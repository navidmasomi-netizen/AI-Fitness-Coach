import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import prisma from "../lib/prisma.js";
import { DAY_TEMPLATE_MAP, humanizeDayType } from "./dayTemplates.js";
import { buildExplanation } from "./explanationBuilder.js";
import {
  buildProgramPlan,
  generateProgramForUser,
  persistProgramPlan,
} from "./programGenerator.js";
import { resolvePrescription } from "./volumeResolver.js";

const REPO_ROOT = "/Users/user/Desktop/AI-Fitness-Coach";

function printCaseResult({ name, input, actual, status, error }) {
  console.log(`CASE: ${name}`);
  console.log(`INPUT: ${JSON.stringify(input)}`);
  if (actual !== undefined) {
    console.log(`ACTUAL: ${JSON.stringify(actual)}`);
  }
  if (error) {
    console.log(`ERROR: ${error}`);
  }
  console.log(`RESULT: ${status}`);
  console.log("---");
}

function buildCompleteProfileData(overrides = {}) {
  return {
    goal: "hypertrophy",
    trainingLevel: "intermediate",
    trainingDaysPerWeek: 4,
    sessionDurationMin: 60,
    equipmentAccess: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"],
    age: 30,
    sex: "male",
    heightCm: 178,
    weightKg: 78,
    occupationType: "desk",
    recoveryQuality: "medium",
    nutritionHabits: "balanced",
    mealFrequency: 3,
    supplementUse: [],
    cardioPreference: "walking",
    injuryFlags: ["none"],
    injuryNotes: null,
    preferredLanguage: "en",
    timezone: "UTC",
    units: "metric",
    wizardCompleted: true,
    wizardCompletedAt: new Date(),
    lastCompletedStep: 20,
    ...overrides,
  };
}

async function createTestUser({ profileData } = {}) {
  const unique = `${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const user = await prisma.user.create({
    data: {
      email: `phase4_${unique}@example.com`,
      name: `Phase4 ${unique}`,
    },
  });

  if (profileData) {
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        ...profileData,
      },
    });
  }

  return user;
}

async function cleanupUserArtifacts(userId) {
  const userPrograms = await prisma.userProgram.findMany({
    where: { userId },
    select: { programId: true },
  });

  if (userPrograms.length > 0) {
    await prisma.userProgram.deleteMany({
      where: { userId },
    });

    const programIds = [...new Set(userPrograms.map((entry) => entry.programId))];
    await prisma.program.deleteMany({
      where: { id: { in: programIds } },
    });
  }

  await prisma.userProfile.deleteMany({
    where: { userId },
  });

  await prisma.user.delete({
    where: { id: userId },
  });
}

async function getActiveUserProgram(userId) {
  return prisma.userProgram.findFirst({
    where: { userId, isActive: true },
  });
}

async function createArchivedUserProgram(userId) {
  const program = await prisma.program.create({
    data: {
      name: `Archived Program ${userId} ${Date.now()}`,
      description: "Archived compatibility fixture",
      splitFamily: "upper_lower",
      goal: "hypertrophy",
      isStatic: false,
    },
  });

  const userProgram = await prisma.userProgram.create({
    data: {
      userId,
      programId: program.id,
      currentDayIndex: 0,
      activatedAt: new Date("2026-06-01T09:00:00.000Z"),
      isActive: false,
    },
  });

  return { program, userProgram };
}

async function snapshotCounts() {
  const [program, programDay, programDayExercise, userProgram, userProgramProfileSnapshot, exercise] = await Promise.all([
    prisma.program.count(),
    prisma.programDay.count(),
    prisma.programDayExercise.count(),
    prisma.userProgram.count(),
    prisma.userProgramProfileSnapshot.count(),
    prisma.exercise.count(),
  ]);

  return { program, programDay, programDayExercise, userProgram, userProgramProfileSnapshot, exercise };
}

function summarizeProgram(program) {
  return {
    id: program.id,
    name: program.name,
    description: program.description,
    splitFamily: program.splitFamily,
    goal: program.goal,
    isStatic: program.isStatic,
    days: program.days.map((day) => ({
      dayIndex: day.dayIndex,
      name: day.name,
      exercises: day.exercises.map((exerciseRow) => ({
        order: exerciseRow.order,
        exerciseName: exerciseRow.exercise.nameEn,
        sets: exerciseRow.sets,
        repRangeLow: exerciseRow.repRangeLow,
        repRangeHigh: exerciseRow.repRangeHigh,
        restSeconds: exerciseRow.restSeconds,
      })),
    })),
  };
}

function extractComparablePlan({ splitResult, plannedDays }) {
  return {
    splitFamily: splitResult.splitFamily,
    splitName: splitResult.splitName,
    dayTypes: plannedDays.map((day) => day.dayType),
    days: plannedDays.map((day) => ({
      dayType: day.dayType,
      movementPatterns: day.plannedExercises.map((exercise) => exercise.movementPattern),
      exerciseNames: day.plannedExercises.map((exercise) => exercise.exercise.nameEn),
      prescriptions: day.plannedExercises.map((exercise) => ({
        sets: exercise.prescription.sets,
        repRangeLow: exercise.prescription.repRangeLow,
        repRangeHigh: exercise.prescription.repRangeHigh,
        restSeconds: exercise.prescription.restSeconds,
      })),
    })),
  };
}

const exercises = await prisma.exercise.findMany({
  orderBy: { id: "asc" },
});

const baselineFailedCaseCounts = await snapshotCounts();
let passed = 0;
let failed = 0;

const cases = [
  {
    name: "1. completed-profile user with no UserProgram generates successfully",
    input: { type: "success" },
    run: async () => {
      const user = await createTestUser({
        profileData: buildCompleteProfileData(),
      });

      try {
        const program = await generateProgramForUser(user.id);
        assert.ok(program);
        assert.ok(program.days.length > 0);
        return summarizeProgram(program);
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "1a. successful generation creates exactly one profile snapshot matching the input profile",
    input: { profileSnapshot: true },
    run: async () => {
      const profileData = buildCompleteProfileData({
        goal: "strength",
        trainingDaysPerWeek: 5,
        equipmentAccess: ["barbell", "machine", "cable"],
        injuryFlags: ["shoulder", "wrist"],
      });
      const user = await createTestUser({
        profileData,
      });

      try {
        const program = await generateProgramForUser(user.id);
        const generatedUserProgram = await prisma.userProgram.findFirstOrThrow({
          where: { userId: user.id, isActive: true },
        });
        const snapshot = await prisma.userProgramProfileSnapshot.findUnique({
          where: { userProgramId: generatedUserProgram.id },
        });

        assert.ok(program);
        assert(snapshot);
        assert.equal(snapshot.userProgramId, generatedUserProgram.id);
        assert.equal(snapshot.goal, profileData.goal);
        assert.deepEqual(snapshot.equipmentAccess, profileData.equipmentAccess);
        assert.deepEqual(snapshot.injuryFlags, profileData.injuryFlags);
        assert.equal(snapshot.trainingDaysPerWeek, profileData.trainingDaysPerWeek);

        return {
          userProgramId: generatedUserProgram.id,
          snapshot,
        };
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "2. incomplete profile rejects before generation",
    input: { wizardCompleted: false },
    run: async () => {
      const before = await snapshotCounts();
      const user = await createTestUser({
        profileData: buildCompleteProfileData({ wizardCompleted: false, wizardCompletedAt: null }),
      });

      try {
        await assert.rejects(
          () => generateProgramForUser(user.id),
          /User profile wizard is not completed/
        );
        const after = await snapshotCounts();
        assert.deepEqual(after, before);
        return { before, after };
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "3. missing profile rejects before generation",
    input: { profile: null },
    run: async () => {
      const before = await snapshotCounts();
      const user = await createTestUser();

      try {
        await assert.rejects(() => generateProgramForUser(user.id), /User profile not found/);
        const after = await snapshotCounts();
        assert.deepEqual(after, before);
        return { before, after };
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "4. existing UserProgram rejects and keeps existing linkage untouched",
    input: { duplicate: true },
    run: async () => {
      const user = await createTestUser({
        profileData: buildCompleteProfileData(),
      });

      try {
        const firstProgram = await generateProgramForUser(user.id);
        const beforeUserProgram = await getActiveUserProgram(user.id);
        const beforeSnapshot = await prisma.userProgramProfileSnapshot.findUnique({
          where: { userProgramId: beforeUserProgram.id },
        });
        const beforeProgramCount = await prisma.program.count();

        await assert.rejects(() => generateProgramForUser(user.id), /Program already active/);

        const afterUserProgram = await getActiveUserProgram(user.id);
        const afterSnapshot = await prisma.userProgramProfileSnapshot.findUnique({
          where: { userProgramId: beforeUserProgram.id },
        });
        const afterProgramCount = await prisma.program.count();

        assert(beforeUserProgram);
        assert(afterUserProgram);
        assert.equal(afterUserProgram.id, beforeUserProgram.id);
        assert.equal(afterUserProgram.programId, beforeUserProgram.programId);
        assert(beforeSnapshot);
        assert(afterSnapshot);
        assert.equal(beforeSnapshot.id, afterSnapshot.id);
        assert.equal(afterProgramCount, beforeProgramCount);

        return {
          firstProgramId: firstProgram.id,
          userProgramId: beforeUserProgram.id,
          profileSnapshotId: beforeSnapshot.id,
          programId: beforeUserProgram.programId,
          beforeProgramCount,
          afterProgramCount,
        };
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "4a. first-time generation succeeds when only archived UserProgram rows exist",
    input: { archivedRowsDoNotBlock: true },
    run: async () => {
      const user = await createTestUser({
        profileData: buildCompleteProfileData(),
      });

      try {
        const archived = await createArchivedUserProgram(user.id);
        const program = await generateProgramForUser(user.id);
        const userPrograms = await prisma.userProgram.findMany({
          where: { userId: user.id },
          orderBy: { id: "asc" },
        });
        const activeUserProgram = await getActiveUserProgram(user.id);
        const snapshots = await prisma.userProgramProfileSnapshot.findMany({
          where: {
            userProgram: {
              userId: user.id,
            },
          },
          orderBy: { id: "asc" },
        });

        assert.equal(userPrograms.length, 2);
        assert(activeUserProgram);
        assert.equal(activeUserProgram.programId, program.id);
        assert.equal(userPrograms.filter((entry) => entry.isActive === false).length, 1);
        assert.equal(userPrograms.filter((entry) => entry.isActive === true).length, 1);
        assert.equal(snapshots.length, 1);

        return {
          archivedUserProgramId: archived.userProgram.id,
          activeUserProgramId: activeUserProgram.id,
          activeProgramId: program.id,
          totalUserPrograms: userPrograms.length,
          snapshotCount: snapshots.length,
        };
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "4b. generation still rejects when an active row exists even if archived rows also exist",
    input: { activeRowStillBlocks: true },
    run: async () => {
      const user = await createTestUser({
        profileData: buildCompleteProfileData(),
      });

      try {
        const archived = await createArchivedUserProgram(user.id);
        const firstProgram = await generateProgramForUser(user.id);
        const beforeActiveUserProgram = await getActiveUserProgram(user.id);
        const beforeSnapshots = await prisma.userProgramProfileSnapshot.findMany({
          where: {
            userProgram: {
              userId: user.id,
            },
          },
        });

        await assert.rejects(() => generateProgramForUser(user.id), /Program already active/);

        const afterActiveUserProgram = await getActiveUserProgram(user.id);
        const afterUserPrograms = await prisma.userProgram.findMany({
          where: { userId: user.id },
        });
        const afterSnapshots = await prisma.userProgramProfileSnapshot.findMany({
          where: {
            userProgram: {
              userId: user.id,
            },
          },
        });

        assert(beforeActiveUserProgram);
        assert(afterActiveUserProgram);
        assert.equal(afterActiveUserProgram.id, beforeActiveUserProgram.id);
        assert.equal(afterActiveUserProgram.programId, beforeActiveUserProgram.programId);
        assert.equal(afterUserPrograms.filter((entry) => entry.isActive === true).length, 1);
        assert.equal(afterUserPrograms.filter((entry) => entry.isActive === false).length, 1);
        assert.equal(afterSnapshots.length, beforeSnapshots.length);

        return {
          archivedUserProgramId: archived.userProgram.id,
          firstProgramId: firstProgram.id,
          activeUserProgramId: afterActiveUserProgram.id,
          userProgramCount: afterUserPrograms.length,
          snapshotCount: afterSnapshots.length,
        };
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "5. generated Program.isStatic is false",
    input: { isStatic: false },
    run: async () => {
      const user = await createTestUser({
        profileData: buildCompleteProfileData(),
      });

      try {
        const program = await generateProgramForUser(user.id);
        assert.equal(program.isStatic, false);
        return { isStatic: program.isStatic, name: program.name };
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "6. Program.description includes personalization, v1.0, and omission diagnostics",
    input: { omissionDescription: true },
    run: async () => {
      const user = await createTestUser({
        profileData: buildCompleteProfileData({
          trainingDaysPerWeek: 4,
          trainingLevel: "beginner",
          equipmentAccess: ["barbell", "dumbbell", "bodyweight"],
        }),
      });

      try {
        const program = await generateProgramForUser(user.id);
        assert.match(program.description, /Generated by AI-Fitness-Coach Program Generator v1.0/);
        assert.match(program.description, /Equipment adaptation: barbell, dumbbell, bodyweight/);
        assert.match(program.description, /Accessory omissions:/);
        return { description: program.description };
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "7. ProgramDay count matches splitResolver count logic including recovery day",
    input: { sevenDayPlan: true },
    run: async () => {
      const profile = buildCompleteProfileData({
        trainingDaysPerWeek: 7,
        trainingLevel: "intermediate",
        goal: "hypertrophy",
        recoveryQuality: "high",
      });

      const user = await createTestUser({ profileData: profile });

      try {
        const plan = buildProgramPlan({ profile, exercises });
        const program = await generateProgramForUser(user.id);
        const expectedCount =
          plan.splitResult.numberOfTrainingDays + (plan.splitResult.recoveryOrCardioDay ? 1 : 0);
        assert.equal(program.days.length, expectedCount);
        return {
          splitDayTypes: plan.splitResult.dayTypes,
          numberOfTrainingDays: plan.splitResult.numberOfTrainingDays,
          recoveryOrCardioDay: plan.splitResult.recoveryOrCardioDay,
          expectedCount,
          actualCount: program.days.length,
        };
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "8. ProgramDay ordering and dayType-derived names match resolved plan",
    input: { ordering: true },
    run: async () => {
      const profile = buildCompleteProfileData({
        trainingDaysPerWeek: 5,
        trainingLevel: "advanced",
      });
      const user = await createTestUser({ profileData: profile });

      try {
        const plan = buildProgramPlan({ profile, exercises });
        const program = await generateProgramForUser(user.id);
        const persistedDaySummary = program.days.map((day) => ({
          dayIndex: day.dayIndex,
          name: day.name,
        }));
        const expectedDaySummary = plan.plannedDays.map((day) => ({
          dayIndex: day.dayIndex,
          name: humanizeDayType(day.dayType),
        }));
        assert.deepEqual(persistedDaySummary, expectedDaySummary);
        return { expectedDaySummary, persistedDaySummary };
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "9. every generated exercise respects equipmentAccess",
    input: { equipmentSafety: true },
    run: async () => {
      const profile = buildCompleteProfileData({
        equipmentAccess: ["barbell", "dumbbell", "bodyweight", "pull_up_bar"],
      });
      const user = await createTestUser({ profileData: profile });

      try {
        const program = await generateProgramForUser(user.id);
        for (const day of program.days) {
          for (const row of day.exercises) {
            assert.ok(profile.equipmentAccess.includes(row.exercise.equipment));
          }
        }
        return summarizeProgram(program);
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "10. every generated exercise respects injuryFlags",
    input: { injurySafety: true },
    run: async () => {
      const profile = buildCompleteProfileData({
        injuryFlags: ["lower_back", "wrist"],
      });
      const user = await createTestUser({ profileData: profile });

      try {
        const program = await generateProgramForUser(user.id);
        for (const day of program.days) {
          for (const row of day.exercises) {
            assert.ok(!row.exercise.jointStressFlags.includes("lower_back_stress"));
            assert.ok(!row.exercise.jointStressFlags.includes("wrist_stress"));
          }
        }
        return summarizeProgram(program);
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "11. every persisted prescription matches volumeResolver independently",
    input: { prescriptionVerification: true },
    run: async () => {
      const profile = buildCompleteProfileData({
        trainingDaysPerWeek: 5,
        trainingLevel: "advanced",
        goal: "strength",
        recoveryQuality: "high",
        sessionDurationMin: 75,
      });
      const user = await createTestUser({ profileData: profile });

      try {
        const plan = buildProgramPlan({ profile, exercises });
        const program = await generateProgramForUser(user.id);
        for (const day of plan.plannedDays) {
          const persistedDay = program.days.find((programDay) => programDay.dayIndex === day.dayIndex);
          for (const plannedExercise of day.plannedExercises) {
            const persistedExercise = persistedDay.exercises.find(
              (row) => row.order === plannedExercise.order
            );
            const expectedPrescription = resolvePrescription({
              goal: profile.goal,
              trainingLevel: profile.trainingLevel,
              recoveryQuality: profile.recoveryQuality,
              sessionDurationMin: profile.sessionDurationMin,
              slotType: plannedExercise.slotType,
              exerciseComplexity: plannedExercise.exercise.complexity,
            });
            assert.equal(persistedExercise.sets, expectedPrescription.sets);
            assert.equal(persistedExercise.repRangeLow, expectedPrescription.repRangeLow);
            assert.equal(persistedExercise.repRangeHigh, expectedPrescription.repRangeHigh);
            assert.equal(persistedExercise.restSeconds, expectedPrescription.restSeconds);
          }
        }
        return summarizeProgram(program);
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "12. slotType is taken from day templates and not inferred from complexity",
    input: { accessoryCompound: true },
    run: async () => {
      const profile = buildCompleteProfileData({
        trainingDaysPerWeek: 5,
        trainingLevel: "advanced",
      });
      const plan = buildProgramPlan({ profile, exercises });
      const weakPointDay = plan.plannedDays.find((day) => day.dayType === "weak_point_or_conditioning");
      assert.ok(weakPointDay);
      assert.ok(
        weakPointDay.plannedExercises.some(
          (exercise) =>
            exercise.slotType === "accessory" && exercise.exercise.complexity === "compound"
        )
      );
      const accessoryCompoundExercise = weakPointDay.plannedExercises.find(
        (exercise) =>
          exercise.slotType === "accessory" && exercise.exercise.complexity === "compound"
      );
      assert.ok(accessoryCompoundExercise.prescription.repRangeLow >= 8);
      return {
        dayType: weakPointDay.dayType,
        plannedExercises: weakPointDay.plannedExercises.map((exercise) => ({
          movementPattern: exercise.movementPattern,
          slotType: exercise.slotType,
          exerciseName: exercise.exercise.nameEn,
          complexity: exercise.exercise.complexity,
          repRangeLow: exercise.prescription.repRangeLow,
          repRangeHigh: exercise.prescription.repRangeHigh,
        })),
      };
    },
  },
  {
    name: "13. accessory no-candidate omits slot and generation still succeeds",
    input: { accessoryOmission: true },
    run: async () => {
      const profile = buildCompleteProfileData({
        trainingDaysPerWeek: 4,
        trainingLevel: "beginner",
        equipmentAccess: ["barbell", "dumbbell", "bodyweight"],
      });
      const user = await createTestUser({ profileData: profile });

      try {
        const plan = buildProgramPlan({ profile, exercises });
        const program = await generateProgramForUser(user.id);
        const upperDay = plan.plannedDays.find((day) => day.dayType === "upper_a");
        assert.ok(!upperDay.plannedExercises.some((exercise) => exercise.movementPattern === "vertical_pull"));
        assert.match(program.description, /Accessory omissions:/);
        return {
          description: program.description,
          upperDay: {
            dayType: upperDay.dayType,
            keptMovementPatterns: upperDay.plannedExercises.map((exercise) => exercise.movementPattern),
          },
        };
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "14. primary no-candidate rejects cleanly with zero rows created",
    input: { primaryFailure: true },
    run: async () => {
      const before = await snapshotCounts();
      const profile = buildCompleteProfileData({
        trainingDaysPerWeek: 1,
        equipmentAccess: ["machine"],
      });
      const user = await createTestUser({ profileData: profile });

      try {
        await assert.rejects(
          () => generateProgramForUser(user.id),
          /Program generation failed for primary slot/
        );
        const after = await snapshotCounts();
        assert.deepEqual(after, before);
        return { before, after };
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "15. transaction rollback leaves counts unchanged after forced nested write failure",
    input: { rollback: true },
    run: async () => {
      const before = await snapshotCounts();
      const profile = buildCompleteProfileData();
      const user = await createTestUser({ profileData: profile });

      try {
        const plan = buildProgramPlan({ profile, exercises });
        const invalidPlannedDays = plan.plannedDays.map((day) => ({
          ...day,
          plannedExercises: day.plannedExercises.map((exercise, index) =>
            day.dayIndex === 0 && index === 0
              ? { ...exercise, exercise: { ...exercise.exercise, id: 99999999 } }
              : exercise
          ),
        }));

        const description = buildExplanation({
          splitResult: plan.splitResult,
          profile,
          diagnostics: plan.diagnostics,
        });

        await assert.rejects(
          () =>
            prisma.$transaction((tx) =>
              persistProgramPlan({
                tx,
                userId: user.id,
                splitResult: plan.splitResult,
                plannedDays: invalidPlannedDays,
                description,
                goal: profile.goal,
                equipmentAccess: profile.equipmentAccess,
                injuryFlags: profile.injuryFlags,
                trainingDaysPerWeek: profile.trainingDaysPerWeek,
              })
            ),
          /Foreign key constraint|Record to update not found|violates foreign key constraint|An operation failed/
        );

        const orphanedSnapshots = await prisma.userProgramProfileSnapshot.findMany({
          where: {
            userProgram: {
              userId: user.id,
            },
          },
        });
        const after = await snapshotCounts();
        assert.equal(orphanedSnapshots.length, 0);
        assert.deepEqual(after, before);
        return { before, after, orphanedSnapshotsCount: orphanedSnapshots.length };
      } finally {
        await cleanupUserArtifacts(user.id);
      }
    },
  },
  {
    name: "16. pre-existing Program and UserProgram data stay unchanged after failed cases",
    input: { failedCasesBaseline: true },
    run: async () => {
      const afterFailedCases = await snapshotCounts();
      assert.deepEqual(afterFailedCases, baselineFailedCaseCounts);
      return { before: baselineFailedCaseCounts, after: afterFailedCases };
    },
  },
  {
    name: "17. identical profiles across two users produce identical planned structure",
    input: { deterministic: true },
    run: async () => {
      const profile = buildCompleteProfileData({
        trainingDaysPerWeek: 5,
        trainingLevel: "advanced",
        goal: "strength",
        recoveryQuality: "high",
        sessionDurationMin: 75,
      });
      const firstUser = await createTestUser({ profileData: profile });
      const secondUser = await createTestUser({ profileData: profile });

      try {
        const firstPlan = buildProgramPlan({ profile, exercises });
        const secondPlan = buildProgramPlan({ profile, exercises });
        assert.deepEqual(extractComparablePlan(firstPlan), extractComparablePlan(secondPlan));

        const firstProgram = await generateProgramForUser(firstUser.id);
        const secondProgram = await generateProgramForUser(secondUser.id);

        assert.deepEqual(extractComparablePlan(firstPlan), extractComparablePlan(secondPlan));

        return {
          first: summarizeProgram(firstProgram),
          second: summarizeProgram(secondProgram),
          comparablePlan: extractComparablePlan(firstPlan),
        };
      } finally {
        await cleanupUserArtifacts(firstUser.id);
        await cleanupUserArtifacts(secondUser.id);
      }
    },
  },
  {
    name: "18. no route, mobile, schema, or migration file was touched",
    input: { workingTreeScope: true },
    run: async () => {
      const statusOutput = execFileSync("git", ["-C", REPO_ROOT, "status", "--short"], {
        encoding: "utf8",
      });
      const changedPaths = statusOutput
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => line.slice(3));

      const forbiddenTouched = changedPaths.filter(
        (path) =>
          path.startsWith("mobile/") ||
          path.startsWith("backend/src/routes/") ||
          path === "backend/prisma/schema.prisma" ||
          path.startsWith("backend/prisma/migrations/")
      );

      assert.deepEqual(forbiddenTouched, []);
      return { changedPaths, forbiddenTouched };
    },
  },
];

for (const testCase of cases) {
  try {
    const actual = await testCase.run();
    passed += 1;
    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      actual,
      status: "PASS",
    });
  } catch (error) {
    failed += 1;
    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      status: "FAIL",
      error: error instanceof Error ? error.stack : String(error),
    });
  }
}

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${passed + failed} total`);

await prisma.$disconnect();

if (failed > 0) {
  process.exitCode = 1;
}

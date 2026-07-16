import assert from "node:assert/strict";

import prisma from "../lib/prisma.js";
import { buildExplanation } from "./explanationBuilder.js";
import {
  buildProgramPlan,
  generateProgramForUser,
} from "./programGenerator.js";
import {
  __persistRegeneratedProgramForTests,
  regenerateProgramForUser,
} from "./regenerationService.js";

const TEST_EMAIL_DOMAIN = "@example.com";

function serializeForLog(value) {
  return JSON.stringify(
    value,
    (key, currentValue) => {
      if (currentValue instanceof Date) {
        return currentValue.toISOString();
      }
      return currentValue;
    },
    2
  );
}

function printCaseStart(name, input) {
  console.log(`CASE: ${name}`);
  console.log(`INPUT: ${serializeForLog(input)}`);
}

function printCaseResult(passed, actual, error) {
  if (typeof actual !== "undefined") {
    console.log(`ACTUAL: ${serializeForLog(actual)}`);
  }
  if (error) {
    console.log(`ERROR: ${error.stack || error.message}`);
  }
  console.log(`RESULT: ${passed ? "PASS" : "FAIL"}`);
  console.log("---");
}

async function runCase(name, input, fn) {
  printCaseStart(name, input);
  try {
    const actual = await fn();
    printCaseResult(true, actual);
    return true;
  } catch (error) {
    printCaseResult(false, undefined, error);
    return false;
  }
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

async function createTestUser({ profileData, suffix }) {
  const user = await prisma.user.create({
    data: {
      email: `regeneration-service-${suffix}${TEST_EMAIL_DOMAIN}`,
      name: `Regeneration Service ${suffix}`,
      password: "hashed-password",
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
  const sessions = await prisma.workoutSession.findMany({
    where: { userId },
    select: { id: true },
  });
  const sessionIds = sessions.map((session) => session.id);

  if (sessionIds.length > 0) {
    await prisma.progressionRecommendation.deleteMany({
      where: {
        OR: [
          { userId },
          { sourceSessionId: { in: sessionIds } },
        ],
      },
    });
  } else {
    await prisma.progressionRecommendation.deleteMany({
      where: { userId },
    });
  }

  await prisma.setLog.deleteMany({
    where: {
      session: {
        userId,
      },
    },
  });
  await prisma.workoutSession.deleteMany({ where: { userId } });

  const userPrograms = await prisma.userProgram.findMany({
    where: { userId },
    select: { programId: true },
  });
  const programIds = [...new Set(userPrograms.map((entry) => entry.programId))];

  await prisma.userProgram.deleteMany({ where: { userId } });

  if (programIds.length > 0) {
    const dynamicPrograms = await prisma.program.findMany({
      where: {
        id: { in: programIds },
        isStatic: false,
      },
      select: { id: true },
    });
    const dynamicProgramIds = dynamicPrograms.map((entry) => entry.id);

    if (dynamicProgramIds.length > 0) {
      await prisma.programDayExercise.deleteMany({
        where: {
          programDay: {
            programId: { in: dynamicProgramIds },
          },
        },
      });
      await prisma.programDay.deleteMany({
        where: {
          programId: { in: dynamicProgramIds },
        },
      });
      await prisma.program.deleteMany({
        where: {
          id: { in: dynamicProgramIds },
        },
      });
    }
  }

  await prisma.userProfile.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

async function snapshotCounts() {
  const [
    program,
    programDay,
    programDayExercise,
    userProgram,
    userProgramProfileSnapshot,
    workoutSession,
    setLog,
    progressionRecommendation,
    user,
    userProfile,
  ] = await Promise.all([
    prisma.program.count(),
    prisma.programDay.count(),
    prisma.programDayExercise.count(),
    prisma.userProgram.count(),
    prisma.userProgramProfileSnapshot.count(),
    prisma.workoutSession.count(),
    prisma.setLog.count(),
    prisma.progressionRecommendation.count(),
    prisma.user.count(),
    prisma.userProfile.count(),
  ]);

  return {
    program,
    programDay,
    programDayExercise,
    userProgram,
    userProgramProfileSnapshot,
    workoutSession,
    setLog,
    progressionRecommendation,
    user,
    userProfile,
  };
}

async function getAllUserPrograms(userId) {
  return prisma.userProgram.findMany({
    where: { userId },
    orderBy: { id: "asc" },
  });
}

async function getActiveUserProgram(userId) {
  return prisma.userProgram.findFirst({
    where: { userId, isActive: true },
  });
}

async function getActiveUserProgramOrThrow(userId) {
  return prisma.userProgram.findFirstOrThrow({
    where: { userId, isActive: true },
  });
}

async function getSnapshotsForUser(userId) {
  return prisma.userProgramProfileSnapshot.findMany({
    where: {
      userProgram: {
        userId,
      },
    },
    orderBy: { id: "asc" },
  });
}

async function createArchivedUserProgram(userId) {
  const program = await prisma.program.create({
    data: {
      name: `Archived Program ${userId} ${Date.now()}`,
      description: "Archived regeneration fixture",
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

async function createCompletedHistoryForActiveProgram(userId) {
  const activeUserProgram = await getActiveUserProgramOrThrow(userId);
  const programDay = await prisma.programDay.findFirstOrThrow({
    where: { programId: activeUserProgram.programId },
    orderBy: { dayIndex: "asc" },
  });
  const programDayExercise = await prisma.programDayExercise.findFirstOrThrow({
    where: { programDayId: programDay.id },
    orderBy: { order: "asc" },
  });

  const session = await prisma.workoutSession.create({
    data: {
      userId,
      programId: activeUserProgram.programId,
      programDayId: programDay.id,
      startedAt: new Date("2026-07-10T09:00:00.000Z"),
      completedAt: new Date("2026-07-10T09:45:00.000Z"),
      status: "completed",
    },
  });

  const setLog = await prisma.setLog.create({
    data: {
      sessionId: session.id,
      exerciseId: programDayExercise.exerciseId,
      setNumber: 1,
      weightKg: 40,
      reps: 10,
      loggedAt: new Date("2026-07-10T09:10:00.000Z"),
    },
  });

  const progressionRecommendation = await prisma.progressionRecommendation.create({
    data: {
      userId,
      sourceSessionId: session.id,
      exerciseId: programDayExercise.exerciseId,
      recommendationType: "maintain",
      recommendedWeightKg: 40,
      reason: "History preservation fixture",
    },
  });

  return {
    activeUserProgram,
    programDay,
    programDayExercise,
    session,
    setLog,
    progressionRecommendation,
  };
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

function summarizeComparablePlan({ splitResult, plannedDays, description }) {
  return {
    splitFamily: splitResult.splitFamily,
    splitName: splitResult.splitName,
    description,
    dayTypes: plannedDays.map((day) => day.dayType),
    dayNames: plannedDays.map((day) => day.name),
    firstDayExerciseNames:
      plannedDays[0]?.plannedExercises.map((exercise) => exercise.exercise.nameEn) ?? [],
  };
}

async function main() {
  let passed = 0;
  let failed = 0;

  const beforeCounts = await snapshotCounts();
  console.log(`ROW_COUNTS_BEFORE: ${serializeForLog(beforeCounts)}`);

  const cases = [
    {
      name: "1. successful regeneration archives the old active row and creates a new active program and snapshot",
      input: "initial generated program followed by regenerateProgramForUser(userId)",
      fn: async () => {
        const suffix = `success-${Date.now()}`;
        const profileData = buildCompleteProfileData();
        const user = await createTestUser({ suffix, profileData });

        try {
          const initialProgram = await generateProgramForUser(user.id);
          const oldActiveUserProgram = await getActiveUserProgramOrThrow(user.id);
          const oldSnapshot = await prisma.userProgramProfileSnapshot.findUniqueOrThrow({
            where: { userProgramId: oldActiveUserProgram.id },
          });
          const oldUserProgramState = {
            programId: oldActiveUserProgram.programId,
            currentDayIndex: oldActiveUserProgram.currentDayIndex,
            activatedAt: oldActiveUserProgram.activatedAt.toISOString(),
            isActive: oldActiveUserProgram.isActive,
          };

          const exercises = await prisma.exercise.findMany({
            orderBy: { id: "asc" },
          });
          const expectedPlan = buildProgramPlan({
            profile: profileData,
            exercises,
          });
          const expectedDescription = buildExplanation({
            splitResult: expectedPlan.splitResult,
            profile: profileData,
            diagnostics: expectedPlan.diagnostics,
          });

          const regeneratedProgram = await regenerateProgramForUser(user.id);

          const allUserPrograms = await getAllUserPrograms(user.id);
          const archivedUserProgram = allUserPrograms.find((entry) => entry.id === oldActiveUserProgram.id);
          const newActiveUserProgram = allUserPrograms.find(
            (entry) => entry.isActive === true && entry.id !== oldActiveUserProgram.id
          );
          const snapshots = await getSnapshotsForUser(user.id);
          const newSnapshot = snapshots.find((entry) => entry.userProgramId === newActiveUserProgram.id);
          const oldProgramStillExists = await prisma.program.findUnique({
            where: { id: initialProgram.id },
          });

          assert.equal(allUserPrograms.length, 2);
          assert(archivedUserProgram);
          assert.equal(archivedUserProgram.isActive, false);
          assert.equal(archivedUserProgram.programId, oldUserProgramState.programId);
          assert.equal(archivedUserProgram.currentDayIndex, oldUserProgramState.currentDayIndex);
          assert.equal(archivedUserProgram.activatedAt.toISOString(), oldUserProgramState.activatedAt);

          assert(newActiveUserProgram);
          assert.equal(newActiveUserProgram.isActive, true);
          assert.notEqual(newActiveUserProgram.id, oldActiveUserProgram.id);
          assert.notEqual(newActiveUserProgram.programId, oldActiveUserProgram.programId);

          assert.equal(snapshots.length, 2);
          assert.equal(oldSnapshot.userProgramId, oldActiveUserProgram.id);
          assert(newSnapshot);
          assert.equal(newSnapshot.goal, profileData.goal);
          assert.deepEqual(newSnapshot.equipmentAccess, profileData.equipmentAccess);
          assert.deepEqual(newSnapshot.injuryFlags, profileData.injuryFlags);
          assert.equal(newSnapshot.trainingDaysPerWeek, profileData.trainingDaysPerWeek);

          assert(oldProgramStillExists);
          assert.equal(oldProgramStillExists.id, initialProgram.id);

          assert.equal(regeneratedProgram.id, newActiveUserProgram.programId);
          assert.equal(regeneratedProgram.splitFamily, expectedPlan.splitResult.splitFamily);
          assert.equal(regeneratedProgram.name, expectedPlan.splitResult.splitName);
          assert.equal(regeneratedProgram.description, expectedDescription);
          assert.equal(regeneratedProgram.days.length, expectedPlan.plannedDays.length);
          assert.deepEqual(
            regeneratedProgram.days.map((day) => day.name),
            expectedPlan.plannedDays.map((day) => day.name)
          );
          assert.deepEqual(
            regeneratedProgram.days[0].exercises.map((exerciseRow) => exerciseRow.exercise.nameEn),
            expectedPlan.plannedDays[0].plannedExercises.map((exercise) => exercise.exercise.nameEn)
          );

          return {
            oldUserProgramId: oldActiveUserProgram.id,
            archivedUserProgram,
            newActiveUserProgram,
            oldSnapshot,
            newSnapshot,
            oldProgramStillExists,
            regeneratedProgram: summarizeProgram(regeneratedProgram),
            expectedPlan: summarizeComparablePlan({
              splitResult: expectedPlan.splitResult,
              plannedDays: expectedPlan.plannedDays,
              description: expectedDescription,
            }),
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "2. no active UserProgram exists -> regeneration rejects before any transaction work",
      input: "user with only archived UserProgram rows",
      fn: async () => {
        const suffix = `no-active-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await createArchivedUserProgram(user.id);
          const before = await snapshotCounts();

          await assert.rejects(
            () => regenerateProgramForUser(user.id),
            /No active program to regenerate for user \d+\./
          );

          const after = await snapshotCounts();
          const userPrograms = await getAllUserPrograms(user.id);
          const snapshots = await getSnapshotsForUser(user.id);

          assert.equal(userPrograms.filter((entry) => entry.isActive === true).length, 0);
          assert.equal(snapshots.length, 0);
          assert.deepEqual(after, before);

          return {
            before,
            after,
            userPrograms,
            snapshots,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "3. active WorkoutSession blocks regeneration before any transaction work",
      input: "active session tied to the current active program",
      fn: async () => {
        const suffix = `active-session-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          const initialProgram = await generateProgramForUser(user.id);
          const activeUserProgram = await getActiveUserProgramOrThrow(user.id);
          const firstDay = await prisma.programDay.findFirstOrThrow({
            where: { programId: activeUserProgram.programId },
            orderBy: { dayIndex: "asc" },
          });
          const beforeCounts = await snapshotCounts();

          const activeSession = await prisma.workoutSession.create({
            data: {
              userId: user.id,
              programId: activeUserProgram.programId,
              programDayId: firstDay.id,
              status: "active",
            },
          });

          await assert.rejects(
            () => regenerateProgramForUser(user.id),
            /Cannot regenerate while a workout session is in progress\./
          );

          const afterCounts = await snapshotCounts();
          const afterActiveUserProgram = await getActiveUserProgramOrThrow(user.id);
          const afterUserPrograms = await getAllUserPrograms(user.id);
          const programIds = afterUserPrograms.map((entry) => entry.programId);

          assert.equal(afterActiveUserProgram.id, activeUserProgram.id);
          assert.equal(afterActiveUserProgram.programId, activeUserProgram.programId);
          assert.deepEqual(afterCounts, {
            ...beforeCounts,
            workoutSession: beforeCounts.workoutSession + 1,
          });
          assert.deepEqual(programIds, [initialProgram.id]);

          return {
            activeSession,
            activeUserProgram: afterActiveUserProgram,
            beforeCounts,
            afterCounts,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "4. forced mid-transaction failure rolls back archive + all new rows",
      input: "invalid exerciseId injected before persistProgramPlan inside the transaction",
      fn: async () => {
        const suffix = `rollback-${Date.now()}`;
        const profileData = buildCompleteProfileData();
        const user = await createTestUser({ suffix, profileData });

        try {
          await generateProgramForUser(user.id);
          const activeUserProgram = await getActiveUserProgramOrThrow(user.id);
          const exercises = await prisma.exercise.findMany({
            orderBy: { id: "asc" },
          });
          const { splitResult, plannedDays, diagnostics } = buildProgramPlan({
            profile: profileData,
            exercises,
          });
          const invalidPlannedDays = plannedDays.map((day, dayIndex) => ({
            ...day,
            plannedExercises: day.plannedExercises.map((exercise, exerciseIndex) =>
              dayIndex === 0 && exerciseIndex === 0
                ? {
                    ...exercise,
                    exercise: {
                      ...exercise.exercise,
                      id: 99999999,
                    },
                  }
                : exercise
            ),
          }));
          const description = buildExplanation({
            splitResult,
            profile: profileData,
            diagnostics,
          });
          const before = await snapshotCounts();

          await assert.rejects(
            () =>
              __persistRegeneratedProgramForTests({
                userId: user.id,
                activeUserProgramId: activeUserProgram.id,
                profile: profileData,
                splitResult,
                plannedDays: invalidPlannedDays,
                description,
              }),
            /Foreign key constraint|Record to update not found|violates foreign key constraint|An operation failed/
          );

          const after = await snapshotCounts();
          const afterActiveUserProgram = await getActiveUserProgramOrThrow(user.id);
          const allUserPrograms = await getAllUserPrograms(user.id);
          const snapshots = await getSnapshotsForUser(user.id);

          assert.equal(afterActiveUserProgram.id, activeUserProgram.id);
          assert.equal(afterActiveUserProgram.isActive, true);
          assert.equal(allUserPrograms.length, 1);
          assert.equal(snapshots.length, 1);
          assert.deepEqual(
            {
              program: after.program,
              programDay: after.programDay,
              programDayExercise: after.programDayExercise,
              userProgram: after.userProgram,
              userProgramProfileSnapshot: after.userProgramProfileSnapshot,
            },
            {
              program: before.program,
              programDay: before.programDay,
              programDayExercise: before.programDayExercise,
              userProgram: before.userProgram,
              userProgramProfileSnapshot: before.userProgramProfileSnapshot,
            }
          );

          return {
            before: {
              program: before.program,
              programDay: before.programDay,
              programDayExercise: before.programDayExercise,
              userProgram: before.userProgram,
              userProgramProfileSnapshot: before.userProgramProfileSnapshot,
            },
            after: {
              program: after.program,
              programDay: after.programDay,
              programDayExercise: after.programDayExercise,
              userProgram: after.userProgram,
              userProgramProfileSnapshot: after.userProgramProfileSnapshot,
            },
            activeUserProgramAfterRollback: afterActiveUserProgram,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "5. concurrent regeneration -> exactly one succeeds and the loser gets a classified domain error",
      input: "Promise.allSettled on two simultaneous regenerateProgramForUser(userId) calls",
      fn: async () => {
        const suffix = `concurrency-${Date.now()}`;
        const profileData = buildCompleteProfileData();
        const user = await createTestUser({ suffix, profileData });

        try {
          await generateProgramForUser(user.id);

          const results = await Promise.allSettled([
            regenerateProgramForUser(user.id),
            regenerateProgramForUser(user.id),
          ]);

          const fulfilled = results.filter((result) => result.status === "fulfilled");
          const rejected = results.filter((result) => result.status === "rejected");
          const userPrograms = await getAllUserPrograms(user.id);
          const activeRows = userPrograms.filter((entry) => entry.isActive === true);
          const archivedRows = userPrograms.filter((entry) => entry.isActive === false);
          const snapshots = await getSnapshotsForUser(user.id);

          assert.equal(fulfilled.length, 1);
          assert.equal(rejected.length, 1);
          assert.match(
            rejected[0].reason.message,
            /Program regeneration already in progress for user \d+\./
          );
          assert.equal(activeRows.length, 1);
          assert.equal(archivedRows.length, 1);
          assert.equal(userPrograms.length, 2);
          assert.equal(snapshots.length, 2);

          return {
            results: results.map((result) =>
              result.status === "fulfilled"
                ? {
                    status: result.status,
                    value: {
                      id: result.value.id,
                      splitFamily: result.value.splitFamily,
                      programId: result.value.userProgram?.id ?? null,
                    },
                  }
                : {
                    status: result.status,
                    reason: {
                      message: result.reason.message,
                      name: result.reason.name,
                    },
                  }
            ),
            userPrograms,
            snapshots,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "6. workout and progression history remain intact after regeneration",
      input: "completed WorkoutSession, SetLog, and ProgressionRecommendation tied to the old program",
      fn: async () => {
        const suffix = `history-${Date.now()}`;
        const profileData = buildCompleteProfileData();
        const user = await createTestUser({ suffix, profileData });

        try {
          await generateProgramForUser(user.id);
          const history = await createCompletedHistoryForActiveProgram(user.id);

          await regenerateProgramForUser(user.id);

          const preservedSession = await prisma.workoutSession.findUniqueOrThrow({
            where: { id: history.session.id },
          });
          const preservedSetLog = await prisma.setLog.findUniqueOrThrow({
            where: { id: history.setLog.id },
          });
          const preservedRecommendation = await prisma.progressionRecommendation.findUniqueOrThrow({
            where: { id: history.progressionRecommendation.id },
          });

          assert.equal(preservedSession.programId, history.session.programId);
          assert.equal(preservedSession.programDayId, history.session.programDayId);
          assert.equal(preservedSetLog.sessionId, history.session.id);
          assert.equal(preservedSetLog.exerciseId, history.setLog.exerciseId);
          assert.equal(preservedRecommendation.sourceSessionId, history.session.id);
          assert.equal(preservedRecommendation.exerciseId, history.progressionRecommendation.exerciseId);

          return {
            preservedSession,
            preservedSetLog,
            preservedRecommendation,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "7. regenerated program matches the same generator-core planning behavior for an equivalent profile",
      input: "compare regenerated program against independent buildProgramPlan/buildExplanation outputs",
      fn: async () => {
        const suffix = `correctness-${Date.now()}`;
        const profileData = buildCompleteProfileData({
          goal: "strength",
          trainingDaysPerWeek: 5,
          trainingLevel: "advanced",
          recoveryQuality: "high",
          equipmentAccess: ["barbell", "machine", "cable", "bodyweight", "pull_up_bar"],
        });
        const user = await createTestUser({ suffix, profileData });

        try {
          await generateProgramForUser(user.id);
          const regeneratedProgram = await regenerateProgramForUser(user.id);
          const exercises = await prisma.exercise.findMany({
            orderBy: { id: "asc" },
          });
          const expectedPlan = buildProgramPlan({
            profile: profileData,
            exercises,
          });
          const expectedDescription = buildExplanation({
            splitResult: expectedPlan.splitResult,
            profile: profileData,
            diagnostics: expectedPlan.diagnostics,
          });

          assert.equal(regeneratedProgram.splitFamily, expectedPlan.splitResult.splitFamily);
          assert.equal(regeneratedProgram.name, expectedPlan.splitResult.splitName);
          assert.equal(regeneratedProgram.description, expectedDescription);
          assert.equal(regeneratedProgram.days.length, expectedPlan.plannedDays.length);
          assert.deepEqual(
            regeneratedProgram.days.map((day) => ({
              dayIndex: day.dayIndex,
              name: day.name,
            })),
            expectedPlan.plannedDays.map((day) => ({
              dayIndex: day.dayIndex,
              name: day.name,
            }))
          );
          assert.deepEqual(
            regeneratedProgram.days.map((day) =>
              day.exercises.map((exerciseRow) => exerciseRow.exercise.nameEn)
            ),
            expectedPlan.plannedDays.map((day) =>
              day.plannedExercises.map((exercise) => exercise.exercise.nameEn)
            )
          );

          return {
            regeneratedProgram: summarizeProgram(regeneratedProgram),
            expectedPlan: summarizeComparablePlan({
              splitResult: expectedPlan.splitResult,
              plannedDays: expectedPlan.plannedDays,
              description: expectedDescription,
            }),
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
  ];

  for (const testCase of cases) {
    const ok = await runCase(testCase.name, testCase.input, testCase.fn);
    if (ok) passed += 1;
    else failed += 1;
  }

  const afterCounts = await snapshotCounts();
  console.log(`ROW_COUNTS_AFTER: ${serializeForLog(afterCounts)}`);
  assert.deepEqual(afterCounts, beforeCounts);

  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  await prisma.$disconnect();

  if (failed > 0) {
    process.exitCode = 1;
  }
}

await main();

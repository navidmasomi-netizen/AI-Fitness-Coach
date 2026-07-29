import assert from "node:assert/strict";

import prisma from "../lib/prisma.js";
import { generateProgramForUser } from "./programGenerator.js";
import { evaluateProgression } from "./progression.js";

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

async function cleanupUserArtifacts(userId) {
  const recommendationSessions = await prisma.workoutSession.findMany({
    where: { userId },
    select: { id: true },
  });

  const sessionIds = recommendationSessions.map((session) => session.id);

  if (sessionIds.length > 0) {
    await prisma.progressionRecommendation.deleteMany({
      where: { sourceSessionId: { in: sessionIds } },
    });
  }

  await prisma.progressionRecommendation.deleteMany({ where: { userId } });
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

  await prisma.userProgram.deleteMany({ where: { userId } });

  const programIds = userPrograms.map((entry) => entry.programId);
  if (programIds.length > 0) {
    await prisma.programDayExercise.deleteMany({
      where: {
        programDay: {
          programId: { in: programIds },
        },
      },
    });
    await prisma.programDay.deleteMany({
      where: { programId: { in: programIds } },
    });
    await prisma.program.deleteMany({ where: { id: { in: programIds } } });
  }

  await prisma.userProfile.deleteMany({ where: { userId } });
  await prisma.user.deleteMany({ where: { id: userId } });
}

async function createTestUser({ profileData, suffix }) {
  const user = await prisma.user.create({
    data: {
      email: `progression-v3-${suffix}${TEST_EMAIL_DOMAIN}`,
      name: `Progression V3 ${suffix}`,
      password: "hashed-password",
    },
  });

  if (profileData) {
    await prisma.userProfile.create({
      data: {
        userId: user.id,
        goal: profileData.goal ?? "hypertrophy",
        trainingLevel: profileData.trainingLevel ?? "beginner",
        trainingDaysPerWeek: profileData.trainingDaysPerWeek ?? 4,
        sessionDurationMin: profileData.sessionDurationMin ?? 60,
        equipmentAccess:
          profileData.equipmentAccess ??
          ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"],
        age: profileData.age ?? 30,
        sex: profileData.sex ?? "male",
        heightCm: profileData.heightCm ?? 178,
        weightKg: profileData.weightKg ?? 78,
        occupationType: profileData.occupationType ?? "desk",
        recoveryQuality: profileData.recoveryQuality ?? "medium",
        nutritionHabits: profileData.nutritionHabits ?? "balanced",
        mealFrequency: profileData.mealFrequency ?? 3,
        supplementUse: profileData.supplementUse ?? ["none"],
        cardioPreference: profileData.cardioPreference ?? "walking",
        injuryFlags: profileData.injuryFlags ?? ["none"],
        injuryNotes: profileData.injuryNotes ?? null,
        preferredLanguage: profileData.preferredLanguage ?? "en",
        timezone: profileData.timezone ?? "UTC",
        units: profileData.units ?? "metric",
        wizardCompleted: profileData.wizardCompleted ?? true,
        wizardCompletedAt: profileData.wizardCompletedAt ?? new Date(),
        lastCompletedStep: profileData.lastCompletedStep ?? 20,
      },
    });
  }

  return user;
}

async function getActiveUserProgram(userId) {
  return prisma.userProgram.findFirstOrThrow({
    where: { userId, isActive: true },
  });
}

async function updateActiveUserProgram(userId, data) {
  const activeUserProgram = await getActiveUserProgram(userId);
  return prisma.userProgram.update({
    where: { id: activeUserProgram.id },
    data,
  });
}

async function snapshotCounts() {
  const [
    workoutSession,
    setLog,
    progressionRecommendation,
    program,
    programDay,
    programDayExercise,
    userProgram,
    user,
    userProfile,
  ] = await Promise.all([
    prisma.workoutSession.count(),
    prisma.setLog.count(),
    prisma.progressionRecommendation.count(),
    prisma.program.count(),
    prisma.programDay.count(),
    prisma.programDayExercise.count(),
    prisma.userProgram.count(),
    prisma.user.count(),
    prisma.userProfile.count(),
  ]);

  return {
    workoutSession,
    setLog,
    progressionRecommendation,
    program,
    programDay,
    programDayExercise,
    userProgram,
    user,
    userProfile,
  };
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

function buildBaseInput(overrides = {}) {
  return {
    exerciseSummary: {
      exerciseId: 52,
      exerciseName: "Bodyweight Squat (Controlled Range)",
      movementPattern: "squat",
      timesPrescribed: 4,
      timesLogged: 4,
      adherenceRate: 1,
      performanceTrend: {
        direction: "increasing",
        confidence: 1,
        reason: "weight_increase",
      },
      lastLoggedAt: new Date("2026-07-11T09:04:00.000Z"),
      recentSets: [
        { date: new Date("2026-07-11T09:04:00.000Z"), weightKg: 47.5, reps: 12 },
        { date: new Date("2026-07-04T09:03:00.000Z"), weightKg: 45, reps: 12 },
        { date: new Date("2026-06-27T09:02:00.000Z"), weightKg: 42.5, reps: 12 },
      ],
    },
    prescription: {
      repRangeLow: 8,
      repRangeHigh: 12,
      progressionType: "load",
    },
    exercise: {
      movementPattern: "squat",
      complexity: "compound",
      progressionType: "load",
    },
    isBeginner: true,
    staticRecoveryQuality: "medium",
    recoveryModifier: "neutral",
    previousRecommendation: null,
    ...overrides,
  };
}

async function createCompletedSessionWithOneSet({
  userId,
  programId,
  programDayId,
  exerciseId,
  startedAt,
  completedAt,
  loggedAt,
  weightKg,
  reps,
}) {
  const session = await prisma.workoutSession.create({
    data: {
      userId,
      programId,
      programDayId,
      startedAt,
      completedAt,
      status: "completed",
    },
  });

  await prisma.setLog.create({
    data: {
      sessionId: session.id,
      exerciseId,
      setNumber: 1,
      weightKg,
      reps,
      loggedAt,
    },
  });

  return session;
}

function buildLoggedSets({ targetExercise, reps, weightKg, count = targetExercise.sets }) {
  return Array.from({ length: count }, (_, index) => ({
    setNumber: index + 1,
    reps,
    weightKg,
  }));
}

async function main() {
  let passed = 0;
  let failed = 0;

  const unitCases = [
    {
      name: "evaluateProgression -> insufficient_data to maintain",
      input: "trend.direction=insufficient_data",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            exerciseSummary: {
              ...buildBaseInput().exerciseSummary,
              performanceTrend: {
                direction: "insufficient_data",
                confidence: 0,
                reason: "insufficient_sessions",
              },
              recentSets: [],
            },
          })
        );
        assert.equal(actual.recommendationType, "maintain");
        assert.equal(actual.reason, "There is not enough workout history yet; load maintained for the next session.");
        return actual;
      },
    },
    {
      name: "evaluateProgression -> increasing below threshold to maintain",
      input: "trend.direction=increasing, confidence=0.5",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            exerciseSummary: {
              ...buildBaseInput().exerciseSummary,
              performanceTrend: {
                direction: "increasing",
                confidence: 0.5,
                reason: "rep_increase",
              },
            },
          })
        );
        assert.equal(actual.recommendationType, "maintain");
        return actual;
      },
    },
    {
      name: "evaluateProgression -> increasing at exact 0.67 to increase",
      input: "trend.direction=increasing, confidence=0.67",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            exerciseSummary: {
              ...buildBaseInput().exerciseSummary,
              performanceTrend: {
                direction: "increasing",
                confidence: 0.67,
                reason: "weight_increase",
              },
            },
          })
        );
        assert.equal(actual.recommendationType, "increase");
        return actual;
      },
    },
    {
      name: "evaluateProgression -> increasing at 0.66 stays maintain",
      input: "trend.direction=increasing, confidence=0.66",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            exerciseSummary: {
              ...buildBaseInput().exerciseSummary,
              performanceTrend: {
                direction: "increasing",
                confidence: 0.66,
                reason: "weight_increase",
              },
            },
          })
        );
        assert.equal(actual.recommendationType, "maintain");
        return actual;
      },
    },
    {
      name: "evaluateProgression -> flat to maintain",
      input: "trend.direction=flat",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            exerciseSummary: {
              ...buildBaseInput().exerciseSummary,
              performanceTrend: {
                direction: "flat",
                confidence: 1,
                reason: "stable_load",
              },
            },
          })
        );
        assert.equal(actual.recommendationType, "maintain");
        return actual;
      },
    },
    {
      name: "evaluateProgression -> decreasing with no prior becomes maintain streak 1",
      input: "trend.direction=decreasing, previousRecommendation=null",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            exerciseSummary: {
              ...buildBaseInput().exerciseSummary,
              performanceTrend: {
                direction: "decreasing",
                confidence: 1,
                reason: "weight_drop",
              },
            },
          })
        );
        assert.equal(actual.recommendationType, "maintain");
        assert.equal(actual.consecutiveFailures, 1);
        return actual;
      },
    },
    {
      name: "evaluateProgression -> decreasing with prior maintain streak deloads",
      input: "trend.direction=decreasing, previousRecommendation.consecutiveFailures=1",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            exerciseSummary: {
              ...buildBaseInput().exerciseSummary,
              performanceTrend: {
                direction: "decreasing",
                confidence: 1,
                reason: "weight_drop",
              },
            },
            previousRecommendation: {
              recommendationType: "maintain",
              consecutiveFailures: 1,
            },
          })
        );
        assert.equal(actual.recommendationType, "deload");
        return actual;
      },
    },
    {
      name: "evaluateProgression -> static low downgrades increase",
      input: "trend=increasing, confidence=1, staticRecoveryQuality=low",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            staticRecoveryQuality: "low",
          })
        );
        assert.equal(actual.recommendationType, "maintain");
        assert(actual.trace.because.includes("static_recovery_quality:low"));
        assert(actual.trace.because.includes("static_recovery_downgrade:increase_to_maintain"));
        return actual;
      },
    },
    {
      name: "evaluateProgression -> behavioral caution downgrades increase",
      input: "trend=increasing, confidence=1, recoveryModifier=caution",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            recoveryModifier: "caution",
          })
        );
        assert.equal(actual.recommendationType, "maintain");
        assert(actual.trace.because.includes("behavioral_recovery_modifier:caution"));
        assert(actual.trace.because.includes("behavioral_recovery_downgrade:increase_to_maintain"));
        return actual;
      },
    },
    {
      name: "evaluateProgression -> medium static and neutral behavioral leave increase unchanged",
      input: "trend=increasing, confidence=1, staticRecoveryQuality=medium, recoveryModifier=neutral",
      fn: () => {
        const actual = evaluateProgression(buildBaseInput());
        assert.equal(actual.recommendationType, "increase");
        return actual;
      },
    },
    {
      name: "evaluateProgression -> supportive does not upgrade maintain",
      input: "trend=flat, recoveryModifier=supportive",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            recoveryModifier: "supportive",
            exerciseSummary: {
              ...buildBaseInput().exerciseSummary,
              performanceTrend: {
                direction: "flat",
                confidence: 1,
                reason: "stable_load",
              },
            },
          })
        );
        assert.equal(actual.recommendationType, "maintain");
        return actual;
      },
    },
    {
      name: "evaluateProgression -> recovery inputs never create deload on their own",
      input: "trend=increasing, staticRecoveryQuality=low, recoveryModifier=caution",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            staticRecoveryQuality: "low",
            recoveryModifier: "caution",
          })
        );
        assert.notEqual(actual.recommendationType, "deload");
        return actual;
      },
    },
    {
      name: "evaluateProgression -> numeric regression for lower-body compound increase",
      input: "squat compound beginner increase path",
      fn: () => {
        const actual = evaluateProgression(buildBaseInput());
        assert.equal(actual.previousWeightKg, 47.5);
        assert.equal(actual.recommendedWeightKg, 48.75);
        return actual;
      },
    },
    {
      name: "evaluateProgression -> numeric regression for upper-body/isolation increase",
      input: "cable curl increase path",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            exerciseSummary: {
              ...buildBaseInput().exerciseSummary,
              exerciseId: 45,
              exerciseName: "Cable Curl",
              movementPattern: "elbow_flexion",
              recentSets: [{ date: new Date("2026-07-11T09:04:00.000Z"), weightKg: 20, reps: 15 }],
            },
            prescription: {
              repRangeLow: 10,
              repRangeHigh: 15,
              progressionType: "load",
            },
            exercise: {
              movementPattern: "elbow_flexion",
              complexity: "isolation",
              progressionType: "load",
            },
          })
        );
        assert.equal(actual.recommendedWeightKg, 21.25);
        return actual;
      },
    },
    {
      name: "evaluateProgression -> 10 percent deload regression",
      input: "previousWeight=50, second decreasing signal",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            exerciseSummary: {
              ...buildBaseInput().exerciseSummary,
              recentSets: [{ date: new Date("2026-07-11T09:04:00.000Z"), weightKg: 50, reps: 8 }],
              performanceTrend: {
                direction: "decreasing",
                confidence: 1,
                reason: "weight_drop",
              },
            },
            previousRecommendation: {
              recommendationType: "maintain",
              consecutiveFailures: 1,
            },
          })
        );
        assert.equal(actual.recommendedWeightKg, 45);
        return actual;
      },
    },
    {
      name: "evaluateProgression -> time progression branch preserved",
      input: "progressionType=time",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            prescription: {
              repRangeLow: 30,
              repRangeHigh: 45,
              progressionType: "time",
            },
            exercise: {
              movementPattern: "anti_extension",
              complexity: "isolation",
              progressionType: "time",
            },
          })
        );
        assert.equal(actual.recommendedTargetLow, 35);
        assert.equal(actual.recommendedTargetHigh, 55);
        return actual;
      },
    },
    {
      name: "evaluateProgression -> reps_then_load branch preserved",
      input: "progressionType=reps_then_load",
      fn: () => {
        const actual = evaluateProgression(
          buildBaseInput({
            prescription: {
              repRangeLow: 8,
              repRangeHigh: 12,
              progressionType: "reps_then_load",
            },
            exercise: {
              movementPattern: "squat",
              complexity: "compound",
              progressionType: "reps_then_load",
            },
          })
        );
        assert.equal(actual.recommendedWeightKg, 48.75);
        assert.equal(actual.recommendedTargetLow, 8);
        assert.equal(actual.recommendedTargetHigh, 12);
        return actual;
      },
    },
    {
      name: "evaluateProgression -> trace distinguishes static and behavioral downgrades",
      input: "check trace contents",
      fn: () => {
        const staticOnly = evaluateProgression(
          buildBaseInput({
            staticRecoveryQuality: "low",
          })
        );
        const behavioralOnly = evaluateProgression(
          buildBaseInput({
            recoveryModifier: "caution",
          })
        );
        const both = evaluateProgression(
          buildBaseInput({
            staticRecoveryQuality: "low",
            recoveryModifier: "caution",
          })
        );
        assert(staticOnly.trace.because.includes("static_recovery_downgrade:increase_to_maintain"));
        assert(behavioralOnly.trace.because.includes("behavioral_recovery_downgrade:increase_to_maintain"));
        assert(both.trace.because.includes("static_recovery_downgrade:increase_to_maintain"));
        assert(both.trace.because.includes("behavioral_recovery_downgrade:increase_to_maintain"));
        return { staticOnly, behavioralOnly, both };
      },
    },
    {
      name: "evaluateProgression -> reason populated for every decision family",
      input: "increase maintain deload all have non-empty reasons",
      fn: () => {
        const increase = evaluateProgression(buildBaseInput());
        const maintain = evaluateProgression(
          buildBaseInput({
            exerciseSummary: {
              ...buildBaseInput().exerciseSummary,
              performanceTrend: {
                direction: "flat",
                confidence: 1,
                reason: "stable_load",
              },
            },
          })
        );
        const deload = evaluateProgression(
          buildBaseInput({
            exerciseSummary: {
              ...buildBaseInput().exerciseSummary,
              performanceTrend: {
                direction: "decreasing",
                confidence: 1,
                reason: "weight_drop",
              },
            },
            previousRecommendation: {
              recommendationType: "maintain",
              consecutiveFailures: 1,
            },
          })
        );
        assert(increase.reason.length > 0);
        assert(maintain.reason.length > 0);
        assert(deload.reason.length > 0);
        return { increase, maintain, deload };
      },
    },
    {
      name: "evaluateProgression -> deterministic identical input",
      input: "same payload twice",
      fn: () => {
        const input = buildBaseInput();
        const first = evaluateProgression(input);
        const second = evaluateProgression(input);
        assert.equal(serializeForLog(first), serializeForLog(second));
        return first;
      },
    },
  ];

  for (const testCase of unitCases) {
    const ok = await runCase(testCase.name, testCase.input, testCase.fn);
    if (ok) passed += 1;
    else failed += 1;
  }

  const beforeCounts = await snapshotCounts();
  console.log(`ROW_COUNTS_BEFORE: ${serializeForLog(beforeCounts)}`);

  const integrationCases = [
    {
      name: "integration -> duplicate invocation returns existing immutable recommendation",
      input: "orchestrator duplicate handling keeps one row and never updates it",
      fn: async () => {
        const [{ Prisma }, orchestratorModule] = await Promise.all([
          import("@prisma/client"),
          import("./progressionPersistenceOrchestrator.js"),
        ]);
        const {
          PROGRESSION_PERSISTENCE_OUTCOMES,
          orchestrateProgressionPersistence,
        } = orchestratorModule;

        const baseRecoveryConstraint = {
          recoveryModifier: "neutral",
          confidence: 0.4,
          signalStrength: "moderate",
          reasonCode: null,
        };

        const suffix = "duplicate-invariant";
        const user = await createTestUser({
          suffix,
          profileData: {
            goal: "hypertrophy",
            trainingLevel: "beginner",
            trainingDaysPerWeek: 1,
            recoveryQuality: "medium",
            sessionDurationMin: 60,
            equipmentAccess: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"],
            injuryFlags: ["none"],
          },
        });

        try {
          const program = await generateProgramForUser(user.id);
          const firstDay = program.days[0];
          const targetExercise = firstDay.exercises[0];

          const priorSession = await createCompletedSessionWithOneSet({
            userId: user.id,
            programId: program.id,
            programDayId: firstDay.id,
            exerciseId: targetExercise.exerciseId,
            startedAt: new Date("2026-07-11T09:00:00.000Z"),
            completedAt: new Date("2026-07-11T09:45:00.000Z"),
            loggedAt: new Date("2026-07-11T09:05:00.000Z"),
            weightKg: null,
            reps: targetExercise.repRangeHigh,
          });

          await prisma.setLog.deleteMany({
            where: {
              sessionId: priorSession.id,
              exerciseId: targetExercise.exerciseId,
            },
          });
          await prisma.setLog.createMany({
            data: buildLoggedSets({
              targetExercise,
              reps: targetExercise.repRangeHigh,
              weightKg: null,
            }).map((set, index) => ({
              sessionId: priorSession.id,
              exerciseId: targetExercise.exerciseId,
              setNumber: set.setNumber,
              reps: set.reps,
              weightKg: set.weightKg,
              loggedAt: new Date(new Date("2026-07-11T09:05:00.000Z").getTime() + index * 60000),
            })),
          });

          const sessionA = await createCompletedSessionWithOneSet({
            userId: user.id,
            programId: program.id,
            programDayId: firstDay.id,
            exerciseId: targetExercise.exerciseId,
            startedAt: new Date("2026-07-12T09:00:00.000Z"),
            completedAt: new Date("2026-07-12T09:45:00.000Z"),
            loggedAt: new Date("2026-07-12T09:05:00.000Z"),
            weightKg: null,
            reps: targetExercise.repRangeHigh,
          });
          await prisma.setLog.deleteMany({
            where: {
              sessionId: sessionA.id,
              exerciseId: targetExercise.exerciseId,
            },
          });
          await prisma.setLog.createMany({
            data: buildLoggedSets({
              targetExercise,
              reps: targetExercise.repRangeHigh,
              weightKg: null,
            }).map((set, index) => ({
              sessionId: sessionA.id,
              exerciseId: targetExercise.exerciseId,
              setNumber: set.setNumber,
              reps: set.reps,
              weightKg: set.weightKg,
              loggedAt: new Date(new Date("2026-07-12T09:05:00.000Z").getTime() + index * 60000),
            })),
          });

          const sessionB = await createCompletedSessionWithOneSet({
            userId: user.id,
            programId: program.id,
            programDayId: firstDay.id,
            exerciseId: targetExercise.exerciseId,
            startedAt: new Date("2026-07-13T09:00:00.000Z"),
            completedAt: new Date("2026-07-13T09:45:00.000Z"),
            loggedAt: new Date("2026-07-13T09:05:00.000Z"),
            weightKg: null,
            reps: targetExercise.repRangeHigh,
          });
          await prisma.setLog.deleteMany({
            where: {
              sessionId: sessionB.id,
              exerciseId: targetExercise.exerciseId,
            },
          });
          await prisma.setLog.createMany({
            data: buildLoggedSets({
              targetExercise,
              reps: targetExercise.repRangeHigh,
              weightKg: null,
            }).map((set, index) => ({
              sessionId: sessionB.id,
              exerciseId: targetExercise.exerciseId,
              setNumber: set.setNumber,
              reps: set.reps,
              weightKg: set.weightKg,
              loggedAt: new Date(new Date("2026-07-13T09:05:00.000Z").getTime() + index * 60000),
            })),
          });

          const inputA = {
            userId: user.id,
            exerciseId: targetExercise.exerciseId,
            sourceSessionId: sessionA.id,
            recoveryConstraint: baseRecoveryConstraint,
          };

          const firstRun = await orchestrateProgressionPersistence(inputA);
          assert.equal(firstRun.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.CREATED);
          assert(firstRun.recommendation);
          assert(firstRun.decision);
          assert.equal(firstRun.duplicateRecovered, false);

          const rowsAfterFirstRun = await prisma.progressionRecommendation.findMany({
            where: { userId: user.id, exerciseId: targetExercise.exerciseId, sourceSessionId: sessionA.id },
            orderBy: { createdAt: "asc" },
            include: { exercise: true },
          });
          assert.equal(rowsAfterFirstRun.length, 1);

          const secondRun = await orchestrateProgressionPersistence(inputA);
          assert.equal(secondRun.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.ALREADY_EXISTS);
          assert(secondRun.recommendation);
          assert.equal(secondRun.decision, null);
          assert.equal(secondRun.duplicateRecovered, false);

          const rowsAfterSecondRun = await prisma.progressionRecommendation.findMany({
            where: { userId: user.id, exerciseId: targetExercise.exerciseId, sourceSessionId: sessionA.id },
            orderBy: { createdAt: "asc" },
            include: { exercise: true },
          });
          assert.equal(rowsAfterSecondRun.length, 1);
          assert.deepEqual(secondRun.recommendation, rowsAfterSecondRun[0]);
          assert.deepEqual(rowsAfterSecondRun[0], rowsAfterFirstRun[0]);

          const concurrentInput = {
            userId: user.id,
            exerciseId: targetExercise.exerciseId,
            sourceSessionId: sessionB.id,
            recoveryConstraint: baseRecoveryConstraint,
          };
          const concurrentRuns = await Promise.all([
            orchestrateProgressionPersistence(concurrentInput),
            orchestrateProgressionPersistence(concurrentInput),
          ]);
          const concurrentOutcomes = concurrentRuns.map((entry) => entry.outcome).sort();
          assert.deepEqual(concurrentOutcomes, [
            PROGRESSION_PERSISTENCE_OUTCOMES.ALREADY_EXISTS,
            PROGRESSION_PERSISTENCE_OUTCOMES.CREATED,
          ]);

          const concurrentRows = await prisma.progressionRecommendation.findMany({
            where: { userId: user.id, exerciseId: targetExercise.exerciseId, sourceSessionId: sessionB.id },
            orderBy: { createdAt: "asc" },
          });
          assert.equal(concurrentRows.length, 1);

          const sessionC = await createCompletedSessionWithOneSet({
            userId: user.id,
            programId: program.id,
            programDayId: firstDay.id,
            exerciseId: targetExercise.exerciseId,
            startedAt: new Date("2026-07-14T09:00:00.000Z"),
            completedAt: new Date("2026-07-14T09:45:00.000Z"),
            loggedAt: new Date("2026-07-14T09:05:00.000Z"),
            weightKg: null,
            reps: targetExercise.repRangeHigh,
          });
          await prisma.setLog.deleteMany({
            where: {
              sessionId: sessionC.id,
              exerciseId: targetExercise.exerciseId,
            },
          });
          await prisma.setLog.createMany({
            data: buildLoggedSets({
              targetExercise,
              reps: targetExercise.repRangeHigh,
              weightKg: null,
            }).map((set, index) => ({
              sessionId: sessionC.id,
              exerciseId: targetExercise.exerciseId,
              setNumber: set.setNumber,
              reps: set.reps,
              weightKg: set.weightKg,
              loggedAt: new Date(new Date("2026-07-14T09:05:00.000Z").getTime() + index * 60000),
            })),
          });

          const inputC = {
            userId: user.id,
            exerciseId: targetExercise.exerciseId,
            sourceSessionId: sessionC.id,
            recoveryConstraint: baseRecoveryConstraint,
          };

          const createdForP2002 = await orchestrateProgressionPersistence(inputC);
          assert.equal(createdForP2002.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.CREATED);
          const existingRowForP2002 = await prisma.progressionRecommendation.findFirstOrThrow({
            where: { userId: user.id, exerciseId: targetExercise.exerciseId, sourceSessionId: sessionC.id },
            include: { exercise: true },
          });

          const originalCreate = prisma.progressionRecommendation.create.bind(prisma.progressionRecommendation);
          const originalFindUnique = prisma.progressionRecommendation.findUnique.bind(prisma.progressionRecommendation);
          let duplicateCheckCount = 0;
          prisma.progressionRecommendation.findUnique = async (...args) => {
            duplicateCheckCount += 1;
            if (duplicateCheckCount === 1) {
              return null;
            }
            return originalFindUnique(...args);
          };
          prisma.progressionRecommendation.create = async () => {
            throw new Prisma.PrismaClientKnownRequestError("duplicate", {
              code: "P2002",
              clientVersion: "test",
              meta: { target: ["userId", "exerciseId", "sourceSessionId"] },
            });
          };

          let recoveredDuplicate;
          try {
            recoveredDuplicate = await orchestrateProgressionPersistence(inputC);
          } finally {
            prisma.progressionRecommendation.create = originalCreate;
            prisma.progressionRecommendation.findUnique = originalFindUnique;
          }

          assert.equal(recoveredDuplicate.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.ALREADY_EXISTS);
          assert.equal(recoveredDuplicate.duplicateRecovered, true);
          assert.equal(recoveredDuplicate.decision, null);
          assert.deepEqual(recoveredDuplicate.recommendation, existingRowForP2002);

          const sessionD = await createCompletedSessionWithOneSet({
            userId: user.id,
            programId: program.id,
            programDayId: firstDay.id,
            exerciseId: targetExercise.exerciseId,
            startedAt: new Date("2026-07-15T09:00:00.000Z"),
            completedAt: new Date("2026-07-15T09:45:00.000Z"),
            loggedAt: new Date("2026-07-15T09:05:00.000Z"),
            weightKg: null,
            reps: targetExercise.repRangeHigh,
          });
          await prisma.setLog.deleteMany({
            where: {
              sessionId: sessionD.id,
              exerciseId: targetExercise.exerciseId,
            },
          });
          await prisma.setLog.createMany({
            data: buildLoggedSets({
              targetExercise,
              reps: targetExercise.repRangeHigh,
              weightKg: null,
            }).map((set, index) => ({
              sessionId: sessionD.id,
              exerciseId: targetExercise.exerciseId,
              setNumber: set.setNumber,
              reps: set.reps,
              weightKg: set.weightKg,
              loggedAt: new Date(new Date("2026-07-15T09:05:00.000Z").getTime() + index * 60000),
            })),
          });

          const inputD = {
            userId: user.id,
            exerciseId: targetExercise.exerciseId,
            sourceSessionId: sessionD.id,
            recoveryConstraint: baseRecoveryConstraint,
          };

          const originalCreateForUnrelated = prisma.progressionRecommendation.create.bind(prisma.progressionRecommendation);
          prisma.progressionRecommendation.create = async () => {
            throw new Prisma.PrismaClientKnownRequestError("unrelated unique", {
              code: "P2002",
              clientVersion: "test",
              meta: { target: ["confidence"] },
            });
          };

          try {
            await assert.rejects(
              () => orchestrateProgressionPersistence(inputD),
              (error) =>
                error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
            );
          } finally {
            prisma.progressionRecommendation.create = originalCreateForUnrelated;
          }

          const rowsAfterUnrelatedAttempt = await prisma.progressionRecommendation.findMany({
            where: { userId: user.id, exerciseId: targetExercise.exerciseId, sourceSessionId: sessionD.id },
          });
          assert.equal(rowsAfterUnrelatedAttempt.length, 0);

          const differentIdentityResult = await orchestrateProgressionPersistence({
            userId: user.id,
            exerciseId: targetExercise.exerciseId,
            sourceSessionId: sessionD.id,
            recoveryConstraint: baseRecoveryConstraint,
          });
          assert.equal(differentIdentityResult.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.CREATED);

          const finalRows = await prisma.progressionRecommendation.findMany({
            where: { userId: user.id, exerciseId: targetExercise.exerciseId },
            orderBy: [{ sourceSessionId: "asc" }, { createdAt: "asc" }],
          });
          assert.equal(finalRows.length, 4);

          return {
            sequentialOutcomes: [firstRun.outcome, secondRun.outcome],
            concurrentOutcomes,
            p2002RecoveredOutcome: recoveredDuplicate.outcome,
            differentIdentityOutcome: differentIdentityResult.outcome,
            totalRows: finalRows.length,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
  ];

  for (const testCase of integrationCases) {
    const ok = await runCase(testCase.name, testCase.input, testCase.fn);
    if (ok) passed += 1;
    else failed += 1;
  }

  const afterCounts = await snapshotCounts();
  console.log(`ROW_COUNTS_AFTER: ${serializeForLog(afterCounts)}`);
  assert.deepEqual(afterCounts, beforeCounts);

  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

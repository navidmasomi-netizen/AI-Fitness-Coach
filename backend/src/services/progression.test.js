import assert from "node:assert/strict";

import prisma from "../lib/prisma.js";
import { generateProgramForUser } from "./programGenerator.js";
import {
  __resetComputeRecoveryModifierForTests,
  __setComputeRecoveryModifierForTests,
  evaluateProgression,
  evaluateSessionProgression,
} from "./progression.js";

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
      name: "integration -> behavioral caution downgrades increase and computeRecoveryModifier runs once",
      input: "4-day generated program with increasing trend but low completion rate",
      fn: async () => {
        const suffix = `behavioral-caution-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: {
            goal: "hypertrophy",
            trainingLevel: "beginner",
            trainingDaysPerWeek: 4,
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
          let recoveryCallCount = 0;

          __setComputeRecoveryModifierForTests((args) => {
            recoveryCallCount += 1;
            return {
              recoveryModifier: "caution",
              confidence: 0.8,
              signalStrength: "strong",
              reason:
                "Recent training behavior shows low completion consistency; this behavioral caution cannot distinguish fatigue from external factors like travel or schedule disruption.",
              trace: {
                decision: "caution",
                because: [
                  "completion_rate:0.25",
                  "missed_session_gap_count:0",
                  "increasing_exercise_count:1",
                  "decreasing_exercise_count:0",
                  "threshold:caution_completion_rate_below_0.5",
                  "signal_strength:strong",
                ],
              },
            };
          });

          const historicalSessions = [
            { startedAt: new Date("2026-06-20T09:00:00.000Z"), completedAt: new Date("2026-06-20T09:45:00.000Z"), weightKg: 40 },
            { startedAt: new Date("2026-06-27T09:00:00.000Z"), completedAt: new Date("2026-06-27T09:45:00.000Z"), weightKg: 42.5 },
            { startedAt: new Date("2026-07-04T09:00:00.000Z"), completedAt: new Date("2026-07-04T09:45:00.000Z"), weightKg: 45 },
          ];

          for (const [index, historical] of historicalSessions.entries()) {
            await createCompletedSessionWithOneSet({
              userId: user.id,
              programId: program.id,
              programDayId: firstDay.id,
              exerciseId: targetExercise.exerciseId,
              startedAt: historical.startedAt,
              completedAt: historical.completedAt,
              loggedAt: new Date(historical.startedAt.getTime() + (index + 1) * 60000),
              weightKg: historical.weightKg,
              reps: targetExercise.repRangeHigh,
            });
          }

          const targetSession = await createCompletedSessionWithOneSet({
            userId: user.id,
            programId: program.id,
            programDayId: firstDay.id,
            exerciseId: targetExercise.exerciseId,
            startedAt: new Date("2026-07-11T09:00:00.000Z"),
            completedAt: new Date("2026-07-11T09:45:00.000Z"),
            loggedAt: new Date("2026-07-11T09:04:00.000Z"),
            weightKg: 47.5,
            reps: targetExercise.repRangeHigh,
          });

          const result = await evaluateSessionProgression(targetSession.id, user.id);
          const targetEvaluation = result.evaluations.find(
            (entry) => entry.exerciseId === targetExercise.exerciseId
          );
          const persisted = await prisma.progressionRecommendation.findFirst({
            where: { sourceSessionId: targetSession.id, userId: user.id, exerciseId: targetExercise.exerciseId },
            orderBy: { createdAt: "asc" },
          });

          assert(result.recommendations.length > 1);
          assert.equal(recoveryCallCount, 1);
          assert.equal(result.recoveryResult.recoveryModifier, "caution");
          assert(targetEvaluation);
          assert.equal(targetEvaluation.evaluation.recommendationType, "maintain");
          assert(targetEvaluation.evaluation.trace.because.includes("behavioral_recovery_modifier:caution"));
          assert(persisted);
          assert.equal(persisted.recommendationType, "maintain");
          assert.equal(persisted.reason, "Workout trend is improving, but recent training behavior triggered a conservative hold for the next session.");

          return {
            recommendationCount: result.recommendations.length,
            recoveryCallCount,
            recoveryResult: result.recoveryResult,
            targetEvaluation,
            persisted,
          };
        } finally {
          __resetComputeRecoveryModifierForTests();
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "integration -> supportive does not upgrade maintain to increase",
      input: "1-day generated program with supportive behavior but flat target exercise",
      fn: async () => {
        const suffix = `supportive-${Date.now()}`;
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
          const supportExercise = firstDay.exercises[1];

          for (const [index, day] of [
            new Date("2026-06-20T09:00:00.000Z"),
            new Date("2026-06-27T09:00:00.000Z"),
            new Date("2026-07-04T09:00:00.000Z"),
            new Date("2026-07-11T09:00:00.000Z"),
          ].entries()) {
            const session = await prisma.workoutSession.create({
              data: {
                userId: user.id,
                programId: program.id,
                programDayId: firstDay.id,
                startedAt: day,
                completedAt: new Date(day.getTime() + 45 * 60000),
                status: "completed",
              },
            });

            await prisma.setLog.createMany({
              data: [
                {
                  sessionId: session.id,
                  exerciseId: targetExercise.exerciseId,
                  setNumber: 1,
                  weightKg: 30,
                  reps: targetExercise.repRangeHigh,
                  loggedAt: new Date(day.getTime() + 5 * 60000),
                },
                {
                  sessionId: session.id,
                  exerciseId: supportExercise.exerciseId,
                  setNumber: 1,
                  weightKg: 20 + index * 2.5,
                  reps: supportExercise.repRangeHigh,
                  loggedAt: new Date(day.getTime() + 10 * 60000),
                },
              ],
            });
          }

          const targetSession = await prisma.workoutSession.findFirstOrThrow({
            where: { userId: user.id, startedAt: new Date("2026-07-11T09:00:00.000Z") },
          });

          const result = await evaluateSessionProgression(targetSession.id, user.id);
          const targetEvaluation = result.evaluations.find(
            (entry) => entry.exerciseId === targetExercise.exerciseId
          );
          const persisted = await prisma.progressionRecommendation.findFirst({
            where: { sourceSessionId: targetSession.id, userId: user.id, exerciseId: targetExercise.exerciseId },
            orderBy: { createdAt: "asc" },
          });

          assert.equal(result.recoveryResult.recoveryModifier, "supportive");
          assert(targetEvaluation);
          assert.equal(targetEvaluation.evaluation.recommendationType, "maintain");
          assert(persisted);
          assert.equal(persisted.recommendationType, "maintain");

          return {
            recoveryResult: result.recoveryResult,
            targetEvaluation,
            persisted,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "integration -> static low with neutral behavioral still downgrades increase",
      input: "2-day generated program with increasing trend and neutral recovery modifier",
      fn: async () => {
        const suffix = `static-low-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: {
            goal: "hypertrophy",
            trainingLevel: "beginner",
            trainingDaysPerWeek: 2,
            recoveryQuality: "low",
            sessionDurationMin: 60,
            equipmentAccess: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"],
            injuryFlags: ["none"],
          },
        });

        try {
          const program = await generateProgramForUser(user.id);
          const firstDay = program.days[0];
          const targetExercise = firstDay.exercises[0];

          for (const [index, historical] of [
            { startedAt: new Date("2026-06-20T09:00:00.000Z"), weightKg: 40 },
            { startedAt: new Date("2026-06-27T09:00:00.000Z"), weightKg: 42.5 },
            { startedAt: new Date("2026-07-04T09:00:00.000Z"), weightKg: 45 },
            { startedAt: new Date("2026-07-11T09:00:00.000Z"), weightKg: 47.5 },
          ].entries()) {
            await createCompletedSessionWithOneSet({
              userId: user.id,
              programId: program.id,
              programDayId: firstDay.id,
              exerciseId: targetExercise.exerciseId,
              startedAt: historical.startedAt,
              completedAt: new Date(historical.startedAt.getTime() + 45 * 60000),
              loggedAt: new Date(historical.startedAt.getTime() + (index + 1) * 60000),
              weightKg: historical.weightKg,
              reps: targetExercise.repRangeHigh,
            });
          }

          const targetSession = await prisma.workoutSession.findFirstOrThrow({
            where: { userId: user.id, startedAt: new Date("2026-07-11T09:00:00.000Z") },
          });

          const result = await evaluateSessionProgression(targetSession.id, user.id);
          const targetEvaluation = result.evaluations.find(
            (entry) => entry.exerciseId === targetExercise.exerciseId
          );
          const persisted = await prisma.progressionRecommendation.findFirst({
            where: { sourceSessionId: targetSession.id, userId: user.id, exerciseId: targetExercise.exerciseId },
            orderBy: { createdAt: "asc" },
          });

          assert.equal(result.recoveryResult.recoveryModifier, "neutral");
          assert(targetEvaluation);
          assert.equal(targetEvaluation.evaluation.recommendationType, "maintain");
          assert(targetEvaluation.evaluation.trace.because.includes("static_recovery_quality:low"));
          assert(persisted);
          assert.equal(persisted.recommendationType, "maintain");

          return {
            recoveryResult: result.recoveryResult,
            targetEvaluation,
            persisted,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "integration -> behavioral caution downgrades despite static high",
      input: "4-day generated program with increasing trend, high static recovery, caution behavior",
      fn: async () => {
        const suffix = `static-high-caution-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: {
            goal: "hypertrophy",
            trainingLevel: "beginner",
            trainingDaysPerWeek: 4,
            recoveryQuality: "high",
            sessionDurationMin: 60,
            equipmentAccess: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"],
            injuryFlags: ["none"],
          },
        });

        try {
          const program = await generateProgramForUser(user.id);
          const firstDay = program.days[0];
          const targetExercise = firstDay.exercises[0];

          for (const [index, historical] of [
            { startedAt: new Date("2026-06-20T09:00:00.000Z"), weightKg: 40 },
            { startedAt: new Date("2026-06-27T09:00:00.000Z"), weightKg: 42.5 },
            { startedAt: new Date("2026-07-04T09:00:00.000Z"), weightKg: 45 },
          ].entries()) {
            await createCompletedSessionWithOneSet({
              userId: user.id,
              programId: program.id,
              programDayId: firstDay.id,
              exerciseId: targetExercise.exerciseId,
              startedAt: historical.startedAt,
              completedAt: new Date(historical.startedAt.getTime() + 45 * 60000),
              loggedAt: new Date(historical.startedAt.getTime() + (index + 1) * 60000),
              weightKg: historical.weightKg,
              reps: targetExercise.repRangeHigh,
            });
          }

          const targetSession = await createCompletedSessionWithOneSet({
            userId: user.id,
            programId: program.id,
            programDayId: firstDay.id,
            exerciseId: targetExercise.exerciseId,
            startedAt: new Date("2026-07-11T09:00:00.000Z"),
            completedAt: new Date("2026-07-11T09:45:00.000Z"),
            loggedAt: new Date("2026-07-11T09:04:00.000Z"),
            weightKg: 47.5,
            reps: targetExercise.repRangeHigh,
          });

          const result = await evaluateSessionProgression(targetSession.id, user.id);
          const targetEvaluation = result.evaluations.find(
            (entry) => entry.exerciseId === targetExercise.exerciseId
          );
          const persisted = await prisma.progressionRecommendation.findFirst({
            where: { sourceSessionId: targetSession.id, userId: user.id, exerciseId: targetExercise.exerciseId },
            orderBy: { createdAt: "asc" },
          });

          assert.equal(result.recoveryResult.recoveryModifier, "caution");
          assert(targetEvaluation);
          assert.equal(targetEvaluation.evaluation.recommendationType, "maintain");
          assert(targetEvaluation.evaluation.trace.because.includes("behavioral_recovery_modifier:caution"));
          assert(persisted);
          assert.equal(persisted.recommendationType, "maintain");

          return {
            recoveryResult: result.recoveryResult,
            targetEvaluation,
            persisted,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "integration -> duplicate invocation behavior remains unchanged",
      input: "same session evaluated twice directly through service",
      fn: async () => {
        const suffix = `duplicate-${Date.now()}`;
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

          const session = await createCompletedSessionWithOneSet({
            userId: user.id,
            programId: program.id,
            programDayId: firstDay.id,
            exerciseId: targetExercise.exerciseId,
            startedAt: new Date("2026-07-12T09:00:00.000Z"),
            completedAt: new Date("2026-07-12T09:45:00.000Z"),
            loggedAt: new Date("2026-07-12T09:05:00.000Z"),
            weightKg: 30,
            reps: targetExercise.repRangeHigh,
          });

          const firstRun = await evaluateSessionProgression(session.id, user.id);
          const secondRun = await evaluateSessionProgression(session.id, user.id);
          const persisted = await prisma.progressionRecommendation.findMany({
            where: { sourceSessionId: session.id, userId: user.id },
            orderBy: [{ exerciseId: "asc" }, { createdAt: "asc" }],
          });

          assert.equal(
            persisted.length,
            firstRun.recommendations.length + secondRun.recommendations.length
          );

          return {
            firstRunCount: firstRun.recommendations.length,
            secondRunCount: secondRun.recommendations.length,
            persistedCount: persisted.length,
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
    __resetComputeRecoveryModifierForTests();
    await prisma.$disconnect();
  });

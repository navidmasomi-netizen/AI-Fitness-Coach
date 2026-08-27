import assert from "node:assert/strict";

import prisma from "../lib/prisma.js";
import { startFromActiveProgram, completeWorkoutSession } from "../controllers/workouts.js";
import { generateProgramForUser } from "./programGenerator.js";
import { analyzeExercisePerformance } from "./exercisePerformanceAnalyzer.js";
import { decideProgression } from "./progressionDecisionEngine.js";
import { mapDecisionToProgressionRecommendationData } from "./progressionDecisionMapping.js";
import { buildProgressionExplanation } from "./progressionExplanationBuilder.js";
import {
  orchestrateProgressionPersistence,
  PROGRESSION_PERSISTENCE_OUTCOMES,
} from "./progressionPersistenceOrchestrator.js";
import {
  createProgramDayRepository,
} from "../repositories/programDayRepository.js";
import {
  createProgressionRecommendationRepository,
} from "../repositories/progressionRecommendationRepository.js";
import {
  createRecommendationApplicationRepository,
} from "../repositories/recommendationApplicationRepository.js";
import {
  createUserProgramRepository,
} from "../repositories/userProgramRepository.js";
import {
  createWorkoutSessionExerciseTargetRepository,
} from "../repositories/workoutSessionExerciseTargetRepository.js";
import {
  createWorkoutSessionRepository,
} from "../repositories/workoutSessionRepository.js";
import {
  WorkoutSessionCompletionError,
  createWorkoutSessionService,
  WorkoutSessionStartError,
  workoutSessionService,
} from "./workoutSessionService.js";

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

function createMockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue);
  }
  return value;
}

function buildCompleteProfileData(overrides = {}) {
  return {
    goal: "hypertrophy",
    trainingLevel: "beginner",
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
    wizardCompletedAt: new Date("2026-07-01T00:00:00.000Z"),
    lastCompletedStep: 20,
    ...overrides,
  };
}

async function createTestUser({ profileData, suffix }) {
  const user = await prisma.user.create({
    data: {
      email: `workout-session-service-${suffix}${TEST_EMAIL_DOMAIN}`,
      name: `Workout Session Service ${suffix}`,
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
    await prisma.recommendationApplication.deleteMany({
      where: {
        OR: [
          { workoutSessionId: { in: sessionIds } },
          {
            recommendation: {
              sourceSessionId: { in: sessionIds },
            },
          },
        ],
      },
    });

    await prisma.workoutSessionExerciseTarget.deleteMany({
      where: { sessionId: { in: sessionIds } },
    });

    await prisma.progressionRecommendation.deleteMany({
      where: {
        OR: [
          { userId },
          { sourceSessionId: { in: sessionIds } },
        ],
      },
    });
  } else {
    await prisma.progressionRecommendation.deleteMany({ where: { userId } });
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

async function getActiveUserProgram(userId) {
  return prisma.userProgram.findFirstOrThrow({
    where: { userId, isActive: true },
    orderBy: { id: "desc" },
  });
}

async function countUserSessions(userId) {
  return prisma.workoutSession.count({ where: { userId } });
}

async function countUserTargets(userId) {
  return prisma.workoutSessionExerciseTarget.count({
    where: {
      session: {
        userId,
      },
    },
  });
}

async function countUserApplications(userId) {
  return prisma.recommendationApplication.count({
    where: {
      workoutSession: {
        userId,
      },
    },
  });
}

async function countUserRecommendations(userId) {
  return prisma.progressionRecommendation.count({
    where: { userId },
  });
}

function projectComparableRecommendation(recommendation) {
  return {
    recommendationType: recommendation.recommendationType,
    decisionType: recommendation.decisionType,
    loadAdjustmentSteps: recommendation.loadAdjustmentSteps,
    repAdjustment: recommendation.repAdjustment,
    setAdjustment: recommendation.setAdjustment,
    durationAdjustmentSteps: recommendation.durationAdjustmentSteps,
    confidence: recommendation.confidence,
    reasonCode: recommendation.reasonCode,
    rulesVersion: recommendation.rulesVersion,
    progressionType: recommendation.progressionType,
    consecutiveFailures: recommendation.consecutiveFailures,
    reason: recommendation.reason,
    status: recommendation.status,
  };
}

function projectPublicExplanation(explanation) {
  if (!explanation) {
    return null;
  }

  return {
    messageKey: explanation.messageKey,
    userSummary: explanation.userSummary,
  };
}

function buildHistoricalExposureRecord({
  sessionId,
  userProgramId,
  programDayExerciseId,
  exerciseId,
  startedAt,
  completedAt,
  progressionType = "load",
  targetSets = 3,
  setLogs,
}) {
  return {
    id: sessionId,
    userProgramId,
    programDayId: 1,
    startedAt,
    completedAt,
    exerciseTargets: [
      {
        id: sessionId * 10,
        programDayExerciseId,
        exerciseId,
        targetSets,
        targetRepRangeLow: 8,
        targetRepRangeHigh: 10,
        exactRepTarget: 8,
        targetLoadKg: progressionType === "time" ? null : 40,
        targetDurationSeconds: progressionType === "time" ? 60 : null,
        progressionType,
        sourceRecommendation: null,
      },
    ],
    setLogs,
  };
}

function buildHistoricalSignalScenarioExposures({
  userProgramId,
  programDayExerciseId,
  exerciseId,
  scenario,
}) {
  const baseStart = "2026-07-20T09:00:00.000Z";
  if (scenario === "no-history") {
    return [];
  }

  if (scenario === "insufficient-history") {
    return [
      buildHistoricalExposureRecord({
        sessionId: 9001,
        userProgramId,
        programDayExerciseId,
        exerciseId,
        startedAt: new Date("2026-07-20T09:00:00.000Z"),
        completedAt: new Date("2026-07-20T10:00:00.000Z"),
        setLogs: [
          {
            id: 90011,
            exerciseId,
            setNumber: 1,
            reps: 8,
            weightKg: 40,
            loggedAt: new Date("2026-07-20T09:30:00.000Z"),
          },
        ],
      }),
    ];
  }

  if (scenario === "increasing-load") {
    return [
      buildHistoricalExposureRecord({
        sessionId: 9002,
        userProgramId,
        programDayExerciseId,
        exerciseId,
        startedAt: new Date("2026-07-24T09:00:00.000Z"),
        completedAt: new Date("2026-07-24T10:00:00.000Z"),
        setLogs: [
          {
            id: 90021,
            exerciseId,
            setNumber: 1,
            reps: 9,
            weightKg: 45,
            loggedAt: new Date("2026-07-24T09:30:00.000Z"),
          },
        ],
      }),
      buildHistoricalExposureRecord({
        sessionId: 9003,
        userProgramId,
        programDayExerciseId,
        exerciseId,
        startedAt: new Date("2026-07-23T09:00:00.000Z"),
        completedAt: new Date("2026-07-23T10:00:00.000Z"),
        setLogs: [
          {
            id: 90031,
            exerciseId,
            setNumber: 1,
            reps: 8,
            weightKg: 40,
            loggedAt: new Date("2026-07-23T09:30:00.000Z"),
          },
        ],
      }),
    ];
  }

  if (scenario === "decreasing-load") {
    return [
      buildHistoricalExposureRecord({
        sessionId: 9004,
        userProgramId,
        programDayExerciseId,
        exerciseId,
        startedAt: new Date("2026-07-24T09:00:00.000Z"),
        completedAt: new Date("2026-07-24T10:00:00.000Z"),
        setLogs: [
          {
            id: 90041,
            exerciseId,
            setNumber: 1,
            reps: 8,
            weightKg: 40,
            loggedAt: new Date("2026-07-24T09:30:00.000Z"),
          },
        ],
      }),
      buildHistoricalExposureRecord({
        sessionId: 9005,
        userProgramId,
        programDayExerciseId,
        exerciseId,
        startedAt: new Date("2026-07-23T09:00:00.000Z"),
        completedAt: new Date("2026-07-23T10:00:00.000Z"),
        setLogs: [
          {
            id: 90051,
            exerciseId,
            setNumber: 1,
            reps: 8,
            weightKg: 45,
            loggedAt: new Date("2026-07-23T09:30:00.000Z"),
          },
        ],
      }),
    ];
  }

  if (scenario === "stable-trend") {
    return [
      buildHistoricalExposureRecord({
        sessionId: 9006,
        userProgramId,
        programDayExerciseId,
        exerciseId,
        startedAt: new Date("2026-07-24T09:00:00.000Z"),
        completedAt: new Date("2026-07-24T10:00:00.000Z"),
        setLogs: [
          {
            id: 90061,
            exerciseId,
            setNumber: 1,
            reps: 9,
            weightKg: 45,
            loggedAt: new Date("2026-07-24T09:30:00.000Z"),
          },
        ],
      }),
      buildHistoricalExposureRecord({
        sessionId: 9007,
        userProgramId,
        programDayExerciseId,
        exerciseId,
        startedAt: new Date("2026-07-23T09:00:00.000Z"),
        completedAt: new Date("2026-07-23T10:00:00.000Z"),
        setLogs: [
          {
            id: 90071,
            exerciseId,
            setNumber: 1,
            reps: 8,
            weightKg: 45,
            loggedAt: new Date("2026-07-23T09:30:00.000Z"),
          },
        ],
      }),
    ];
  }

  if (scenario === "unknown-trend") {
    return [
      buildHistoricalExposureRecord({
        sessionId: 9008,
        userProgramId,
        programDayExerciseId,
        exerciseId,
        startedAt: new Date("2026-07-24T09:00:00.000Z"),
        completedAt: new Date("2026-07-24T10:00:00.000Z"),
        setLogs: [
          {
            id: 90081,
            exerciseId,
            setNumber: 1,
            reps: 14,
            weightKg: null,
            loggedAt: new Date("2026-07-24T09:30:00.000Z"),
          },
        ],
      }),
      buildHistoricalExposureRecord({
        sessionId: 9009,
        userProgramId,
        programDayExerciseId,
        exerciseId,
        startedAt: new Date("2026-07-23T09:00:00.000Z"),
        completedAt: new Date("2026-07-23T10:00:00.000Z"),
        setLogs: [
          {
            id: 90091,
            exerciseId,
            setNumber: 1,
            reps: 12,
            weightKg: null,
            loggedAt: new Date("2026-07-23T09:30:00.000Z"),
          },
        ],
      }),
    ];
  }

  throw new Error(`Unsupported historical signal scenario: ${scenario}`);
}

async function addSetLogsForSession({ sessionId, exerciseId, sets }) {
  for (const [index, set] of sets.entries()) {
    await prisma.setLog.create({
      data: {
        sessionId,
        exerciseId,
        setNumber: index + 1,
        reps: set.reps,
        weightKg: set.weightKg,
      },
    });
  }
}

async function createStartedSession({ userId, idempotencyKey = null }) {
  return workoutSessionService.startFromActiveProgram({
    userId,
    idempotencyKey,
  });
}

async function createStartedSessionWithAppliedRecommendation({ userId }) {
  await generateProgramForUser(userId);
  const activeUserProgram = await getActiveUserProgram(userId);
  const programDay = await prisma.programDay.findFirstOrThrow({
    where: {
      programId: activeUserProgram.programId,
      dayIndex: activeUserProgram.currentDayIndex,
    },
    include: {
      exercises: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
      },
    },
  });

  const targetExercise =
    programDay.exercises.find((exerciseRow) => exerciseRow.progressionType !== "time") ??
    programDay.exercises[0];

  const sourceSession = await createCompletedSourceSession({
    userId,
    programId: activeUserProgram.programId,
    programDayId: programDay.id,
    exerciseId: targetExercise.exerciseId,
  });

  const sourceRecommendation = await createPendingRecommendation({
    userId,
    exerciseId: targetExercise.exerciseId,
    sourceSessionId: sourceSession.id,
    decisionType: "INCREASE_REPS",
    progressionType: targetExercise.progressionType ?? "reps_then_load",
    repAdjustment: 1,
  });

  const started = await createStartedSession({ userId });

  return {
    started,
    sourceRecommendation,
    targetExercise,
  };
}

function buildPersistableDecision(overrides = {}) {
  return {
    decisionType: "MAINTAIN",
    loadAdjustmentSteps: 0,
    repAdjustment: 0,
    setAdjustment: 0,
    durationAdjustmentSteps: 0,
    confidence: 0.8,
    reasonCode: "RULE_V1_TARGETS_FULLY_MET",
    secondaryReasonCodes: [],
    requiresManualReview: false,
    shouldPersist: true,
    rulesVersion: "progression_decision_rules_v5",
    ...overrides,
  };
}

function buildHistoricalConflictDecision(overrides = {}) {
  return {
    exerciseId: 15,
    sourceSessionId: null,
    decisionType: "MAINTAIN",
    loadAdjustmentSteps: 0,
    repAdjustment: 0,
    setAdjustment: 0,
    durationAdjustmentSteps: 0,
    confidence: 0.5,
    reasonCode: "RULE_V2_HISTORICAL_TREND_CONFLICT",
    secondaryReasonCodes: [
      "RULE_V1_PERFORMANCE_IMPROVED",
      "RULE_V1_TARGETS_FULLY_MET",
    ],
    requiresManualReview: false,
    shouldPersist: true,
    rulesVersion: "progression_decision_rules_v5",
    ...overrides,
  };
}

function buildDeloadHistory(overrides = {}) {
  return {
    recentDeloadCount: 1,
    mostRecentDeloadAt: "2026-07-20T10:00:00.000Z",
    hasRecentDeload: true,
    ...overrides,
  };
}

function buildAppliedDeloadHistoryRow(overrides = {}) {
  const recommendation = {
    id: 101,
    decisionType: "DELOAD",
    recommendationType: "deload",
    sourceSessionId: 7001,
    sourceSession: {
      userProgramId: 501,
    },
    ...(overrides.recommendation ?? {}),
  };
  const { recommendation: _ignoredRecommendationOverride, ...rowOverrides } = overrides;
  const row = {
    id: 9001,
    recommendationId: recommendation.id,
    appliedAt: "2026-07-20T10:00:00.000Z",
    workoutSession: {
      userProgramId: 501,
    },
    recommendation,
    ...rowOverrides,
  };

  if (rowOverrides.recommendationId === undefined) {
    row.recommendationId = recommendation.id;
  }

  return row;
}

function buildTrainingStateSignals(historicalTrainingSignals, overrides = {}) {
  return {
    fatigue: {
      historicalTrainingSignals,
    },
    ...overrides,
  };
}

async function createPendingRecommendation({
  userId,
  exerciseId,
  sourceSessionId,
  decisionType,
  progressionType = "load",
  loadAdjustmentSteps = 0,
  repAdjustment = 0,
  durationAdjustmentSteps = 0,
}) {
  return prisma.progressionRecommendation.create({
    data: {
      userId,
      exerciseId,
      sourceSessionId,
      recommendationType: decisionType === "DELOAD" ? "deload" : decisionType === "MAINTAIN" ? "maintain" : "increase",
      decisionType,
      loadAdjustmentSteps,
      repAdjustment,
      setAdjustment: 0,
      durationAdjustmentSteps,
      rulesVersion: "progression_decision_rules_v5",
      lifecycleStatus: "PENDING",
      progressionType,
      reason: "Progression decision recorded for the next session.",
      status: "active",
    },
  });
}

async function createCompletedSourceSession({
  userId,
  programId,
  programDayId,
  exerciseId,
}) {
  const session = await prisma.workoutSession.create({
    data: {
      userId,
      programId,
      programDayId,
      status: "completed",
      startedAt: new Date("2026-07-26T08:00:00.000Z"),
      completedAt: new Date("2026-07-26T08:45:00.000Z"),
    },
  });

  await prisma.setLog.create({
    data: {
      sessionId: session.id,
      exerciseId,
      setNumber: 1,
      reps: 10,
      weightKg: 40,
      loggedAt: new Date("2026-07-26T08:10:00.000Z"),
    },
  });

  return session;
}

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "creates a session with persisted target snapshots and embedded response targets",
      input: "active user starts from active program",
      fn: async () => {
        const suffix = `create-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          const program = await generateProgramForUser(user.id);
          const activeUserProgram = await getActiveUserProgram(user.id);
          const res = createMockRes();

          await startFromActiveProgram({ userId: user.id, body: {} }, res);

          assert.equal(res.statusCode, 200);
          assert.equal(res.body.success, true);
          assert.equal(res.body.data.resumed, false);
          assert.equal(res.body.data.session.userProgramId, activeUserProgram.id);
          assert.equal(res.body.data.session.exerciseTargets.length, res.body.data.exercises.length);
          assert.equal(await countUserSessions(user.id), 1);
          assert.equal(await countUserTargets(user.id), res.body.data.exercises.length);

          return {
            sessionId: res.body.data.session.id,
            targetCount: res.body.data.session.exerciseTargets.length,
            responseProgramId: res.body.data.program.id,
            generatedProgramId: program.id,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "replays an existing active session with embedded target snapshots",
      input: "same user calls start twice without completing",
      fn: async () => {
        const suffix = `replay-active-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);

          const firstRes = createMockRes();
          await startFromActiveProgram({ userId: user.id, body: {} }, firstRes);
          const secondRes = createMockRes();
          await startFromActiveProgram({ userId: user.id, body: {} }, secondRes);

          assert.equal(secondRes.statusCode, 200);
          assert.equal(secondRes.body.data.resumed, true);
          assert.equal(secondRes.body.data.session.id, firstRes.body.data.session.id);
          assert.equal(await countUserSessions(user.id), 1);

          return {
            firstSessionId: firstRes.body.data.session.id,
            secondSessionId: secondRes.body.data.session.id,
            resumed: secondRes.body.data.resumed,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "replays the same user-scoped idempotencyKey",
      input: "same user repeats same idempotency key",
      fn: async () => {
        const suffix = `replay-key-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);

          const firstRes = createMockRes();
          await startFromActiveProgram({
            userId: user.id,
            body: { idempotencyKey: "44444444-4444-4444-8444-444444444444" },
            headers: {},
          }, firstRes);

          const secondRes = createMockRes();
          await startFromActiveProgram({
            userId: user.id,
            body: { idempotencyKey: "44444444-4444-4444-8444-444444444444" },
            headers: {},
          }, secondRes);

          assert.equal(secondRes.body.data.session.id, firstRes.body.data.session.id);
          assert.equal(await countUserSessions(user.id), 1);

          return {
            sessionId: secondRes.body.data.session.id,
            resumed: secondRes.body.data.resumed,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "prevents duplicate sessions when a different idempotencyKey is supplied while active",
      input: "same user sends a second logical start while session is active",
      fn: async () => {
        const suffix = `prevent-duplicate-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);

          const firstRes = createMockRes();
          await startFromActiveProgram({
            userId: user.id,
            body: { idempotencyKey: "55555555-5555-4555-8555-555555555555" },
            headers: {},
          }, firstRes);

          const secondRes = createMockRes();
          await startFromActiveProgram({
            userId: user.id,
            body: { idempotencyKey: "66666666-6666-4666-8666-666666666666" },
            headers: {},
          }, secondRes);

          assert.equal(secondRes.body.data.session.id, firstRes.body.data.session.id);
          assert.equal(await countUserSessions(user.id), 1);

          return {
            sessionId: secondRes.body.data.session.id,
            sessionCount: await countUserSessions(user.id),
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "rolls back when one target is unresolved",
      input: "eligible pending recommendation requires missing increment metadata",
      fn: async () => {
        const suffix = `rollback-unresolved-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          const program = await generateProgramForUser(user.id);
          const activeUserProgram = await getActiveUserProgram(user.id);
          const programDay = await prisma.programDay.findFirstOrThrow({
            where: {
              programId: activeUserProgram.programId,
              dayIndex: activeUserProgram.currentDayIndex,
            },
            include: {
              exercises: {
                orderBy: { order: "asc" },
              },
            },
          });

          const sourceSession = await createCompletedSourceSession({
            userId: user.id,
            programId: program.id,
            programDayId: programDay.id,
            exerciseId: programDay.exercises[0].exerciseId,
          });

          await createPendingRecommendation({
            userId: user.id,
            exerciseId: programDay.exercises[0].exerciseId,
            sourceSessionId: sourceSession.id,
            decisionType: "INCREASE_LOAD",
            loadAdjustmentSteps: 1,
          });

          const beforeSessions = await countUserSessions(user.id);
          const beforeTargets = await countUserTargets(user.id);
          const beforeApplications = await countUserApplications(user.id);

          const res = createMockRes();
          await startFromActiveProgram({ userId: user.id, body: {} }, res);

          assert.equal(res.statusCode, 500);
          assert.equal(await countUserSessions(user.id), beforeSessions); // source session only
          assert.equal(await countUserTargets(user.id), beforeTargets);
          assert.equal(await countUserApplications(user.id), beforeApplications);

          const pendingRecommendation = await prisma.progressionRecommendation.findFirstOrThrow({
            where: { id: { gt: 0 }, sourceSessionId: sourceSession.id, exerciseId: programDay.exercises[0].exerciseId },
          });
          assert.equal(pendingRecommendation.lifecycleStatus, "PENDING");

          return {
            statusCode: res.statusCode,
            sessionCount: await countUserSessions(user.id),
            targetCount: await countUserTargets(user.id),
            lifecycleStatus: pendingRecommendation.lifecycleStatus,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "rolls back when target persistence fails",
      input: "repository createManyForSession throws inside transaction",
      fn: async () => {
        const suffix = `rollback-persist-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);

          const service = createWorkoutSessionService({
            createWorkoutSessionExerciseTargetRepositoryImpl(db) {
              const repository = createWorkoutSessionExerciseTargetRepository(db);
              return {
                ...repository,
                async createManyForSession() {
                  throw new Error("synthetic target persistence failure");
                },
              };
            },
          });

          let thrownError = null;
          try {
            await service.startFromActiveProgram({ userId: user.id, idempotencyKey: null });
          } catch (error) {
            thrownError = error;
          }

          assert(thrownError instanceof WorkoutSessionStartError);
          assert.equal(await countUserSessions(user.id), 0);
          assert.equal(await countUserTargets(user.id), 0);
          assert.equal(await countUserApplications(user.id), 0);

          return {
            errorCode: thrownError.code,
            sessionCount: await countUserSessions(user.id),
            targetCount: await countUserTargets(user.id),
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "preserves existing compatible HTTP behavior while adding embedded target snapshots",
      input: "response still contains program, programDay, exercises, resumed, session",
      fn: async () => {
        const suffix = `compatible-response-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          const program = await generateProgramForUser(user.id);
          const res = createMockRes();
          await startFromActiveProgram({ userId: user.id, body: {} }, res);

          assert.equal(res.statusCode, 200);
          assert.equal(res.body.success, true);
          assert.equal(res.body.data.program.id, program.id);
          assert(Array.isArray(res.body.data.exercises));
          assert(Array.isArray(res.body.data.session.exerciseTargets));
          assert.equal(Array.isArray(res.body.data.session.setLogs), true);

          return {
            responseKeys: Object.keys(res.body.data),
            targetCount: res.body.data.session.exerciseTargets.length,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "completion excludes the current session from historical query and invokes aggregation",
      input: "historical query receives excludeSessionId and limit 5 during completion",
      fn: async () => {
        const suffix = `complete-history-context-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];

          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [
              { reps: 10, weightKg: 40 },
              { reps: 10, weightKg: 40 },
            ],
          });

          let historicalQueryArgs = null;
          let appliedDeloadHistoryQueryArgs = null;
          let appliedDeloadHistoryQueryCalls = 0;
          let deriveDeloadHistoryCalls = 0;
          let aggregationCalls = 0;
          let aggregationInputLength = null;
          let decisionInput = null;
          const neutralDeloadHistory = buildDeloadHistory({
            recentDeloadCount: 0,
            mostRecentDeloadAt: null,
            hasRecentDeload: false,
          });

          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl(input) {
              decisionInput = input;
              return buildPersistableDecision();
            },
            createWorkoutSessionRepositoryImpl(db) {
              const repository = createWorkoutSessionRepository(db);
              return {
                ...repository,
                async findCompletedHistoryForUserProgramDayExercise(params) {
                  historicalQueryArgs = params;
                  return [];
                },
              };
            },
            createProgressionRecommendationRepositoryImpl(db) {
              const repository = createProgressionRecommendationRepository(db);
              return {
                ...repository,
                async findAppliedDeloadHistoryRows(params) {
                  appliedDeloadHistoryQueryCalls += 1;
                  appliedDeloadHistoryQueryArgs = params;
                  return [];
                },
              };
            },
            deriveDeloadHistoryImpl({ appliedDeloadRows, currentUserProgramId }) {
              deriveDeloadHistoryCalls += 1;
              assert.deepEqual(appliedDeloadRows, []);
              assert.equal(currentUserProgramId, started.session.userProgramId);
              return neutralDeloadHistory;
            },
            deriveTrainingStateSignalsFromExposuresImpl(exposures, { deloadHistory }) {
              aggregationCalls += 1;
              aggregationInputLength = exposures.length;
              return buildTrainingStateSignals({
                completedExposureCount: 0,
                averageCompletionRatio: null,
                averageCompletedSets: null,
                latestCompletedAt: null,
                previousCompletedAt: null,
                loadTrend: "UNKNOWN",
                repTrend: "UNKNOWN",
              }, {
                adaptation: {
                  deloadHistory,
                },
              });
            },
          });

          await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          assert.deepEqual(appliedDeloadHistoryQueryArgs, {
            userProgramId: started.session.userProgramId,
            excludeSourceSessionId: started.session.id,
          });
          assert.equal(appliedDeloadHistoryQueryCalls, 1);
          assert.equal(deriveDeloadHistoryCalls, 1);
          assert.deepEqual(historicalQueryArgs, {
            userProgramId: started.session.userProgramId,
            programDayExerciseId: target.programDayExerciseId,
            limit: 5,
            excludeSessionId: started.session.id,
          });
          assert.equal(aggregationCalls, 1);
          assert.equal(aggregationInputLength, 0);
          assert.deepEqual(decisionInput.trainingStateSignals.adaptation, {
            deloadHistory: neutralDeloadHistory,
          });
          assert.equal(
            Object.hasOwn(decisionInput.trainingStateSignals.adaptation, "plateauDetection"),
            false
          );

          return {
            appliedDeloadHistoryQueryArgs,
            appliedDeloadHistoryQueryCalls,
            deriveDeloadHistoryCalls,
            historicalQueryArgs,
            aggregationCalls,
            aggregationInputLength,
            deloadHistory: decisionInput.trainingStateSignals.adaptation.deloadHistory,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "completion transports one applied deload fact without changing recommendation behavior",
      input: "applied deload history is queried once, derived once, and passed unchanged into decision context",
      fn: async () => {
        const suffix = `complete-deload-transport-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];
          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          let appliedDeloadHistoryQueryCalls = 0;
          let deriveDeloadHistoryCalls = 0;
          let decisionInput = null;
          const deloadHistory = buildDeloadHistory();

          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl(input) {
              decisionInput = input;
              return buildPersistableDecision();
            },
            createProgressionRecommendationRepositoryImpl(db) {
              const repository = createProgressionRecommendationRepository(db);
              return {
                ...repository,
                async findAppliedDeloadHistoryRows(params) {
                  appliedDeloadHistoryQueryCalls += 1;
                  assert.deepEqual(params, {
                    userProgramId: started.session.userProgramId,
                    excludeSourceSessionId: started.session.id,
                  });
                  return [buildAppliedDeloadHistoryRow()];
                },
              };
            },
            deriveDeloadHistoryImpl({ appliedDeloadRows, currentUserProgramId }) {
              deriveDeloadHistoryCalls += 1;
              assert.equal(appliedDeloadRows.length, 1);
              assert.equal(currentUserProgramId, started.session.userProgramId);
              return deloadHistory;
            },
          });

          const result = await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          assert.equal(appliedDeloadHistoryQueryCalls, 1);
          assert.equal(deriveDeloadHistoryCalls, 1);
          assert.deepEqual(decisionInput.trainingStateSignals.adaptation, {
            deloadHistory,
          });
          assert.equal(
            Object.hasOwn(decisionInput.trainingStateSignals.adaptation, "plateauDetection"),
            false
          );
          assert.equal(result.progressionRecommendations[0].decisionType, "MAINTAIN");
          assert.equal(result.progressionRecommendations[0].reasonCode, "RULE_V1_TARGETS_FULLY_MET");

          return {
            appliedDeloadHistoryQueryCalls,
            deriveDeloadHistoryCalls,
            deloadHistory: decisionInput.trainingStateSignals.adaptation.deloadHistory,
            decisionType: result.progressionRecommendations[0].decisionType,
            reasonCode: result.progressionRecommendations[0].reasonCode,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "completion transports multiple applied deloads unchanged",
      input: "derived multi-row deload history reaches decision context without synthesis",
      fn: async () => {
        const suffix = `complete-deload-multiple-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];
          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          let decisionInput = null;
          const deloadHistory = buildDeloadHistory({
            recentDeloadCount: 2,
            mostRecentDeloadAt: "2026-07-22T10:00:00.000Z",
            hasRecentDeload: true,
          });

          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl(input) {
              decisionInput = input;
              return buildPersistableDecision();
            },
            createProgressionRecommendationRepositoryImpl(db) {
              const repository = createProgressionRecommendationRepository(db);
              return {
                ...repository,
                async findAppliedDeloadHistoryRows() {
                  return [
                    buildAppliedDeloadHistoryRow({
                      id: 9002,
                      appliedAt: "2026-07-22T10:00:00.000Z",
                      recommendation: { id: 102, sourceSessionId: 7002 },
                    }),
                    buildAppliedDeloadHistoryRow(),
                  ];
                },
              };
            },
            deriveDeloadHistoryImpl({ appliedDeloadRows, currentUserProgramId }) {
              assert.equal(appliedDeloadRows.length, 2);
              assert.equal(currentUserProgramId, started.session.userProgramId);
              return deloadHistory;
            },
          });

          await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          assert.deepEqual(decisionInput.trainingStateSignals.adaptation, {
            deloadHistory,
          });

          return {
            deloadHistory: decisionInput.trainingStateSignals.adaptation.deloadHistory,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "successful completion persists normalized recommendations and advances the active program",
      input: "completed active session with performed sets and a previously applied recommendation",
      fn: async () => {
        const suffix = `complete-success-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          const { started, sourceRecommendation, targetExercise } =
            await createStartedSessionWithAppliedRecommendation({ userId: user.id });
          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: targetExercise.exerciseId,
            sets: [
              { reps: 10, weightKg: 40 },
              { reps: 10, weightKg: 40 },
            ],
          });

          const activeBefore = await getActiveUserProgram(user.id);
          const recommendationsBefore = await countUserRecommendations(user.id);

          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl: () => buildPersistableDecision(),
          });

          const result = await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          const completedSession = await prisma.workoutSession.findUniqueOrThrow({
            where: { id: started.session.id },
          });
          const appliedRecommendation = await prisma.progressionRecommendation.findUniqueOrThrow({
            where: { id: sourceRecommendation.id },
          });
          const createdRecommendations = await prisma.progressionRecommendation.findMany({
            where: {
              userId: user.id,
              sourceSessionId: started.session.id,
            },
            orderBy: [{ id: "asc" }],
          });

          assert.equal(completedSession.status, "completed");
          assert.notEqual(completedSession.completedAt, null);
          assert.equal(appliedRecommendation.lifecycleStatus, "APPLIED");
          assert.equal(createdRecommendations.length >= 1, true);
          assert.notEqual(result.nextProgramDay, null);
          assert.equal(result.updatedUserProgram.currentDayIndex, result.nextProgramDay.dayIndex);
          assert.equal(result.updatedUserProgram.currentDayIndex !== activeBefore.currentDayIndex, true);
          assert.equal(await countUserRecommendations(user.id), recommendationsBefore + createdRecommendations.length);

          return {
            sessionStatus: completedSession.status,
            recommendationCount: createdRecommendations.length,
            sourceRecommendationLifecycleStatus: appliedRecommendation.lifecycleStatus,
            advancedToDayIndex: result.updatedUserProgram.currentDayIndex,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "completion continues with neutral historical signals when aggregation fails",
      input: "historical signal aggregation throws but completion still succeeds",
      fn: async () => {
        const suffix = `complete-history-fail-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];

          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [
              { reps: 10, weightKg: 40 },
              { reps: 10, weightKg: 40 },
            ],
          });

          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl: () => buildPersistableDecision(),
            deriveTrainingStateSignalsFromExposuresImpl() {
              throw new Error("synthetic historical aggregation failure");
            },
          });

          const result = await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          const completedSession = await prisma.workoutSession.findUniqueOrThrow({
            where: { id: started.session.id },
          });
          const createdRecommendations = await prisma.progressionRecommendation.findMany({
            where: {
              userId: user.id,
              sourceSessionId: started.session.id,
            },
          });

          assert.equal(completedSession.status, "completed");
          assert.equal(createdRecommendations.length >= 1, true);
          assert.equal(Array.isArray(result.progressionRecommendations), true);

          return {
            sessionStatus: completedSession.status,
            recommendationCount: createdRecommendations.length,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "completion continues with neutral historical signals when repository history query fails",
      input: "history repository throws but completion still succeeds with unchanged recommendation output",
      fn: async () => {
        const suffix = `complete-history-query-fail-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];

          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [
              { reps: 10, weightKg: 40 },
              { reps: 10, weightKg: 40 },
            ],
          });

          let aggregationCalls = 0;
          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl: () => buildPersistableDecision(),
            createWorkoutSessionRepositoryImpl(db) {
              const repository = createWorkoutSessionRepository(db);
              return {
                ...repository,
                async findCompletedHistoryForUserProgramDayExercise() {
                  throw new Error("synthetic history repository failure");
                },
              };
            },
            deriveTrainingStateSignalsFromExposuresImpl() {
              aggregationCalls += 1;
              return buildTrainingStateSignals({
                completedExposureCount: 0,
                averageCompletionRatio: null,
                averageCompletedSets: null,
                latestCompletedAt: null,
                previousCompletedAt: null,
                loadTrend: "UNKNOWN",
                repTrend: "UNKNOWN",
              });
            },
          });

          const result = await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          const completedSession = await prisma.workoutSession.findUniqueOrThrow({
            where: { id: started.session.id },
          });
          const createdRecommendation = await prisma.progressionRecommendation.findFirstOrThrow({
            where: {
              userId: user.id,
              sourceSessionId: started.session.id,
            },
            orderBy: { id: "asc" },
          });

          assert.equal(completedSession.status, "completed");
          assert.equal(aggregationCalls, 0);
          assert.deepEqual(projectComparableRecommendation(createdRecommendation), {
            recommendationType: "maintain",
            decisionType: "MAINTAIN",
            loadAdjustmentSteps: 0,
            repAdjustment: 0,
            setAdjustment: 0,
            durationAdjustmentSteps: 0,
            confidence: 0.8,
            reasonCode: "RULE_V1_TARGETS_FULLY_MET",
            rulesVersion: "progression_decision_rules_v5",
            progressionType: "load",
            consecutiveFailures: 1,
            reason: "Targets were fully met; load maintained for the next session.",
            status: "active",
          });
          assert.equal(Array.isArray(result.progressionRecommendations), true);

          return {
            sessionStatus: completedSession.status,
            aggregationCalls,
            recommendation: projectComparableRecommendation(createdRecommendation),
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "historical repository output remains immutable across completion and aggregation",
      input: "frozen repository exposure rows are passed through without mutation",
      fn: async () => {
        const suffix = `complete-history-immutable-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];

          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          const frozenExposures = deepFreeze(
            buildHistoricalSignalScenarioExposures({
              userProgramId: started.session.userProgramId,
              programDayExerciseId: target.programDayExerciseId,
              exerciseId: target.exerciseId,
              scenario: "increasing-load",
            })
          );
          const before = serializeForLog(frozenExposures);
          let aggregatorInput = null;

          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl: () => buildPersistableDecision(),
            createWorkoutSessionRepositoryImpl(db) {
              const repository = createWorkoutSessionRepository(db);
              return {
                ...repository,
                async findCompletedHistoryForUserProgramDayExercise() {
                  return frozenExposures;
                },
              };
            },
            deriveTrainingStateSignalsFromExposuresImpl(exposures) {
              aggregatorInput = exposures;
              return buildTrainingStateSignals({
                completedExposureCount: 2,
                averageCompletionRatio: 1 / 3,
                averageCompletedSets: 1,
                latestCompletedAt: "2026-07-24T10:00:00.000Z",
                previousCompletedAt: "2026-07-23T10:00:00.000Z",
                loadTrend: "INCREASING",
                repTrend: "INCREASING",
              });
            },
          });

          await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          const after = serializeForLog(frozenExposures);
          assert.equal(before, after);
          assert.equal(aggregatorInput, frozenExposures);
          assert.equal(Object.isFrozen(frozenExposures), true);

          return {
            unchanged: before === after,
            sameReference: aggregatorInput === frozenExposures,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "completion invokes analyzer and decision engine once per performed target",
      input: "service wrappers track analyzer and decision engine calls",
      fn: async () => {
        const suffix = `complete-invocation-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];

          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [
              { reps: 10, weightKg: 40 },
              { reps: 10, weightKg: 40 },
            ],
          });

          let analyzerCalls = 0;
          let decisionCalls = 0;
          let decisionInput = null;
          let explanationCalls = 0;
          let explainedDecision = null;
          let generatedExplanation = null;
          let mappedRecommendationInput = null;
          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            analyzeExercisePerformanceImpl(input) {
              analyzerCalls += 1;
              return analyzeExercisePerformance(input);
            },
            decideProgressionImpl(input) {
              decisionCalls += 1;
              decisionInput = input;
              decideProgression(input);
              return buildPersistableDecision();
            },
            buildProgressionExplanationImpl({ decision }) {
              explanationCalls += 1;
              explainedDecision = decision;
              generatedExplanation = buildProgressionExplanation({ decision });
              return generatedExplanation;
            },
            mapDecisionToProgressionRecommendationDataImpl(input) {
              mappedRecommendationInput = input;
              return {
                userId: input.userId,
                exerciseId: input.exerciseId,
                sourceSessionId: input.sourceSessionId,
                recommendationType: "maintain",
                decisionType: "MAINTAIN",
                previousWeightKg: null,
                recommendedWeightKg: null,
                previousTargetLow: 6,
                previousTargetHigh: 12,
                recommendedTargetLow: null,
                recommendedTargetHigh: null,
                targetSets: null,
                loadAdjustmentSteps: 0,
                repAdjustment: 0,
                setAdjustment: 0,
                durationAdjustmentSteps: 0,
                confidence: 0.8,
                reasonCode: "RULE_V1_TARGETS_FULLY_MET",
                rulesVersion: "progression_decision_rules_v5",
                progressionType: "load",
                consecutiveFailures: 1,
                reason: "Targets were fully met; load maintained for the next session.",
                status: "active",
              };
            },
          });

          const result = await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          assert.equal(analyzerCalls, 1);
          assert.equal(decisionCalls, 1);
          assert.equal(explanationCalls, 1);
          assert.equal(explainedDecision, mappedRecommendationInput.decision);
          assert.equal(Object.hasOwn(decisionInput, "historicalTrainingSignals"), false);
          assert.equal(Object.hasOwn(decisionInput, "trainingStateSignals"), true);
          assert.equal(Object.isFrozen(decisionInput.trainingStateSignals), true);
          assert.equal(
            Object.isFrozen(
              decisionInput.trainingStateSignals.fatigue.historicalTrainingSignals
            ),
            true
          );
          assert.deepEqual(decisionInput.existingRecommendationContext, null);
          assert.deepEqual(decisionInput.policyThresholds, {
            deloadFailureStreak: 2,
          });
          assert.equal(
            Object.hasOwn(mappedRecommendationInput, "historicalTrainingSignals"),
            false
          );
          assert.equal(
            Object.hasOwn(result.progressionRecommendations[0], "historicalTrainingSignals"),
            false
          );
          assert.deepEqual(
            result.progressionRecommendations[0].explanation,
            projectPublicExplanation(generatedExplanation)
          );
          assert.equal(
            Object.hasOwn(result.progressionRecommendations[0].explanation, "developerSummary"),
            false
          );
          assert.equal(
            Object.hasOwn(result.progressionRecommendations[0], "programDayExerciseId"),
            false
          );

          return {
            analyzerCalls,
            decisionCalls,
            explanationCalls,
            decisionInput,
            explainedDecision,
            generatedExplanation: projectPublicExplanation(generatedExplanation),
            mappedRecommendationInput,
            responseRecommendation: result.progressionRecommendations[0],
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "historical signal integration preserves recommendation outputs",
      input: "non-neutral versus failing aggregation yields identical persisted recommendations",
      fn: async () => {
        const firstUser = await createTestUser({
          suffix: `complete-history-equivalence-a-${Date.now()}`,
          profileData: buildCompleteProfileData(),
        });
        const secondUser = await createTestUser({
          suffix: `complete-history-equivalence-b-${Date.now()}`,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(firstUser.id);
          await generateProgramForUser(secondUser.id);

          const firstStarted = await createStartedSession({ userId: firstUser.id });
          const secondStarted = await createStartedSession({ userId: secondUser.id });
          const firstTarget =
            firstStarted.session.exerciseTargets.find((entry) =>
              ["load", "reps_then_load"].includes(entry.progressionType ?? "load")
            ) ?? firstStarted.session.exerciseTargets[0];
          const secondTarget =
            secondStarted.session.exerciseTargets.find((entry) =>
              ["load", "reps_then_load"].includes(entry.progressionType ?? "load")
            ) ?? secondStarted.session.exerciseTargets[0];

          await addSetLogsForSession({
            sessionId: firstStarted.session.id,
            exerciseId: firstTarget.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });
          await addSetLogsForSession({
            sessionId: secondStarted.session.id,
            exerciseId: secondTarget.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          const firstService = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl: () => buildPersistableDecision(),
            deriveTrainingStateSignalsFromExposuresImpl() {
              return buildTrainingStateSignals({
                completedExposureCount: 5,
                averageCompletionRatio: 0.8,
                averageCompletedSets: 2.6,
                latestCompletedAt: "2026-07-25T10:00:00.000Z",
                previousCompletedAt: "2026-07-24T10:00:00.000Z",
                loadTrend: "INCREASING",
                repTrend: "STABLE",
              });
            },
          });
          const secondService = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl: () => buildPersistableDecision(),
            deriveTrainingStateSignalsFromExposuresImpl() {
              throw new Error("synthetic historical aggregation failure");
            },
          });

          await firstService.completeWorkoutSession({
            userId: firstUser.id,
            sessionId: firstStarted.session.id,
          });
          await secondService.completeWorkoutSession({
            userId: secondUser.id,
            sessionId: secondStarted.session.id,
          });

          const firstRecommendation = await prisma.progressionRecommendation.findFirstOrThrow({
            where: {
              userId: firstUser.id,
              sourceSessionId: firstStarted.session.id,
            },
            orderBy: { id: "asc" },
          });
          const secondRecommendation = await prisma.progressionRecommendation.findFirstOrThrow({
            where: {
              userId: secondUser.id,
              sourceSessionId: secondStarted.session.id,
            },
            orderBy: { id: "asc" },
          });

          assert.deepEqual(
            projectComparableRecommendation(firstRecommendation),
            projectComparableRecommendation(secondRecommendation)
          );

          return {
            recommendation: projectComparableRecommendation(firstRecommendation),
          };
        } finally {
          await cleanupUserArtifacts(firstUser.id);
          await cleanupUserArtifacts(secondUser.id);
        }
      },
    },
    {
      name: "canonical R010 service path preserves mapping, persistence, and response baselines",
      input: "triggering historical conflict downgrades the canonical R010 path without application-side leakage",
      fn: async () => {
        const suffix = `complete-r010-baseline-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target =
            started.session.exerciseTargets.find((entry) =>
              ["load", "reps_then_load"].includes(entry.progressionType ?? "load")
            ) ?? started.session.exerciseTargets[0];

          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [
              { reps: 10, weightKg: 42.5 },
              { reps: 10, weightKg: 45 },
              { reps: 10, weightKg: 45 },
            ],
          });

          const historicalTrainingSignals = deepFreeze({
            completedExposureCount: 2,
            averageCompletionRatio: 1,
            averageCompletedSets: 3,
            latestCompletedAt: "2026-07-28T10:00:00.000Z",
            previousCompletedAt: "2026-07-21T10:00:00.000Z",
            loadTrend: "DECREASING",
            repTrend: "INCREASING",
          });
          const historicalSnapshot = serializeForLog(historicalTrainingSignals);
          const expectedDecision = buildHistoricalConflictDecision({
            sourceSessionId: started.session.id,
            exerciseId: target.exerciseId,
          });
          let decisionInput = null;
          let capturedHistoricalSignals = null;
          let mappedRecommendationInput = null;
          const applicationsBefore = await countUserApplications(user.id);

          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
              reasonCode: null,
            }),
            analyzeExercisePerformanceImpl() {
              return {
                exerciseId: target.exerciseId,
                sourceSessionId: started.session.id,
                prescription: {
                  prescribedSets: 3,
                  prescribedRepLow: target.targetRepRangeLow,
                  prescribedRepHigh: target.targetRepRangeHigh,
                  prescribedRestSeconds: 90,
                },
                observedPerformance: {
                  loggedSetCount: 3,
                  completedSetCount: 3,
                  successfulSetCount: 3,
                  failedSetCount: 0,
                  totalReps: 30,
                  totalVolumeKg: 132.5,
                  averageWeightKg: 44.1667,
                  maximumWeightKg: 45,
                  minimumWeightKg: 42.5,
                  bestSet: { setNumber: 2, reps: 10, weightKg: 45 },
                  finalSet: { setNumber: 3, reps: 10, weightKg: 45 },
                  allPlannedSetsReachedUpperRepBound: false,
                  prescribedSetCompletionRate: 1,
                  targetRepHitRate: 1,
                },
                historyFacts: {
                  previousSessionWeightKg: 42.5,
                  weightDeltaKg: 2.5,
                  weightDeltaPercent: 5.8824,
                  previousPrescribedSetCompletionRate: 0.6667,
                  prescribedSetCompletionRateDelta: 0.3333,
                  consecutiveSuccessfulSessions: 1,
                  consecutiveFailedSessions: 0,
                },
                hasSufficientData: true,
                dataQualityFlags: [],
              };
            },
            deriveTrainingStateSignalsFromExposuresImpl() {
              return buildTrainingStateSignals(historicalTrainingSignals);
            },
            decideProgressionImpl(input) {
              decisionInput = input;
              capturedHistoricalSignals =
                input.trainingStateSignals.fatigue.historicalTrainingSignals;
              return decideProgression(input);
            },
            mapDecisionToProgressionRecommendationDataImpl(input) {
              mappedRecommendationInput = input;
              return mapDecisionToProgressionRecommendationData(input);
            },
          });

          const result = await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          const createdRecommendation = await prisma.progressionRecommendation.findFirstOrThrow({
            where: {
              userId: user.id,
              sourceSessionId: started.session.id,
            },
            orderBy: { id: "asc" },
          });
          const applicationsAfter = await countUserApplications(user.id);

          assert.equal(
            decisionInput.trainingStateSignals.fatigue.historicalTrainingSignals,
            capturedHistoricalSignals
          );
          assert.notEqual(
            decisionInput.trainingStateSignals.fatigue.historicalTrainingSignals,
            historicalTrainingSignals
          );
          assert.equal(Object.hasOwn(decisionInput, "trainingStateSignals"), true);
          assert.equal(Object.hasOwn(decisionInput, "historicalTrainingSignals"), false);
          assert.equal(Object.isFrozen(decisionInput.trainingStateSignals), true);
          assert.equal(
            Object.isFrozen(
              decisionInput.trainingStateSignals.fatigue.historicalTrainingSignals
            ),
            true
          );
          assert.deepEqual(
            decisionInput.trainingStateSignals.fatigue.historicalTrainingSignals,
            historicalTrainingSignals
          );
          assert.equal(serializeForLog(historicalTrainingSignals), historicalSnapshot);
          assert.deepEqual(mappedRecommendationInput.decision, expectedDecision);
          assert.equal(
            Object.hasOwn(mappedRecommendationInput, "historicalTrainingSignals"),
            false
          );
          assert.deepEqual(projectComparableRecommendation(createdRecommendation), {
            recommendationType: "maintain",
            decisionType: "MAINTAIN",
            loadAdjustmentSteps: 0,
            repAdjustment: 0,
            setAdjustment: 0,
            durationAdjustmentSteps: 0,
            confidence: 0.5,
            reasonCode: "RULE_V2_HISTORICAL_TREND_CONFLICT",
            rulesVersion: "progression_decision_rules_v5",
            progressionType: target.progressionType ?? "load",
            consecutiveFailures: 0,
            reason: "Performance improved, but declining historical trends triggered a conservative hold for the next session.",
            status: "active",
          });
          assert.deepEqual(
            projectComparableRecommendation(result.progressionRecommendations[0]),
            projectComparableRecommendation(createdRecommendation)
          );
          assert.equal(applicationsBefore, 0);
          assert.equal(applicationsAfter, 0);

          return {
            decisionInput,
            mappedRecommendationInput,
            recommendation: projectComparableRecommendation(createdRecommendation),
            responseRecommendation: projectComparableRecommendation(
              result.progressionRecommendations[0]
            ),
            applicationsBefore,
            applicationsAfter,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "recovery override path preserves service wiring and downstream baselines",
      input: "positive historical state remains engine-identical while caution recovery produces the existing override result",
      fn: async () => {
        const suffix = `complete-recovery-override-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target =
            started.session.exerciseTargets.find((entry) =>
              ["load", "reps_then_load"].includes(entry.progressionType ?? "load")
            ) ?? started.session.exerciseTargets[0];

          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [
              { reps: 10, weightKg: 42.5 },
              { reps: 10, weightKg: 45 },
              { reps: 10, weightKg: 45 },
            ],
          });

          const historicalTrainingSignals = deepFreeze({
            completedExposureCount: 2,
            averageCompletionRatio: 1,
            averageCompletedSets: 3,
            latestCompletedAt: "2026-07-28T10:00:00.000Z",
            previousCompletedAt: "2026-07-21T10:00:00.000Z",
            loadTrend: "INCREASING",
            repTrend: "STABLE",
          });
          const historicalSnapshot = serializeForLog(historicalTrainingSignals);
          let decisionInput = null;
          let mappedRecommendationInput = null;

          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "caution",
              confidence: 0.8,
              signalStrength: "strong",
              reasonCode: "behavioral",
            }),
            analyzeExercisePerformanceImpl() {
              return {
                exerciseId: target.exerciseId,
                sourceSessionId: started.session.id,
                prescription: {
                  prescribedSets: 3,
                  prescribedRepLow: target.targetRepRangeLow,
                  prescribedRepHigh: target.targetRepRangeHigh,
                  prescribedRestSeconds: 90,
                },
                observedPerformance: {
                  loggedSetCount: 3,
                  completedSetCount: 3,
                  successfulSetCount: 3,
                  failedSetCount: 0,
                  totalReps: 30,
                  totalVolumeKg: 132.5,
                  averageWeightKg: 44.1667,
                  maximumWeightKg: 45,
                  minimumWeightKg: 42.5,
                  bestSet: { setNumber: 2, reps: 10, weightKg: 45 },
                  finalSet: { setNumber: 3, reps: 10, weightKg: 45 },
                  allPlannedSetsReachedUpperRepBound: false,
                  prescribedSetCompletionRate: 1,
                  targetRepHitRate: 1,
                },
                historyFacts: {
                  previousSessionWeightKg: 42.5,
                  weightDeltaKg: 2.5,
                  weightDeltaPercent: 5.8824,
                  previousPrescribedSetCompletionRate: 0.6667,
                  prescribedSetCompletionRateDelta: 0.3333,
                  consecutiveSuccessfulSessions: 1,
                  consecutiveFailedSessions: 0,
                },
                hasSufficientData: true,
                dataQualityFlags: [],
              };
            },
            deriveTrainingStateSignalsFromExposuresImpl() {
              return buildTrainingStateSignals(historicalTrainingSignals);
            },
            decideProgressionImpl(input) {
              decisionInput = input;
              return decideProgression(input);
            },
            mapDecisionToProgressionRecommendationDataImpl(input) {
              mappedRecommendationInput = input;
              return mapDecisionToProgressionRecommendationData(input);
            },
          });

          const result = await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          const createdRecommendation = await prisma.progressionRecommendation.findFirstOrThrow({
            where: {
              userId: user.id,
              sourceSessionId: started.session.id,
            },
            orderBy: { id: "asc" },
          });

          assert.equal(Object.hasOwn(decisionInput, "historicalTrainingSignals"), false);
          assert.equal(Object.hasOwn(decisionInput, "trainingStateSignals"), true);
          assert.equal(Object.isFrozen(decisionInput.trainingStateSignals), true);
          assert.equal(
            Object.isFrozen(
              decisionInput.trainingStateSignals.fatigue.historicalTrainingSignals
            ),
            true
          );
          assert.deepEqual(
            decisionInput.trainingStateSignals.fatigue.historicalTrainingSignals,
            historicalTrainingSignals
          );
          assert.equal(serializeForLog(historicalTrainingSignals), historicalSnapshot);
          assert.equal(mappedRecommendationInput.decision.reasonCode, "RULE_V1_RECOVERY_OVERRIDE");
          assert.deepEqual(projectComparableRecommendation(createdRecommendation), {
            recommendationType: "maintain",
            decisionType: "MAINTAIN",
            loadAdjustmentSteps: 0,
            repAdjustment: 0,
            setAdjustment: 0,
            durationAdjustmentSteps: 0,
            confidence: 0.4,
            reasonCode: "RULE_V1_RECOVERY_OVERRIDE",
            rulesVersion: "progression_decision_rules_v5",
            progressionType: target.progressionType ?? "load",
            consecutiveFailures: 0,
            reason: "Performance supported progression, but recovery signals triggered a conservative hold for the next session.",
            status: "active",
          });
          assert.deepEqual(
            projectComparableRecommendation(result.progressionRecommendations[0]),
            projectComparableRecommendation(createdRecommendation)
          );

          return {
            decisionInput,
            mappedRecommendationInput,
            recommendation: projectComparableRecommendation(createdRecommendation),
            responseRecommendation: projectComparableRecommendation(
              result.progressionRecommendations[0]
            ),
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "deload history variants preserve canonical R010 service outputs",
      input: "neutral versus populated applied-deload history yields identical persistence, explanation, and response payloads",
      fn: async () => {
        const firstUser = await createTestUser({
          suffix: `complete-deload-passive-a-${Date.now()}`,
          profileData: buildCompleteProfileData(),
        });
        const secondUser = await createTestUser({
          suffix: `complete-deload-passive-b-${Date.now()}`,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(firstUser.id);
          await generateProgramForUser(secondUser.id);

          const firstStarted = await createStartedSession({ userId: firstUser.id });
          const secondStarted = await createStartedSession({ userId: secondUser.id });
          const firstTarget =
            firstStarted.session.exerciseTargets.find((entry) =>
              ["load", "reps_then_load"].includes(entry.progressionType ?? "load")
            ) ?? firstStarted.session.exerciseTargets[0];
          const secondTarget =
            secondStarted.session.exerciseTargets.find((entry) =>
              ["load", "reps_then_load"].includes(entry.progressionType ?? "load")
            ) ?? secondStarted.session.exerciseTargets[0];

          await addSetLogsForSession({
            sessionId: firstStarted.session.id,
            exerciseId: firstTarget.exerciseId,
            sets: [
              { reps: 10, weightKg: 42.5 },
              { reps: 10, weightKg: 45 },
              { reps: 10, weightKg: 45 },
            ],
          });
          await addSetLogsForSession({
            sessionId: secondStarted.session.id,
            exerciseId: secondTarget.exerciseId,
            sets: [
              { reps: 10, weightKg: 42.5 },
              { reps: 10, weightKg: 45 },
              { reps: 10, weightKg: 45 },
            ],
          });

          const historicalTrainingSignals = deepFreeze({
            completedExposureCount: 2,
            averageCompletionRatio: 1,
            averageCompletedSets: 3,
            latestCompletedAt: "2026-07-28T10:00:00.000Z",
            previousCompletedAt: "2026-07-21T10:00:00.000Z",
            loadTrend: "DECREASING",
            repTrend: "INCREASING",
          });
          const neutralDeloadHistory = buildDeloadHistory({
            recentDeloadCount: 0,
            mostRecentDeloadAt: null,
            hasRecentDeload: false,
          });
          const populatedDeloadHistory = buildDeloadHistory({
            recentDeloadCount: 2,
            mostRecentDeloadAt: "2026-07-22T10:00:00.000Z",
            hasRecentDeload: true,
          });

          let firstDecisionInput = null;
          let secondDecisionInput = null;

          function buildService({ deloadHistory, started }) {
            return createWorkoutSessionService({
              analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
              computeRecoveryModifierImpl: () => ({
                recoveryModifier: "neutral",
                confidence: 0.5,
                signalStrength: "moderate",
                reasonCode: null,
              }),
              analyzeExercisePerformanceImpl() {
                return {
                  exerciseId: started.session.id === firstStarted.session.id
                    ? firstTarget.exerciseId
                    : secondTarget.exerciseId,
                  sourceSessionId: started.session.id,
                  prescription: {
                    prescribedSets: 3,
                    prescribedRepLow:
                      started.session.id === firstStarted.session.id
                        ? firstTarget.targetRepRangeLow
                        : secondTarget.targetRepRangeLow,
                    prescribedRepHigh:
                      started.session.id === firstStarted.session.id
                        ? firstTarget.targetRepRangeHigh
                        : secondTarget.targetRepRangeHigh,
                    prescribedRestSeconds: 90,
                  },
                  observedPerformance: {
                    loggedSetCount: 3,
                    completedSetCount: 3,
                    successfulSetCount: 3,
                    failedSetCount: 0,
                    totalReps: 30,
                    totalVolumeKg: 132.5,
                    averageWeightKg: 44.1667,
                    maximumWeightKg: 45,
                    minimumWeightKg: 42.5,
                    bestSet: { setNumber: 2, reps: 10, weightKg: 45 },
                    finalSet: { setNumber: 3, reps: 10, weightKg: 45 },
                    allPlannedSetsReachedUpperRepBound: false,
                    prescribedSetCompletionRate: 1,
                    targetRepHitRate: 1,
                  },
                  historyFacts: {
                    previousSessionWeightKg: 42.5,
                    weightDeltaKg: 2.5,
                    weightDeltaPercent: 5.8824,
                    previousPrescribedSetCompletionRate: 0.6667,
                    prescribedSetCompletionRateDelta: 0.3333,
                    consecutiveSuccessfulSessions: 1,
                    consecutiveFailedSessions: 0,
                  },
                  hasSufficientData: true,
                  dataQualityFlags: [],
                };
              },
              deriveTrainingStateSignalsFromExposuresImpl() {
                return buildTrainingStateSignals(historicalTrainingSignals, {
                  adaptation: {
                    deloadHistory,
                  },
                });
              },
              decideProgressionImpl(input) {
                if (started.session.id === firstStarted.session.id) {
                  firstDecisionInput = input;
                } else {
                  secondDecisionInput = input;
                }
                return decideProgression(input);
              },
            });
          }

          const firstResult = await buildService({
            deloadHistory: neutralDeloadHistory,
            started: firstStarted,
          }).completeWorkoutSession({
            userId: firstUser.id,
            sessionId: firstStarted.session.id,
          });
          const secondResult = await buildService({
            deloadHistory: populatedDeloadHistory,
            started: secondStarted,
          }).completeWorkoutSession({
            userId: secondUser.id,
            sessionId: secondStarted.session.id,
          });

          const firstRecommendation = await prisma.progressionRecommendation.findFirstOrThrow({
            where: {
              userId: firstUser.id,
              sourceSessionId: firstStarted.session.id,
            },
            orderBy: { id: "asc" },
          });
          const secondRecommendation = await prisma.progressionRecommendation.findFirstOrThrow({
            where: {
              userId: secondUser.id,
              sourceSessionId: secondStarted.session.id,
            },
            orderBy: { id: "asc" },
          });

          assert.deepEqual(firstDecisionInput.trainingStateSignals.adaptation, {
            deloadHistory: neutralDeloadHistory,
          });
          assert.deepEqual(secondDecisionInput.trainingStateSignals.adaptation, {
            deloadHistory: populatedDeloadHistory,
          });
          assert.deepEqual(
            projectComparableRecommendation(firstRecommendation),
            projectComparableRecommendation(secondRecommendation)
          );
          assert.deepEqual(
            projectComparableRecommendation(firstResult.progressionRecommendations[0]),
            projectComparableRecommendation(secondResult.progressionRecommendations[0])
          );
          assert.deepEqual(
            firstResult.progressionRecommendations[0].explanation,
            secondResult.progressionRecommendations[0].explanation
          );

          return {
            neutralDeloadHistory: firstDecisionInput.trainingStateSignals.adaptation.deloadHistory,
            populatedDeloadHistory:
              secondDecisionInput.trainingStateSignals.adaptation.deloadHistory,
            recommendation: projectComparableRecommendation(firstRecommendation),
            explanation: firstResult.progressionRecommendations[0].explanation,
          };
        } finally {
          await cleanupUserArtifacts(firstUser.id);
          await cleanupUserArtifacts(secondUser.id);
        }
      },
    },
    {
      name: "unknown valid reasons continue through completion with internal generic-safe explanations only",
      input: "fresh persisted recommendation keeps its payload while the internal explanation falls back safely",
      fn: async () => {
        const suffix = `complete-unknown-explanation-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];
          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          let explanationCalls = 0;
          let generatedExplanation = null;
          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl: () =>
              buildPersistableDecision({
                reasonCode: "RULE_V9_UNKNOWN_INTEGRATION_REASON",
              }),
            buildProgressionExplanationImpl({ decision }) {
              explanationCalls += 1;
              generatedExplanation = buildProgressionExplanation({ decision });
              return generatedExplanation;
            },
          });

          const result = await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          const createdRecommendation = await prisma.progressionRecommendation.findFirstOrThrow({
            where: {
              userId: user.id,
              sourceSessionId: started.session.id,
            },
            orderBy: { id: "asc" },
          });

          assert.equal(explanationCalls, 1);
          assert.equal(
            generatedExplanation.messageKey,
            "progression_explanation.rule_v9_unknown_integration_reason"
          );
          assert.equal(
            generatedExplanation.userSummary,
            "Progression decision recorded for the next session."
          );
          assert.equal(createdRecommendation.reasonCode, "RULE_V9_UNKNOWN_INTEGRATION_REASON");
          assert.equal(
            createdRecommendation.reason,
            "Progression decision recorded for the next session."
          );
          assert.equal(Object.hasOwn(createdRecommendation, "explanation"), false);
          assert.deepEqual(
            result.progressionRecommendations[0].explanation,
            projectPublicExplanation(generatedExplanation)
          );
          assert.equal(
            Object.hasOwn(result.progressionRecommendations[0].explanation, "developerSummary"),
            false
          );

          return {
            explanationCalls,
            explanation: projectPublicExplanation(generatedExplanation),
            recommendation: projectComparableRecommendation(createdRecommendation),
            responseRecommendation: projectComparableRecommendation(
              result.progressionRecommendations[0]
            ),
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "multiple fresh recommendations keep explanations aligned by internal programDayExerciseId",
      input: "two persisted recommendations expose the correct public explanation DTO without leaking the internal key",
      fn: async () => {
        const suffix = `complete-multi-explanation-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const [firstTarget, secondTarget] = started.session.exerciseTargets.slice(0, 2);

          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: firstTarget.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });
          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: secondTarget.exerciseId,
            sets: [{ reps: 12, weightKg: 0 }],
          });

          const decisionsByProgramDayExerciseId = new Map([
            [
              firstTarget.programDayExerciseId,
              buildPersistableDecision({
                decisionType: "MAINTAIN",
                reasonCode: "RULE_V1_TARGETS_FULLY_MET",
              }),
            ],
            [
              secondTarget.programDayExerciseId,
              buildPersistableDecision({
                decisionType: "MAINTAIN",
                reasonCode: "RULE_V1_RECOVERY_OVERRIDE",
              }),
            ],
          ]);

          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl(input) {
              const programDayExerciseId =
                started.session.exerciseTargets.find(
                  (target) => target.exerciseId === input.analysis.exerciseId
                )?.programDayExerciseId ?? null;

              const decision = decisionsByProgramDayExerciseId.get(programDayExerciseId);
              if (!decision) {
                throw new Error("Missing synthetic decision for target");
              }

              return decision;
            },
          });

          const result = await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          assert.equal(result.progressionRecommendations.length, 2);

          const byExerciseId = new Map(
            result.progressionRecommendations.map((recommendation) => [
              recommendation.exerciseId,
              recommendation,
            ])
          );

          const firstRecommendation = byExerciseId.get(firstTarget.exerciseId);
          const secondRecommendation = byExerciseId.get(secondTarget.exerciseId);

          assert(firstRecommendation);
          assert(secondRecommendation);
          assert.deepEqual(firstRecommendation.explanation, {
            messageKey: "progression_explanation.rule_v1_targets_fully_met",
            userSummary: "Targets were fully met, so the next session stays the same.",
          });
          assert.deepEqual(secondRecommendation.explanation, {
            messageKey: "progression_explanation.rule_v1_recovery_override",
            userSummary:
              "Recovery constraints led to a more conservative recommendation for the next session.",
          });
          assert.equal(Object.hasOwn(firstRecommendation, "programDayExerciseId"), false);
          assert.equal(Object.hasOwn(secondRecommendation, "programDayExerciseId"), false);
          assert.equal(Object.hasOwn(firstRecommendation.explanation, "developerSummary"), false);
          assert.equal(Object.hasOwn(secondRecommendation.explanation, "developerSummary"), false);

          return {
            recommendations: result.progressionRecommendations.map((recommendation) => ({
              exerciseId: recommendation.exerciseId,
              reasonCode: recommendation.reasonCode,
              explanation: recommendation.explanation,
            })),
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "public explanation attachment failure omits only the explanation field",
      input: "DTO serialization defect leaves the successful fresh recommendation payload otherwise unchanged",
      fn: async () => {
        const suffix = `complete-attachment-omit-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];
          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl: () => buildPersistableDecision(),
            buildProgressionExplanationImpl() {
              return Object.freeze({
                messageKey: "",
                userSummary: "",
              });
            },
          });

          const result = await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          const createdRecommendation = await prisma.progressionRecommendation.findFirstOrThrow({
            where: {
              userId: user.id,
              sourceSessionId: started.session.id,
            },
            orderBy: { id: "asc" },
          });

          assert.equal(Object.hasOwn(result.progressionRecommendations[0], "explanation"), false);
          assert.deepEqual(
            projectComparableRecommendation(result.progressionRecommendations[0]),
            projectComparableRecommendation(createdRecommendation)
          );

          return {
            responseRecommendation: projectComparableRecommendation(
              result.progressionRecommendations[0]
            ),
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "historical signal integration preserves recommendation outputs across deterministic history scenarios",
      input: "no history, insufficient history, trend variants, and aggregation fallback all yield identical recommendation fields",
      fn: async () => {
        const scenarios = [
          "no-history",
          "insufficient-history",
          "increasing-load",
          "decreasing-load",
          "stable-trend",
          "unknown-trend",
          "aggregation-fallback",
        ];
        const results = [];

        for (const [index, scenario] of scenarios.entries()) {
          const user = await createTestUser({
            suffix: `complete-history-matrix-${scenario}-${Date.now()}-${index}`,
            profileData: buildCompleteProfileData(),
          });

          try {
            await generateProgramForUser(user.id);
            const started = await createStartedSession({ userId: user.id });
            const target = started.session.exerciseTargets[0];

            await addSetLogsForSession({
              sessionId: started.session.id,
              exerciseId: target.exerciseId,
              sets: [{ reps: 10, weightKg: 40 }],
            });

            const serviceConfig = {
              analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
              computeRecoveryModifierImpl: () => ({
                recoveryModifier: "neutral",
                confidence: 0.5,
                signalStrength: "moderate",
              }),
              decideProgressionImpl: () => buildPersistableDecision(),
            };

            if (scenario === "aggregation-fallback") {
              serviceConfig.deriveTrainingStateSignalsFromExposuresImpl = () => {
                throw new Error("synthetic historical aggregation failure");
              };
            } else {
              const exposures = buildHistoricalSignalScenarioExposures({
                userProgramId: started.session.userProgramId,
                programDayExerciseId: target.programDayExerciseId,
                exerciseId: target.exerciseId,
                scenario,
              });
              serviceConfig.createWorkoutSessionRepositoryImpl = (db) => {
                const repository = createWorkoutSessionRepository(db);
                return {
                  ...repository,
                  async findCompletedHistoryForUserProgramDayExercise() {
                    return exposures;
                  },
                };
              };
            }

            const service = createWorkoutSessionService(serviceConfig);
            await service.completeWorkoutSession({
              userId: user.id,
              sessionId: started.session.id,
            });

            const recommendation = await prisma.progressionRecommendation.findFirstOrThrow({
              where: {
                userId: user.id,
                sourceSessionId: started.session.id,
              },
              orderBy: { id: "asc" },
            });

            results.push({
              scenario,
              recommendation: projectComparableRecommendation(recommendation),
            });
          } finally {
            await cleanupUserArtifacts(user.id);
          }
        }

        const baseline = results[0].recommendation;
        for (const result of results.slice(1)) {
          assert.deepEqual(result.recommendation, baseline);
        }

        return {
          scenarios: results.map((result) => result.scenario),
          recommendation: baseline,
        };
      },
    },
    {
      name: "neutral historical fallback remains isolated across independent completions",
      input: "repeated fallback completions yield identical recommendation output",
      fn: async () => {
        const firstUser = await createTestUser({
          suffix: `complete-history-isolation-a-${Date.now()}`,
          profileData: buildCompleteProfileData(),
        });
        const secondUser = await createTestUser({
          suffix: `complete-history-isolation-b-${Date.now()}`,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(firstUser.id);
          await generateProgramForUser(secondUser.id);

          const firstStarted = await createStartedSession({ userId: firstUser.id });
          const secondStarted = await createStartedSession({ userId: secondUser.id });

          await addSetLogsForSession({
            sessionId: firstStarted.session.id,
            exerciseId: firstStarted.session.exerciseTargets[0].exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });
          await addSetLogsForSession({
            sessionId: secondStarted.session.id,
            exerciseId: secondStarted.session.exerciseTargets[0].exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          const failingService = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl: () => buildPersistableDecision(),
            deriveTrainingStateSignalsFromExposuresImpl() {
              throw new Error("synthetic historical aggregation failure");
            },
          });

          await failingService.completeWorkoutSession({
            userId: firstUser.id,
            sessionId: firstStarted.session.id,
          });
          await failingService.completeWorkoutSession({
            userId: secondUser.id,
            sessionId: secondStarted.session.id,
          });

          const firstRecommendation = await prisma.progressionRecommendation.findFirstOrThrow({
            where: { userId: firstUser.id, sourceSessionId: firstStarted.session.id },
            orderBy: { id: "asc" },
          });
          const secondRecommendation = await prisma.progressionRecommendation.findFirstOrThrow({
            where: { userId: secondUser.id, sourceSessionId: secondStarted.session.id },
            orderBy: { id: "asc" },
          });

          assert.deepEqual(
            projectComparableRecommendation(firstRecommendation),
            projectComparableRecommendation(secondRecommendation)
          );

          return {
            recommendation: projectComparableRecommendation(firstRecommendation),
          };
        } finally {
          await cleanupUserArtifacts(firstUser.id);
          await cleanupUserArtifacts(secondUser.id);
        }
      },
    },
    {
      name: "service completion remains the production owner while standalone orchestrator compatibility resolves by identity",
      input: "orchestrator observes already-existing recommendation after completion service persistence",
      fn: async () => {
        const suffix = `complete-history-ownership-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];

          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl: () => buildPersistableDecision(),
          });

          await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          const actual = await orchestrateProgressionPersistence({
            userId: user.id,
            exerciseId: target.exerciseId,
            sourceSessionId: started.session.id,
            recoveryConstraint: {
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
              reasonCode: null,
            },
          });

          assert.equal(actual.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.ALREADY_EXISTS);
          assert.equal(actual.recommendation?.sourceSessionId, started.session.id);
          assert.equal(actual.recommendation?.exerciseId, target.exerciseId);

          return {
            outcome: actual.outcome,
            sourceSessionId: actual.recommendation?.sourceSessionId ?? null,
            exerciseId: actual.recommendation?.exerciseId ?? null,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "completion rolls back when applied deload history query fails",
      input: "applied deload history repository failure aborts the completion transaction",
      fn: async () => {
        const suffix = `complete-deload-query-fail-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];
          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          const activeBefore = await getActiveUserProgram(user.id);
          const recommendationsBefore = await countUserRecommendations(user.id);
          const applicationsBefore = await countUserApplications(user.id);
          const targetCountBefore = await countUserTargets(user.id);
          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            createProgressionRecommendationRepositoryImpl(db) {
              const repository = createProgressionRecommendationRepository(db);
              return {
                ...repository,
                async findAppliedDeloadHistoryRows() {
                  throw new Error("synthetic applied deload history query failure");
                },
              };
            },
          });

          let thrown = null;
          try {
            await service.completeWorkoutSession({
              userId: user.id,
              sessionId: started.session.id,
            });
          } catch (error) {
            thrown = error;
          }

          const sessionAfter = await prisma.workoutSession.findUniqueOrThrow({
            where: { id: started.session.id },
          });
          const activeAfter = await getActiveUserProgram(user.id);

          assert(thrown instanceof WorkoutSessionCompletionError);
          assert.equal(sessionAfter.status, "active");
          assert.equal(sessionAfter.completedAt, null);
          assert.equal(await countUserRecommendations(user.id), recommendationsBefore);
          assert.equal(await countUserApplications(user.id), applicationsBefore);
          assert.equal(await countUserTargets(user.id), targetCountBefore);
          assert.equal(activeAfter.currentDayIndex, activeBefore.currentDayIndex);

          return {
            errorCode: thrown.code,
            sessionStatus: sessionAfter.status,
            recommendationCount: await countUserRecommendations(user.id),
            applicationCount: await countUserApplications(user.id),
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "completion rolls back when applied deload history derivation fails",
      input: "pure deload history derivation failure aborts the completion transaction",
      fn: async () => {
        const suffix = `complete-deload-derive-fail-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];
          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          const activeBefore = await getActiveUserProgram(user.id);
          const recommendationsBefore = await countUserRecommendations(user.id);
          const applicationsBefore = await countUserApplications(user.id);
          const targetCountBefore = await countUserTargets(user.id);
          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            createProgressionRecommendationRepositoryImpl(db) {
              const repository = createProgressionRecommendationRepository(db);
              return {
                ...repository,
                async findAppliedDeloadHistoryRows() {
                  return [buildAppliedDeloadHistoryRow()];
                },
              };
            },
            deriveDeloadHistoryImpl() {
              throw new Error("synthetic applied deload derivation failure");
            },
          });

          let thrown = null;
          try {
            await service.completeWorkoutSession({
              userId: user.id,
              sessionId: started.session.id,
            });
          } catch (error) {
            thrown = error;
          }

          const sessionAfter = await prisma.workoutSession.findUniqueOrThrow({
            where: { id: started.session.id },
          });
          const activeAfter = await getActiveUserProgram(user.id);

          assert(thrown instanceof WorkoutSessionCompletionError);
          assert.equal(sessionAfter.status, "active");
          assert.equal(sessionAfter.completedAt, null);
          assert.equal(await countUserRecommendations(user.id), recommendationsBefore);
          assert.equal(await countUserApplications(user.id), applicationsBefore);
          assert.equal(await countUserTargets(user.id), targetCountBefore);
          assert.equal(activeAfter.currentDayIndex, activeBefore.currentDayIndex);

          return {
            errorCode: thrown.code,
            sessionStatus: sessionAfter.status,
            recommendationCount: await countUserRecommendations(user.id),
            applicationCount: await countUserApplications(user.id),
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "completion rolls back when analyzer fails",
      input: "analyzer throws before recommendation persistence",
      fn: async () => {
        const suffix = `complete-analyzer-fail-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];
          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          const activeBefore = await getActiveUserProgram(user.id);
          const recommendationsBefore = await countUserRecommendations(user.id);
          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            analyzeExercisePerformanceImpl() {
              throw new Error("synthetic analyzer failure");
            },
          });

          let thrown = null;
          try {
            await service.completeWorkoutSession({
              userId: user.id,
              sessionId: started.session.id,
            });
          } catch (error) {
            thrown = error;
          }

          const sessionAfter = await prisma.workoutSession.findUniqueOrThrow({
            where: { id: started.session.id },
          });
          const activeAfter = await getActiveUserProgram(user.id);

          assert(thrown instanceof WorkoutSessionCompletionError);
          assert.equal(sessionAfter.status, "active");
          assert.equal(sessionAfter.completedAt, null);
          assert.equal(await countUserRecommendations(user.id), recommendationsBefore);
          assert.equal(activeAfter.currentDayIndex, activeBefore.currentDayIndex);

          return {
            errorCode: thrown.code,
            sessionStatus: sessionAfter.status,
            currentDayIndex: activeAfter.currentDayIndex,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "completion rolls back when recommendation persistence fails",
      input: "repository createNormalizedRecommendations throws inside transaction",
      fn: async () => {
        const suffix = `complete-recommendation-fail-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];
          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          const activeBefore = await getActiveUserProgram(user.id);
          const recommendationsBefore = await countUserRecommendations(user.id);

          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl: () => buildPersistableDecision(),
            createProgressionRecommendationRepositoryImpl(db) {
              const repository = createProgressionRecommendationRepository(db);
              return {
                ...repository,
                async createNormalizedRecommendations() {
                  throw new Error("synthetic recommendation persistence failure");
                },
              };
            },
          });

          let thrown = null;
          try {
            await service.completeWorkoutSession({
              userId: user.id,
              sessionId: started.session.id,
            });
          } catch (error) {
            thrown = error;
          }

          const sessionAfter = await prisma.workoutSession.findUniqueOrThrow({
            where: { id: started.session.id },
          });
          const activeAfter = await getActiveUserProgram(user.id);

          assert(thrown instanceof WorkoutSessionCompletionError);
          assert.equal(sessionAfter.status, "active");
          assert.equal(await countUserRecommendations(user.id), recommendationsBefore);
          assert.equal(activeAfter.currentDayIndex, activeBefore.currentDayIndex);

          return {
            errorCode: thrown.code,
            sessionStatus: sessionAfter.status,
            recommendationCount: await countUserRecommendations(user.id),
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "completion rolls back when the explanation builder rejects a malformed persisted decision",
      input: "builder validation failure aborts the transaction before recommendation persistence",
      fn: async () => {
        const suffix = `complete-explanation-fail-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];
          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          const activeBefore = await getActiveUserProgram(user.id);
          const recommendationsBefore = await countUserRecommendations(user.id);
          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl: () => ({
              ...buildPersistableDecision(),
              secondaryReasonCodes: "not-an-array",
            }),
          });

          let thrown = null;
          try {
            await service.completeWorkoutSession({
              userId: user.id,
              sessionId: started.session.id,
            });
          } catch (error) {
            thrown = error;
          }

          const sessionAfter = await prisma.workoutSession.findUniqueOrThrow({
            where: { id: started.session.id },
          });
          const activeAfter = await getActiveUserProgram(user.id);

          assert(thrown instanceof WorkoutSessionCompletionError);
          assert.equal(sessionAfter.status, "active");
          assert.equal(await countUserRecommendations(user.id), recommendationsBefore);
          assert.equal(activeAfter.currentDayIndex, activeBefore.currentDayIndex);

          return {
            errorCode: thrown.code,
            sessionStatus: sessionAfter.status,
            recommendationCount: await countUserRecommendations(user.id),
            currentDayIndex: activeAfter.currentDayIndex,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "completion rolls back when later persistence fails after recommendations are staged",
      input: "user program advancement failure aborts the full transaction",
      fn: async () => {
        const suffix = `complete-advance-fail-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];
          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          const activeBefore = await getActiveUserProgram(user.id);
          const recommendationsBefore = await countUserRecommendations(user.id);

          const service = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl: () => buildPersistableDecision(),
            createUserProgramRepositoryImpl(db) {
              const repository = createUserProgramRepository(db);
              return {
                ...repository,
                async advanceCurrentDayIndexConditionally() {
                  return {
                    matchedCount: 0,
                    userProgram: null,
                  };
                },
              };
            },
          });

          let thrown = null;
          try {
            await service.completeWorkoutSession({
              userId: user.id,
              sessionId: started.session.id,
            });
          } catch (error) {
            thrown = error;
          }

          const sessionAfter = await prisma.workoutSession.findUniqueOrThrow({
            where: { id: started.session.id },
          });
          const activeAfter = await getActiveUserProgram(user.id);

          assert(thrown instanceof WorkoutSessionCompletionError);
          assert.equal(sessionAfter.status, "active");
          assert.equal(await countUserRecommendations(user.id), recommendationsBefore);
          assert.equal(activeAfter.currentDayIndex, activeBefore.currentDayIndex);

          return {
            errorCode: thrown.code,
            sessionStatus: sessionAfter.status,
            currentDayIndex: activeAfter.currentDayIndex,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "already-completed completion path skips applied deload history query",
      input: "second completion attempt fails before deload-history wiring runs",
      fn: async () => {
        const suffix = `complete-deload-skip-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];
          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          const firstService = createWorkoutSessionService({
            analyzeWorkoutHistoryImpl: async () => ({ exerciseSummaries: [], completionRate: null }),
            computeRecoveryModifierImpl: () => ({
              recoveryModifier: "neutral",
              confidence: 0.5,
              signalStrength: "moderate",
            }),
            decideProgressionImpl: () => buildPersistableDecision(),
          });
          await firstService.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          let appliedDeloadHistoryQueryCalls = 0;
          const secondService = createWorkoutSessionService({
            createProgressionRecommendationRepositoryImpl(db) {
              const repository = createProgressionRecommendationRepository(db);
              return {
                ...repository,
                async findAppliedDeloadHistoryRows(...args) {
                  appliedDeloadHistoryQueryCalls += 1;
                  return repository.findAppliedDeloadHistoryRows(...args);
                },
              };
            },
          });

          let thrown = null;
          try {
            await secondService.completeWorkoutSession({
              userId: user.id,
              sessionId: started.session.id,
            });
          } catch (error) {
            thrown = error;
          }

          assert(thrown instanceof WorkoutSessionCompletionError);
          assert.equal(thrown.code, "WORKOUT_SESSION_NOT_ACTIVE");
          assert.equal(appliedDeloadHistoryQueryCalls, 0);

          return {
            errorCode: thrown.code,
            appliedDeloadHistoryQueryCalls,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
    {
      name: "rejects duplicate completion and preserves HTTP compatibility",
      input: "same session is completed twice through the controller",
      fn: async () => {
        const suffix = `complete-duplicate-${Date.now()}`;
        const user = await createTestUser({
          suffix,
          profileData: buildCompleteProfileData(),
        });

        try {
          await generateProgramForUser(user.id);
          const started = await createStartedSession({ userId: user.id });
          const target = started.session.exerciseTargets[0];
          await addSetLogsForSession({
            sessionId: started.session.id,
            exerciseId: target.exerciseId,
            sets: [{ reps: 10, weightKg: 40 }],
          });

          const firstRes = createMockRes();
          await completeWorkoutSession({
            userId: user.id,
            params: { sessionId: String(started.session.id) },
          }, firstRes);

          const secondRes = createMockRes();
          await completeWorkoutSession({
            userId: user.id,
            params: { sessionId: String(started.session.id) },
          }, secondRes);

          assert.equal(firstRes.statusCode, 200);
          assert.equal(firstRes.body.success, true);
          assert.equal(Array.isArray(firstRes.body.data.progressionRecommendations), true);
          assert.equal(Object.hasOwn(firstRes.body.data, "progressionWarning"), true);
          assert.equal(secondRes.statusCode, 400);
          assert.equal(secondRes.body.success, false);

          return {
            firstResponseKeys: Object.keys(firstRes.body.data),
            secondStatusCode: secondRes.statusCode,
            secondMessage: secondRes.body.message,
          };
        } finally {
          await cleanupUserArtifacts(user.id);
        }
      },
    },
  ];

  for (const testCase of cases) {
    if (await runCase(testCase.name, testCase.input, testCase.fn)) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  await prisma.$disconnect();

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error(error.stack || error.message);
  await prisma.$disconnect();
  process.exitCode = 1;
});

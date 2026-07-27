import assert from "node:assert/strict";

import prisma from "../lib/prisma.js";
import { startFromActiveProgram, completeWorkoutSession } from "../controllers/workouts.js";
import { generateProgramForUser } from "./programGenerator.js";
import { analyzeExercisePerformance } from "./exercisePerformanceAnalyzer.js";
import { decideProgression } from "./progressionDecisionEngine.js";
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
    rulesVersion: "progression_decision_rules_v4",
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
      rulesVersion: "progression_decision_rules_v4",
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
              decideProgression(input);
              return buildPersistableDecision();
            },
          });

          await service.completeWorkoutSession({
            userId: user.id,
            sessionId: started.session.id,
          });

          assert.equal(analyzerCalls, 1);
          assert.equal(decisionCalls, 1);

          return {
            analyzerCalls,
            decisionCalls,
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

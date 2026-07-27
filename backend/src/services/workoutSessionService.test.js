import assert from "node:assert/strict";

import prisma from "../lib/prisma.js";
import { startFromActiveProgram, completeWorkoutSession } from "../controllers/workouts.js";
import { generateProgramForUser } from "./programGenerator.js";
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
  createWorkoutSessionService,
  WorkoutSessionStartError,
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
      name: "does not affect completion behavior",
      input: "complete endpoint still delegates to evaluateSessionProgression path",
      fn: async () => {
        assert.match(completeWorkoutSession.toString(), /evaluateSessionProgression/);

        return {
          completionContainsLegacyCall: /evaluateSessionProgression/.test(
            completeWorkoutSession.toString()
          ),
        };
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

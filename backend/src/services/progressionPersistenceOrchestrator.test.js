import assert from "node:assert/strict";

import { Prisma } from "@prisma/client";

import prisma from "../lib/prisma.js";
import { generateProgramForUser } from "./programGenerator.js";
import {
  DECISION_TYPES,
  PROGRESSION_RULES_VERSION,
  REASON_CODES,
} from "./progressionDecisionEngine.js";
import {
  PROGRESSION_PERSISTENCE_OUTCOMES,
  ProgressionPersistenceSourceError,
  ProgressionPersistenceUnsupportedDecisionError,
  ProgressionPersistenceValidationError,
  classifyDecisionPersistability,
  createOrRecoverProgressionRecommendation,
  isProgressionRecommendationIdempotencyP2002,
  mapDecisionToProgressionRecommendationData,
  orchestrateProgressionPersistence,
} from "./progressionPersistenceOrchestrator.js";

const TEST_EMAIL_DOMAIN = "@example.com";
const NEUTRAL_RECOVERY = Object.freeze({
  recoveryModifier: "neutral",
  confidence: 0.4,
  signalStrength: "moderate",
  reasonCode: null,
});
let fixtureSequence = 0;

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

function nextTestSuffix(prefix) {
  fixtureSequence += 1;
  return `${prefix}-${fixtureSequence}`;
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
      email: `progression-orchestrator-${suffix}${TEST_EMAIL_DOMAIN}`,
      name: `Progression Orchestrator ${suffix}`,
      password: "hashed-password",
    },
  });

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
      wizardCompleted: true,
      wizardCompletedAt: new Date("2026-06-01T00:00:00.000Z"),
      lastCompletedStep: 20,
    },
  });

  return user;
}

async function createProgramFixture(suffix) {
  const user = await createTestUser({
    suffix,
    profileData: {
      goal: "hypertrophy",
      trainingLevel: "beginner",
      trainingDaysPerWeek: 2,
      recoveryQuality: "medium",
      sessionDurationMin: 60,
      equipmentAccess: ["barbell", "dumbbell", "machine", "cable", "bodyweight", "pull_up_bar"],
      injuryFlags: ["none"],
    },
  });

  const program = await generateProgramForUser(user.id);
  const firstDay = program.days[0];
  const targetExercise = firstDay.exercises[0];

  return {
    user,
    program,
    firstDay,
    targetExercise,
  };
}

async function createWorkoutSession({
  userId,
  programId = null,
  programDayId = null,
  startedAt,
  completedAt = null,
  status = "completed",
}) {
  return prisma.workoutSession.create({
    data: {
      userId,
      programId,
      programDayId,
      startedAt,
      completedAt,
      status,
    },
  });
}

async function addSetLogs(sessionId, exerciseId, sets, startedAt) {
  return prisma.setLog.createMany({
    data: sets.map((set, index) => ({
      sessionId,
      exerciseId,
      setNumber: set.setNumber,
      reps: set.reps,
      weightKg: set.weightKg,
      loggedAt: new Date(startedAt.getTime() + (index + 1) * 60000),
    })),
  });
}

async function createCompletedExerciseSession({
  userId,
  programId,
  programDayId,
  exerciseId,
  startedAt,
  sets,
}) {
  const session = await createWorkoutSession({
    userId,
    programId,
    programDayId,
    startedAt,
    completedAt: new Date(startedAt.getTime() + 45 * 60000),
    status: "completed",
  });

  await addSetLogs(session.id, exerciseId, sets, startedAt);
  return session;
}

function buildLoggedSets({ targetExercise, reps, weightKg, count = targetExercise.sets }) {
  return Array.from({ length: count }, (_, index) => ({
    setNumber: index + 1,
    reps,
    weightKg,
  }));
}

async function findRecommendation(identity) {
  return prisma.progressionRecommendation.findUnique({
    where: {
      userId_exerciseId_sourceSessionId: identity,
    },
    include: { exercise: true },
  });
}

function buildKnownRequestError({ target }) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "7.7.0",
    meta: { target },
  });
}

function buildDecision(decisionType, reasonCode, overrides = {}) {
  return {
    exerciseId: 15,
    sourceSessionId: 501,
    decisionType,
    loadAdjustmentSteps:
      decisionType === DECISION_TYPES.INCREASE_LOAD
        ? 1
        : decisionType === DECISION_TYPES.DELOAD
          ? -1
          : 0,
    setAdjustment: 0,
    repAdjustment: decisionType === DECISION_TYPES.INCREASE_REPS ? 1 : 0,
    reasonCode,
    secondaryReasonCodes: [],
    confidence: 0.5,
    requiresManualReview: false,
    shouldPersist:
      decisionType !== DECISION_TYPES.INSUFFICIENT_DATA &&
      decisionType !== DECISION_TYPES.SKIP &&
      decisionType !== DECISION_TYPES.MANUAL_REVIEW,
    rulesVersion: PROGRESSION_RULES_VERSION,
    ...overrides,
  };
}

function buildAnalysis(overrides = {}) {
  return {
    exerciseId: 15,
    sourceSessionId: 501,
    prescription: {
      prescribedSets: 3,
      prescribedRepLow: 8,
      prescribedRepHigh: 12,
      prescribedRestSeconds: 90,
    },
    observedPerformance: {
      loggedSetCount: 3,
      completedSetCount: 3,
      successfulSetCount: 3,
      failedSetCount: 0,
      totalReps: 30,
      totalVolumeKg: 1265,
      averageWeightKg: 42.5,
      maximumWeightKg: 45,
      minimumWeightKg: 40,
      bestSet: { setNumber: 3, reps: 8, weightKg: 45 },
      finalSet: { setNumber: 3, reps: 8, weightKg: 45 },
      prescribedSetCompletionRate: 1,
      targetRepHitRate: 1,
    },
    historyFacts: {
      previousSessionWeightKg: 42.5,
      weightDeltaKg: 2.5,
      weightDeltaPercent: 5.8824,
      previousPrescribedSetCompletionRate: 1,
      prescribedSetCompletionRateDelta: 0,
      consecutiveSuccessfulSessions: 2,
      consecutiveFailedSessions: 0,
    },
    hasSufficientData: true,
    dataQualityFlags: [],
    ...overrides,
  };
}

async function withPatchedProgressionRecommendationMethods(overrides, fn) {
  const originalCreate = prisma.progressionRecommendation.create;
  const originalFindUnique = prisma.progressionRecommendation.findUnique;

  if (overrides.create) {
    prisma.progressionRecommendation.create = overrides.create;
  }

  if (overrides.findUnique) {
    prisma.progressionRecommendation.findUnique = overrides.findUnique;
  }

  try {
    return await fn();
  } finally {
    prisma.progressionRecommendation.create = originalCreate;
    prisma.progressionRecommendation.findUnique = originalFindUnique;
  }
}

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "validation -> missing input rejected",
      input: "undefined input",
      fn: async () => {
        await assert.rejects(
          () => orchestrateProgressionPersistence(undefined),
          ProgressionPersistenceValidationError
        );
        return { error: "validated" };
      },
    },
    {
      name: "validation -> missing userId rejected",
      input: "userId is required",
      fn: async () => {
        await assert.rejects(
          () =>
            orchestrateProgressionPersistence({
              exerciseId: 1,
              sourceSessionId: 1,
            }),
          /userId/
        );
        return { error: "validated" };
      },
    },
    {
      name: "validation -> missing exerciseId rejected",
      input: "exerciseId is required",
      fn: async () => {
        await assert.rejects(
          () =>
            orchestrateProgressionPersistence({
              userId: 1,
              sourceSessionId: 1,
            }),
          /exerciseId/
        );
        return { error: "validated" };
      },
    },
    {
      name: "validation -> missing sourceSessionId rejected",
      input: "sourceSessionId is required",
      fn: async () => {
        await assert.rejects(
          () =>
            orchestrateProgressionPersistence({
              userId: 1,
              exerciseId: 1,
            }),
          /sourceSessionId/
        );
        return { error: "validated" };
      },
    },
    {
      name: "validation -> invalid recovery constraint rejected",
      input: "unknown recovery modifier",
      fn: async () => {
        await assert.rejects(
          () =>
            orchestrateProgressionPersistence({
              userId: 1,
              exerciseId: 1,
              sourceSessionId: 1,
              recoveryConstraint: {
                recoveryModifier: "panic",
                confidence: 0.5,
                signalStrength: "moderate",
                reasonCode: null,
              },
            }),
          /recoveryModifier/
        );
        return { error: "validated" };
      },
    },
    {
      name: "validation -> invalid policy override rejected",
      input: "unknown progression mode override",
      fn: async () => {
        await assert.rejects(
          () =>
            orchestrateProgressionPersistence({
              userId: 1,
              exerciseId: 1,
              sourceSessionId: 1,
              progressionPolicyOverride: {
                progressionMode: "velocity",
              },
            }),
          /progressionMode/
        );
        return { error: "validated" };
      },
    },
    {
      name: "source -> source session not found",
      input: "unknown source session id",
      fn: async () => {
        await assert.rejects(
          () =>
            orchestrateProgressionPersistence({
              userId: 999999,
              exerciseId: 1,
              sourceSessionId: 999999,
              recoveryConstraint: NEUTRAL_RECOVERY,
            }),
          ProgressionPersistenceSourceError
        );
        return { error: "validated" };
      },
    },
    {
      name: "source -> ownership mismatch rejected",
      input: "source session belongs to another user",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("ownership"));
        const otherUser = await createTestUser({
          suffix: `${nextTestSuffix("ownership-other")}`,
          profileData: { goal: "hypertrophy" },
        });

        try {
          const session = await createWorkoutSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            completedAt: new Date("2026-07-01T09:45:00.000Z"),
            status: "completed",
          });

          await addSetLogs(
            session.id,
            fixture.targetExercise.exerciseId,
            [
              {
                setNumber: 1,
                reps: fixture.targetExercise.repRangeHigh,
                weightKg: 20,
              },
            ],
            new Date("2026-07-01T09:00:00.000Z")
          );

          await assert.rejects(
            () =>
              orchestrateProgressionPersistence({
                userId: otherUser.id,
                exerciseId: fixture.targetExercise.exerciseId,
                sourceSessionId: session.id,
                recoveryConstraint: NEUTRAL_RECOVERY,
              }),
            ProgressionPersistenceSourceError
          );

          return { sessionId: session.id };
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
          await cleanupUserArtifacts(otherUser.id);
        }
      },
    },
    {
      name: "source -> active session rejected",
      input: "source session must be completed",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("active"));
        try {
          const session = await createWorkoutSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            completedAt: null,
            status: "active",
          });

          await addSetLogs(
            session.id,
            fixture.targetExercise.exerciseId,
            [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 30 }],
            new Date("2026-07-01T09:00:00.000Z")
          );

          await assert.rejects(
            () =>
              orchestrateProgressionPersistence({
                userId: fixture.user.id,
                exerciseId: fixture.targetExercise.exerciseId,
                sourceSessionId: session.id,
                recoveryConstraint: NEUTRAL_RECOVERY,
              }),
            ProgressionPersistenceSourceError
          );

          return { sessionId: session.id };
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "source -> exercise must exist in source session",
      input: "exercise has no set logs in source session",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("missing-ex"));
        try {
          const session = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-02T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 30 }],
          });

          await assert.rejects(
            () =>
              orchestrateProgressionPersistence({
                userId: fixture.user.id,
                exerciseId: fixture.targetExercise.exerciseId + 999999,
                sourceSessionId: session.id,
                recoveryConstraint: NEUTRAL_RECOVERY,
              }),
            ProgressionPersistenceSourceError
          );

          return { sessionId: session.id };
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "source -> exercise must be prescribed in session program day",
      input: "logged extra exercise not present in ProgramDayExercise",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("unprescribed"));
        try {
          const prescribedIds = fixture.firstDay.exercises.map((entry) => entry.exerciseId);
          const extraExercise = await prisma.exercise.findFirstOrThrow({
            where: { id: { notIn: prescribedIds } },
          });

          const session = await createWorkoutSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            startedAt: new Date("2026-07-03T09:00:00.000Z"),
            completedAt: new Date("2026-07-03T09:45:00.000Z"),
            status: "completed",
          });

          await addSetLogs(
            session.id,
            extraExercise.id,
            [{ setNumber: 1, reps: 12, weightKg: 15 }],
            new Date("2026-07-03T09:00:00.000Z")
          );

          await assert.rejects(
            () =>
              orchestrateProgressionPersistence({
                userId: fixture.user.id,
                exerciseId: extraExercise.id,
                sourceSessionId: session.id,
                recoveryConstraint: NEUTRAL_RECOVERY,
              }),
            ProgressionPersistenceSourceError
          );

          return { sessionId: session.id, extraExerciseId: extraExercise.id };
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "created -> maintain recommendation persists",
      input: "partial completion with prior history",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("maintain"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: buildLoggedSets({
              targetExercise: fixture.targetExercise,
              reps: fixture.targetExercise.repRangeHigh,
              weightKg: 30,
            }),
          });

          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: buildLoggedSets({
              targetExercise: fixture.targetExercise,
              reps: fixture.targetExercise.repRangeHigh,
              weightKg: 30,
              count: fixture.targetExercise.sets - 1,
            }),
          });

          const actual = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });

          assert.equal(actual.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.CREATED);
          assert.equal(actual.decision.decisionType, DECISION_TYPES.MAINTAIN);
          assert.equal(actual.recommendation.recommendationType, "maintain");
          assert.equal(actual.recommendation.recommendedWeightKg, null);
          assert.equal(actual.recommendation.reasonCode, REASON_CODES.TARGETS_PARTIALLY_MET);
          return actual;
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "created -> increase recommendation persists",
      input: "full success with previous successful session",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("increase"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: buildLoggedSets({
              targetExercise: fixture.targetExercise,
              reps: fixture.targetExercise.repRangeHigh,
              weightKg: 30,
            }),
          });

          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: buildLoggedSets({
              targetExercise: fixture.targetExercise,
              reps: fixture.targetExercise.repRangeHigh,
              weightKg: null,
            }),
          });

          const actual = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });

          assert.equal(actual.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.CREATED);
          assert.equal(actual.decision.decisionType, DECISION_TYPES.INCREASE_REPS);
          assert.equal(actual.recommendation.recommendationType, "increase");
          assert.equal(actual.recommendation.confidence, actual.decision.confidence);
          assert.equal(actual.recommendation.recommendedWeightKg, null);
          assert.equal(actual.recommendation.reasonCode, REASON_CODES.REPEATED_REP_SUCCESS);
          return actual;
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "created -> deload recommendation persists",
      input: "repeated failed sessions trigger deload",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("deload"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeLow - 1, weightKg: 30 }],
          });

          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeLow - 2, weightKg: 30 }],
          });

          const actual = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });

          assert.equal(actual.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.CREATED);
          assert.equal(actual.decision.decisionType, DECISION_TYPES.DELOAD);
          assert.equal(actual.recommendation.recommendationType, "deload");
          return actual;
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "not persisted -> insufficient data",
      input: "first completed exercise session has no previous history",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("insufficient"));
        try {
          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 30 }],
          });

          const actual = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });

          assert.equal(actual.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.NOT_PERSISTED);
          assert.equal(actual.recommendation, null);
          assert.equal(actual.decision.decisionType, DECISION_TYPES.INSUFFICIENT_DATA);
          return actual;
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "not persisted -> skip for invalid increment",
      input: "policy override marks increment invalid",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("skip"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 30 }],
          });

          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 32.5 }],
          });

          const actual = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
            progressionPolicyOverride: {
              validIncrement: false,
            },
          });

          assert.equal(actual.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.NOT_PERSISTED);
          assert.equal(actual.recommendation, null);
          assert.equal(actual.decision.decisionType, DECISION_TYPES.SKIP);
          return actual;
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "pre-check duplicate returns already exists",
      input: "sequential second invocation",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("precheck"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 30 }],
          });

          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 32.5 }],
          });

          const first = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });
          const second = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });

          assert.equal(first.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.CREATED);
          assert.equal(second.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.ALREADY_EXISTS);
          assert.equal(second.duplicateRecovered, false);
          assert.equal(second.decision, null);
          assert.equal(first.recommendation.id, second.recommendation.id);
          return {
            first,
            second,
          };
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "duplicate invocation leaves row immutable",
      input: "second sequential invocation does not update existing row",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("immutable"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 30 }],
          });

          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 32.5 }],
          });

          await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });

          const before = await findRecommendation({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
          });

          const duplicate = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });

          const after = await findRecommendation({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
          });

          assert.equal(duplicate.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.ALREADY_EXISTS);
          assert.deepEqual(
            {
              confidence: after.confidence,
              reasonCode: after.reasonCode,
              status: after.status,
              targetSets: after.targetSets,
              recommendedWeightKg: after.recommendedWeightKg,
              recommendedTargetLow: after.recommendedTargetLow,
              recommendedTargetHigh: after.recommendedTargetHigh,
              createdAt: after.createdAt,
            },
            {
              confidence: before.confidence,
              reasonCode: before.reasonCode,
              status: before.status,
              targetSets: before.targetSets,
              recommendedWeightKg: before.recommendedWeightKg,
              recommendedTargetLow: before.recommendedTargetLow,
              recommendedTargetHigh: before.recommendedTargetHigh,
              createdAt: before.createdAt,
            }
          );

          return {
            before,
            after,
          };
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "different source session can create another row",
      input: "identity grain includes sourceSessionId",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("different-source"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 30 }],
          });

          const sourceOne = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 32.5 }],
          });
          const sourceTwo = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-15T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 35 }],
          });

          const first = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceOne.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });
          const second = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceTwo.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });

          const count = await prisma.progressionRecommendation.count({
            where: { userId: fixture.user.id, exerciseId: fixture.targetExercise.exerciseId },
          });

          assert.equal(first.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.CREATED);
          assert.equal(second.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.CREATED);
          assert.equal(count, 2);
          return { count, first, second };
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "concurrent invocation yields one row total",
      input: "same identity invoked concurrently",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("concurrent"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 30 }],
          });

          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 32.5 }],
          });

          const [left, right] = await Promise.all([
            orchestrateProgressionPersistence({
              userId: fixture.user.id,
              exerciseId: fixture.targetExercise.exerciseId,
              sourceSessionId: sourceSession.id,
              recoveryConstraint: NEUTRAL_RECOVERY,
            }),
            orchestrateProgressionPersistence({
              userId: fixture.user.id,
              exerciseId: fixture.targetExercise.exerciseId,
              sourceSessionId: sourceSession.id,
              recoveryConstraint: NEUTRAL_RECOVERY,
            }),
          ]);

          const count = await prisma.progressionRecommendation.count({
            where: {
              userId: fixture.user.id,
              exerciseId: fixture.targetExercise.exerciseId,
              sourceSessionId: sourceSession.id,
            },
          });

          const outcomes = [left.outcome, right.outcome].sort();
          assert.deepEqual(outcomes, [
            PROGRESSION_PERSISTENCE_OUTCOMES.ALREADY_EXISTS,
            PROGRESSION_PERSISTENCE_OUTCOMES.CREATED,
          ]);
          assert.equal(count, 1);
          return { left, right, count };
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "helper -> intended P2002 target array matches",
      input: "meta.target array",
      fn: () => {
        assert.equal(
          isProgressionRecommendationIdempotencyP2002(
            buildKnownRequestError({
              target: ["userId", "exerciseId", "sourceSessionId"],
            })
          ),
          true
        );
        return { matched: true };
      },
    },
    {
      name: "helper -> intended P2002 quoted target array matches",
      input: "meta.target array with quoted fields",
      fn: () => {
        assert.equal(
          isProgressionRecommendationIdempotencyP2002(
            buildKnownRequestError({
              target: ['"userId"', '"exerciseId"', '"sourceSessionId"'],
            })
          ),
          true
        );
        return { matched: true };
      },
    },
    {
      name: "helper -> intended P2002 index name matches",
      input: "meta.target index name",
      fn: () => {
        assert.equal(
          isProgressionRecommendationIdempotencyP2002(
            buildKnownRequestError({
              target: "ProgressionRecommendation_userId_exerciseId_sourceSessionId_key",
            })
          ),
          true
        );
        return { matched: true };
      },
    },
    {
      name: "helper -> unrelated P2002 does not match",
      input: "meta.target other unique field",
      fn: () => {
        assert.equal(
          isProgressionRecommendationIdempotencyP2002(
            buildKnownRequestError({
              target: ["email"],
            })
          ),
          false
        );
        return { matched: false };
      },
    },
    {
      name: "helper -> createOrRecover success path",
      input: "create returns persisted recommendation",
      fn: async () => {
        const fakeRecommendation = {
          id: 1,
          exerciseId: 10,
          sourceSessionId: 20,
          exercise: { id: 10 },
        };

        const actual = await withPatchedProgressionRecommendationMethods(
          {
            create: async () => fakeRecommendation,
          },
          async () =>
            createOrRecoverProgressionRecommendation({
              identity: { userId: 1, exerciseId: 10, sourceSessionId: 20 },
              createData: { userId: 1, exerciseId: 10, sourceSessionId: 20 },
            })
        );

        assert.equal(actual.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.CREATED);
        assert.equal(actual.duplicateRecovered, false);
        assert.deepEqual(actual.recommendation, fakeRecommendation);
        return actual;
      },
    },
    {
      name: "helper -> intended P2002 recovery returns existing row",
      input: "create throws intended duplicate and existing row is fetched",
      fn: async () => {
        const fakeRecommendation = {
          id: 2,
          exerciseId: 10,
          sourceSessionId: 20,
          exercise: { id: 10 },
        };

        const actual = await withPatchedProgressionRecommendationMethods(
          {
            create: async () => {
              throw buildKnownRequestError({
                target: ["userId", "exerciseId", "sourceSessionId"],
              });
            },
            findUnique: async () => fakeRecommendation,
          },
          async () =>
            createOrRecoverProgressionRecommendation({
              identity: { userId: 1, exerciseId: 10, sourceSessionId: 20 },
              createData: { userId: 1, exerciseId: 10, sourceSessionId: 20 },
            })
        );

        assert.equal(actual.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.ALREADY_EXISTS);
        assert.equal(actual.duplicateRecovered, true);
        assert.deepEqual(actual.recommendation, fakeRecommendation);
        return actual;
      },
    },
    {
      name: "helper -> unrelated P2002 is rethrown",
      input: "different unique target",
      fn: async () => {
        const error = buildKnownRequestError({ target: ["email"] });

        await assert.rejects(
          () =>
            withPatchedProgressionRecommendationMethods(
              {
                create: async () => {
                  throw error;
                },
              },
              async () =>
                createOrRecoverProgressionRecommendation({
                  identity: { userId: 1, exerciseId: 10, sourceSessionId: 20 },
                  createData: { userId: 1, exerciseId: 10, sourceSessionId: 20 },
                })
            ),
          (thrown) => thrown === error
        );

        return { error: "rethrows" };
      },
    },
    {
      name: "helper -> intended P2002 without recoverable row throws integrity error",
      input: "create throws intended duplicate but lookup finds nothing",
      fn: async () => {
        await assert.rejects(
          () =>
            withPatchedProgressionRecommendationMethods(
              {
                create: async () => {
                  throw buildKnownRequestError({
                    target: ["userId", "exerciseId", "sourceSessionId"],
                  });
                },
                findUnique: async () => null,
              },
              async () =>
                createOrRecoverProgressionRecommendation({
                  identity: { userId: 1, exerciseId: 10, sourceSessionId: 20 },
                  createData: { userId: 1, exerciseId: 10, sourceSessionId: 20 },
                })
            ),
          /idempotency recovery failed/
        );

        return { error: "integrity" };
      },
    },
    {
      name: "mapping -> maintain writes compatibility-safe fields",
      input: "maintain decision to Prisma payload",
      fn: () => {
        const actual = mapDecisionToProgressionRecommendationData({
          userId: 1,
          exerciseId: 15,
          sourceSessionId: 501,
          decision: buildDecision(DECISION_TYPES.MAINTAIN, REASON_CODES.TARGETS_PARTIALLY_MET),
          analysis: buildAnalysis({
            historyFacts: {
              previousSessionWeightKg: 42.5,
              weightDeltaKg: 0,
              weightDeltaPercent: 0,
              previousPrescribedSetCompletionRate: 1,
              prescribedSetCompletionRateDelta: -0.3333,
              consecutiveSuccessfulSessions: 0,
              consecutiveFailedSessions: 1,
            },
          }),
          prescription: {
            sets: 3,
            repRangeLow: 8,
            repRangeHigh: 12,
            restSeconds: 90,
            progressionType: "load",
          },
          exercise: {
            id: 15,
            progressionType: "load",
          },
          previousRecommendation: {
            consecutiveFailures: 1,
          },
        });

        assert.equal(actual.recommendationType, "maintain");
        assert.equal(actual.previousWeightKg, 42.5);
        assert.equal(actual.recommendedWeightKg, null);
        assert.equal(actual.previousTargetLow, 8);
        assert.equal(actual.previousTargetHigh, 12);
        assert.equal(actual.recommendedTargetLow, null);
        assert.equal(actual.recommendedTargetHigh, null);
        assert.equal(actual.targetSets, null);
        assert.equal(actual.reasonCode, REASON_CODES.TARGETS_PARTIALLY_MET);
        assert.equal(actual.status, "active");
        return actual;
      },
    },
    {
      name: "mapping -> increase writes compatibility-safe fields",
      input: "increase decision to Prisma payload",
      fn: () => {
        const actual = mapDecisionToProgressionRecommendationData({
          userId: 1,
          exerciseId: 15,
          sourceSessionId: 501,
          decision: buildDecision(DECISION_TYPES.INCREASE_LOAD, REASON_CODES.REPEATED_SUCCESS, {
            confidence: 0.8,
          }),
          analysis: buildAnalysis(),
          prescription: {
            sets: 3,
            repRangeLow: 8,
            repRangeHigh: 12,
            restSeconds: 90,
            progressionType: "load",
          },
          exercise: {
            id: 15,
            progressionType: "load",
          },
          previousRecommendation: null,
        });

        assert.equal(actual.recommendationType, "increase");
        assert.equal(actual.confidence, 0.8);
        assert.equal(actual.recommendedWeightKg, null);
        return actual;
      },
    },
    {
      name: "mapping -> increase reps writes compatibility-safe fields",
      input: "INCREASE_REPS persists without concrete rep or load targets",
      fn: () => {
        const actual = mapDecisionToProgressionRecommendationData({
          userId: 1,
          exerciseId: 52,
          sourceSessionId: 552,
          decision: buildDecision(
            DECISION_TYPES.INCREASE_REPS,
            REASON_CODES.REPEATED_REP_SUCCESS,
            {
              exerciseId: 52,
              sourceSessionId: 552,
              confidence: 0.65,
              loadAdjustmentSteps: 0,
              repAdjustment: 1,
            }
          ),
          analysis: buildAnalysis({
            exerciseId: 52,
            sourceSessionId: 552,
            prescription: {
              prescribedSets: 3,
              prescribedRepLow: 12,
              prescribedRepHigh: 20,
              prescribedRestSeconds: 60,
            },
            observedPerformance: {
              loggedSetCount: 3,
              completedSetCount: 3,
              successfulSetCount: 3,
              failedSetCount: 0,
              totalReps: 54,
              totalVolumeKg: 0,
              averageWeightKg: null,
              maximumWeightKg: null,
              minimumWeightKg: null,
              bestSet: { setNumber: 3, reps: 18, weightKg: null },
              finalSet: { setNumber: 3, reps: 18, weightKg: null },
              prescribedSetCompletionRate: 1,
              targetRepHitRate: 1,
            },
            historyFacts: {
              previousSessionWeightKg: null,
              weightDeltaKg: null,
              weightDeltaPercent: null,
              previousPrescribedSetCompletionRate: 1,
              prescribedSetCompletionRateDelta: 0.3333,
              consecutiveSuccessfulSessions: 2,
              consecutiveFailedSessions: 0,
            },
          }),
          prescription: {
            sets: 3,
            repRangeLow: 12,
            repRangeHigh: 20,
            restSeconds: 60,
            progressionType: "reps",
          },
          exercise: {
            id: 52,
            progressionType: "reps",
          },
          previousRecommendation: null,
        });

        assert.equal(actual.recommendationType, "increase");
        assert.equal(actual.recommendedWeightKg, null);
        assert.equal(actual.recommendedTargetLow, null);
        assert.equal(actual.recommendedTargetHigh, null);
        assert.equal(actual.targetSets, null);
        assert.equal(actual.reasonCode, REASON_CODES.REPEATED_REP_SUCCESS);
        assert.equal(actual.confidence, 0.65);
        assert.equal(actual.progressionType, "reps");
        return actual;
      },
    },
    {
      name: "mapping -> deload writes compatibility-safe fields",
      input: "deload decision to Prisma payload",
      fn: () => {
        const actual = mapDecisionToProgressionRecommendationData({
          userId: 1,
          exerciseId: 15,
          sourceSessionId: 501,
          decision: buildDecision(DECISION_TYPES.DELOAD, REASON_CODES.REPEATED_FAILURE),
          analysis: buildAnalysis({
            historyFacts: {
              previousSessionWeightKg: 42.5,
              weightDeltaKg: -2.5,
              weightDeltaPercent: -5.8824,
              previousPrescribedSetCompletionRate: 1,
              prescribedSetCompletionRateDelta: -0.3333,
              consecutiveSuccessfulSessions: 0,
              consecutiveFailedSessions: 2,
            },
          }),
          prescription: {
            sets: 3,
            repRangeLow: 8,
            repRangeHigh: 12,
            restSeconds: 90,
            progressionType: "load",
          },
          exercise: {
            id: 15,
            progressionType: "load",
          },
          previousRecommendation: null,
        });

        assert.equal(actual.recommendationType, "deload");
        assert.equal(actual.reasonCode, REASON_CODES.REPEATED_FAILURE);
        assert.equal(actual.recommendedWeightKg, null);
        return actual;
      },
    },
    {
      name: "persistability -> increase persists",
      input: "INCREASE_LOAD classification",
      fn: () => {
        assert.equal(classifyDecisionPersistability(DECISION_TYPES.INCREASE_LOAD), "PERSIST");
        return { persistability: "PERSIST" };
      },
    },
    {
      name: "persistability -> maintain persists",
      input: "MAINTAIN classification",
      fn: () => {
        assert.equal(classifyDecisionPersistability(DECISION_TYPES.MAINTAIN), "PERSIST");
        return { persistability: "PERSIST" };
      },
    },
    {
      name: "persistability -> deload persists",
      input: "DELOAD classification",
      fn: () => {
        assert.equal(classifyDecisionPersistability(DECISION_TYPES.DELOAD), "PERSIST");
        return { persistability: "PERSIST" };
      },
    },
    {
      name: "persistability -> insufficient data does not persist",
      input: "INSUFFICIENT_DATA classification",
      fn: () => {
        assert.equal(
          classifyDecisionPersistability(DECISION_TYPES.INSUFFICIENT_DATA),
          "DO_NOT_PERSIST"
        );
        return { persistability: "DO_NOT_PERSIST" };
      },
    },
    {
      name: "persistability -> skip does not persist",
      input: "SKIP classification",
      fn: () => {
        assert.equal(classifyDecisionPersistability(DECISION_TYPES.SKIP), "DO_NOT_PERSIST");
        return { persistability: "DO_NOT_PERSIST" };
      },
    },
    {
      name: "persistability -> manual review does not persist",
      input: "MANUAL_REVIEW classification",
      fn: () => {
        assert.equal(
          classifyDecisionPersistability(DECISION_TYPES.MANUAL_REVIEW),
          "DO_NOT_PERSIST"
        );
        return { persistability: "DO_NOT_PERSIST" };
      },
    },
    {
      name: "persistability -> unsupported decision throws",
      input: "future unclassified decision",
      fn: () => {
        assert.throws(
          () => classifyDecisionPersistability("DECREASE_LOAD"),
          ProgressionPersistenceUnsupportedDecisionError
        );
        return { error: "validated" };
      },
    },
    {
      name: "not persisted output has null recommendation",
      input: "insufficient-data path keeps decision and omits row",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("np-null"));
        try {
          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-12T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 30 }],
          });

          const actual = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });

          assert.equal(actual.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.NOT_PERSISTED);
          assert.equal(actual.recommendation, null);
          assert.notEqual(actual.decision, null);
          return actual;
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "created output includes decision and recommendation",
      input: "created path invariants",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("created-shape"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: buildLoggedSets({
              targetExercise: fixture.targetExercise,
              reps: fixture.targetExercise.repRangeHigh,
              weightKg: 30,
            }),
          });
          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: buildLoggedSets({
              targetExercise: fixture.targetExercise,
              reps: fixture.targetExercise.repRangeHigh,
              weightKg: null,
            }),
          });
          const actual = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });
          assert.equal(actual.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.CREATED);
          assert.notEqual(actual.recommendation, null);
          assert.notEqual(actual.decision, null);
          assert.equal(actual.duplicateRecovered, false);
          return actual;
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "already exists output omits freshly recalculated decision",
      input: "duplicate result returns stored row only",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("already-null"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: buildLoggedSets({
              targetExercise: fixture.targetExercise,
              reps: fixture.targetExercise.repRangeHigh,
              weightKg: null,
            }),
          });
          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: buildLoggedSets({
              targetExercise: fixture.targetExercise,
              reps: fixture.targetExercise.repRangeHigh,
              weightKg: null,
            }),
          });
          await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });
          const duplicate = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });
          assert.equal(duplicate.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.ALREADY_EXISTS);
          assert.equal(duplicate.decision, null);
          assert.notEqual(duplicate.recommendation, null);
          return duplicate;
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "mapping -> no concrete target values are invented",
      input: "Phase 2D leaves target fields null",
      fn: () => {
        const actual = mapDecisionToProgressionRecommendationData({
          userId: 1,
          exerciseId: 15,
          sourceSessionId: 501,
          decision: buildDecision(DECISION_TYPES.INCREASE_LOAD, REASON_CODES.REPEATED_SUCCESS),
          analysis: buildAnalysis(),
          prescription: {
            sets: 3,
            repRangeLow: 8,
            repRangeHigh: 12,
            restSeconds: 90,
            progressionType: "load",
          },
          exercise: {
            id: 15,
            progressionType: "load",
          },
          previousRecommendation: null,
        });
        assert.equal(actual.recommendedWeightKg, null);
        assert.equal(actual.recommendedTargetLow, null);
        assert.equal(actual.recommendedTargetHigh, null);
        assert.equal(actual.targetSets, null);
        return actual;
      },
    },
    {
      name: "mapping -> unsupported decision is rejected",
      input: "non-persistable decision cannot map to Prisma payload",
      fn: () => {
        assert.throws(
          () =>
            mapDecisionToProgressionRecommendationData({
              userId: 1,
              exerciseId: 15,
              sourceSessionId: 501,
              decision: buildDecision(DECISION_TYPES.SKIP, REASON_CODES.NO_VALID_INCREMENT),
              analysis: buildAnalysis(),
              prescription: {
                sets: 3,
                repRangeLow: 8,
                repRangeHigh: 12,
                restSeconds: 90,
                progressionType: "load",
              },
              exercise: {
                id: 15,
                progressionType: "load",
              },
              previousRecommendation: null,
            }),
          ProgressionPersistenceUnsupportedDecisionError
        );
        return { error: "validated" };
      },
    },
    {
      name: "created recommendation writes primary reasonCode",
      input: "reasonCode source of truth is versioned decision code",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("reason-code"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: buildLoggedSets({
              targetExercise: fixture.targetExercise,
              reps: fixture.targetExercise.repRangeHigh,
              weightKg: null,
            }),
          });
          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: buildLoggedSets({
              targetExercise: fixture.targetExercise,
              reps: fixture.targetExercise.repRangeHigh,
              weightKg: null,
            }),
          });
          const actual = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });
          assert.equal(actual.recommendation.reasonCode, REASON_CODES.REPEATED_REP_SUCCESS);
          return actual;
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "compatibility field -> status remains active",
      input: "status is written only for compatibility",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("status"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 30 }],
          });
          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 32.5 }],
          });
          const actual = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });
          assert.equal(actual.recommendation.status, "active");
          return actual;
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "compatibility field -> confidence stored from decision",
      input: "persisted row keeps descriptive confidence",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("confidence"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 30 }],
          });
          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeHigh, weightKg: 32.5 }],
          });
          const actual = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });
          assert.equal(actual.recommendation.confidence, actual.decision.confidence);
          return actual;
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "created -> increase reps persists without concrete targets",
      input: "reps progression stores decision evidence without target resolution",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("increase-reps"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: buildLoggedSets({
              targetExercise: fixture.targetExercise,
              reps: fixture.targetExercise.repRangeHigh,
              weightKg: null,
            }),
          });

          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: buildLoggedSets({
              targetExercise: fixture.targetExercise,
              reps: fixture.targetExercise.repRangeHigh,
              weightKg: null,
            }),
          });

          const actual = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });

          assert.equal(actual.outcome, PROGRESSION_PERSISTENCE_OUTCOMES.CREATED);
          assert.equal(actual.decision.decisionType, DECISION_TYPES.INCREASE_REPS);
          assert.equal(actual.recommendation.recommendationType, "increase");
          assert.equal(actual.recommendation.recommendedWeightKg, null);
          assert.equal(actual.recommendation.recommendedTargetLow, null);
          assert.equal(actual.recommendation.recommendedTargetHigh, null);
          assert.equal(actual.recommendation.reasonCode, REASON_CODES.REPEATED_REP_SUCCESS);
          assert.equal(actual.recommendation.confidence, actual.decision.confidence);
          return actual;
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
    {
      name: "compatibility field -> consecutiveFailures derives from factual history",
      input: "persisted maintain row keeps compatibility attempt count",
      fn: async () => {
        const fixture = await createProgramFixture(nextTestSuffix("failures"));
        try {
          await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-01T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeLow - 1, weightKg: 30 }],
          });
          const sourceSession = await createCompletedExerciseSession({
            userId: fixture.user.id,
            programId: fixture.program.id,
            programDayId: fixture.firstDay.id,
            exerciseId: fixture.targetExercise.exerciseId,
            startedAt: new Date("2026-07-08T09:00:00.000Z"),
            sets: [{ setNumber: 1, reps: fixture.targetExercise.repRangeLow - 1, weightKg: 30 }],
          });
          const actual = await orchestrateProgressionPersistence({
            userId: fixture.user.id,
            exerciseId: fixture.targetExercise.exerciseId,
            sourceSessionId: sourceSession.id,
            recoveryConstraint: NEUTRAL_RECOVERY,
          });
          assert.equal(actual.recommendation.consecutiveFailures >= 1, true);
          return actual;
        } finally {
          await cleanupUserArtifacts(fixture.user.id);
        }
      },
    },
  ];

  for (const testCase of cases) {
    const ok = await runCase(testCase.name, testCase.input, testCase.fn);
    if (ok) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

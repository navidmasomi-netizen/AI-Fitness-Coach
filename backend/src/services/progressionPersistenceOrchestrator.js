import { Prisma } from "@prisma/client";

import prisma from "../lib/prisma.js";
import {
  createProgressionPersistenceRepository,
} from "../repositories/progressionPersistenceRepository.js";
export { isProgressionRecommendationIdempotencyP2002 } from "../repositories/progressionPersistenceRepository.js";
import { analyzeExercisePerformance } from "./exercisePerformanceAnalyzer.js";
import {
  DECISION_TYPES,
  decideProgression,
} from "./progressionDecisionEngine.js";
import {
  classifyDecisionPersistability,
  mapDecisionToProgressionRecommendationData,
  ProgressionPersistenceUnsupportedDecisionError,
  ProgressionPersistenceValidationError,
} from "./progressionDecisionMapping.js";
import { computeRecoveryModifier } from "./recoveryEngine.js";
import { analyzeWorkoutHistory } from "./workoutAnalyzer.js";

export const PROGRESSION_PERSISTENCE_OUTCOMES = Object.freeze({
  CREATED: "CREATED",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  NOT_PERSISTED: "NOT_PERSISTED",
});

const COMPLETED_SESSION_STATUS = "completed";
const DEFAULT_RECOVERY_ANALYSIS_WINDOW_DAYS = 28;
const SUPPORTED_PROGRESSION_MODES = new Set(["load", "time", "reps", "reps_then_load"]);
const progressionPersistenceRepository = createProgressionPersistenceRepository(prisma);

export class ProgressionPersistenceSourceError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProgressionPersistenceSourceError";
  }
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isNegativeInteger(value) {
  return Number.isInteger(value) && value < 0;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteInteger(value) {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
}

function validateIdentity(value, label) {
  if (!isPositiveInteger(value)) {
    throw new ProgressionPersistenceValidationError(`${label} must be a positive integer`);
  }
}

function validateRecoveryConstraint(recoveryConstraint) {
  if (recoveryConstraint === null || recoveryConstraint === undefined) {
    return;
  }

  if (!isPlainObject(recoveryConstraint)) {
    throw new ProgressionPersistenceValidationError("recoveryConstraint must be an object when provided");
  }

  if (!["supportive", "neutral", "caution"].includes(recoveryConstraint.recoveryModifier)) {
    throw new ProgressionPersistenceValidationError(
      "recoveryConstraint.recoveryModifier must be supportive, neutral, or caution"
    );
  }

  if (
    typeof recoveryConstraint.confidence !== "number" ||
    !Number.isFinite(recoveryConstraint.confidence) ||
    recoveryConstraint.confidence < 0 ||
    recoveryConstraint.confidence > 1
  ) {
    throw new ProgressionPersistenceValidationError(
      "recoveryConstraint.confidence must be a finite number between 0 and 1"
    );
  }

  if (!["weak", "moderate", "strong"].includes(recoveryConstraint.signalStrength)) {
    throw new ProgressionPersistenceValidationError(
      "recoveryConstraint.signalStrength must be weak, moderate, or strong"
    );
  }
}

function validateProgressionPolicyOverride(progressionPolicyOverride) {
  if (progressionPolicyOverride === null || progressionPolicyOverride === undefined) {
    return;
  }

  if (!isPlainObject(progressionPolicyOverride)) {
    throw new ProgressionPersistenceValidationError(
      "progressionPolicyOverride must be an object when provided"
    );
  }

  if (
    progressionPolicyOverride.progressionMode !== undefined &&
    !SUPPORTED_PROGRESSION_MODES.has(progressionPolicyOverride.progressionMode)
  ) {
    throw new ProgressionPersistenceValidationError(
      "progressionPolicyOverride.progressionMode must be load, time, reps, or reps_then_load"
    );
  }

  for (const field of [
    "allowsLoadAdjustment",
    "allowsSetAdjustment",
    "allowsRepAdjustment",
    "validIncrement",
  ]) {
    if (
      progressionPolicyOverride[field] !== undefined &&
      typeof progressionPolicyOverride[field] !== "boolean"
    ) {
      throw new ProgressionPersistenceValidationError(
        `progressionPolicyOverride.${field} must be a boolean when provided`
      );
    }
  }
}

function validateOrchestratorInput(input) {
  if (!isPlainObject(input)) {
    throw new ProgressionPersistenceValidationError("input is required");
  }

  validateIdentity(input.userId, "userId");
  validateIdentity(input.exerciseId, "exerciseId");
  validateIdentity(input.sourceSessionId, "sourceSessionId");
  validateRecoveryConstraint(input.recoveryConstraint);
  validateProgressionPolicyOverride(input.progressionPolicyOverride);
}

function serializeSetLog(setLog) {
  return {
    setNumber: setLog.setNumber,
    reps: setLog.reps,
    weightKg: setLog.weightKg,
  };
}

function sessionSortValue(session) {
  const comparableDate = session.completedAt ?? session.startedAt;
  if (!(comparableDate instanceof Date) || Number.isNaN(comparableDate.getTime())) {
    throw new ProgressionPersistenceSourceError(
      `Session ${session.id} is missing a valid comparable timestamp`
    );
  }

  return comparableDate.getTime();
}

function isStrictlyBeforeSource(session, sourceSession) {
  const sessionTime = sessionSortValue(session);
  const sourceTime = sessionSortValue(sourceSession);

  if (sessionTime !== sourceTime) {
    return sessionTime < sourceTime;
  }

  return session.id < sourceSession.id;
}

function buildAnalyzerInput({
  exerciseId,
  sourceSessionId,
  sourceSessionSetLogs,
  previousSessions,
  prescription,
}) {
  return {
    exerciseId,
    sourceSessionId,
    prescription: {
      prescribedSets: prescription.sets,
      prescribedRepLow: prescription.repRangeLow,
      prescribedRepHigh: prescription.repRangeHigh,
      prescribedRestSeconds: prescription.restSeconds,
    },
    currentSession: {
      sets: sourceSessionSetLogs.map(serializeSetLog),
    },
    previousSessions: previousSessions.map((session) => ({
      sourceSessionId: session.id,
      sets: session.setLogs.map(serializeSetLog),
    })),
  };
}

function resolveProgressionMode(prescription, exercise) {
  const progressionMode = prescription.progressionType || exercise.progressionType || "load";
  if (!SUPPORTED_PROGRESSION_MODES.has(progressionMode)) {
    throw new ProgressionPersistenceValidationError(
      `Unsupported progression mode "${progressionMode}" for exercise ${exercise.id}`
    );
  }
  return progressionMode;
}

function buildProgressionPolicy({ prescription, exercise, progressionPolicyOverride }) {
  const progressionMode = resolveProgressionMode(prescription, exercise);
  const basePolicy = {
    progressionMode,
    allowsLoadAdjustment: progressionMode === "load" || progressionMode === "reps_then_load",
    allowsSetAdjustment: false,
    allowsRepAdjustment:
      progressionMode === "reps" || progressionMode === "reps_then_load",
    validIncrement: true,
  };

  return {
    ...basePolicy,
    ...(progressionPolicyOverride ?? {}),
  };
}

function mapRecommendationTypeToDecisionType(recommendationType) {
  if (recommendationType === "increase") return DECISION_TYPES.INCREASE_LOAD;
  if (recommendationType === "maintain") return DECISION_TYPES.MAINTAIN;
  if (recommendationType === "deload") return DECISION_TYPES.DELOAD;

  throw new ProgressionPersistenceValidationError(
    `Unsupported legacy recommendationType "${recommendationType}"`
  );
}

function buildPreviousDecisionContext(previousRecommendation) {
  if (!previousRecommendation) {
    return null;
  }

  return {
    previousDecisionType: mapRecommendationTypeToDecisionType(
      previousRecommendation.recommendationType
    ),
    consecutiveFailures: previousRecommendation.consecutiveFailures ?? 0,
  };
}

function buildDecisionInput({
  analysis,
  prescription,
  exercise,
  previousRecommendation,
  recoveryConstraint,
  progressionPolicyOverride,
}) {
  return {
    analysis,
    progressionPolicy: buildProgressionPolicy({
      prescription,
      exercise,
      progressionPolicyOverride,
    }),
    recoveryConstraint: recoveryConstraint ?? null,
    previousDecisionContext: buildPreviousDecisionContext(previousRecommendation),
    existingRecommendationContext: null,
    policyThresholds: {
      deloadFailureStreak: 2,
    },
  };
}

function buildAlreadyExistsResult({
  recommendation,
  duplicateRecovered,
  sourceSessionId,
  exerciseId,
}) {
  return {
    outcome: PROGRESSION_PERSISTENCE_OUTCOMES.ALREADY_EXISTS,
    recommendation,
    decision: null,
    duplicateRecovered,
    sourceSessionId,
    exerciseId,
  };
}

function buildCreatedResult({ recommendation, decision, sourceSessionId, exerciseId }) {
  return {
    outcome: PROGRESSION_PERSISTENCE_OUTCOMES.CREATED,
    recommendation,
    decision,
    duplicateRecovered: false,
    sourceSessionId,
    exerciseId,
  };
}

function buildNotPersistedResult({ decision, sourceSessionId, exerciseId }) {
  return {
    outcome: PROGRESSION_PERSISTENCE_OUTCOMES.NOT_PERSISTED,
    recommendation: null,
    decision,
    duplicateRecovered: false,
    sourceSessionId,
    exerciseId,
  };
}

export async function findExistingProgressionRecommendation(identity) {
  return progressionPersistenceRepository.findExistingProgressionRecommendation(identity);
}

export async function createOrRecoverProgressionRecommendation({ identity, createData }) {
  const result =
    await progressionPersistenceRepository.createOrRecoverProgressionRecommendation({
      identity,
      createData,
    });

  if (result.outcome === "CREATED") {
    return {
      outcome: PROGRESSION_PERSISTENCE_OUTCOMES.CREATED,
      recommendation: result.recommendation,
      duplicateRecovered: false,
    };
  }

  return {
    outcome: PROGRESSION_PERSISTENCE_OUTCOMES.ALREADY_EXISTS,
    recommendation: result.recommendation,
    duplicateRecovered: result.duplicateRecovered,
  };
}

async function loadSourceSessionContext({ userId, exerciseId, sourceSessionId }) {
  const sourceSession = await prisma.workoutSession.findUnique({
    where: { id: sourceSessionId },
  });

  if (!sourceSession) {
    throw new ProgressionPersistenceSourceError(
      `Source session ${sourceSessionId} was not found`
    );
  }

  if (sourceSession.userId !== userId) {
    throw new ProgressionPersistenceSourceError(
      `Source session ${sourceSessionId} does not belong to user ${userId}`
    );
  }

  if (sourceSession.status !== COMPLETED_SESSION_STATUS) {
    throw new ProgressionPersistenceSourceError(
      `Source session ${sourceSessionId} must be completed before progression persistence`
    );
  }

  const setLogs = await prisma.setLog.findMany({
    where: {
      sessionId: sourceSessionId,
      exerciseId,
    },
    orderBy: [{ setNumber: "asc" }, { id: "asc" }],
  });

  if (setLogs.length === 0) {
    throw new ProgressionPersistenceSourceError(
      `Exercise ${exerciseId} is not present in source session ${sourceSessionId}`
    );
  }

  if (!sourceSession.programDayId) {
    throw new ProgressionPersistenceSourceError(
      `Source session ${sourceSessionId} has no associated program day`
    );
  }

  const prescription = await prisma.programDayExercise.findFirst({
    where: {
      programDayId: sourceSession.programDayId,
      exerciseId,
    },
    include: {
      exercise: true,
    },
  });

  if (!prescription || !prescription.exercise) {
    throw new ProgressionPersistenceSourceError(
      `Exercise ${exerciseId} is not prescribed for source session ${sourceSessionId}`
    );
  }

  return {
    sourceSession: {
      ...sourceSession,
      setLogs,
    },
    prescription,
  };
}

async function loadPreviousExerciseSessions({ userId, exerciseId, sourceSession }) {
  const sessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: COMPLETED_SESSION_STATUS,
      setLogs: {
        some: { exerciseId },
      },
    },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    include: {
      setLogs: {
        where: { exerciseId },
        orderBy: [{ setNumber: "asc" }, { id: "asc" }],
      },
    },
  });

  return sessions.filter(
    (session) =>
      session.id !== sourceSession.id &&
      session.setLogs.length > 0 &&
      isStrictlyBeforeSource(session, sourceSession)
  );
}

async function loadPreviousRecommendation({ userId, exerciseId, sourceSession }) {
  const recommendations = await prisma.progressionRecommendation.findMany({
    where: {
      userId,
      exerciseId,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    include: {
      sourceSession: {
        select: {
          id: true,
          startedAt: true,
          completedAt: true,
        },
      },
    },
  });

  return (
    recommendations.find((recommendation) => {
      const previousSourceSession = recommendation.sourceSession;
      return (
        previousSourceSession &&
        isStrictlyBeforeSource(previousSourceSession, sourceSession)
      );
    }) ?? null
  );
}

async function resolveRecoveryConstraint({ userId, recoveryConstraint }) {
  if (recoveryConstraint) {
    return recoveryConstraint;
  }

  const workoutAnalysis = await analyzeWorkoutHistory({
    userId,
    windowDays: DEFAULT_RECOVERY_ANALYSIS_WINDOW_DAYS,
  });
  const recoveryResult = computeRecoveryModifier({ workoutAnalysis });

  return {
    recoveryModifier: recoveryResult.recoveryModifier,
    confidence: recoveryResult.confidence,
    signalStrength: recoveryResult.signalStrength,
    reasonCode: null,
  };
}

// Retained as a non-production compatibility entry point. The
// authoritative production owner for progression generation is
// workoutSessionService.completeWorkoutSession().
export async function orchestrateProgressionPersistence(input) {
  validateOrchestratorInput(input);

  const { userId, exerciseId, sourceSessionId } = input;
  const identity = { userId, exerciseId, sourceSessionId };
  const { sourceSession, prescription } = await loadSourceSessionContext(identity);

  const precheckedExistingRecommendation =
    await findExistingProgressionRecommendation(identity);
  if (precheckedExistingRecommendation) {
    return buildAlreadyExistsResult({
      recommendation: precheckedExistingRecommendation,
      duplicateRecovered: false,
      sourceSessionId,
      exerciseId,
    });
  }

  const [previousSessions, previousRecommendation, resolvedRecoveryConstraint] =
    await Promise.all([
      loadPreviousExerciseSessions({ userId, exerciseId, sourceSession }),
      loadPreviousRecommendation({ userId, exerciseId, sourceSession }),
      resolveRecoveryConstraint({
        userId,
        recoveryConstraint: input.recoveryConstraint,
      }),
    ]);

  const analysis = analyzeExercisePerformance(
    buildAnalyzerInput({
      exerciseId,
      sourceSessionId,
      sourceSessionSetLogs: sourceSession.setLogs,
      previousSessions,
      prescription,
    })
  );

  const decision = decideProgression(
    buildDecisionInput({
      analysis,
      prescription,
      exercise: prescription.exercise,
      previousRecommendation,
      recoveryConstraint: resolvedRecoveryConstraint,
      progressionPolicyOverride: input.progressionPolicyOverride,
    })
  );

  if (classifyDecisionPersistability(decision.decisionType) === "DO_NOT_PERSIST") {
    return buildNotPersistedResult({
      decision,
      sourceSessionId,
      exerciseId,
    });
  }

  const createData = mapDecisionToProgressionRecommendationData({
    userId,
    exerciseId,
    sourceSessionId,
    decision,
    analysis,
    prescription,
    exercise: prescription.exercise,
    previousRecommendation,
  });

  const createResult = await createOrRecoverProgressionRecommendation({
    identity,
    createData,
  });

  if (createResult.outcome === PROGRESSION_PERSISTENCE_OUTCOMES.ALREADY_EXISTS) {
    return buildAlreadyExistsResult({
      recommendation: createResult.recommendation,
      duplicateRecovered: createResult.duplicateRecovered,
      sourceSessionId,
      exerciseId,
    });
  }

  return buildCreatedResult({
    recommendation: createResult.recommendation,
    decision,
    sourceSessionId,
    exerciseId,
  });
}

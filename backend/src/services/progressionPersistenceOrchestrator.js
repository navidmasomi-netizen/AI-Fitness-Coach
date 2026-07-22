import { Prisma } from "@prisma/client";

import prisma from "../lib/prisma.js";
import { analyzeExercisePerformance } from "./exercisePerformanceAnalyzer.js";
import {
  DECISION_TYPES,
  decideProgression,
} from "./progressionDecisionEngine.js";
import { computeRecoveryModifier } from "./recoveryEngine.js";
import { analyzeWorkoutHistory } from "./workoutAnalyzer.js";

export const PROGRESSION_PERSISTENCE_OUTCOMES = Object.freeze({
  CREATED: "CREATED",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  NOT_PERSISTED: "NOT_PERSISTED",
});

const COMPLETED_SESSION_STATUS = "completed";
const DEFAULT_RECOVERY_ANALYSIS_WINDOW_DAYS = 28;
const PERSISTABLE_DECISION_TYPES = new Set([
  DECISION_TYPES.INCREASE_LOAD,
  DECISION_TYPES.INCREASE_REPS,
  DECISION_TYPES.INCREASE_DURATION,
  DECISION_TYPES.MAINTAIN,
  DECISION_TYPES.DELOAD,
]);
const NON_PERSISTABLE_DECISION_TYPES = new Set([
  DECISION_TYPES.INSUFFICIENT_DATA,
  DECISION_TYPES.SKIP,
  DECISION_TYPES.MANUAL_REVIEW,
]);
const SUPPORTED_PROGRESSION_MODES = new Set(["load", "time", "reps", "reps_then_load"]);
const RECOMMENDATION_UNIQUE_INDEX_NAME =
  "ProgressionRecommendation_userId_exerciseId_sourceSessionId_key";
const COMPOSITE_TARGET_FIELDS = ["userId", "exerciseId", "sourceSessionId"];

export class ProgressionPersistenceValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProgressionPersistenceValidationError";
  }
}

export class ProgressionPersistenceSourceError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProgressionPersistenceSourceError";
  }
}

export class ProgressionPersistenceUnsupportedDecisionError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProgressionPersistenceUnsupportedDecisionError";
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

function normalizeTargetComponent(value) {
  return String(value).replace(/["`]/g, "");
}

function compareCompositeTargetArray(target) {
  if (!Array.isArray(target) || target.length !== COMPOSITE_TARGET_FIELDS.length) {
    return false;
  }

  const normalizedTarget = target.map(normalizeTargetComponent).sort();
  const normalizedFields = [...COMPOSITE_TARGET_FIELDS].sort();
  return normalizedTarget.every((field, index) => field === normalizedFields[index]);
}

function compareCompositeTargetName(target) {
  if (typeof target !== "string") {
    return false;
  }

  return normalizeTargetComponent(target) === RECOMMENDATION_UNIQUE_INDEX_NAME;
}

function compareCompositeTargetMessage(message) {
  if (typeof message !== "string") {
    return false;
  }

  const match = message.match(/Unique constraint failed on the fields:\s*\(([^)]+)\)/);
  if (!match) {
    return false;
  }

  const normalizedTarget = match[1]
    .split(",")
    .map((component) => normalizeTargetComponent(component).trim())
    .filter(Boolean)
    .sort();
  const normalizedFields = [...COMPOSITE_TARGET_FIELDS].sort();

  if (normalizedTarget.length !== normalizedFields.length) {
    return false;
  }

  return normalizedTarget.every((field, index) => field === normalizedFields[index]);
}

export function isProgressionRecommendationIdempotencyP2002(error) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  return (
    compareCompositeTargetArray(target) ||
    compareCompositeTargetName(target) ||
    compareCompositeTargetMessage(error.message)
  );
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
    allowsRepAdjustment: progressionMode === "reps",
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

export function classifyDecisionPersistability(decisionType) {
  if (PERSISTABLE_DECISION_TYPES.has(decisionType)) {
    return "PERSIST";
  }

  if (NON_PERSISTABLE_DECISION_TYPES.has(decisionType)) {
    return "DO_NOT_PERSIST";
  }

  throw new ProgressionPersistenceUnsupportedDecisionError(
    `Unsupported decision type "${decisionType}" for persistence`
  );
}

function mapDecisionTypeToRecommendationType(decisionType) {
  if (decisionType === DECISION_TYPES.INCREASE_LOAD) return "increase";
  if (decisionType === DECISION_TYPES.INCREASE_REPS) return "increase";
  if (decisionType === DECISION_TYPES.INCREASE_DURATION) return "increase";
  if (decisionType === DECISION_TYPES.MAINTAIN) return "maintain";
  if (decisionType === DECISION_TYPES.DELOAD) return "deload";

  throw new ProgressionPersistenceUnsupportedDecisionError(
    `Decision type "${decisionType}" cannot be mapped to RecommendationType`
  );
}

function buildCompatibilityReason(decision) {
  switch (decision.reasonCode) {
    case "RULE_V1_REPEATED_SUCCESS":
      return "Targets were met repeatedly; load can increase in the next session.";
    case "RULE_V1_REPEATED_REP_SUCCESS":
      return "Targets were met repeatedly; repetitions can increase in the next session.";
    case "RULE_V1_PERFORMANCE_IMPROVED":
      return "Performance improved; load can increase in the next session.";
    case "RULE_V1_REP_PERFORMANCE_IMPROVED":
      return "Performance improved; repetitions can increase in the next session.";
    case "RULE_V1_TARGETS_FULLY_MET":
      return "Targets were fully met; load maintained for the next session.";
    case "RULE_V1_TARGETS_PARTIALLY_MET":
      return "Targets were not fully met; load maintained for the next session.";
    case "RULE_V1_PERFORMANCE_REGRESSED":
      return "Performance regressed; load maintained for the next session.";
    case "RULE_V1_REPEATED_FAILURE":
      return "Performance declined repeatedly; a deload is recommended for the next session.";
    case "RULE_V1_RECOVERY_OVERRIDE":
      return "Performance supported progression, but recovery signals triggered a conservative hold for the next session.";
    case "RULE_V1_MISSING_LOAD_DATA":
      return "Targets were met, but load data was missing; load maintained for the next session.";
    default:
      return "Progression decision recorded for the next session.";
  }
}

function deriveCompatibilityConsecutiveFailures({ analysis, previousRecommendation }) {
  return Math.max(
    analysis.historyFacts.consecutiveFailedSessions ?? 0,
    previousRecommendation?.consecutiveFailures ?? 0
  );
}

function resolvePersistedTargetSets({ decision, analysis }) {
  if (decision.setAdjustment === 0) {
    return null;
  }

  return Math.max(0, analysis.prescription.prescribedSets + decision.setAdjustment);
}

function validateFiniteIntegerAdjustmentField(decision, fieldName) {
  if (!Object.hasOwn(decision, fieldName)) {
    throw new ProgressionPersistenceValidationError(`decision.${fieldName} is required for persistence`);
  }

  const value = decision[fieldName];
  if (!isFiniteInteger(value)) {
    throw new ProgressionPersistenceValidationError(
      `decision.${fieldName} must be a finite integer`
    );
  }

  return value;
}

function validateExpectedZero(value, fieldName, decisionType) {
  if (value !== 0) {
    throw new ProgressionPersistenceValidationError(
      `Decision type "${decisionType}" requires decision.${fieldName} === 0`
    );
  }
}

function resolveDecisionProgressionMode({ prescription, exercise }) {
  return prescription.progressionType || exercise.progressionType || "load";
}

function validateDecisionAdjustmentConsistency({
  decision,
  loadAdjustmentSteps,
  repAdjustment,
  setAdjustment,
  durationAdjustmentSteps,
  progressionMode,
}) {
  switch (decision.decisionType) {
    case DECISION_TYPES.INCREASE_LOAD:
      if (!isPositiveInteger(loadAdjustmentSteps)) {
        throw new ProgressionPersistenceValidationError(
          "INCREASE_LOAD requires decision.loadAdjustmentSteps > 0"
        );
      }
      validateExpectedZero(repAdjustment, "repAdjustment", decision.decisionType);
      validateExpectedZero(setAdjustment, "setAdjustment", decision.decisionType);
      validateExpectedZero(durationAdjustmentSteps, "durationAdjustmentSteps", decision.decisionType);
      return;

    case DECISION_TYPES.INCREASE_REPS:
      validateExpectedZero(loadAdjustmentSteps, "loadAdjustmentSteps", decision.decisionType);
      if (!isPositiveInteger(repAdjustment)) {
        throw new ProgressionPersistenceValidationError(
          "INCREASE_REPS requires decision.repAdjustment > 0"
        );
      }
      validateExpectedZero(setAdjustment, "setAdjustment", decision.decisionType);
      validateExpectedZero(durationAdjustmentSteps, "durationAdjustmentSteps", decision.decisionType);
      return;

    case DECISION_TYPES.INCREASE_DURATION:
      validateExpectedZero(loadAdjustmentSteps, "loadAdjustmentSteps", decision.decisionType);
      validateExpectedZero(repAdjustment, "repAdjustment", decision.decisionType);
      validateExpectedZero(setAdjustment, "setAdjustment", decision.decisionType);
      if (!isPositiveInteger(durationAdjustmentSteps)) {
        throw new ProgressionPersistenceValidationError(
          "INCREASE_DURATION requires decision.durationAdjustmentSteps > 0"
        );
      }
      return;

    case DECISION_TYPES.MAINTAIN:
      validateExpectedZero(loadAdjustmentSteps, "loadAdjustmentSteps", decision.decisionType);
      validateExpectedZero(repAdjustment, "repAdjustment", decision.decisionType);
      validateExpectedZero(setAdjustment, "setAdjustment", decision.decisionType);
      validateExpectedZero(durationAdjustmentSteps, "durationAdjustmentSteps", decision.decisionType);
      return;

    case DECISION_TYPES.DELOAD:
      validateExpectedZero(setAdjustment, "setAdjustment", decision.decisionType);
      validateExpectedZero(durationAdjustmentSteps, "durationAdjustmentSteps", decision.decisionType);

      if (progressionMode === "reps") {
        validateExpectedZero(loadAdjustmentSteps, "loadAdjustmentSteps", decision.decisionType);
        if (!isNegativeInteger(repAdjustment)) {
          throw new ProgressionPersistenceValidationError(
            "DELOAD in reps mode requires decision.repAdjustment < 0"
          );
        }
        return;
      }

      if (progressionMode === "time") {
        validateExpectedZero(loadAdjustmentSteps, "loadAdjustmentSteps", decision.decisionType);
        validateExpectedZero(repAdjustment, "repAdjustment", decision.decisionType);
        return;
      }

      if (!isNegativeInteger(loadAdjustmentSteps)) {
        throw new ProgressionPersistenceValidationError(
          "DELOAD in load or reps_then_load mode requires decision.loadAdjustmentSteps < 0"
        );
      }
      validateExpectedZero(repAdjustment, "repAdjustment", decision.decisionType);
      return;

    default:
      return;
  }
}

function validateDecisionPersistenceContract({ decision, prescription, exercise }) {
  if (!isPlainObject(decision)) {
    throw new ProgressionPersistenceValidationError("decision is required for Prisma mapping");
  }

  if (!isNonEmptyString(decision.decisionType)) {
    throw new ProgressionPersistenceValidationError(
      "decision.decisionType must be a non-empty string for persistence"
    );
  }

  classifyDecisionPersistability(decision.decisionType);

  const loadAdjustmentSteps = validateFiniteIntegerAdjustmentField(decision, "loadAdjustmentSteps");
  const repAdjustment = validateFiniteIntegerAdjustmentField(decision, "repAdjustment");
  const setAdjustment = validateFiniteIntegerAdjustmentField(decision, "setAdjustment");
  const durationAdjustmentSteps = validateFiniteIntegerAdjustmentField(
    decision,
    "durationAdjustmentSteps"
  );

  const progressionMode = resolveDecisionProgressionMode({ prescription, exercise });
  validateDecisionAdjustmentConsistency({
    decision,
    loadAdjustmentSteps,
    repAdjustment,
    setAdjustment,
    durationAdjustmentSteps,
    progressionMode,
  });

  if (Object.hasOwn(decision, "durationAdjustmentSeconds")) {
    throw new ProgressionPersistenceValidationError(
      "decision.durationAdjustmentSeconds is not supported for persistence"
    );
  }

  if (!isNonEmptyString(decision.rulesVersion)) {
    throw new ProgressionPersistenceValidationError(
      "decision.rulesVersion must be a non-empty string for persistence"
    );
  }
}

export function mapDecisionToProgressionRecommendationData({
  userId,
  exerciseId,
  sourceSessionId,
  decision,
  analysis,
  prescription,
  exercise,
  previousRecommendation,
}) {
  validateDecisionPersistenceContract({ decision, prescription, exercise });

  return {
    userId,
    exerciseId,
    sourceSessionId,
    recommendationType: mapDecisionTypeToRecommendationType(decision.decisionType),
    decisionType: decision.decisionType,
    previousWeightKg: analysis.historyFacts.previousSessionWeightKg,
    recommendedWeightKg: null,
    previousTargetLow: analysis.prescription.prescribedRepLow,
    previousTargetHigh: analysis.prescription.prescribedRepHigh,
    recommendedTargetLow: null,
    recommendedTargetHigh: null,
    targetSets: resolvePersistedTargetSets({ decision, analysis }),
    loadAdjustmentSteps: decision.loadAdjustmentSteps,
    repAdjustment: decision.repAdjustment,
    setAdjustment: decision.setAdjustment,
    durationAdjustmentSteps: decision.durationAdjustmentSteps,
    confidence: decision.confidence,
    reasonCode: decision.reasonCode,
    rulesVersion: decision.rulesVersion,
    progressionType: prescription.progressionType || exercise.progressionType || "load",
    consecutiveFailures: deriveCompatibilityConsecutiveFailures({
      analysis,
      previousRecommendation,
    }),
    reason: buildCompatibilityReason(decision),
    status: "active",
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
  return prisma.progressionRecommendation.findUnique({
    where: {
      userId_exerciseId_sourceSessionId: {
        userId: identity.userId,
        exerciseId: identity.exerciseId,
        sourceSessionId: identity.sourceSessionId,
      },
    },
    include: { exercise: true },
  });
}

export async function createOrRecoverProgressionRecommendation({ identity, createData }) {
  try {
    const recommendation = await prisma.progressionRecommendation.create({
      data: createData,
      include: { exercise: true },
    });

    return {
      outcome: PROGRESSION_PERSISTENCE_OUTCOMES.CREATED,
      recommendation,
      duplicateRecovered: false,
    };
  } catch (error) {
    if (!isProgressionRecommendationIdempotencyP2002(error)) {
      throw error;
    }

    const existingRecommendation = await findExistingProgressionRecommendation(identity);
    if (!existingRecommendation) {
      throw new Error(
        `Progression recommendation idempotency recovery failed for (${identity.userId}, ${identity.exerciseId}, ${identity.sourceSessionId})`
      );
    }

    return {
      outcome: PROGRESSION_PERSISTENCE_OUTCOMES.ALREADY_EXISTS,
      recommendation: existingRecommendation,
      duplicateRecovered: true,
    };
  }
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

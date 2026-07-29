import {
  DECISION_TYPES,
} from "./progressionDecisionEngine.js";

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

export class ProgressionPersistenceValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProgressionPersistenceValidationError";
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

function isNegativeInteger(value) {
  return Number.isInteger(value) && value < 0;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteInteger(value) {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
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

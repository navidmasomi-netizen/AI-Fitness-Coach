import {
  DECISION_TYPES,
  ProgressionDecisionValidationError,
  PROGRESSION_RULES_VERSION,
  REASON_CODES,
} from "./progressionDecisionEngine.js";

export function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return value;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isValidRate(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

function uniqueOrdered(values) {
  const seen = new Set();
  const output = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }

  return output.sort((left, right) => left.localeCompare(right));
}

function validateCandidateDecision(candidateDecision) {
  if (!isPlainObject(candidateDecision)) {
    throw new ProgressionDecisionValidationError("candidateDecision is required");
  }

  if (!isPositiveInteger(candidateDecision.exerciseId)) {
    throw new ProgressionDecisionValidationError(
      "candidateDecision.exerciseId must be a positive integer"
    );
  }

  if (!isPositiveInteger(candidateDecision.sourceSessionId)) {
    throw new ProgressionDecisionValidationError(
      "candidateDecision.sourceSessionId must be a positive integer"
    );
  }

  if (!Object.values(DECISION_TYPES).includes(candidateDecision.decisionType)) {
    throw new ProgressionDecisionValidationError(
      "candidateDecision.decisionType must be a known decision type"
    );
  }

  if (!Object.values(REASON_CODES).includes(candidateDecision.reasonCode)) {
    throw new ProgressionDecisionValidationError(
      "candidateDecision.reasonCode must be a known reason code"
    );
  }

  if (!isStringArray(candidateDecision.secondaryReasonCodes)) {
    throw new ProgressionDecisionValidationError(
      "candidateDecision.secondaryReasonCodes must be an array of strings"
    );
  }

  if (!isValidRate(candidateDecision.confidence)) {
    throw new ProgressionDecisionValidationError(
      "candidateDecision.confidence must be between 0 and 1"
    );
  }

  if (typeof candidateDecision.requiresManualReview !== "boolean") {
    throw new ProgressionDecisionValidationError(
      "candidateDecision.requiresManualReview must be a boolean"
    );
  }

  if (typeof candidateDecision.shouldPersist !== "boolean") {
    throw new ProgressionDecisionValidationError(
      "candidateDecision.shouldPersist must be a boolean"
    );
  }

  for (const field of [
    "loadAdjustmentSteps",
    "setAdjustment",
    "repAdjustment",
    "durationAdjustmentSteps",
  ]) {
    if (!Number.isInteger(candidateDecision[field])) {
      throw new ProgressionDecisionValidationError(
        `candidateDecision.${field} must be an integer`
      );
    }
  }

  if (
    typeof candidateDecision.rulesVersion !== "string" ||
    candidateDecision.rulesVersion.trim().length === 0
  ) {
    throw new ProgressionDecisionValidationError(
      "candidateDecision.rulesVersion must be a non-empty string"
    );
  }
}

function resolveRelevantTrend(historicalTrainingSignals, candidateDecision) {
  if (candidateDecision.decisionType === DECISION_TYPES.INCREASE_LOAD) {
    return historicalTrainingSignals.loadTrend;
  }

  if (candidateDecision.decisionType === DECISION_TYPES.INCREASE_REPS) {
    return historicalTrainingSignals.repTrend;
  }

  return null;
}

function isTargetCandidate(candidateDecision) {
  if (candidateDecision.decisionType === DECISION_TYPES.INCREASE_LOAD) {
    return candidateDecision.reasonCode === REASON_CODES.PERFORMANCE_IMPROVED;
  }

  if (candidateDecision.decisionType === DECISION_TYPES.INCREASE_REPS) {
    return candidateDecision.reasonCode === REASON_CODES.REP_PERFORMANCE_IMPROVED;
  }

  return false;
}

function shouldDowngrade({ candidateDecision, historicalTrainingSignals }) {
  if (!isPlainObject(historicalTrainingSignals)) {
    return false;
  }

  if (
    !Number.isInteger(historicalTrainingSignals.completedExposureCount) ||
    historicalTrainingSignals.completedExposureCount < 2
  ) {
    return false;
  }

  const relevantTrend = resolveRelevantTrend(historicalTrainingSignals, candidateDecision);
  return relevantTrend === "DECREASING";
}

function buildDowngradedDecision(candidateDecision) {
  return deepFreeze({
    exerciseId: candidateDecision.exerciseId,
    sourceSessionId: candidateDecision.sourceSessionId,
    decisionType: DECISION_TYPES.MAINTAIN,
    loadAdjustmentSteps: 0,
    setAdjustment: 0,
    repAdjustment: 0,
    durationAdjustmentSteps: 0,
    reasonCode: REASON_CODES.HISTORICAL_TREND_CONFLICT,
    secondaryReasonCodes: uniqueOrdered([
      candidateDecision.reasonCode,
      ...candidateDecision.secondaryReasonCodes,
    ]),
    confidence: candidateDecision.confidence,
    requiresManualReview: candidateDecision.requiresManualReview,
    shouldPersist: candidateDecision.shouldPersist,
    rulesVersion: candidateDecision.rulesVersion || PROGRESSION_RULES_VERSION,
  });
}

export function applyHistoricalProgressionModifier({
  candidateDecision,
  historicalTrainingSignals,
}) {
  validateCandidateDecision(candidateDecision);

  if (!isTargetCandidate(candidateDecision)) {
    return candidateDecision;
  }

  if (!shouldDowngrade({ candidateDecision, historicalTrainingSignals })) {
    return candidateDecision;
  }

  return buildDowngradedDecision(candidateDecision);
}

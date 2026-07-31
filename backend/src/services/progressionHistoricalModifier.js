import {
  DECISION_TYPES,
  ProgressionDecisionValidationError,
  REASON_CODES,
} from "./progressionDecisionEngine.js";

function deepFreeze(value) {
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

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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

  if (!isNonEmptyString(candidateDecision.ruleId)) {
    throw new ProgressionDecisionValidationError(
      "candidateDecision.ruleId must be a non-empty string"
    );
  }

  if (!Object.values(DECISION_TYPES).includes(candidateDecision.decisionType)) {
    throw new ProgressionDecisionValidationError(
      "candidateDecision.decisionType must be a known decision type"
    );
  }

  if (!Object.values(REASON_CODES).includes(candidateDecision.primaryReasonCode)) {
    throw new ProgressionDecisionValidationError(
      "candidateDecision.primaryReasonCode must be a known reason code"
    );
  }

  if (
    !Array.isArray(candidateDecision.secondaryReasonCodes) ||
    !candidateDecision.secondaryReasonCodes.every((entry) =>
      Object.values(REASON_CODES).includes(entry)
    )
  ) {
    throw new ProgressionDecisionValidationError(
      "candidateDecision.secondaryReasonCodes must be an array of strings"
    );
  }

  if (typeof candidateDecision.terminal !== "boolean") {
    throw new ProgressionDecisionValidationError(
      "candidateDecision.terminal must be a boolean"
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
    return candidateDecision.primaryReasonCode === REASON_CODES.PERFORMANCE_IMPROVED;
  }

  if (candidateDecision.decisionType === DECISION_TYPES.INCREASE_REPS) {
    return candidateDecision.primaryReasonCode === REASON_CODES.REP_PERFORMANCE_IMPROVED;
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

function buildDowngradedCandidate(candidateDecision) {
  return deepFreeze({
    ruleId: "R015_HISTORICAL_TREND_CONFLICT_DOWNGRADE",
    decisionType: DECISION_TYPES.MAINTAIN,
    primaryReasonCode: REASON_CODES.HISTORICAL_TREND_CONFLICT,
    secondaryReasonCodes: uniqueOrdered([
      candidateDecision.primaryReasonCode,
      ...candidateDecision.secondaryReasonCodes,
    ]),
    terminal: true,
    requiresManualReview: candidateDecision.requiresManualReview,
    shouldPersist: candidateDecision.shouldPersist,
    loadAdjustmentSteps: 0,
    setAdjustment: 0,
    repAdjustment: 0,
    durationAdjustmentSteps: 0,
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

  return buildDowngradedCandidate(candidateDecision);
}

import { applyHistoricalProgressionModifier } from "./progressionHistoricalModifier.js";

export const PROGRESSION_RULES_VERSION = "progression_decision_rules_v5";

export const DECISION_TYPES = Object.freeze({
  INCREASE_LOAD: "INCREASE_LOAD",
  INCREASE_REPS: "INCREASE_REPS",
  INCREASE_DURATION: "INCREASE_DURATION",
  MAINTAIN: "MAINTAIN",
  DELOAD: "DELOAD",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  SKIP: "SKIP",
  MANUAL_REVIEW: "MANUAL_REVIEW",
});

export const REASON_CODES = Object.freeze({
  INVALID_ANALYSIS: "RULE_V1_INVALID_ANALYSIS",
  ZERO_PRESCRIPTION: "RULE_V1_ZERO_PRESCRIPTION",
  INSUFFICIENT_HISTORY: "RULE_V1_INSUFFICIENT_HISTORY",
  TARGETS_FULLY_MET: "RULE_V1_TARGETS_FULLY_MET",
  TARGETS_PARTIALLY_MET: "RULE_V1_TARGETS_PARTIALLY_MET",
  PERFORMANCE_IMPROVED: "RULE_V1_PERFORMANCE_IMPROVED",
  REP_PERFORMANCE_IMPROVED: "RULE_V1_REP_PERFORMANCE_IMPROVED",
  TIME_PERFORMANCE_IMPROVED: "RULE_V1_TIME_PERFORMANCE_IMPROVED",
  PERFORMANCE_REGRESSED: "RULE_V1_PERFORMANCE_REGRESSED",
  REPEATED_SUCCESS: "RULE_V1_REPEATED_SUCCESS",
  REPEATED_REP_SUCCESS: "RULE_V1_REPEATED_REP_SUCCESS",
  REPEATED_TIME_SUCCESS: "RULE_V1_REPEATED_TIME_SUCCESS",
  REPEATED_FAILURE: "RULE_V1_REPEATED_FAILURE",
  RECOVERY_OVERRIDE: "RULE_V1_RECOVERY_OVERRIDE",
  HISTORICAL_TREND_CONFLICT: "RULE_V2_HISTORICAL_TREND_CONFLICT",
  MISSING_LOAD_DATA: "RULE_V1_MISSING_LOAD_DATA",
  MISSING_DURATION_TARGET: "RULE_V1_MISSING_DURATION_TARGET",
  NO_VALID_INCREMENT: "RULE_V1_NO_VALID_INCREMENT",
  ALREADY_EVALUATED: "RULE_V1_ALREADY_EVALUATED",
});

const DECISION_TYPE_VALUES = new Set(Object.values(DECISION_TYPES));
const REASON_CODE_VALUES = new Set(Object.values(REASON_CODES));
const PROGRESSION_MODE_VALUES = new Set(["load", "time", "reps", "reps_then_load"]);
const RECOVERY_MODIFIER_VALUES = new Set(["supportive", "neutral", "caution"]);
const SIGNAL_STRENGTH_VALUES = new Set(["weak", "moderate", "strong"]);

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

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
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

function isValidRate(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isValidFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function uniqueOrdered(values) {
  const seen = new Set();
  const output = [];

  for (const value of values) {
    if (!value || seen.has(value)) continue;
    seen.add(value);
    output.push(value);
  }

  return output;
}

function compareReasonCodes(left, right) {
  return left.localeCompare(right);
}

function validateReasonCode(reasonCode, label) {
  if (!REASON_CODE_VALUES.has(reasonCode)) {
    throw new ProgressionDecisionValidationError(`${label} must be a known reason code`);
  }
}

function validateDecisionType(decisionType, label) {
  if (!DECISION_TYPE_VALUES.has(decisionType)) {
    throw new ProgressionDecisionValidationError(`${label} must be a known decision type`);
  }
}

function validateAdjustment(value, label) {
  if (!Number.isInteger(value)) {
    throw new ProgressionDecisionValidationError(`${label} must be an integer`);
  }
}

function validateAnalysisShape(analysis) {
  if (!isPlainObject(analysis)) {
    throw new ProgressionDecisionValidationError("analysis is required");
  }

  if (!isPositiveInteger(analysis.exerciseId)) {
    throw new ProgressionDecisionValidationError("analysis.exerciseId must be a positive integer");
  }

  if (!isPositiveInteger(analysis.sourceSessionId)) {
    throw new ProgressionDecisionValidationError("analysis.sourceSessionId must be a positive integer");
  }

  if (!isPlainObject(analysis.prescription)) {
    throw new ProgressionDecisionValidationError("analysis.prescription is required");
  }

  if (!isPlainObject(analysis.observedPerformance)) {
    throw new ProgressionDecisionValidationError("analysis.observedPerformance is required");
  }

  if (!isPlainObject(analysis.historyFacts)) {
    throw new ProgressionDecisionValidationError("analysis.historyFacts is required");
  }

  if (typeof analysis.hasSufficientData !== "boolean") {
    throw new ProgressionDecisionValidationError("analysis.hasSufficientData must be a boolean");
  }

  if (!Array.isArray(analysis.dataQualityFlags) || !analysis.dataQualityFlags.every((flag) => typeof flag === "string")) {
    throw new ProgressionDecisionValidationError("analysis.dataQualityFlags must be an array of strings");
  }

  const { prescription, observedPerformance, historyFacts } = analysis;

  if (!isNonNegativeInteger(prescription.prescribedSets)) {
    throw new ProgressionDecisionValidationError("analysis.prescription.prescribedSets must be a non-negative integer");
  }

  if (prescription.prescribedRepLow !== null && prescription.prescribedRepLow !== undefined && !isPositiveInteger(prescription.prescribedRepLow)) {
    throw new ProgressionDecisionValidationError("analysis.prescription.prescribedRepLow must be a positive integer or null");
  }

  if (prescription.prescribedRepHigh !== null && prescription.prescribedRepHigh !== undefined && !isPositiveInteger(prescription.prescribedRepHigh)) {
    throw new ProgressionDecisionValidationError("analysis.prescription.prescribedRepHigh must be a positive integer or null");
  }

  const countFields = [
    "loggedSetCount",
    "completedSetCount",
    "successfulSetCount",
    "failedSetCount",
    "totalReps",
  ];

  for (const field of countFields) {
    if (!isNonNegativeInteger(observedPerformance[field])) {
      throw new ProgressionDecisionValidationError(`analysis.observedPerformance.${field} must be a non-negative integer`);
    }
  }

  const rateFields = ["prescribedSetCompletionRate", "targetRepHitRate"];
  for (const field of rateFields) {
    const value = observedPerformance[field];
    if (value !== null && value !== undefined && !isValidRate(value)) {
      throw new ProgressionDecisionValidationError(`analysis.observedPerformance.${field} must be between 0 and 1 or null`);
    }
  }

  if (typeof observedPerformance.allPlannedSetsReachedUpperRepBound !== "boolean") {
    throw new ProgressionDecisionValidationError(
      "analysis.observedPerformance.allPlannedSetsReachedUpperRepBound must be a boolean"
    );
  }

  const numericNullableFields = ["totalVolumeKg", "averageWeightKg", "maximumWeightKg", "minimumWeightKg"];
  for (const field of numericNullableFields) {
    const value = observedPerformance[field];
    if (value !== null && value !== undefined && (!isValidFiniteNumber(value) || value < 0)) {
      throw new ProgressionDecisionValidationError(`analysis.observedPerformance.${field} must be a non-negative finite number or null`);
    }
  }

  for (const field of ["consecutiveSuccessfulSessions", "consecutiveFailedSessions"]) {
    if (!isNonNegativeInteger(historyFacts[field])) {
      throw new ProgressionDecisionValidationError(`analysis.historyFacts.${field} must be a non-negative integer`);
    }
  }

  for (const field of [
    "previousSessionWeightKg",
    "weightDeltaKg",
    "weightDeltaPercent",
    "previousPrescribedSetCompletionRate",
    "prescribedSetCompletionRateDelta",
  ]) {
    const value = historyFacts[field];
    if (value !== null && value !== undefined && !isValidFiniteNumber(value)) {
      throw new ProgressionDecisionValidationError(`analysis.historyFacts.${field} must be a finite number or null`);
    }
  }
}

function validateProgressionPolicy(policy) {
  if (!isPlainObject(policy)) {
    throw new ProgressionDecisionValidationError("progressionPolicy is required");
  }

  if (!PROGRESSION_MODE_VALUES.has(policy.progressionMode)) {
    throw new ProgressionDecisionValidationError("progressionPolicy.progressionMode must be one of: load, time, reps, reps_then_load");
  }

  for (const field of ["allowsLoadAdjustment", "allowsSetAdjustment", "allowsRepAdjustment", "validIncrement"]) {
    if (typeof policy[field] !== "boolean") {
      throw new ProgressionDecisionValidationError(`progressionPolicy.${field} must be a boolean`);
    }
  }
}

function validateRecoveryConstraint(recoveryConstraint) {
  if (recoveryConstraint === null || recoveryConstraint === undefined) {
    return;
  }

  if (!isPlainObject(recoveryConstraint)) {
    throw new ProgressionDecisionValidationError("recoveryConstraint must be an object when provided");
  }

  if (!RECOVERY_MODIFIER_VALUES.has(recoveryConstraint.recoveryModifier)) {
    throw new ProgressionDecisionValidationError("recoveryConstraint.recoveryModifier must be supportive, neutral, or caution");
  }

  if (!isValidRate(recoveryConstraint.confidence)) {
    throw new ProgressionDecisionValidationError("recoveryConstraint.confidence must be between 0 and 1");
  }

  if (!SIGNAL_STRENGTH_VALUES.has(recoveryConstraint.signalStrength)) {
    throw new ProgressionDecisionValidationError("recoveryConstraint.signalStrength must be weak, moderate, or strong");
  }

  if (
    recoveryConstraint.reasonCode !== null &&
    recoveryConstraint.reasonCode !== undefined &&
    typeof recoveryConstraint.reasonCode !== "string"
  ) {
    throw new ProgressionDecisionValidationError("recoveryConstraint.reasonCode must be a string or null");
  }
}

function validatePreviousDecisionContext(previousDecisionContext) {
  if (previousDecisionContext === null || previousDecisionContext === undefined) {
    return;
  }

  if (!isPlainObject(previousDecisionContext)) {
    throw new ProgressionDecisionValidationError("previousDecisionContext must be an object when provided");
  }

  validateDecisionType(previousDecisionContext.previousDecisionType, "previousDecisionContext.previousDecisionType");

  if (!isNonNegativeInteger(previousDecisionContext.consecutiveFailures)) {
    throw new ProgressionDecisionValidationError("previousDecisionContext.consecutiveFailures must be a non-negative integer");
  }
}

function validateExistingRecommendationContext(existingRecommendationContext) {
  if (existingRecommendationContext === null || existingRecommendationContext === undefined) {
    return;
  }

  if (!isPlainObject(existingRecommendationContext)) {
    throw new ProgressionDecisionValidationError("existingRecommendationContext must be an object when provided");
  }

  if (typeof existingRecommendationContext.alreadyEvaluated !== "boolean") {
    throw new ProgressionDecisionValidationError("existingRecommendationContext.alreadyEvaluated must be a boolean");
  }
}

function validatePolicyThresholds(policyThresholds) {
  if (policyThresholds === null || policyThresholds === undefined) {
    return;
  }

  if (!isPlainObject(policyThresholds)) {
    throw new ProgressionDecisionValidationError("policyThresholds must be an object when provided");
  }

  if (!isPositiveInteger(policyThresholds.deloadFailureStreak)) {
    throw new ProgressionDecisionValidationError("policyThresholds.deloadFailureStreak must be a positive integer");
  }
}

function validateTrainingStateSignals(trainingStateSignals) {
  if (!isPlainObject(trainingStateSignals)) {
    throw new ProgressionDecisionValidationError("trainingStateSignals is required");
  }

  if (!isPlainObject(trainingStateSignals.fatigue)) {
    throw new ProgressionDecisionValidationError("trainingStateSignals.fatigue is required");
  }

  if (!isPlainObject(trainingStateSignals.fatigue.historicalTrainingSignals)) {
    throw new ProgressionDecisionValidationError(
      "trainingStateSignals.fatigue.historicalTrainingSignals is required"
    );
  }
}

function validateInput(input) {
  if (!isPlainObject(input)) {
    throw new ProgressionDecisionValidationError("input is required");
  }

  validateAnalysisShape(input.analysis);
  validateProgressionPolicy(input.progressionPolicy);
  validateRecoveryConstraint(input.recoveryConstraint);
  validatePreviousDecisionContext(input.previousDecisionContext);
  validateTrainingStateSignals(input.trainingStateSignals);
  validateExistingRecommendationContext(input.existingRecommendationContext);
  validatePolicyThresholds(input.policyThresholds);
}

export class ProgressionDecisionValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProgressionDecisionValidationError";
  }
}

function buildContext(input) {
  const policyThresholds = {
    deloadFailureStreak: input.policyThresholds?.deloadFailureStreak ?? 2,
  };

  const analysis = input.analysis;
  const observed = analysis.observedPerformance;
  const history = analysis.historyFacts;
  const progressionMode = input.progressionPolicy.progressionMode;
  const isRepsMode = progressionMode === "reps";
  const isRepsThenLoadMode = progressionMode === "reps_then_load";
  const isTimeMode = progressionMode === "time";
  const fullTargetSuccess =
    observed.prescribedSetCompletionRate === 1 &&
    observed.targetRepHitRate === 1 &&
    analysis.prescription.prescribedSets > 0;
  const partialTargetCompletion =
    observed.loggedSetCount > 0 &&
    (observed.prescribedSetCompletionRate !== 1 || observed.targetRepHitRate !== 1);
  const improvementSignals = [];
  const regressionSignals = [];

  if (!isRepsMode && !isTimeMode && history.weightDeltaKg !== null && history.weightDeltaKg > 0) {
    improvementSignals.push(REASON_CODES.PERFORMANCE_IMPROVED);
  }

  if (history.prescribedSetCompletionRateDelta !== null && history.prescribedSetCompletionRateDelta > 0) {
    improvementSignals.push(
      isRepsMode
        ? REASON_CODES.REP_PERFORMANCE_IMPROVED
        : isTimeMode
          ? REASON_CODES.TIME_PERFORMANCE_IMPROVED
          : REASON_CODES.PERFORMANCE_IMPROVED
    );
  }

  if (!isRepsMode && !isTimeMode && history.weightDeltaKg !== null && history.weightDeltaKg < 0) {
    regressionSignals.push(REASON_CODES.PERFORMANCE_REGRESSED);
  }

  if (history.prescribedSetCompletionRateDelta !== null && history.prescribedSetCompletionRateDelta < 0) {
    regressionSignals.push(REASON_CODES.PERFORMANCE_REGRESSED);
  }

  const conflictingSignals = improvementSignals.length > 0 && regressionSignals.length > 0;
  const effectiveConsecutiveFailures = Math.max(
    history.consecutiveFailedSessions,
    input.previousDecisionContext?.consecutiveFailures ?? 0
  );

  return {
    input,
    analysis,
    progressionPolicy: input.progressionPolicy,
    recoveryConstraint: input.recoveryConstraint ?? null,
    previousDecisionContext: input.previousDecisionContext ?? null,
    existingRecommendationContext: input.existingRecommendationContext ?? null,
    policyThresholds,
    progressionMode,
    isRepsMode,
    isRepsThenLoadMode,
    isTimeMode,
    fullTargetSuccess,
    partialTargetCompletion,
    improvementSignals,
    regressionSignals,
    conflictingSignals,
    effectiveConsecutiveFailures,
    missingDurationTarget:
      isTimeMode &&
      (analysis.prescription.prescribedRepLow === null ||
        analysis.prescription.prescribedRepHigh === null ||
        analysis.dataQualityFlags.includes("missing_prescribed_rep_low") ||
        analysis.dataQualityFlags.includes("missing_prescribed_rep_high")),
    usableLoadData:
      analysis.observedPerformance.bestSet?.weightKg !== null &&
      analysis.observedPerformance.bestSet?.weightKg !== undefined,
  };
}

export const RULE_CATALOG = Object.freeze([
  Object.freeze({ id: "R001_INVALID_ANALYSIS_FLAGS", priority: 100, terminal: true }),
  Object.freeze({ id: "R002_ALREADY_EVALUATED", priority: 95, terminal: true }),
  Object.freeze({ id: "R003_INVALID_ZERO_PRESCRIPTION", priority: 90, terminal: true }),
  Object.freeze({ id: "R004_INSUFFICIENT_HISTORY", priority: 85, terminal: true }),
  Object.freeze({ id: "R005_NO_VALID_INCREMENT", priority: 80, terminal: true }),
  Object.freeze({ id: "R006_REPEATED_FAILURE_DELOAD", priority: 75, terminal: true }),
  Object.freeze({ id: "R007_PARTIAL_TARGETS_HOLD", priority: 70, terminal: true }),
  Object.freeze({ id: "R008_MISSING_LOAD_DATA_HOLD", priority: 65, terminal: true }),
  Object.freeze({ id: "R009_REPEATED_SUCCESS_INCREASE", priority: 60, terminal: false }),
  Object.freeze({ id: "R010_PERFORMANCE_IMPROVED_INCREASE", priority: 55, terminal: false }),
  Object.freeze({ id: "R011_PERFORMANCE_REGRESSED_HOLD", priority: 50, terminal: true }),
  Object.freeze({ id: "R012_TARGETS_FULLY_MET_HOLD", priority: 45, terminal: true }),
  Object.freeze({ id: "R015_HISTORICAL_TREND_CONFLICT_DOWNGRADE", priority: 42, terminal: true }),
  Object.freeze({ id: "R013_RECOVERY_DOWNGRADE", priority: 40, terminal: true }),
  Object.freeze({ id: "R014_FALLBACK_MAINTAIN", priority: 10, terminal: true }),
]);

const ANALYSIS_MANUAL_REVIEW_FLAGS = new Set([
  "missing_prescribed_rep_low",
  "missing_prescribed_rep_high",
]);

function createCandidate({
  ruleId,
  decisionType,
  primaryReasonCode,
  secondaryReasonCodes = [],
  terminal = false,
  requiresManualReview = false,
  shouldPersist = true,
  loadAdjustmentSteps = 0,
  setAdjustment = 0,
  repAdjustment = 0,
  durationAdjustmentSteps = 0,
}) {
  validateDecisionType(decisionType, "candidate.decisionType");
  validateReasonCode(primaryReasonCode, "candidate.primaryReasonCode");
  validateAdjustment(loadAdjustmentSteps, "candidate.loadAdjustmentSteps");
  validateAdjustment(setAdjustment, "candidate.setAdjustment");
  validateAdjustment(repAdjustment, "candidate.repAdjustment");
  validateAdjustment(durationAdjustmentSteps, "candidate.durationAdjustmentSteps");

  const dedupedSecondaries = uniqueOrdered(
    secondaryReasonCodes.filter((code) => code !== primaryReasonCode)
  ).sort(compareReasonCodes);

  for (const code of dedupedSecondaries) {
    validateReasonCode(code, "candidate.secondaryReasonCodes[]");
  }

  return {
    ruleId,
    decisionType,
    primaryReasonCode,
    secondaryReasonCodes: dedupedSecondaries,
    terminal,
    requiresManualReview,
    shouldPersist,
    loadAdjustmentSteps,
    setAdjustment,
    repAdjustment,
    durationAdjustmentSteps,
  };
}

function buildRuleR001(context) {
  const severeFlags = context.analysis.dataQualityFlags.filter(
    (flag) => ANALYSIS_MANUAL_REVIEW_FLAGS.has(flag) && !context.isTimeMode
  );
  if (severeFlags.length === 0) return null;

  return createCandidate({
    ruleId: "R001_INVALID_ANALYSIS_FLAGS",
    decisionType: DECISION_TYPES.MANUAL_REVIEW,
    primaryReasonCode: REASON_CODES.INVALID_ANALYSIS,
    secondaryReasonCodes: [],
    terminal: true,
    requiresManualReview: true,
    shouldPersist: false,
  });
}

function buildRuleR002(context) {
  if (!context.existingRecommendationContext?.alreadyEvaluated) return null;

  return createCandidate({
    ruleId: "R002_ALREADY_EVALUATED",
    decisionType: DECISION_TYPES.SKIP,
    primaryReasonCode: REASON_CODES.ALREADY_EVALUATED,
    terminal: true,
    shouldPersist: false,
  });
}

function buildRuleR003(context) {
  if (context.analysis.prescription.prescribedSets !== 0) return null;

  return createCandidate({
    ruleId: "R003_INVALID_ZERO_PRESCRIPTION",
    decisionType: DECISION_TYPES.SKIP,
    primaryReasonCode: REASON_CODES.ZERO_PRESCRIPTION,
    terminal: true,
    shouldPersist: false,
  });
}

function buildRuleR004(context) {
  if (context.missingDurationTarget) {
    return createCandidate({
      ruleId: "R004_INSUFFICIENT_HISTORY",
      decisionType: DECISION_TYPES.INSUFFICIENT_DATA,
      primaryReasonCode: REASON_CODES.MISSING_DURATION_TARGET,
      terminal: true,
      shouldPersist: false,
    });
  }

  if (context.analysis.hasSufficientData && !context.analysis.dataQualityFlags.includes("missing_previous_history")) {
    return null;
  }

  return createCandidate({
    ruleId: "R004_INSUFFICIENT_HISTORY",
    decisionType: DECISION_TYPES.INSUFFICIENT_DATA,
    primaryReasonCode: REASON_CODES.INSUFFICIENT_HISTORY,
    secondaryReasonCodes:
      context.analysis.dataQualityFlags.includes("missing_previous_history")
        ? []
        : [REASON_CODES.INVALID_ANALYSIS],
    terminal: true,
    shouldPersist: false,
  });
}

function buildRuleR005(context) {
  if (context.progressionPolicy.validIncrement) return null;

  return createCandidate({
    ruleId: "R005_NO_VALID_INCREMENT",
    decisionType: DECISION_TYPES.SKIP,
    primaryReasonCode: REASON_CODES.NO_VALID_INCREMENT,
    terminal: true,
    shouldPersist: false,
  });
}

function buildRuleR006(context) {
  if (context.effectiveConsecutiveFailures < context.policyThresholds.deloadFailureStreak) return null;

  return createCandidate({
    ruleId: "R006_REPEATED_FAILURE_DELOAD",
    decisionType: DECISION_TYPES.DELOAD,
    primaryReasonCode: REASON_CODES.REPEATED_FAILURE,
    secondaryReasonCodes: context.regressionSignals,
    terminal: true,
    loadAdjustmentSteps: context.isRepsMode || context.isTimeMode ? 0 : -1,
    repAdjustment: context.isRepsMode ? -1 : 0,
  });
}

function buildRuleR007(context) {
  if (!context.partialTargetCompletion) return null;

  const secondaryReasonCodes = [...context.regressionSignals];
  if (context.effectiveConsecutiveFailures > 0) {
    secondaryReasonCodes.push(REASON_CODES.REPEATED_FAILURE);
  }

  return createCandidate({
    ruleId: "R007_PARTIAL_TARGETS_HOLD",
    decisionType: DECISION_TYPES.MAINTAIN,
    primaryReasonCode: REASON_CODES.TARGETS_PARTIALLY_MET,
    secondaryReasonCodes,
    terminal: true,
  });
}

function buildRuleR008(context) {
  if (!context.fullTargetSuccess || context.usableLoadData) return null;
  if (!context.progressionPolicy.allowsLoadAdjustment) return null;
  if (context.isRepsMode) return null;
  if (context.isRepsThenLoadMode) return null;

  return createCandidate({
    ruleId: "R008_MISSING_LOAD_DATA_HOLD",
    decisionType: DECISION_TYPES.MAINTAIN,
    primaryReasonCode: REASON_CODES.MISSING_LOAD_DATA,
    secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
    terminal: true,
  });
}

function buildRuleR009(context) {
  if (!context.fullTargetSuccess) return null;
  if (context.analysis.historyFacts.consecutiveSuccessfulSessions < 2) return null;
  if (
    !context.progressionPolicy.allowsLoadAdjustment &&
    !context.progressionPolicy.allowsRepAdjustment &&
    !context.isTimeMode
  ) {
    return null;
  }

  if (context.isRepsMode) {
    if (!context.progressionPolicy.allowsRepAdjustment) return null;

    return createCandidate({
      ruleId: "R009_REPEATED_SUCCESS_INCREASE",
      decisionType: DECISION_TYPES.INCREASE_REPS,
      primaryReasonCode: REASON_CODES.REPEATED_REP_SUCCESS,
      secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
      repAdjustment: 1,
    });
  }

  if (context.isRepsThenLoadMode) {
    if (context.analysis.observedPerformance.allPlannedSetsReachedUpperRepBound) {
      if (!context.progressionPolicy.allowsLoadAdjustment) return null;

      return createCandidate({
        ruleId: "R009_REPEATED_SUCCESS_INCREASE",
        decisionType: DECISION_TYPES.INCREASE_LOAD,
        primaryReasonCode: REASON_CODES.REPEATED_SUCCESS,
        secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
        loadAdjustmentSteps: 1,
      });
    }

    if (!context.progressionPolicy.allowsRepAdjustment) return null;

    return createCandidate({
      ruleId: "R009_REPEATED_SUCCESS_INCREASE",
      decisionType: DECISION_TYPES.INCREASE_REPS,
      primaryReasonCode: REASON_CODES.REPEATED_REP_SUCCESS,
      secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
      repAdjustment: 1,
    });
  }

  if (context.isTimeMode) {
    return createCandidate({
      ruleId: "R009_REPEATED_SUCCESS_INCREASE",
      decisionType: DECISION_TYPES.INCREASE_DURATION,
      primaryReasonCode: REASON_CODES.REPEATED_TIME_SUCCESS,
      secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
      durationAdjustmentSteps: 1,
    });
  }

  return createCandidate({
    ruleId: "R009_REPEATED_SUCCESS_INCREASE",
    decisionType: DECISION_TYPES.INCREASE_LOAD,
    primaryReasonCode: REASON_CODES.REPEATED_SUCCESS,
    secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
    loadAdjustmentSteps: 1,
  });
}

function buildRuleR010(context) {
  if (!context.fullTargetSuccess) return null;
  if (context.improvementSignals.length === 0) return null;
  if (
    !context.progressionPolicy.allowsLoadAdjustment &&
    !context.progressionPolicy.allowsRepAdjustment &&
    !context.isTimeMode
  ) {
    return null;
  }

  if (context.isRepsMode) {
    if (!context.progressionPolicy.allowsRepAdjustment) return null;

    return createCandidate({
      ruleId: "R010_PERFORMANCE_IMPROVED_INCREASE",
      decisionType: DECISION_TYPES.INCREASE_REPS,
      primaryReasonCode: REASON_CODES.REP_PERFORMANCE_IMPROVED,
      secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
      repAdjustment: 1,
    });
  }

  if (context.isRepsThenLoadMode) {
    if (context.analysis.observedPerformance.allPlannedSetsReachedUpperRepBound) {
      if (!context.progressionPolicy.allowsLoadAdjustment) return null;

      return createCandidate({
        ruleId: "R010_PERFORMANCE_IMPROVED_INCREASE",
        decisionType: DECISION_TYPES.INCREASE_LOAD,
        primaryReasonCode: REASON_CODES.PERFORMANCE_IMPROVED,
        secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
        loadAdjustmentSteps: 1,
      });
    }

    if (!context.progressionPolicy.allowsRepAdjustment) return null;

    return createCandidate({
      ruleId: "R010_PERFORMANCE_IMPROVED_INCREASE",
      decisionType: DECISION_TYPES.INCREASE_REPS,
      primaryReasonCode: REASON_CODES.REP_PERFORMANCE_IMPROVED,
      secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
      repAdjustment: 1,
    });
  }

  if (context.isTimeMode) {
    return createCandidate({
      ruleId: "R010_PERFORMANCE_IMPROVED_INCREASE",
      decisionType: DECISION_TYPES.INCREASE_DURATION,
      primaryReasonCode: REASON_CODES.TIME_PERFORMANCE_IMPROVED,
      secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
      durationAdjustmentSteps: 1,
    });
  }

  return createCandidate({
    ruleId: "R010_PERFORMANCE_IMPROVED_INCREASE",
    decisionType: DECISION_TYPES.INCREASE_LOAD,
    primaryReasonCode: REASON_CODES.PERFORMANCE_IMPROVED,
    secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
    loadAdjustmentSteps: 1,
  });
}

function buildRuleR011(context) {
  if (!context.fullTargetSuccess) return null;
  if (context.regressionSignals.length === 0) return null;

  return createCandidate({
    ruleId: "R011_PERFORMANCE_REGRESSED_HOLD",
    decisionType: DECISION_TYPES.MAINTAIN,
    primaryReasonCode: REASON_CODES.PERFORMANCE_REGRESSED,
    secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
    terminal: true,
  });
}

function buildRuleR012(context) {
  if (!context.fullTargetSuccess) return null;

  return createCandidate({
    ruleId: "R012_TARGETS_FULLY_MET_HOLD",
    decisionType: DECISION_TYPES.MAINTAIN,
    primaryReasonCode: REASON_CODES.TARGETS_FULLY_MET,
    terminal: true,
  });
}

function buildRuleR013(context, candidate) {
  if (!candidate) return null;
  if (
    candidate.decisionType !== DECISION_TYPES.INCREASE_LOAD &&
    candidate.decisionType !== DECISION_TYPES.INCREASE_REPS &&
    candidate.decisionType !== DECISION_TYPES.INCREASE_DURATION
  ) {
    return candidate;
  }
  if (context.recoveryConstraint?.recoveryModifier !== "caution") return candidate;

  return createCandidate({
    ruleId: "R013_RECOVERY_DOWNGRADE",
    decisionType: DECISION_TYPES.MAINTAIN,
    primaryReasonCode: REASON_CODES.RECOVERY_OVERRIDE,
    secondaryReasonCodes: [candidate.primaryReasonCode, ...candidate.secondaryReasonCodes],
    terminal: true,
  });
}

function buildRuleR014() {
  return createCandidate({
    ruleId: "R014_FALLBACK_MAINTAIN",
    decisionType: DECISION_TYPES.MAINTAIN,
    primaryReasonCode: REASON_CODES.TARGETS_PARTIALLY_MET,
    terminal: true,
  });
}

function runTerminalRulePipeline(context) {
  const terminalRules = [
    buildRuleR001,
    buildRuleR002,
    buildRuleR003,
    buildRuleR004,
    buildRuleR005,
    buildRuleR006,
    buildRuleR007,
    buildRuleR008,
  ];

  for (const rule of terminalRules) {
    const candidate = rule(context);
    if (candidate) {
      return candidate;
    }
  }

  return null;
}

function runProgressionRulePipeline(context) {
  const candidateRules = [buildRuleR009, buildRuleR010];
  const terminalMaintainRules = [buildRuleR011, buildRuleR012];

  const candidates = candidateRules
    .map((rule) => rule(context))
    .filter(Boolean)
    .sort((left, right) => {
      const leftMeta = RULE_CATALOG.find((rule) => rule.id === left.ruleId);
      const rightMeta = RULE_CATALOG.find((rule) => rule.id === right.ruleId);
      return (rightMeta?.priority ?? 0) - (leftMeta?.priority ?? 0);
    });

  const selectedCandidate = candidates[0] ?? null;
  if (selectedCandidate) {
    const candidateAfterHistoricalSeam = applyHistoricalProgressionModifier({
      candidateDecision: selectedCandidate,
      historicalTrainingSignals:
        context.input.trainingStateSignals.fatigue.historicalTrainingSignals,
    });
    return buildRuleR013(context, candidateAfterHistoricalSeam);
  }

  for (const rule of terminalMaintainRules) {
    const candidate = rule(context);
    if (candidate) return candidate;
  }

  return buildRuleR014();
}

function calculateConfidence(candidate, context) {
  let confidence = 0.5;

  if (candidate.decisionType === DECISION_TYPES.INSUFFICIENT_DATA) {
    confidence -= 0.25;
  }

  if (context.analysis.dataQualityFlags.includes("missing_previous_history")) {
    confidence -= 0.25;
  }

  const qualityPenalty = Math.min(context.analysis.dataQualityFlags.length * 0.1, 0.3);
  const adjustedQualityPenalty =
    context.isTimeMode && context.analysis.dataQualityFlags.includes("missing_weight_data")
      ? Math.max(0, qualityPenalty - 0.1)
      : qualityPenalty;
  confidence -= adjustedQualityPenalty;

  if (
    (candidate.decisionType === DECISION_TYPES.INCREASE_LOAD ||
      candidate.decisionType === DECISION_TYPES.INCREASE_REPS ||
      candidate.decisionType === DECISION_TYPES.INCREASE_DURATION) &&
    context.analysis.historyFacts.consecutiveSuccessfulSessions >= 2
  ) {
    confidence += 0.15;
  }

  if (
    candidate.decisionType === DECISION_TYPES.INCREASE_LOAD &&
    (context.analysis.historyFacts.weightDeltaKg > 0 ||
      context.analysis.historyFacts.prescribedSetCompletionRateDelta > 0)
  ) {
    confidence += 0.15;
  }

  if (
    candidate.decisionType === DECISION_TYPES.INCREASE_REPS &&
    context.analysis.historyFacts.prescribedSetCompletionRateDelta > 0
  ) {
    confidence += 0.15;
  }

  if (
    candidate.decisionType === DECISION_TYPES.INCREASE_DURATION &&
    context.analysis.historyFacts.prescribedSetCompletionRateDelta > 0
  ) {
    confidence += 0.15;
  }

  if (candidate.decisionType === DECISION_TYPES.DELOAD) {
    confidence += 0.1;
  }

  if (candidate.primaryReasonCode === REASON_CODES.RECOVERY_OVERRIDE) {
    confidence -= 0.1;
  }

  if (context.conflictingSignals) {
    confidence -= 0.1;
  }

  confidence = roundToTwo(Math.max(0, Math.min(1, confidence)));
  return confidence;
}

function buildDecisionOutput(candidate, context) {
  const output = {
    exerciseId: context.analysis.exerciseId,
    sourceSessionId: context.analysis.sourceSessionId,
    decisionType: candidate.decisionType,
    loadAdjustmentSteps: candidate.loadAdjustmentSteps,
    setAdjustment: candidate.setAdjustment,
    repAdjustment: candidate.repAdjustment,
    durationAdjustmentSteps: candidate.durationAdjustmentSteps,
    reasonCode: candidate.primaryReasonCode,
    secondaryReasonCodes: uniqueOrdered(candidate.secondaryReasonCodes).sort(compareReasonCodes),
    confidence: calculateConfidence(candidate, context),
    requiresManualReview: candidate.requiresManualReview,
    shouldPersist:
      candidate.decisionType === DECISION_TYPES.SKIP ||
      candidate.decisionType === DECISION_TYPES.INSUFFICIENT_DATA ||
      candidate.requiresManualReview
        ? false
        : candidate.shouldPersist,
    rulesVersion: PROGRESSION_RULES_VERSION,
  };

  validateOutput(output);
  return deepFreeze(output);
}

function validateOutput(output) {
  if (!isPositiveInteger(output.exerciseId)) {
    throw new ProgressionDecisionValidationError("output.exerciseId must be a positive integer");
  }

  if (!isPositiveInteger(output.sourceSessionId)) {
    throw new ProgressionDecisionValidationError("output.sourceSessionId must be a positive integer");
  }

  validateDecisionType(output.decisionType, "output.decisionType");
  validateReasonCode(output.reasonCode, "output.reasonCode");

  if (!Array.isArray(output.secondaryReasonCodes)) {
    throw new ProgressionDecisionValidationError("output.secondaryReasonCodes must be an array");
  }

  for (const code of output.secondaryReasonCodes) {
    validateReasonCode(code, "output.secondaryReasonCodes[]");
  }

  if (new Set(output.secondaryReasonCodes).size !== output.secondaryReasonCodes.length) {
    throw new ProgressionDecisionValidationError("output.secondaryReasonCodes must not contain duplicates");
  }

  if (output.secondaryReasonCodes.includes(output.reasonCode)) {
    throw new ProgressionDecisionValidationError("output.secondaryReasonCodes must not include the primary reasonCode");
  }

  if (!isValidRate(output.confidence)) {
    throw new ProgressionDecisionValidationError("output.confidence must be between 0 and 1");
  }

  if (typeof output.requiresManualReview !== "boolean") {
    throw new ProgressionDecisionValidationError("output.requiresManualReview must be a boolean");
  }

  if (typeof output.shouldPersist !== "boolean") {
    throw new ProgressionDecisionValidationError("output.shouldPersist must be a boolean");
  }

  for (const field of ["loadAdjustmentSteps", "setAdjustment", "repAdjustment", "durationAdjustmentSteps"]) {
    validateAdjustment(output[field], `output.${field}`);
  }

  if (output.decisionType === DECISION_TYPES.INCREASE_DURATION && output.durationAdjustmentSteps <= 0) {
    throw new ProgressionDecisionValidationError(
      "INCREASE_DURATION must emit a positive durationAdjustmentSteps"
    );
  }

  if (output.decisionType !== DECISION_TYPES.INCREASE_DURATION && output.durationAdjustmentSteps !== 0) {
    throw new ProgressionDecisionValidationError(
      "Only INCREASE_DURATION may emit a non-zero durationAdjustmentSteps"
    );
  }

  if (
    (output.decisionType === DECISION_TYPES.SKIP || output.decisionType === DECISION_TYPES.INSUFFICIENT_DATA) &&
    output.shouldPersist !== false
  ) {
    throw new ProgressionDecisionValidationError("SKIP and INSUFFICIENT_DATA must not persist");
  }

  if (typeof output.rulesVersion !== "string" || output.rulesVersion.length === 0) {
    throw new ProgressionDecisionValidationError("output.rulesVersion must be a non-empty string");
  }
}

export function decideProgression(input) {
  validateInput(input);
  const context = buildContext(input);
  const terminalDecision = runTerminalRulePipeline(context);
  const candidate = terminalDecision ?? runProgressionRulePipeline(context);
  return buildDecisionOutput(candidate, context);
}

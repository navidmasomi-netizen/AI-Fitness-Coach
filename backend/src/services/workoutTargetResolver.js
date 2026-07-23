import { DECISION_TYPES } from "./progressionDecisionEngine.js";

export const RECOMMENDATION_LIFECYCLE_STATUSES = Object.freeze({
  PENDING: "PENDING",
  APPLIED: "APPLIED",
  SUPERSEDED: "SUPERSEDED",
  INVALID: "INVALID",
  LEGACY_UNRESOLVABLE: "LEGACY_UNRESOLVABLE",
  IGNORED: "IGNORED",
});

export const WORKOUT_TARGET_RESOLUTION_REASONS = Object.freeze({
  LEGACY_RECOMMENDATION: "LEGACY_RECOMMENDATION",
  NON_PENDING_RECOMMENDATION: "NON_PENDING_RECOMMENDATION",
  MISSING_RULES_VERSION: "MISSING_RULES_VERSION",
  MISSING_BASELINE_TARGET: "MISSING_BASELINE_TARGET",
  MISSING_LOAD_INCREMENT: "MISSING_LOAD_INCREMENT",
  MISSING_DURATION_INCREMENT: "MISSING_DURATION_INCREMENT",
  UNSUPPORTED_DECISION: "UNSUPPORTED_DECISION",
  UNSUPPORTED_MODE: "UNSUPPORTED_MODE",
  TIME_DELOAD_UNRESOLVED: "TIME_DELOAD_UNRESOLVED",
  INVALID_ADJUSTMENT: "INVALID_ADJUSTMENT",
  INVALID_TARGET_STATE: "INVALID_TARGET_STATE",
  MISSING_EXACT_REP_TARGET: "MISSING_EXACT_REP_TARGET",
});

const SUPPORTED_PROGRESSION_TYPES = new Set(["load", "reps", "reps_then_load", "time"]);
const SUPPORTED_RECOMMENDATION_LIFECYCLE_VALUES = new Set(
  Object.values(RECOMMENDATION_LIFECYCLE_STATUSES)
);

export class WorkoutTargetResolverValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "WorkoutTargetResolverValidationError";
  }
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function cloneAdjustments(recommendation) {
  return {
    loadAdjustmentSteps: recommendation?.loadAdjustmentSteps ?? 0,
    repAdjustment: recommendation?.repAdjustment ?? 0,
    setAdjustment: recommendation?.setAdjustment ?? 0,
    durationAdjustmentSteps: recommendation?.durationAdjustmentSteps ?? 0,
  };
}

function buildResolvedTarget(baselineTarget, recommendation) {
  return {
    targetSets: baselineTarget.targetSets,
    targetRepRangeLow: baselineTarget.prescribedRepLow ?? null,
    targetRepRangeHigh: baselineTarget.prescribedRepHigh ?? null,
    exactRepTarget: baselineTarget.exactRepTarget ?? null,
    targetLoadKg: baselineTarget.targetLoadKg ?? null,
    targetDurationSeconds: baselineTarget.targetDurationSeconds ?? null,
    progressionType: baselineTarget.progressionType,
    sourceDecisionType: recommendation?.decisionType ?? null,
    sourceRulesVersion: recommendation?.rulesVersion ?? null,
    appliedAdjustments: cloneAdjustments(recommendation),
  };
}

function resolved(target) {
  return {
    status: "resolved",
    target,
  };
}

function unresolved(reason) {
  return {
    status: "unresolved",
    reason,
  };
}

function validateTopLevelInput(input) {
  if (!isPlainObject(input)) {
    throw new WorkoutTargetResolverValidationError("resolver input must be an object");
  }

  if (!("baselineTarget" in input)) {
    throw new WorkoutTargetResolverValidationError("resolver input must include baselineTarget");
  }
}

function isRepBasedMode(progressionType) {
  return progressionType === "load" || progressionType === "reps" || progressionType === "reps_then_load";
}

function validateBaselineTarget(baselineTarget) {
  if (!isPlainObject(baselineTarget)) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.MISSING_BASELINE_TARGET;
  }

  if (!SUPPORTED_PROGRESSION_TYPES.has(baselineTarget.progressionType)) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.UNSUPPORTED_MODE;
  }

  if (!isPositiveInteger(baselineTarget.targetSets)) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
  }

  if (isRepBasedMode(baselineTarget.progressionType)) {
    if (!isPositiveInteger(baselineTarget.prescribedRepLow)) {
      return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
    }

    if (!isPositiveInteger(baselineTarget.prescribedRepHigh)) {
      return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
    }

    if (baselineTarget.prescribedRepHigh < baselineTarget.prescribedRepLow) {
      return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
    }

    if (baselineTarget.exactRepTarget !== null && baselineTarget.exactRepTarget !== undefined) {
      if (!isPositiveInteger(baselineTarget.exactRepTarget)) {
        return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
      }

      if (
        baselineTarget.exactRepTarget < baselineTarget.prescribedRepLow ||
        baselineTarget.exactRepTarget > baselineTarget.prescribedRepHigh
      ) {
        return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
      }
    }
  }

  if (
    baselineTarget.targetLoadKg !== null &&
    baselineTarget.targetLoadKg !== undefined &&
    !isNonNegativeFiniteNumber(baselineTarget.targetLoadKg)
  ) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
  }

  if (
    baselineTarget.targetDurationSeconds !== null &&
    baselineTarget.targetDurationSeconds !== undefined &&
    !isPositiveInteger(baselineTarget.targetDurationSeconds)
  ) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
  }

  return null;
}

function validateLifecycleEligibility(recommendation) {
  if (!isPlainObject(recommendation)) {
    throw new WorkoutTargetResolverValidationError("recommendation must be an object when provided");
  }

  if (recommendation.lifecycleStatus === null || recommendation.lifecycleStatus === undefined) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.LEGACY_RECOMMENDATION;
  }

  if (!SUPPORTED_RECOMMENDATION_LIFECYCLE_VALUES.has(recommendation.lifecycleStatus)) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.NON_PENDING_RECOMMENDATION;
  }

  if (recommendation.lifecycleStatus === RECOMMENDATION_LIFECYCLE_STATUSES.LEGACY_UNRESOLVABLE) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.LEGACY_RECOMMENDATION;
  }

  if (recommendation.lifecycleStatus !== RECOMMENDATION_LIFECYCLE_STATUSES.PENDING) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.NON_PENDING_RECOMMENDATION;
  }

  if (!isNonEmptyString(recommendation.decisionType)) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.LEGACY_RECOMMENDATION;
  }

  if (!isNonEmptyString(recommendation.rulesVersion)) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.MISSING_RULES_VERSION;
  }

  return null;
}

function normalizeKgToCents(value) {
  if (value === null || value === undefined) {
    return null;
  }

  let raw;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    raw = value.toFixed(2);
  } else if (typeof value === "string") {
    raw = value.trim();
  } else if (typeof value?.toString === "function") {
    raw = value.toString().trim();
  } else {
    return null;
  }

  const match = raw.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) {
    return null;
  }

  const sign = match[1] === "-" ? -1 : 1;
  const whole = Number(match[2]);
  const fraction = Number((match[3] ?? "").padEnd(2, "0"));
  const cents = sign * (whole * 100 + fraction);

  return Number.isSafeInteger(cents) ? cents : null;
}

function normalizePositiveIncrementCents(value) {
  const cents = normalizeKgToCents(value);
  return cents !== null && cents > 0 ? cents : null;
}

function centsToKg(cents) {
  return Number((cents / 100).toFixed(2));
}

function validatePositiveIntegerAdjustment(value) {
  return Number.isInteger(value) && value > 0;
}

function validateNegativeIntegerAdjustment(value) {
  return Number.isInteger(value) && value < 0;
}

function hasAnyNonZeroAdjustment(recommendation) {
  return (
    recommendation.loadAdjustmentSteps !== 0 ||
    recommendation.repAdjustment !== 0 ||
    recommendation.setAdjustment !== 0 ||
    recommendation.durationAdjustmentSteps !== 0
  );
}

function validateResolvedTarget(target) {
  if (!isPositiveInteger(target.targetSets)) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
  }

  if (!SUPPORTED_PROGRESSION_TYPES.has(target.progressionType)) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.UNSUPPORTED_MODE;
  }

  if (isRepBasedMode(target.progressionType)) {
    if (!isPositiveInteger(target.targetRepRangeLow) || !isPositiveInteger(target.targetRepRangeHigh)) {
      return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
    }

    if (target.targetRepRangeHigh < target.targetRepRangeLow) {
      return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
    }

    if (target.exactRepTarget !== null && target.exactRepTarget !== undefined) {
      if (!isPositiveInteger(target.exactRepTarget)) {
        return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
      }

      if (target.exactRepTarget < target.targetRepRangeLow || target.exactRepTarget > target.targetRepRangeHigh) {
        return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
      }
    }
  }

  if (target.targetLoadKg !== null && target.targetLoadKg !== undefined && !isNonNegativeFiniteNumber(target.targetLoadKg)) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
  }

  if (
    target.targetDurationSeconds !== null &&
    target.targetDurationSeconds !== undefined &&
    !isPositiveInteger(target.targetDurationSeconds)
  ) {
    return WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE;
  }

  return null;
}

function resolveIncreaseLoad(baselineTarget, recommendation, prescriptionMetadata) {
  if (!validatePositiveIntegerAdjustment(recommendation.loadAdjustmentSteps)) {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_ADJUSTMENT);
  }

  const loadIncrementCents = normalizePositiveIncrementCents(prescriptionMetadata?.loadIncrementKg);
  if (loadIncrementCents === null) {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.MISSING_LOAD_INCREMENT);
  }

  const baselineLoadCents = normalizeKgToCents(baselineTarget.targetLoadKg);
  if (baselineLoadCents === null) {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE);
  }

  const target = buildResolvedTarget(baselineTarget, recommendation);
  target.targetLoadKg = centsToKg(baselineLoadCents + recommendation.loadAdjustmentSteps * loadIncrementCents);

  if (baselineTarget.progressionType === "reps_then_load") {
    target.exactRepTarget = baselineTarget.prescribedRepLow;
  }

  const validationError = validateResolvedTarget(target);
  return validationError ? unresolved(validationError) : resolved(target);
}

function resolveIncreaseReps(baselineTarget, recommendation) {
  if (baselineTarget.progressionType === "time") {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.UNSUPPORTED_MODE);
  }

  if (!validatePositiveIntegerAdjustment(recommendation.repAdjustment)) {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_ADJUSTMENT);
  }

  if (!isPositiveInteger(baselineTarget.exactRepTarget)) {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.MISSING_EXACT_REP_TARGET);
  }

  const nextRepTarget = baselineTarget.exactRepTarget + recommendation.repAdjustment;
  if (nextRepTarget > baselineTarget.prescribedRepHigh) {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_ADJUSTMENT);
  }

  const target = buildResolvedTarget(baselineTarget, recommendation);
  target.exactRepTarget = nextRepTarget;

  const validationError = validateResolvedTarget(target);
  return validationError ? unresolved(validationError) : resolved(target);
}

function resolveIncreaseDuration(baselineTarget, recommendation, prescriptionMetadata) {
  if (baselineTarget.progressionType !== "time") {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.UNSUPPORTED_MODE);
  }

  if (!validatePositiveIntegerAdjustment(recommendation.durationAdjustmentSteps)) {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_ADJUSTMENT);
  }

  if (!isPositiveInteger(prescriptionMetadata?.durationIncrementSeconds)) {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.MISSING_DURATION_INCREMENT);
  }

  if (!isPositiveInteger(baselineTarget.targetDurationSeconds)) {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE);
  }

  const target = buildResolvedTarget(baselineTarget, recommendation);
  target.targetDurationSeconds =
    baselineTarget.targetDurationSeconds +
    recommendation.durationAdjustmentSteps * prescriptionMetadata.durationIncrementSeconds;

  const validationError = validateResolvedTarget(target);
  return validationError ? unresolved(validationError) : resolved(target);
}

function resolveDeload(baselineTarget, recommendation, prescriptionMetadata) {
  if (baselineTarget.progressionType === "time") {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.TIME_DELOAD_UNRESOLVED);
  }

  if (baselineTarget.progressionType === "reps") {
    if (
      !validateNegativeIntegerAdjustment(recommendation.repAdjustment) ||
      recommendation.loadAdjustmentSteps !== 0 ||
      recommendation.setAdjustment !== 0 ||
      recommendation.durationAdjustmentSteps !== 0
    ) {
      return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_ADJUSTMENT);
    }

    if (!isPositiveInteger(baselineTarget.exactRepTarget)) {
      return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.MISSING_EXACT_REP_TARGET);
    }

    const target = buildResolvedTarget(baselineTarget, recommendation);
    target.exactRepTarget = baselineTarget.exactRepTarget + recommendation.repAdjustment;
    const validationError = validateResolvedTarget(target);
    return validationError ? unresolved(validationError) : resolved(target);
  }

  if (
    !validateNegativeIntegerAdjustment(recommendation.loadAdjustmentSteps) ||
    recommendation.repAdjustment !== 0 ||
    recommendation.setAdjustment !== 0 ||
    recommendation.durationAdjustmentSteps !== 0
  ) {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_ADJUSTMENT);
  }

  const loadIncrementCents = normalizePositiveIncrementCents(prescriptionMetadata?.loadIncrementKg);
  if (loadIncrementCents === null) {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.MISSING_LOAD_INCREMENT);
  }

  const baselineLoadCents = normalizeKgToCents(baselineTarget.targetLoadKg);
  if (baselineLoadCents === null) {
    return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_TARGET_STATE);
  }

  const target = buildResolvedTarget(baselineTarget, recommendation);
  target.targetLoadKg = centsToKg(baselineLoadCents + recommendation.loadAdjustmentSteps * loadIncrementCents);

  const validationError = validateResolvedTarget(target);
  return validationError ? unresolved(validationError) : resolved(target);
}

export function resolveWorkoutTarget(input) {
  validateTopLevelInput(input);

  const baselineValidationError = validateBaselineTarget(input.baselineTarget);
  if (baselineValidationError) {
    return unresolved(baselineValidationError);
  }

  if (input.recommendation === null || input.recommendation === undefined) {
    return resolved(buildResolvedTarget(input.baselineTarget, null));
  }

  const lifecycleError = validateLifecycleEligibility(input.recommendation);
  if (lifecycleError) {
    return unresolved(lifecycleError);
  }

  switch (input.recommendation.decisionType) {
    case DECISION_TYPES.MAINTAIN:
      if (hasAnyNonZeroAdjustment(input.recommendation)) {
        return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.INVALID_ADJUSTMENT);
      }
      return resolved(buildResolvedTarget(input.baselineTarget, input.recommendation));

    case DECISION_TYPES.INCREASE_LOAD:
      return resolveIncreaseLoad(input.baselineTarget, input.recommendation, input.prescriptionMetadata ?? null);

    case DECISION_TYPES.INCREASE_REPS:
      return resolveIncreaseReps(input.baselineTarget, input.recommendation);

    case DECISION_TYPES.INCREASE_DURATION:
      return resolveIncreaseDuration(
        input.baselineTarget,
        input.recommendation,
        input.prescriptionMetadata ?? null
      );

    case DECISION_TYPES.DELOAD:
      return resolveDeload(input.baselineTarget, input.recommendation, input.prescriptionMetadata ?? null);

    default:
      return unresolved(WORKOUT_TARGET_RESOLUTION_REASONS.UNSUPPORTED_DECISION);
  }
}

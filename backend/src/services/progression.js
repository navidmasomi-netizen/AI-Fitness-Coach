const LOWER_BODY_PATTERNS = ["squat", "hinge", "lunge", "single_leg"];

function roundToQuarter(value) {
  return Math.round(value / 1.25) * 1.25;
}

function getWeightIncrement(exercise, isBeginner) {
  const isLowerBody = LOWER_BODY_PATTERNS.includes(exercise.movementPattern);
  const isCompound = exercise.complexity === "compound";

  if (isLowerBody && isCompound) {
    return isBeginner ? 1.25 : 2.5;
  }
  return 1.25;
}

function formatConfidence(confidence) {
  return confidence.toFixed(2);
}

function getLatestLoggedWeight(exerciseSummary) {
  return exerciseSummary?.recentSets?.[0]?.weightKg ?? null;
}

/**
 * Progression Engine v2 rules:
 * - Decisions are driven by WorkoutAnalysis.exerciseSummaries[].performanceTrend.
 * - Trend confidence boundary is inclusive: confidence >= 0.67 is eligible for increase.
 * - Recovery modifier interpretation:
 *   recoveryQuality === "low" always downgrades an increase decision to maintain.
 *   This is the conservative interpretation of "may downgrade" and never creates deload.
 * - Weight/progression math is preserved from the previous engine:
 *   lower-body-compound increment table, roundToQuarter, 10% deload, and
 *   progressionType handling for time / reps_then_load / default load.
 */
export function evaluateProgression({
  exerciseSummary,
  prescription,
  exercise,
  isBeginner,
  staticRecoveryQuality,
  recoveryModifier,
  previousRecommendation,
}) {
  const trace = {
    decision: "maintain",
    because: [],
  };

  const previousFailureStreak = previousRecommendation?.consecutiveFailures ?? 0;
  const trend = exerciseSummary.performanceTrend;
  const previousWeight = getLatestLoggedWeight(exerciseSummary);

  trace.because.push(`performance_trend:${trend.direction}`);
  trace.because.push(`trend_confidence:${formatConfidence(trend.confidence)}`);
  trace.because.push(`trend_reason:${trend.reason}`);
  trace.because.push(`consecutive_failures:${previousFailureStreak}`);

  let recommendationType;
  let consecutiveFailures = 0;

  if (trend.direction === "insufficient_data") {
    recommendationType = "maintain";
    consecutiveFailures = previousFailureStreak;
  } else if (trend.direction === "increasing" && trend.confidence < 0.67) {
    recommendationType = "maintain";
    consecutiveFailures = previousFailureStreak;
  } else if (trend.direction === "increasing" && trend.confidence >= 0.67) {
    recommendationType = "increase";
    consecutiveFailures = 0;
  } else if (trend.direction === "flat") {
    recommendationType = "maintain";
    consecutiveFailures = previousFailureStreak;
  } else if (
    trend.direction === "decreasing" &&
    (!previousRecommendation || previousRecommendation.consecutiveFailures < 1)
  ) {
    recommendationType = "maintain";
    consecutiveFailures = previousFailureStreak + 1;
  } else if (
    trend.direction === "decreasing" &&
    previousRecommendation &&
    previousRecommendation.consecutiveFailures >= 1
  ) {
    recommendationType = "deload";
    consecutiveFailures = previousFailureStreak;
  } else {
    recommendationType = "maintain";
    consecutiveFailures = previousFailureStreak;
  }

  const isIncreaseEligibleBeforeRecovery = recommendationType === "increase";
  const staticRecoveryDowngrade =
    isIncreaseEligibleBeforeRecovery && staticRecoveryQuality === "low";
  const behavioralRecoveryDowngrade =
    isIncreaseEligibleBeforeRecovery && recoveryModifier === "caution";

  if (staticRecoveryDowngrade) {
    trace.because.push(`static_recovery_quality:${staticRecoveryQuality}`);
    trace.because.push("static_recovery_downgrade:increase_to_maintain");
  }

  if (behavioralRecoveryDowngrade) {
    trace.because.push(`behavioral_recovery_modifier:${recoveryModifier}`);
    trace.because.push("behavioral_recovery_downgrade:increase_to_maintain");
  }

  if (staticRecoveryDowngrade || behavioralRecoveryDowngrade) {
    recommendationType = "maintain";
  }

  trace.decision = recommendationType;

  const previousTargetLow = prescription?.repRangeLow ?? null;
  const previousTargetHigh = prescription?.repRangeHigh ?? null;
  let recommendedWeightKg = previousWeight;
  let recommendedTargetLow = previousTargetLow;
  let recommendedTargetHigh = previousTargetHigh;

  let reason = "Workout trend stayed stable; load maintained for the next session.";

  if (recommendationType === "increase") {
    const progressionType = prescription?.progressionType || exercise.progressionType || "load";

    if (progressionType === "time") {
      recommendedWeightKg = previousWeight;
      recommendedTargetLow =
        previousTargetLow === null ? null : previousTargetLow + 5;
      recommendedTargetHigh =
        previousTargetHigh === null ? null : previousTargetHigh + 10;
      reason =
        "Recent workout trend is increasing with sufficient confidence; duration increased for the next session.";
    } else if (progressionType === "reps_then_load" && previousWeight !== null) {
      const increment = getWeightIncrement(exercise, isBeginner);
      recommendedWeightKg = roundToQuarter(previousWeight + increment);
      recommendedTargetLow = previousTargetLow;
      recommendedTargetHigh = previousTargetHigh;
      reason =
        "Recent workout trend is increasing with sufficient confidence; weight increased and reps reset for the next session.";
    } else {
      const increment = getWeightIncrement(exercise, isBeginner);
      recommendedWeightKg =
        previousWeight !== null ? roundToQuarter(previousWeight + increment) : null;
      recommendedTargetLow = previousTargetLow;
      recommendedTargetHigh = previousTargetHigh;
      reason =
        "Recent workout trend is increasing with sufficient confidence; weight increased for the next session.";
    }
  } else if (recommendationType === "deload") {
    recommendedWeightKg =
      previousWeight !== null ? roundToQuarter(previousWeight * 0.9) : null;
    recommendedTargetLow = previousTargetLow;
    recommendedTargetHigh = previousTargetHigh;
    reason =
      "Recent workout trend is decreasing for a second straight evaluation; weight reduced for the next session.";
  } else if (trend.direction === "insufficient_data") {
    reason = "There is not enough workout history yet; load maintained for the next session.";
  } else if (trend.direction === "increasing" && trend.confidence < 0.67) {
    reason =
      "Workout trend is improving but confidence is still below threshold; load maintained for the next session.";
  } else if (trend.direction === "increasing" && staticRecoveryQuality === "low" && recoveryModifier === "caution") {
    reason =
      "Workout trend is improving, but low recovery quality and recent training behavior triggered a conservative hold for the next session.";
  } else if (trend.direction === "increasing" && staticRecoveryQuality === "low") {
    reason =
      "Workout trend is improving, but low recovery quality triggered a conservative hold for the next session.";
  } else if (trend.direction === "increasing" && recoveryModifier === "caution") {
    reason =
      "Workout trend is improving, but recent training behavior triggered a conservative hold for the next session.";
  } else if (trend.direction === "flat") {
    reason = "Workout trend is flat; load maintained for the next session.";
  } else if (trend.direction === "decreasing") {
    reason =
      "Workout trend is decreasing; load maintained for one more attempt before any deload.";
  }

  return {
    recommendationType,
    previousWeightKg: previousWeight,
    recommendedWeightKg,
    previousTargetLow,
    previousTargetHigh,
    recommendedTargetLow,
    recommendedTargetHigh,
    progressionType: exercise.progressionType || null,
    consecutiveFailures,
    reason,
    trace,
  };
}

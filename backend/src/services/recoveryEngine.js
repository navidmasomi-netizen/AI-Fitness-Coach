function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Signal-strength boundaries are inclusive and deterministic:
 * - 0.00 through 0.33 => weak
 * - 0.34 through 0.66 => moderate
 * - 0.67 through 1.00 => strong
 */
export function deriveSignalStrength(confidence) {
  if (confidence <= 0.33) return "weak";
  if (confidence <= 0.66) return "moderate";
  return "strong";
}

export function assessSessionConsistency(sessionConsistency) {
  const completionRate = sessionConsistency?.completionRate ?? null;
  const missedSessionGapCount = sessionConsistency?.missedSessionGaps?.length ?? 0;

  return {
    completionRate,
    missedSessionGapCount,
    isCautionCompletionRate:
      completionRate !== null && completionRate < 0.5,
    isSupportiveCompletionRate:
      completionRate !== null && completionRate >= 0.9,
    completionRateCautionConfidence:
      completionRate === null ? 0 : clamp((0.5 - completionRate) / 0.5, 0, 1),
    completionRateSupportiveConfidence:
      completionRate === null ? 0 : clamp((completionRate - 0.9) / 0.1, 0, 1),
  };
}

export function assessCrossExerciseTrend(exerciseSummaries) {
  let increasingExerciseCount = 0;
  let decreasingExerciseCount = 0;

  for (const exerciseSummary of exerciseSummaries) {
    const trend = exerciseSummary.performanceTrend;
    if (trend.direction === "increasing" && trend.confidence >= 0.67) {
      increasingExerciseCount += 1;
    }
    if (trend.direction === "decreasing" && trend.confidence >= 0.67) {
      decreasingExerciseCount += 1;
    }
  }

  return {
    increasingExerciseCount,
    decreasingExerciseCount,
    hasSupportiveIncrease: increasingExerciseCount >= 1,
    hasCautionDecreaseCluster: decreasingExerciseCount >= 2,
    decreasingClusterConfidence:
      decreasingExerciseCount < 2
        ? 0
        : clamp((decreasingExerciseCount - 1) / 2, 0, 1),
  };
}

export function buildRecoveryTrace({
  recoveryModifier,
  confidence,
  sessionAssessment,
  trendAssessment,
  threshold,
}) {
  return {
    decision: recoveryModifier,
    because: [
      `completion_rate:${sessionAssessment.completionRate === null ? "null" : sessionAssessment.completionRate.toFixed(2)}`,
      `missed_session_gap_count:${sessionAssessment.missedSessionGapCount}`,
      `increasing_exercise_count:${trendAssessment.increasingExerciseCount}`,
      `decreasing_exercise_count:${trendAssessment.decreasingExerciseCount}`,
      `threshold:${threshold}`,
      `signal_strength:${deriveSignalStrength(confidence)}`,
    ],
  };
}

/**
 * Recovery Engine rules:
 * - Evaluate caution conditions first.
 * - Only if caution does not fire, evaluate supportive conditions.
 * - Only if neither fires, return neutral.
 * - confidence formulas:
 *   caution-from-completion = (0.5 - completionRate) / 0.5, clamped to 0..1
 *   caution-from-decreasing-cluster = (decreasingExerciseCount - 1) / 2, clamped to 0..1
 *   supportive = max((completionRate - 0.9) / 0.1, increasingExerciseCount / 2), clamped to 0..1
 *   neutral-from-null-data = 0
 *   neutral-from-observed-but-unremarkable-data = 0.4
 * - signalStrength is derived from confidence only and is never used in branching.
 */
export function computeRecoveryModifier({ workoutAnalysis }) {
  const sessionAssessment = assessSessionConsistency(workoutAnalysis.sessionConsistency);
  const trendAssessment = assessCrossExerciseTrend(workoutAnalysis.exerciseSummaries);

  if (
    sessionAssessment.isCautionCompletionRate ||
    trendAssessment.hasCautionDecreaseCluster
  ) {
    const confidence = roundToTwo(
      Math.max(
        sessionAssessment.completionRateCautionConfidence,
        trendAssessment.decreasingClusterConfidence
      )
    );
    const trace = buildRecoveryTrace({
      recoveryModifier: "caution",
      confidence,
      sessionAssessment,
      trendAssessment,
      threshold:
        sessionAssessment.isCautionCompletionRate &&
        trendAssessment.hasCautionDecreaseCluster
          ? "caution_both_signals"
          : sessionAssessment.isCautionCompletionRate
            ? "caution_completion_rate_below_0.5"
            : "caution_two_or_more_decreasing_exercises",
    });

    return {
      recoveryModifier: "caution",
      confidence,
      signalStrength: deriveSignalStrength(confidence),
      reason:
        sessionAssessment.isCautionCompletionRate
          ? "Recent training behavior shows low completion consistency; this behavioral caution cannot distinguish fatigue from external factors like travel or schedule disruption."
          : "Recent training behavior shows multiple exercises trending downward; this behavioral caution cannot distinguish recovery limits from external disruptions or logging variance.",
      trace,
    };
  }

  if (
    sessionAssessment.isSupportiveCompletionRate &&
    trendAssessment.hasSupportiveIncrease &&
    trendAssessment.decreasingExerciseCount === 0
  ) {
    const confidence = roundToTwo(
      clamp(
        Math.max(
          sessionAssessment.completionRateSupportiveConfidence,
          clamp(trendAssessment.increasingExerciseCount / 2, 0, 1)
        ),
        0,
        1
      )
    );
    const trace = buildRecoveryTrace({
      recoveryModifier: "supportive",
      confidence,
      sessionAssessment,
      trendAssessment,
      threshold: "supportive_all_conditions_met",
    });

    return {
      recoveryModifier: "supportive",
      confidence,
      signalStrength: deriveSignalStrength(confidence),
      reason:
        "Recent training behavior looks supportive of progression, but this remains a behavioral signal and cannot confirm underlying recovery physiology.",
      trace,
    };
  }

  const isNullData =
    sessionAssessment.completionRate === null || workoutAnalysis.hasActiveProgram === false;
  const confidence = isNullData ? 0 : 0.4;
  const trace = buildRecoveryTrace({
    recoveryModifier: "neutral",
    confidence,
    sessionAssessment,
    trendAssessment,
    threshold: isNullData ? "neutral_insufficient_behavioral_context" : "neutral_no_behavioral_trigger",
  });

  return {
    recoveryModifier: "neutral",
    confidence,
    signalStrength: deriveSignalStrength(confidence),
    reason: isNullData
      ? "Behavioral recovery context is limited, so no recovery modifier was applied."
      : "Recent training behavior is unremarkable, so no additional recovery modifier was applied.",
    trace,
  };
}

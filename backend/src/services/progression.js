import prisma from "../lib/prisma.js";

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
  // Upper body compound and all isolation exercises use the conservative increment.
  return 1.25;
}

function getMaxLoggedWeight(setLogs) {
  const weights = setLogs.map((s) => s.weightKg).filter((w) => w !== null && w !== undefined);
  if (weights.length === 0) return null;
  return Math.max(...weights);
}

/**
 * Evaluate one exercise's performance within a completed session against its
 * prescribed top-of-range target, and produce a single deterministic
 * recommendation row (not yet persisted).
 */
function evaluateExercise({ exercise, prescription, setLogs, isBeginner, previousFailureStreak }) {
  if (!prescription) {
    return {
      recommendationType: "maintain",
      previousWeightKg: getMaxLoggedWeight(setLogs),
      recommendedWeightKg: getMaxLoggedWeight(setLogs),
      previousTargetLow: null,
      previousTargetHigh: null,
      recommendedTargetLow: null,
      recommendedTargetHigh: null,
      consecutiveFailures: previousFailureStreak,
      reason: "No program prescription found for this exercise; cannot evaluate progression.",
    };
  }

  if (!setLogs || setLogs.length === 0) {
    return {
      recommendationType: "maintain",
      previousWeightKg: null,
      recommendedWeightKg: null,
      previousTargetLow: prescription.repRangeLow,
      previousTargetHigh: prescription.repRangeHigh,
      recommendedTargetLow: prescription.repRangeLow,
      recommendedTargetHigh: prescription.repRangeHigh,
      consecutiveFailures: previousFailureStreak,
      reason: "No sets were logged for this exercise; cannot evaluate progression.",
    };
  }

  const topRange = prescription.repRangeHigh;
  const allSetsHitTop = setLogs.every((s) => s.reps >= topRange);
  const previousWeight = getMaxLoggedWeight(setLogs);
  const progressionType = exercise.progressionType || "load";

  if (allSetsHitTop) {
    // Full success.
    if (progressionType === "time") {
      const recommendedHigh = prescription.repRangeHigh + 10;
      const recommendedLow = prescription.repRangeLow + 5;
      return {
        recommendationType: "increase",
        previousWeightKg: previousWeight,
        recommendedWeightKg: previousWeight,
        previousTargetLow: prescription.repRangeLow,
        previousTargetHigh: prescription.repRangeHigh,
        recommendedTargetLow: recommendedLow,
        recommendedTargetHigh: recommendedHigh,
        consecutiveFailures: 0,
        reason: "All sets reached the top of the time range; duration increased.",
      };
    }

    if (progressionType === "reps_then_load" && previousWeight !== null) {
      // Once reps are maxed at this weight, the next step is a load increase
      // and resetting reps back to the bottom of the range.
      const increment = getWeightIncrement(exercise, isBeginner);
      return {
        recommendationType: "increase",
        previousWeightKg: previousWeight,
        recommendedWeightKg: roundToQuarter(previousWeight + increment),
        previousTargetLow: prescription.repRangeLow,
        previousTargetHigh: prescription.repRangeHigh,
        recommendedTargetLow: prescription.repRangeLow,
        recommendedTargetHigh: prescription.repRangeHigh,
        consecutiveFailures: 0,
        reason: "All sets reached top reps at this weight; weight increased and reps reset.",
      };
    }

    // Default: load-based progression.
    const increment = getWeightIncrement(exercise, isBeginner);
    const recommendedWeight = previousWeight !== null ? roundToQuarter(previousWeight + increment) : null;
    return {
      recommendationType: "increase",
      previousWeightKg: previousWeight,
      recommendedWeightKg: recommendedWeight,
      previousTargetLow: prescription.repRangeLow,
      previousTargetHigh: prescription.repRangeHigh,
      recommendedTargetLow: prescription.repRangeLow,
      recommendedTargetHigh: prescription.repRangeHigh,
      consecutiveFailures: 0,
      reason: "All sets reached the top of the prescribed rep range; weight increased.",
    };
  }

  // Not full success: maintain or deload depending on failure streak.
  const newFailureStreak = previousFailureStreak + 1;

  if (newFailureStreak >= 2) {
    const deloadWeight = previousWeight !== null ? roundToQuarter(previousWeight * 0.9) : null;
    return {
      recommendationType: "deload",
      previousWeightKg: previousWeight,
      recommendedWeightKg: deloadWeight,
      previousTargetLow: prescription.repRangeLow,
      previousTargetHigh: prescription.repRangeHigh,
      recommendedTargetLow: prescription.repRangeLow,
      recommendedTargetHigh: prescription.repRangeHigh,
      consecutiveFailures: newFailureStreak,
      reason: "Two consecutive sessions failed to reach the top of the rep range; weight reduced.",
    };
  }

  return {
    recommendationType: "maintain",
    previousWeightKg: previousWeight,
    recommendedWeightKg: previousWeight,
    previousTargetLow: prescription.repRangeLow,
    previousTargetHigh: prescription.repRangeHigh,
    recommendedTargetLow: prescription.repRangeLow,
    recommendedTargetHigh: prescription.repRangeHigh,
    consecutiveFailures: newFailureStreak,
    reason: "At least one set did not reach the top of the rep range; weight maintained for another attempt.",
  };
}

export async function evaluateSessionProgression(sessionId, userId) {
  const session = await prisma.workoutSession.findUnique({
    where: { id: sessionId },
    include: {
      setLogs: {
        include: { exercise: true },
      },
    },
  });

  if (!session || session.userId !== userId) {
    return { recommendations: [], warning: "Session not found for this user; no progression evaluated." };
  }

  if (!session.programDayId) {
    return { recommendations: [], warning: "Session has no associated program day; no progression evaluated." };
  }

  const userProfile = await prisma.userProfile.findUnique({ where: { userId } });
  const isBeginner = userProfile?.trainingLevel === "beginner";

  const prescriptions = await prisma.programDayExercise.findMany({
    where: { programDayId: session.programDayId },
    include: { exercise: true },
  });

  const setLogsByExercise = {};
  for (const log of session.setLogs) {
    if (!setLogsByExercise[log.exerciseId]) setLogsByExercise[log.exerciseId] = [];
    setLogsByExercise[log.exerciseId].push(log);
  }

  const recommendations = [];

  for (const prescription of prescriptions) {
    const exerciseId = prescription.exerciseId;
    const exercise = prescription.exercise;
    const setLogs = setLogsByExercise[exerciseId] || [];

    const previousRecommendation = await prisma.progressionRecommendation.findFirst({
      where: { userId, exerciseId },
      orderBy: { createdAt: "desc" },
    });
    const previousFailureStreak =
      previousRecommendation && previousRecommendation.recommendationType === "maintain"
        ? previousRecommendation.consecutiveFailures
        : 0;

    const evaluation = evaluateExercise({
      exercise,
      prescription,
      setLogs,
      isBeginner,
      previousFailureStreak,
    });

    const created = await prisma.progressionRecommendation.create({
      data: {
        userId,
        exerciseId,
        sourceSessionId: sessionId,
        recommendationType: evaluation.recommendationType,
        previousWeightKg: evaluation.previousWeightKg,
        recommendedWeightKg: evaluation.recommendedWeightKg,
        previousTargetLow: evaluation.previousTargetLow,
        previousTargetHigh: evaluation.previousTargetHigh,
        recommendedTargetLow: evaluation.recommendedTargetLow,
        recommendedTargetHigh: evaluation.recommendedTargetHigh,
        progressionType: exercise.progressionType,
        consecutiveFailures: evaluation.consecutiveFailures,
        reason: evaluation.reason,
      },
      include: { exercise: true },
    });

    recommendations.push(created);
  }

  return { recommendations, warning: null };
}

export const GENERATOR_VERSION = "1.0";

const VALID_GOALS = new Set(["hypertrophy", "strength", "fat_loss", "recomposition"]);
const VALID_TRAINING_LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const VALID_RECOVERY_QUALITIES = new Set(["low", "medium", "high"]);
const VALID_SLOT_TYPES = new Set(["primary", "accessory"]);
const VALID_EXERCISE_COMPLEXITIES = new Set(["compound", "isolation"]);

const BASE_RULES = {
  strength: {
    primary: { setsLow: 3, setsHigh: 5, repRangeLow: 3, repRangeHigh: 6, restLow: 120, restHigh: 180 },
    accessory: { setsLow: 2, setsHigh: 4, repRangeLow: 6, repRangeHigh: 12, restLow: 60, restHigh: 120 },
  },
  hypertrophy: {
    primary: { setsLow: 3, setsHigh: 4, repRangeLow: 6, repRangeHigh: 12, restLow: 90, restHigh: 120 },
    accessory: { setsLow: 2, setsHigh: 4, repRangeLow: 8, repRangeHigh: 15, restLow: 45, restHigh: 90 },
  },
  fat_loss: {
    primary: { setsLow: 2, setsHigh: 4, repRangeLow: 8, repRangeHigh: 12, restLow: 60, restHigh: 90 },
    accessory: { setsLow: 2, setsHigh: 3, repRangeLow: 10, repRangeHigh: 15, restLow: 45, restHigh: 75 },
  },
  recomposition: {
    primary: { setsLow: 3, setsHigh: 4, repRangeLow: 5, repRangeHigh: 10, restLow: 90, restHigh: 120 },
    accessory: { setsLow: 2, setsHigh: 4, repRangeLow: 8, repRangeHigh: 15, restLow: 45, restHigh: 90 },
  },
};

function validateInputs({ goal, trainingLevel, recoveryQuality, sessionDurationMin, slotType, exerciseComplexity }) {
  if (!VALID_GOALS.has(goal)) {
    throw new Error(`Invalid goal: ${goal}. Expected one of ${Array.from(VALID_GOALS).join(", ")}.`);
  }

  if (!VALID_TRAINING_LEVELS.has(trainingLevel)) {
    throw new Error(
      `Invalid trainingLevel: ${trainingLevel}. Expected one of ${Array.from(VALID_TRAINING_LEVELS).join(", ")}.`
    );
  }

  if (!VALID_RECOVERY_QUALITIES.has(recoveryQuality)) {
    throw new Error(
      `Invalid recoveryQuality: ${recoveryQuality}. Expected one of ${Array.from(VALID_RECOVERY_QUALITIES).join(", ")}.`
    );
  }

  if (!VALID_SLOT_TYPES.has(slotType)) {
    throw new Error(`Invalid slotType: ${slotType}. Expected one of ${Array.from(VALID_SLOT_TYPES).join(", ")}.`);
  }

  if (!VALID_EXERCISE_COMPLEXITIES.has(exerciseComplexity)) {
    throw new Error(
      `Invalid exerciseComplexity: ${exerciseComplexity}. Expected one of ${Array.from(
        VALID_EXERCISE_COMPLEXITIES
      ).join(", ")}.`
    );
  }

  if (typeof sessionDurationMin !== "number" || Number.isNaN(sessionDurationMin)) {
    throw new Error(`Invalid sessionDurationMin: ${sessionDurationMin}. Expected a numeric duration tier.`);
  }

  const validDurationTier =
    sessionDurationMin === 30 ||
    sessionDurationMin === 45 ||
    sessionDurationMin === 60 ||
    sessionDurationMin >= 75;

  if (!validDurationTier) {
    throw new Error(
      `Invalid sessionDurationMin: ${sessionDurationMin}. Expected 30, 45, 60, or any value >= 75.`
    );
  }
}

function normalizeSessionDurationTier(sessionDurationMin) {
  if (sessionDurationMin >= 75) return 75;
  return sessionDurationMin;
}

function roundToNearest15Seconds(value) {
  return Math.round(value / 15) * 15;
}

function buildReason({
  goal,
  slotType,
  exerciseComplexity,
  trainingLevel,
  recoveryQuality,
  durationTier,
  sets,
  repRangeLow,
  repRangeHigh,
  restSeconds,
  adjustmentsApplied,
}) {
  const adjustmentsText = adjustmentsApplied.length > 0 ? adjustmentsApplied.join(", ") : "none";
  const durationLabel = durationTier >= 75 ? "75+ minute tier" : `${durationTier} minute tier`;
  return `${goal} ${slotType} ${exerciseComplexity} prescription for ${trainingLevel} trainee with ${recoveryQuality} recovery at ${durationLabel}: ${sets} sets, ${repRangeLow}-${repRangeHigh} reps, ${restSeconds} sec rest. Adjustments applied: ${adjustmentsText}.`;
}

export function resolvePrescription({
  goal,
  trainingLevel,
  recoveryQuality,
  sessionDurationMin,
  slotType,
  exerciseComplexity,
}) {
  validateInputs({
    goal,
    trainingLevel,
    recoveryQuality,
    sessionDurationMin,
    slotType,
    exerciseComplexity,
  });

  const durationTier = normalizeSessionDurationTier(sessionDurationMin);
  const baseRule = BASE_RULES[goal][slotType];
  const adjustmentsApplied = [];

  let sets;
  if (trainingLevel === "beginner") {
    sets = baseRule.setsLow;
    adjustmentsApplied.push("beginner_low_end");
  } else if (trainingLevel === "intermediate") {
    sets = Math.round((baseRule.setsLow + baseRule.setsHigh) / 2);
    adjustmentsApplied.push("intermediate_midpoint");
  } else {
    sets = baseRule.setsHigh;
    adjustmentsApplied.push("advanced_provisional_high_end");
  }

  if (recoveryQuality === "low") {
    const reducedSets = Math.floor(sets * 0.75);
    sets = reducedSets;
    adjustmentsApplied.push("low_recovery_reduced_sets");
  } else if (recoveryQuality === "high") {
    if (trainingLevel === "advanced") {
      adjustmentsApplied.push("high_recovery_confirms_high_end");
    } else if (trainingLevel === "intermediate" && durationTier >= 75) {
      sets = baseRule.setsHigh;
      adjustmentsApplied.push("high_recovery_upper_range_unlock");
    }
  }

  if (durationTier === 30 && sets > 3) {
    sets = 3;
    adjustmentsApplied.push("30min_conservative_sets");
  } else if (durationTier === 45 && sets > 4) {
    sets = 4;
    adjustmentsApplied.push("45min_cap_4_sets");
  } else if (durationTier >= 75) {
    adjustmentsApplied.push("75plus_duration_tier");
  }

  if (sets < 2) {
    sets = 2;
    adjustmentsApplied.push("final_floor_2_sets");
  }

  if (sets > baseRule.setsHigh) {
    sets = baseRule.setsHigh;
  }

  const baseRestMidpoint = (baseRule.restLow + baseRule.restHigh) / 2;
  let restSeconds = roundToNearest15Seconds(baseRestMidpoint);

  if (recoveryQuality === "low") {
    restSeconds += 15;
    adjustmentsApplied.push("low_recovery_plus_15s_rest");
  }

  const reason = buildReason({
    goal,
    slotType,
    exerciseComplexity,
    trainingLevel,
    recoveryQuality,
    durationTier,
    sets,
    repRangeLow: baseRule.repRangeLow,
    repRangeHigh: baseRule.repRangeHigh,
    restSeconds,
    adjustmentsApplied,
  });

  return {
    sets,
    repRangeLow: baseRule.repRangeLow,
    repRangeHigh: baseRule.repRangeHigh,
    restSeconds,
    reason,
    adjustmentsApplied,
    generatorVersion: GENERATOR_VERSION,
  };
}

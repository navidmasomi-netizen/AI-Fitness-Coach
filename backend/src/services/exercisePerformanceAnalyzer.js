function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function roundToTwo(value) {
  return Math.round(value * 100) / 100;
}

function roundToFour(value) {
  return Math.round(value * 10000) / 10000;
}

function validateIdentity(exerciseId, sourceSessionId) {
  if (!isPositiveInteger(exerciseId)) {
    throw new TypeError("exerciseId must be a positive integer");
  }

  if (!isPositiveInteger(sourceSessionId)) {
    throw new TypeError("sourceSessionId must be a positive integer");
  }
}

function validatePrescription(prescription) {
  if (!prescription || typeof prescription !== "object") {
    throw new TypeError("prescription is required");
  }

  const {
    prescribedSets,
    prescribedRepLow,
    prescribedRepHigh,
    prescribedRestSeconds = null,
  } = prescription;

  if (!isNonNegativeInteger(prescribedSets)) {
    throw new TypeError("prescribedSets must be a non-negative integer");
  }

  if (prescribedRepLow !== null && prescribedRepLow !== undefined && !isPositiveInteger(prescribedRepLow)) {
    throw new TypeError("prescribedRepLow must be a positive integer or null");
  }

  if (prescribedRepHigh !== null && prescribedRepHigh !== undefined && !isPositiveInteger(prescribedRepHigh)) {
    throw new TypeError("prescribedRepHigh must be a positive integer or null");
  }

  if (
    prescribedRepLow !== null &&
    prescribedRepLow !== undefined &&
    prescribedRepHigh !== null &&
    prescribedRepHigh !== undefined &&
    prescribedRepLow > prescribedRepHigh
  ) {
    throw new RangeError("prescribedRepLow cannot be greater than prescribedRepHigh");
  }

  if (
    prescribedRestSeconds !== null &&
    prescribedRestSeconds !== undefined &&
    !isNonNegativeInteger(prescribedRestSeconds)
  ) {
    throw new TypeError("prescribedRestSeconds must be a non-negative integer or null");
  }

  return {
    prescribedSets,
    prescribedRepLow: prescribedRepLow ?? null,
    prescribedRepHigh: prescribedRepHigh ?? null,
    prescribedRestSeconds: prescribedRestSeconds ?? null,
  };
}

function validateSet(set, label) {
  if (!set || typeof set !== "object") {
    throw new TypeError(`${label} must be an object`);
  }

  if (!isPositiveInteger(set.setNumber)) {
    throw new TypeError(`${label}.setNumber must be a positive integer`);
  }

  if (!isPositiveInteger(set.reps)) {
    throw new TypeError(`${label}.reps must be a positive integer`);
  }

  if (set.weightKg !== null && set.weightKg !== undefined && !isNonNegativeNumber(set.weightKg)) {
    throw new TypeError(`${label}.weightKg must be a non-negative number or null`);
  }

  return {
    setNumber: set.setNumber,
    reps: set.reps,
    weightKg: set.weightKg ?? null,
  };
}

function normalizeSession(session, indexLabel) {
  if (!session || typeof session !== "object") {
    throw new TypeError(`${indexLabel} session is required`);
  }

  if (!Array.isArray(session.sets)) {
    throw new TypeError(`${indexLabel}.sets must be an array`);
  }

  return {
    sourceSessionId:
      session.sourceSessionId === undefined || session.sourceSessionId === null
        ? null
        : session.sourceSessionId,
    sets: session.sets.map((set, setIndex) => validateSet(set, `${indexLabel}.sets[${setIndex}]`)),
  };
}

function compareBestSets(left, right) {
  const leftWeight = left.weightKg === null ? -1 : left.weightKg;
  const rightWeight = right.weightKg === null ? -1 : right.weightKg;

  if (leftWeight !== rightWeight) {
    return rightWeight - leftWeight;
  }

  if (left.reps !== right.reps) {
    return right.reps - left.reps;
  }

  return left.setNumber - right.setNumber;
}

function buildSetSnapshot(set) {
  return {
    setNumber: set.setNumber,
    reps: set.reps,
    weightKg: set.weightKg,
  };
}

function computeRate(numerator, denominator) {
  if (!Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }

  return roundToFour(numerator / denominator);
}

function deriveSessionFacts(session, prescription) {
  const orderedSets = session.sets
    .map((set, index) => ({ ...set, __index: index }))
    .sort((left, right) => left.setNumber - right.setNumber || left.__index - right.__index);

  const weightedSets = orderedSets.filter((set) => set.weightKg !== null);
  const successfulSetCount =
    prescription.prescribedRepLow === null
      ? orderedSets.length
      : orderedSets.filter((set) => set.reps >= prescription.prescribedRepLow).length;
  const failedSetCount =
    prescription.prescribedRepLow === null ? 0 : orderedSets.length - successfulSetCount;
  const totalReps = orderedSets.reduce((sum, set) => sum + set.reps, 0);
  const totalVolumeKg = roundToTwo(
    orderedSets.reduce((sum, set) => sum + (set.weightKg === null ? 0 : set.weightKg * set.reps), 0)
  );
  const averageWeightKg =
    weightedSets.length === 0
      ? null
      : roundToFour(
          weightedSets.reduce((sum, set) => sum + set.weightKg, 0) / weightedSets.length
        );
  const maximumWeightKg =
    weightedSets.length === 0 ? null : Math.max(...weightedSets.map((set) => set.weightKg));
  const minimumWeightKg =
    weightedSets.length === 0 ? null : Math.min(...weightedSets.map((set) => set.weightKg));
  const bestSet =
    orderedSets.length === 0
      ? null
      : buildSetSnapshot(orderedSets.slice().sort(compareBestSets)[0]);
  const finalSet =
    orderedSets.length === 0 ? null : buildSetSnapshot(orderedSets[orderedSets.length - 1]);
  const loggedSetCount = orderedSets.length;
  const completedSetCount = loggedSetCount;
  const prescribedSetCompletionRate = computeRate(
    Math.min(loggedSetCount, prescription.prescribedSets),
    prescription.prescribedSets
  );
  const targetRepHitRate = computeRate(successfulSetCount, loggedSetCount);
  const sessionSuccessful =
    prescription.prescribedRepLow === null || prescription.prescribedSets === 0
      ? false
      : prescribedSetCompletionRate === 1 && targetRepHitRate === 1;
  const sessionFailed =
    prescription.prescribedRepLow === null || prescription.prescribedSets === 0
      ? false
      : loggedSetCount > 0 && !sessionSuccessful;

  const dataQualityFlags = [];
  if (loggedSetCount === 0) dataQualityFlags.push("no_logged_sets");
  if (prescription.prescribedSets === 0) dataQualityFlags.push("zero_prescribed_sets");
  if (prescription.prescribedRepLow === null) dataQualityFlags.push("missing_prescribed_rep_low");
  if (prescription.prescribedRepHigh === null) dataQualityFlags.push("missing_prescribed_rep_high");
  if (orderedSets.some((set) => set.weightKg === null)) dataQualityFlags.push("missing_weight_data");

  return {
    loggedSetCount,
    completedSetCount,
    successfulSetCount,
    failedSetCount,
    totalReps,
    totalVolumeKg,
    averageWeightKg,
    maximumWeightKg,
    minimumWeightKg,
    bestSet,
    finalSet,
    prescribedSetCompletionRate,
    targetRepHitRate,
    sessionSuccessful,
    sessionFailed,
    dataQualityFlags,
  };
}

function buildHistoryFacts(currentFacts, previousSessions, prescription) {
  if (previousSessions.length === 0) {
    return {
      previousSessionWeightKg: null,
      weightDeltaKg: null,
      weightDeltaPercent: null,
      previousPrescribedSetCompletionRate: null,
      prescribedSetCompletionRateDelta: null,
      consecutiveSuccessfulSessions: currentFacts.sessionSuccessful ? 1 : 0,
      consecutiveFailedSessions: currentFacts.sessionFailed ? 1 : 0,
    };
  }

  const derivedHistory = previousSessions.map((session) => deriveSessionFacts(session, prescription));
  const previousFacts = derivedHistory[0];
  const previousSessionWeightKg = previousFacts.bestSet?.weightKg ?? null;
  const currentWeightKg = currentFacts.bestSet?.weightKg ?? null;
  const weightDeltaKg =
    currentWeightKg === null || previousSessionWeightKg === null
      ? null
      : roundToFour(currentWeightKg - previousSessionWeightKg);
  const weightDeltaPercent =
    weightDeltaKg === null || previousSessionWeightKg === 0
      ? null
      : roundToFour((weightDeltaKg / previousSessionWeightKg) * 100);
  const previousPrescribedSetCompletionRate = previousFacts.prescribedSetCompletionRate;
  const prescribedSetCompletionRateDelta =
    currentFacts.prescribedSetCompletionRate === null ||
    previousPrescribedSetCompletionRate === null
      ? null
      : roundToFour(
          currentFacts.prescribedSetCompletionRate - previousPrescribedSetCompletionRate
        );

  let consecutiveSuccessfulSessions = 0;
  let consecutiveFailedSessions = 0;
  for (const sessionFacts of [currentFacts, ...derivedHistory]) {
    if (sessionFacts.sessionSuccessful) {
      consecutiveSuccessfulSessions += 1;
    } else {
      break;
    }
  }

  for (const sessionFacts of [currentFacts, ...derivedHistory]) {
    if (sessionFacts.sessionFailed) {
      consecutiveFailedSessions += 1;
    } else {
      break;
    }
  }

  return {
    previousSessionWeightKg,
    weightDeltaKg,
    weightDeltaPercent,
    previousPrescribedSetCompletionRate,
    prescribedSetCompletionRateDelta,
    consecutiveSuccessfulSessions,
    consecutiveFailedSessions,
  };
}

export function analyzeExercisePerformance(input) {
  if (!input || typeof input !== "object") {
    throw new TypeError("input is required");
  }

  const { exerciseId, sourceSessionId } = input;
  validateIdentity(exerciseId, sourceSessionId);

  const prescription = validatePrescription(input.prescription);
  const currentSession = normalizeSession(input.currentSession, "currentSession");
  const previousSessions = Array.isArray(input.previousSessions)
    ? input.previousSessions.map((session, index) => normalizeSession(session, `previousSessions[${index}]`))
    : [];

  const currentFacts = deriveSessionFacts(currentSession, prescription);
  const historyFacts = buildHistoryFacts(currentFacts, previousSessions, prescription);
  const dataQualityFlags = [
    ...currentFacts.dataQualityFlags,
    ...(previousSessions.length === 0 ? ["missing_previous_history"] : []),
  ];

  return {
    exerciseId,
    sourceSessionId,
    prescription,
    observedPerformance: {
      loggedSetCount: currentFacts.loggedSetCount,
      completedSetCount: currentFacts.completedSetCount,
      successfulSetCount: currentFacts.successfulSetCount,
      failedSetCount: currentFacts.failedSetCount,
      totalReps: currentFacts.totalReps,
      totalVolumeKg: currentFacts.totalVolumeKg,
      averageWeightKg: currentFacts.averageWeightKg,
      maximumWeightKg: currentFacts.maximumWeightKg,
      minimumWeightKg: currentFacts.minimumWeightKg,
      bestSet: currentFacts.bestSet,
      finalSet: currentFacts.finalSet,
      prescribedSetCompletionRate: currentFacts.prescribedSetCompletionRate,
      targetRepHitRate: currentFacts.targetRepHitRate,
    },
    historyFacts,
    hasSufficientData:
      currentFacts.loggedSetCount > 0 &&
      prescription.prescribedSets > 0 &&
      prescription.prescribedRepLow !== null,
    dataQualityFlags,
  };
}

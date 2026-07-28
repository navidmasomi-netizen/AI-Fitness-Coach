const UNKNOWN_TREND = "UNKNOWN";
const INCREASING_TREND = "INCREASING";
const DECREASING_TREND = "DECREASING";
const STABLE_TREND = "STABLE";

export class HistoricalTrainingSignalsError extends Error {
  constructor(message) {
    super(message);
    this.name = "HistoricalTrainingSignalsError";
  }
}

function createNeutralSignals() {
  return Object.freeze({
    completedExposureCount: 0,
    averageCompletionRatio: null,
    averageCompletedSets: null,
    latestCompletedAt: null,
    previousCompletedAt: null,
    loadTrend: UNKNOWN_TREND,
    repTrend: UNKNOWN_TREND,
  });
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function toTimestamp(value) {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  return null;
}

function toIsoString(value) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }

  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? value : null;
  }

  return null;
}

function compareExposureOrderDesc(left, right) {
  const leftCompletedAt = toTimestamp(left?.completedAt) ?? Number.NEGATIVE_INFINITY;
  const rightCompletedAt = toTimestamp(right?.completedAt) ?? Number.NEGATIVE_INFINITY;
  if (leftCompletedAt !== rightCompletedAt) {
    return rightCompletedAt - leftCompletedAt;
  }

  const leftStartedAt = toTimestamp(left?.startedAt) ?? Number.NEGATIVE_INFINITY;
  const rightStartedAt = toTimestamp(right?.startedAt) ?? Number.NEGATIVE_INFINITY;
  if (leftStartedAt !== rightStartedAt) {
    return rightStartedAt - leftStartedAt;
  }

  return (right?.id ?? Number.NEGATIVE_INFINITY) - (left?.id ?? Number.NEGATIVE_INFINITY);
}

function compareBestWeightedSet(left, right) {
  if (left.weightKg !== right.weightKg) {
    return right.weightKg - left.weightKg;
  }

  if (left.reps !== right.reps) {
    return right.reps - left.reps;
  }

  if (left.setNumber !== right.setNumber) {
    return left.setNumber - right.setNumber;
  }

  return left.originalIndex - right.originalIndex;
}

function compareBestRepSet(left, right) {
  if (left.reps !== right.reps) {
    return right.reps - left.reps;
  }

  if (left.setNumber !== right.setNumber) {
    return left.setNumber - right.setNumber;
  }

  return left.originalIndex - right.originalIndex;
}

function deriveTrend(latestValue, previousValue) {
  if (!isFiniteNumber(latestValue) || !isFiniteNumber(previousValue)) {
    return UNKNOWN_TREND;
  }

  if (latestValue === previousValue) {
    return STABLE_TREND;
  }

  return latestValue > previousValue ? INCREASING_TREND : DECREASING_TREND;
}

function normalizeTarget(exposure) {
  if (!Array.isArray(exposure.exerciseTargets) || exposure.exerciseTargets.length !== 1) {
    return null;
  }

  const [target] = exposure.exerciseTargets;
  if (!target || !isPositiveInteger(target.programDayExerciseId) || !isPositiveInteger(target.exerciseId)) {
    return null;
  }

  return target;
}

function normalizeValidSetLogs(exposure, target) {
  if (!Array.isArray(exposure.setLogs)) {
    return [];
  }

  const validSetLogs = [];
  for (let index = 0; index < exposure.setLogs.length; index += 1) {
    const setLog = exposure.setLogs[index];
    if (!setLog || setLog.exerciseId !== target.exerciseId) {
      continue;
    }

    if (!isPositiveInteger(setLog.setNumber) || !isPositiveInteger(setLog.reps)) {
      continue;
    }

    if (setLog.weightKg !== null && setLog.weightKg !== undefined && !isFiniteNumber(setLog.weightKg)) {
      continue;
    }

    validSetLogs.push({
      setNumber: setLog.setNumber,
      reps: setLog.reps,
      weightKg:
        setLog.weightKg === null || setLog.weightKg === undefined ? null : setLog.weightKg,
      originalIndex: index,
    });
  }

  return validSetLogs;
}

function normalizeExposure(exposure) {
  const completedTimestamp = toTimestamp(exposure?.completedAt);
  const startedTimestamp = toTimestamp(exposure?.startedAt);
  if (!isPositiveInteger(exposure?.id) || completedTimestamp === null || startedTimestamp === null) {
    return null;
  }

  const target = normalizeTarget(exposure);
  if (!target) {
    return null;
  }

  const validSetLogs = normalizeValidSetLogs(exposure, target);
  if (validSetLogs.length === 0) {
    return null;
  }

  return {
    id: exposure.id,
    completedAtIso: toIsoString(exposure.completedAt),
    completedAtTimestamp: completedTimestamp,
    startedAtTimestamp: startedTimestamp,
    targetSets: target.targetSets,
    progressionType: target.progressionType,
    validSetLogs,
  };
}

function selectBestWeightedSet(validSetLogs) {
  const weightedSets = validSetLogs.filter((setLog) => isFiniteNumber(setLog.weightKg));
  if (weightedSets.length === 0) {
    return null;
  }

  return [...weightedSets].sort(compareBestWeightedSet)[0];
}

function selectBestRepSet(validSetLogs) {
  if (validSetLogs.length === 0) {
    return null;
  }

  return [...validSetLogs].sort(compareBestRepSet)[0];
}

function deriveLoadFact(exposure) {
  if (!exposure) {
    return null;
  }

  if (exposure.progressionType === "time") {
    return null;
  }

  const bestWeightedSet = selectBestWeightedSet(exposure.validSetLogs);
  return bestWeightedSet?.weightKg ?? null;
}

function deriveRepFact(exposure) {
  if (!exposure) {
    return null;
  }

  if (exposure.progressionType === "time") {
    return null;
  }

  const bestWeightedSet = selectBestWeightedSet(exposure.validSetLogs);
  if (bestWeightedSet) {
    return bestWeightedSet.reps;
  }

  const bestRepSet = selectBestRepSet(exposure.validSetLogs);
  return bestRepSet?.reps ?? null;
}

function deriveCompletionRatio(exposure) {
  if (!isPositiveInteger(exposure.targetSets)) {
    return null;
  }

  return Math.min(exposure.validSetLogs.length, exposure.targetSets) / exposure.targetSets;
}

function deriveAverage(values) {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export function deriveHistoricalTrainingSignals(exposures) {
  if (!Array.isArray(exposures)) {
    throw new TypeError("Historical exposures must be provided as an array.");
  }

  const sortedExposures = [...exposures].sort(compareExposureOrderDesc);
  const seenSessionIds = new Set();
  const normalizedExposures = [];

  for (const exposure of sortedExposures) {
    if (!isPositiveInteger(exposure?.id)) {
      continue;
    }

    if (seenSessionIds.has(exposure.id)) {
      throw new HistoricalTrainingSignalsError(
        `Duplicate historical exposure session id: ${exposure.id}`
      );
    }
    seenSessionIds.add(exposure.id);

    const normalizedExposure = normalizeExposure(exposure);
    if (normalizedExposure) {
      normalizedExposures.push(normalizedExposure);
    }
  }

  if (normalizedExposures.length === 0) {
    return createNeutralSignals();
  }

  const completionRatios = normalizedExposures
    .map(deriveCompletionRatio)
    .filter((value) => isFiniteNumber(value));
  const completedSetCounts = normalizedExposures.map(
    (exposure) => exposure.validSetLogs.length
  );

  const latestExposure = normalizedExposures[0];
  const previousExposure = normalizedExposures[1] ?? null;

  const signals = {
    completedExposureCount: normalizedExposures.length,
    averageCompletionRatio: deriveAverage(completionRatios),
    averageCompletedSets: deriveAverage(completedSetCounts),
    latestCompletedAt: latestExposure.completedAtIso,
    previousCompletedAt: previousExposure?.completedAtIso ?? null,
    loadTrend: deriveTrend(deriveLoadFact(latestExposure), deriveLoadFact(previousExposure)),
    repTrend: deriveTrend(deriveRepFact(latestExposure), deriveRepFact(previousExposure)),
  };

  return Object.freeze(signals);
}

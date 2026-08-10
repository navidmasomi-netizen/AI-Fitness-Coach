import { readFileSync } from "node:fs";
import {
  compareExercisesV1,
  DEFAULT_EXERCISE_SIMILARITY_POLICY_V1,
  SIMILARITY_DIMENSIONS,
  SIMILARITY_REASON_CODES,
  SIMILARITY_RESULT_STATUSES,
} from "./index.js";
import {
  EXERCISE_SIMILARITY_CALIBRATION_FIXTURES_BY_NAME,
  resolveExerciseSimilarityCalibrationFixture,
} from "./calibrationFixtures.js";

export const EXERCISE_SIMILARITY_GOLD_STANDARD_V1_URL = new URL(
  "../../../data/similarity/gold-standard-v1.json",
  import.meta.url
);

export const SIMILARITY_VALIDATION_CATEGORIES = Object.freeze({
  VERY_HIGH: "VERY_HIGH",
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
  VERY_LOW: "VERY_LOW",
  UNAVAILABLE: "UNAVAILABLE",
});

export const SIMILARITY_GOLD_STANDARD_CONFIDENCE = Object.freeze({
  HIGH: "HIGH",
  MEDIUM: "MEDIUM",
  LOW: "LOW",
});

export const SIMILARITY_GOLD_STANDARD_SOURCES = Object.freeze({
  CATALOG: "CATALOG",
  SYNTHETIC: "SYNTHETIC",
  MIXED: "MIXED",
});

export const SIMILARITY_CALIBRATION_FILTER_MODES = Object.freeze({
  ALL: "ALL",
  ACTIVE_ONLY: "ACTIVE_ONLY",
  HIGH_CONFIDENCE_ONLY: "HIGH_CONFIDENCE_ONLY",
});

export const ORDERED_SIMILARITY_VALIDATION_CATEGORIES = Object.freeze([
  SIMILARITY_VALIDATION_CATEGORIES.VERY_LOW,
  SIMILARITY_VALIDATION_CATEGORIES.LOW,
  SIMILARITY_VALIDATION_CATEGORIES.MEDIUM,
  SIMILARITY_VALIDATION_CATEGORIES.HIGH,
  SIMILARITY_VALIDATION_CATEGORIES.VERY_HIGH,
]);

export const SIMILARITY_VALIDATION_THRESHOLDS_V1 = Object.freeze({
  version: "validation-thresholds-v1",
  veryHighMinInclusive: 0.85,
  highMinInclusive: 0.7,
  mediumMinInclusive: 0.45,
  lowMinInclusive: 0.2,
});

const VALID_CATEGORY_SET = new Set(Object.values(SIMILARITY_VALIDATION_CATEGORIES));
const VALID_CONFIDENCE_SET = new Set(Object.values(SIMILARITY_GOLD_STANDARD_CONFIDENCE));
const VALID_SOURCE_SET = new Set(Object.values(SIMILARITY_GOLD_STANDARD_SOURCES));
const VALID_FILTER_MODE_SET = new Set(Object.values(SIMILARITY_CALIBRATION_FILTER_MODES));
const THRESHOLD_VALUES = [
  SIMILARITY_VALIDATION_THRESHOLDS_V1.lowMinInclusive,
  SIMILARITY_VALIDATION_THRESHOLDS_V1.mediumMinInclusive,
  SIMILARITY_VALIDATION_THRESHOLDS_V1.highMinInclusive,
  SIMILARITY_VALIDATION_THRESHOLDS_V1.veryHighMinInclusive,
];

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

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

function buildNormalizedPairKey(exerciseA, exerciseB) {
  return [exerciseA, exerciseB]
    .sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }))
    .join(" <> ");
}

function categoryRank(category) {
  if (category === SIMILARITY_VALIDATION_CATEGORIES.UNAVAILABLE) {
    return null;
  }
  return ORDERED_SIMILARITY_VALIDATION_CATEGORIES.indexOf(category);
}

function buildEmptyDistribution() {
  return {
    VERY_HIGH: 0,
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
    VERY_LOW: 0,
    UNAVAILABLE: 0,
  };
}

function buildEmptyConfidenceDistribution() {
  return {
    HIGH: 0,
    MEDIUM: 0,
    LOW: 0,
  };
}

function buildEmptySourceDistribution() {
  return {
    CATALOG: 0,
    SYNTHETIC: 0,
    MIXED: 0,
  };
}

function buildEmptyFixtureSourceDistribution() {
  return {
    catalog: 0,
    synthetic: 0,
  };
}

function buildEmptyConfusionMatrix() {
  const matrix = {};
  for (const expected of Object.values(SIMILARITY_VALIDATION_CATEGORIES)) {
    matrix[expected] = buildEmptyDistribution();
  }
  return matrix;
}

function calculateThresholdDistance(score) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null;
  }

  return Math.min(...THRESHOLD_VALUES.map((threshold) => Math.abs(score - threshold)));
}

function buildMismatchSeverity(expectedCategory, observedCategory) {
  if (expectedCategory === observedCategory) {
    return 0;
  }

  const expectedRank = categoryRank(expectedCategory);
  const observedRank = categoryRank(observedCategory);

  if (expectedRank === null || observedRank === null) {
    return 5;
  }

  return Math.abs(expectedRank - observedRank);
}

function cloneCalibrationResult(result) {
  return JSON.parse(JSON.stringify(result));
}

function validateNonEmptyString(value, message) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(message);
  }
}

function derivePairSource(fixtureA, fixtureB) {
  if (fixtureA.source === "catalog" && fixtureB.source === "catalog") {
    return SIMILARITY_GOLD_STANDARD_SOURCES.CATALOG;
  }

  if (fixtureA.source === "synthetic" && fixtureB.source === "synthetic") {
    return SIMILARITY_GOLD_STANDARD_SOURCES.SYNTHETIC;
  }

  return SIMILARITY_GOLD_STANDARD_SOURCES.MIXED;
}

function applyCalibrationDatasetFilter(pairs, filterMode) {
  if (!VALID_FILTER_MODE_SET.has(filterMode)) {
    throw new Error(`Similarity calibration filter mode "${filterMode}" is unsupported.`);
  }

  if (filterMode === SIMILARITY_CALIBRATION_FILTER_MODES.ALL) {
    return [...pairs];
  }

  if (filterMode === SIMILARITY_CALIBRATION_FILTER_MODES.ACTIVE_ONLY) {
    return pairs.filter((pair) => pair.activeForCalibration);
  }

  return pairs.filter(
    (pair) => pair.activeForCalibration && pair.confidence === SIMILARITY_GOLD_STANDARD_CONFIDENCE.HIGH
  );
}

export function loadSimilarityGoldStandardDataset(fileUrl = EXERCISE_SIMILARITY_GOLD_STANDARD_V1_URL) {
  return JSON.parse(readFileSync(fileUrl, "utf8"));
}

export function mapSimilarityResultToValidationCategory(result) {
  if (!isPlainObject(result)) {
    throw new Error("Similarity validation mapping requires a similarity result object.");
  }

  if (result.status === SIMILARITY_RESULT_STATUSES.UNAVAILABLE) {
    return SIMILARITY_VALIDATION_CATEGORIES.UNAVAILABLE;
  }

  if (result.status !== SIMILARITY_RESULT_STATUSES.AVAILABLE) {
    throw new Error(`Similarity validation mapping received unsupported status "${result.status}".`);
  }

  if (typeof result.score !== "number" || !Number.isFinite(result.score)) {
    throw new Error("Similarity validation mapping requires a finite numeric score for available results.");
  }

  if (result.score >= SIMILARITY_VALIDATION_THRESHOLDS_V1.veryHighMinInclusive) {
    return SIMILARITY_VALIDATION_CATEGORIES.VERY_HIGH;
  }

  if (result.score >= SIMILARITY_VALIDATION_THRESHOLDS_V1.highMinInclusive) {
    return SIMILARITY_VALIDATION_CATEGORIES.HIGH;
  }

  if (result.score >= SIMILARITY_VALIDATION_THRESHOLDS_V1.mediumMinInclusive) {
    return SIMILARITY_VALIDATION_CATEGORIES.MEDIUM;
  }

  if (result.score >= SIMILARITY_VALIDATION_THRESHOLDS_V1.lowMinInclusive) {
    return SIMILARITY_VALIDATION_CATEGORIES.LOW;
  }

  return SIMILARITY_VALIDATION_CATEGORIES.VERY_LOW;
}

export function validateSimilarityGoldStandardDataset(
  dataset,
  fixtureResolver = resolveExerciseSimilarityCalibrationFixture
) {
  if (!isPlainObject(dataset)) {
    throw new Error("Similarity gold standard dataset must be a plain object.");
  }

  validateNonEmptyString(dataset.version, "Similarity gold standard dataset requires a non-empty version string.");
  validateNonEmptyString(dataset.createdAt, "Similarity gold standard dataset requires a non-empty createdAt string.");
  validateNonEmptyString(dataset.updatedAt, "Similarity gold standard dataset requires a non-empty updatedAt string.");
  validateNonEmptyString(dataset.maintainer, "Similarity gold standard dataset requires a non-empty maintainer string.");

  if (!isPlainObject(dataset.categoryDefinitions)) {
    throw new Error("Similarity gold standard dataset requires categoryDefinitions.");
  }

  for (const category of Object.values(SIMILARITY_VALIDATION_CATEGORIES)) {
    validateNonEmptyString(
      dataset.categoryDefinitions[category],
      `Similarity gold standard dataset category "${category}" requires a non-empty description.`
    );
  }

  if (!Array.isArray(dataset.pairs)) {
    throw new Error("Similarity gold standard dataset pairs must be an array.");
  }

  const seenIds = new Set();
  const seenPairKeys = new Set();

  dataset.pairs.forEach((pair, index) => {
    if (!isPlainObject(pair)) {
      throw new Error(`Similarity gold standard pair at index ${index} must be a plain object.`);
    }

    validateNonEmptyString(pair.id, `Similarity gold standard pair at index ${index} requires a non-empty id string.`);
    validateNonEmptyString(
      pair.exerciseA,
      `Similarity gold standard pair "${pair.id}" requires a non-empty exerciseA string.`
    );
    validateNonEmptyString(
      pair.exerciseB,
      `Similarity gold standard pair "${pair.id}" requires a non-empty exerciseB string.`
    );

    if (!VALID_CATEGORY_SET.has(pair.expectedCategory)) {
      throw new Error(
        `Similarity gold standard pair "${pair.exerciseA}" vs "${pair.exerciseB}" has invalid expectedCategory "${pair.expectedCategory}".`
      );
    }

    if (!VALID_CONFIDENCE_SET.has(pair.confidence)) {
      throw new Error(
        `Similarity gold standard pair "${pair.exerciseA}" vs "${pair.exerciseB}" has invalid confidence "${pair.confidence}".`
      );
    }

    if (!VALID_SOURCE_SET.has(pair.source)) {
      throw new Error(
        `Similarity gold standard pair "${pair.exerciseA}" vs "${pair.exerciseB}" has invalid source "${pair.source}".`
      );
    }

    if (typeof pair.activeForCalibration !== "boolean") {
      throw new Error(
        `Similarity gold standard pair "${pair.exerciseA}" vs "${pair.exerciseB}" requires a boolean activeForCalibration flag.`
      );
    }

    validateNonEmptyString(
      pair.rationale,
      `Similarity gold standard pair "${pair.exerciseA}" vs "${pair.exerciseB}" requires a non-empty rationale string.`
    );

    if (!Array.isArray(pair.tags) || !pair.tags.every((tag) => typeof tag === "string" && tag.trim().length > 0)) {
      throw new Error(
        `Similarity gold standard pair "${pair.exerciseA}" vs "${pair.exerciseB}" requires a tags array of non-empty strings.`
      );
    }

    if (seenIds.has(pair.id)) {
      throw new Error(`Similarity gold standard dataset contains duplicate id "${pair.id}".`);
    }
    seenIds.add(pair.id);

    const pairKey = buildNormalizedPairKey(pair.exerciseA, pair.exerciseB);
    if (seenPairKeys.has(pairKey)) {
      throw new Error(`Similarity gold standard dataset contains duplicate pair "${pair.exerciseA}" vs "${pair.exerciseB}".`);
    }
    seenPairKeys.add(pairKey);

    const fixtureA = fixtureResolver(pair.exerciseA);
    const fixtureB = fixtureResolver(pair.exerciseB);
    const expectedSource = derivePairSource(fixtureA, fixtureB);
    if (pair.source !== expectedSource) {
      throw new Error(
        `Similarity gold standard pair "${pair.exerciseA}" vs "${pair.exerciseB}" has source "${pair.source}" but expected "${expectedSource}".`
      );
    }
  });

  return true;
}

export function summarizeSimilarityGoldStandardCoverage(
  dataset,
  fixtureResolver = resolveExerciseSimilarityCalibrationFixture
) {
  validateSimilarityGoldStandardDataset(dataset, fixtureResolver);

  const categoryCounts = buildEmptyDistribution();
  const confidenceCounts = buildEmptyConfidenceDistribution();
  const pairSourceCounts = buildEmptySourceDistribution();
  const fixtureSourceCounts = buildEmptyFixtureSourceDistribution();
  const movementPatterns = new Set();
  const equipmentValues = new Set();
  const fixtureNames = new Set();

  let activePairs = 0;

  for (const pair of dataset.pairs) {
    categoryCounts[pair.expectedCategory] += 1;
    confidenceCounts[pair.confidence] += 1;
    pairSourceCounts[pair.source] += 1;
    if (pair.activeForCalibration) {
      activePairs += 1;
    }

    for (const fixtureName of [pair.exerciseA, pair.exerciseB]) {
      if (fixtureNames.has(fixtureName)) {
        continue;
      }

      fixtureNames.add(fixtureName);
      const fixture = fixtureResolver(fixtureName);
      fixtureSourceCounts[fixture.source] += 1;

      if (fixture.exercise.dnaMovementPattern) {
        movementPatterns.add(fixture.exercise.dnaMovementPattern);
      }

      for (const equipment of fixture.exercise.requiredEquipment ?? []) {
        equipmentValues.add(equipment);
      }
    }
  }

  return deepFreeze({
    totalPairs: dataset.pairs.length,
    activePairs,
    inactivePairs: dataset.pairs.length - activePairs,
    uniqueFixtures: fixtureNames.size,
    sourceCounts: fixtureSourceCounts,
    pairSourceCounts,
    confidenceCounts,
    categoryCounts,
    movementPatterns: [...movementPatterns].sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" })),
    equipmentValues: [...equipmentValues].sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" })),
  });
}

export function runSimilarityCalibration({
  dataset = loadSimilarityGoldStandardDataset(),
  fixtureResolver = resolveExerciseSimilarityCalibrationFixture,
  compareExercises = compareExercisesV1,
  filterMode = SIMILARITY_CALIBRATION_FILTER_MODES.ALL,
} = {}) {
  validateSimilarityGoldStandardDataset(dataset, fixtureResolver);

  const filteredPairs = applyCalibrationDatasetFilter(dataset.pairs, filterMode);
  const filteredDataset = {
    ...dataset,
    pairs: filteredPairs,
  };
  const coverage = summarizeSimilarityGoldStandardCoverage(filteredDataset, fixtureResolver);

  const results = filteredPairs.map((pair) => {
    const fixtureA = fixtureResolver(pair.exerciseA);
    const fixtureB = fixtureResolver(pair.exerciseB);
    const comparison = compareExercises(fixtureA.exercise, fixtureB.exercise);
    const observedCategory = mapSimilarityResultToValidationCategory(comparison);
    const mismatchSeverity = buildMismatchSeverity(pair.expectedCategory, observedCategory);

    return deepFreeze({
      id: pair.id,
      pairKey: buildNormalizedPairKey(pair.exerciseA, pair.exerciseB),
      exerciseA: pair.exerciseA,
      exerciseB: pair.exerciseB,
      source: pair.source,
      sourceA: fixtureA.source,
      sourceB: fixtureB.source,
      confidence: pair.confidence,
      activeForCalibration: pair.activeForCalibration,
      expectedCategory: pair.expectedCategory,
      observedCategory,
      exactMatch: pair.expectedCategory === observedCategory,
      mismatchSeverity,
      status: comparison.status,
      score: comparison.score,
      rationale: pair.rationale,
      tags: [...pair.tags],
      policyVersion: comparison.policyVersion,
      dimensions: comparison.dimensions,
      reasons: comparison.reasons,
      thresholdDistance: calculateThresholdDistance(comparison.score),
    });
  });

  return deepFreeze({
    datasetVersion: dataset.version,
    policyVersion: DEFAULT_EXERCISE_SIMILARITY_POLICY_V1.version,
    thresholdVersion: SIMILARITY_VALIDATION_THRESHOLDS_V1.version,
    filterMode,
    totalDatasetPairs: dataset.pairs.length,
    totalPairs: results.length,
    coverage,
    results,
  });
}

export function buildSimilarityCalibrationReport(calibrationRun) {
  if (!isPlainObject(calibrationRun) || !Array.isArray(calibrationRun.results)) {
    throw new Error("Similarity calibration report requires a calibration run object.");
  }

  const expectedDistribution = buildEmptyDistribution();
  const observedDistribution = buildEmptyDistribution();
  const confidenceDistribution = buildEmptyConfidenceDistribution();
  const sourceDistribution = buildEmptySourceDistribution();
  const confusionMatrix = buildEmptyConfusionMatrix();

  for (const result of calibrationRun.results) {
    expectedDistribution[result.expectedCategory] += 1;
    observedDistribution[result.observedCategory] += 1;
    confidenceDistribution[result.confidence] += 1;
    sourceDistribution[result.source] += 1;
    confusionMatrix[result.expectedCategory][result.observedCategory] += 1;
  }

  const mismatches = calibrationRun.results.filter((result) => !result.exactMatch);
  const falseHigh = mismatches
    .filter((result) => {
      const expectedRank = categoryRank(result.expectedCategory);
      const observedRank = categoryRank(result.observedCategory);
      return expectedRank !== null && observedRank !== null && observedRank > expectedRank;
    })
    .sort((left, right) => right.mismatchSeverity - left.mismatchSeverity || (right.score ?? -1) - (left.score ?? -1));

  const falseLow = mismatches
    .filter((result) => {
      const expectedRank = categoryRank(result.expectedCategory);
      const observedRank = categoryRank(result.observedCategory);
      return expectedRank !== null && observedRank !== null && observedRank < expectedRank;
    })
    .sort((left, right) => right.mismatchSeverity - left.mismatchSeverity || (left.score ?? 2) - (right.score ?? 2));

  const largestMismatches = [...mismatches]
    .sort(
      (left, right) =>
        right.mismatchSeverity - left.mismatchSeverity ||
        ((left.thresholdDistance ?? Number.POSITIVE_INFINITY) - (right.thresholdDistance ?? Number.POSITIVE_INFINITY))
    )
    .slice(0, 10)
    .map(cloneCalibrationResult);

  const topAmbiguousCases = calibrationRun.results
    .filter((result) => result.status === SIMILARITY_RESULT_STATUSES.AVAILABLE && typeof result.thresholdDistance === "number")
    .sort((left, right) => left.thresholdDistance - right.thresholdDistance || (right.score ?? -1) - (left.score ?? -1))
    .slice(0, 10)
    .map(cloneCalibrationResult);

  const expectedHighObservedVeryLow = calibrationRun.results
    .filter(
      (result) =>
        (result.expectedCategory === SIMILARITY_VALIDATION_CATEGORIES.HIGH ||
          result.expectedCategory === SIMILARITY_VALIDATION_CATEGORIES.VERY_HIGH) &&
        result.observedCategory === SIMILARITY_VALIDATION_CATEGORIES.VERY_LOW
    )
    .map(cloneCalibrationResult);

  const expectedVeryLowObservedHigh = calibrationRun.results
    .filter(
      (result) =>
        result.expectedCategory === SIMILARITY_VALIDATION_CATEGORIES.VERY_LOW &&
        (result.observedCategory === SIMILARITY_VALIDATION_CATEGORIES.HIGH ||
          result.observedCategory === SIMILARITY_VALIDATION_CATEGORIES.VERY_HIGH)
    )
    .map(cloneCalibrationResult);

  return deepFreeze({
    datasetVersion: calibrationRun.datasetVersion,
    policyVersion: calibrationRun.policyVersion,
    thresholdVersion: calibrationRun.thresholdVersion,
    filterMode: calibrationRun.filterMode,
    totalDatasetPairs: calibrationRun.totalDatasetPairs,
    coverage: calibrationRun.coverage,
    summary: {
      totalPairs: calibrationRun.results.length,
      exactMatches: calibrationRun.results.length - mismatches.length,
      mismatches: mismatches.length,
      matchRate:
        calibrationRun.results.length === 0
          ? null
          : Number(((calibrationRun.results.length - mismatches.length) / calibrationRun.results.length).toFixed(4)),
    },
    expectedDistribution,
    observedDistribution,
    confidenceDistribution,
    sourceDistribution,
    confusionMatrix,
    falseHigh: falseHigh.slice(0, 10).map(cloneCalibrationResult),
    falseLow: falseLow.slice(0, 10).map(cloneCalibrationResult),
    largestMismatches,
    topAmbiguousCases,
    criticalOutliers: {
      expectedHighObservedVeryLow,
      expectedVeryLowObservedHigh,
    },
  });
}

export function runSimilarityCalibrationV1({
  filterMode = SIMILARITY_CALIBRATION_FILTER_MODES.ALL,
} = {}) {
  return runSimilarityCalibration({
    dataset: loadSimilarityGoldStandardDataset(),
    fixtureResolver: resolveExerciseSimilarityCalibrationFixture,
    compareExercises: compareExercisesV1,
    filterMode,
  });
}

export function buildSimilarityCalibrationReportV1({
  filterMode = SIMILARITY_CALIBRATION_FILTER_MODES.ALL,
} = {}) {
  return buildSimilarityCalibrationReport(runSimilarityCalibrationV1({ filterMode }));
}

export const EXERCISE_SIMILARITY_CALIBRATION_DIMENSIONS = deepFreeze([
  SIMILARITY_DIMENSIONS.MOVEMENT,
  SIMILARITY_DIMENSIONS.EXERCISE_CLASS,
  SIMILARITY_DIMENSIONS.MUSCLE,
  SIMILARITY_DIMENSIONS.EQUIPMENT,
  SIMILARITY_DIMENSIONS.DEMAND,
]);

export const EXERCISE_SIMILARITY_CALIBRATION_OUTLIER_REASON_CODES = deepFreeze([
  SIMILARITY_REASON_CODES.ENGINE.NO_AVAILABLE_DIMENSIONS,
]);

export const EXERCISE_SIMILARITY_CALIBRATION_FIXTURE_COUNT = Object.keys(
  EXERCISE_SIMILARITY_CALIBRATION_FIXTURES_BY_NAME
).length;

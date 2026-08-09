import { SLUG_PATTERN } from "../exerciseCatalogValidation.js";

export const EXERCISE_SIMILARITY_PROFILE_VERSION = "v1";
export const EXERCISE_SIMILARITY_POLICY_VERSION = "contract_v1";

export const SIMILARITY_DIMENSIONS = Object.freeze({
  MOVEMENT: "movement",
  MUSCLE: "muscle",
  EQUIPMENT: "equipment",
  DEMAND: "demand",
});

export const ENABLED_SIMILARITY_DIMENSIONS = Object.freeze([
  SIMILARITY_DIMENSIONS.MOVEMENT,
  SIMILARITY_DIMENSIONS.MUSCLE,
  SIMILARITY_DIMENSIONS.EQUIPMENT,
  SIMILARITY_DIMENSIONS.DEMAND,
]);

export const DEFERRED_SIMILARITY_DIMENSIONS = Object.freeze(["execution"]);

export const SIMILARITY_RESULT_STATUSES = Object.freeze({
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
});

export const SIMILARITY_REASON_CODES = Object.freeze({
  MOVEMENT: Object.freeze({
    SAME_MOVEMENT_PATTERN: "SIMILARITY_MOVEMENT_SAME_PATTERN",
    DIFFERENT_MOVEMENT_PATTERN: "SIMILARITY_MOVEMENT_DIFFERENT_PATTERN",
    MISSING_DNA_MOVEMENT_PATTERN: "SIMILARITY_MOVEMENT_MISSING_DNA_PATTERN",
  }),
  MUSCLE: Object.freeze({
    PRIMARY_MUSCLE_OVERLAP: "SIMILARITY_MUSCLE_PRIMARY_OVERLAP",
    SECONDARY_MUSCLE_OVERLAP: "SIMILARITY_MUSCLE_SECONDARY_OVERLAP",
    NO_MUSCLE_OVERLAP: "SIMILARITY_MUSCLE_NO_OVERLAP",
    MISSING_MUSCLE_METADATA: "SIMILARITY_MUSCLE_MISSING_METADATA",
  }),
  EQUIPMENT: Object.freeze({
    SAME_REQUIRED_EQUIPMENT: "SIMILARITY_EQUIPMENT_SAME_REQUIRED_EQUIPMENT",
    PARTIAL_REQUIRED_EQUIPMENT_OVERLAP: "SIMILARITY_EQUIPMENT_PARTIAL_REQUIRED_EQUIPMENT_OVERLAP",
    DIFFERENT_REQUIRED_EQUIPMENT: "SIMILARITY_EQUIPMENT_DIFFERENT_REQUIRED_EQUIPMENT",
    MISSING_REQUIRED_EQUIPMENT: "SIMILARITY_EQUIPMENT_MISSING_REQUIRED_EQUIPMENT",
  }),
  DEMAND: Object.freeze({
    SAME_STABILITY_DEMAND: "SIMILARITY_DEMAND_SAME_STABILITY_DEMAND",
    DIFFERENT_STABILITY_DEMAND: "SIMILARITY_DEMAND_DIFFERENT_STABILITY_DEMAND",
    SAME_AXIAL_LOADING: "SIMILARITY_DEMAND_SAME_AXIAL_LOADING",
    DIFFERENT_AXIAL_LOADING: "SIMILARITY_DEMAND_DIFFERENT_AXIAL_LOADING",
    MISSING_STABILITY_DEMAND: "SIMILARITY_DEMAND_MISSING_STABILITY_DEMAND",
    MISSING_AXIAL_LOADING: "SIMILARITY_DEMAND_MISSING_AXIAL_LOADING",
    MISSING_DEMAND_METADATA: "SIMILARITY_DEMAND_MISSING_METADATA",
  }),
  ENGINE: Object.freeze({
    NO_AVAILABLE_DIMENSIONS: "SIMILARITY_ENGINE_NO_AVAILABLE_DIMENSIONS",
  }),
});

const VALID_DIMENSIONS = new Set(ENABLED_SIMILARITY_DIMENSIONS);
const VALID_STATUSES = new Set(Object.values(SIMILARITY_RESULT_STATUSES));

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue);
  }
  return value;
}

function cloneAndSortStrings(values) {
  return [...values].sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isOptionalCatalogString(value) {
  return value === null || value === undefined || typeof value === "string";
}

function isValidScore(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1;
}

function assertArrayOfStrings(value, fieldName) {
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }
}

function inferMissingFacts(rawExercise) {
  const missingFacts = [];

  if (!rawExercise.dnaMovementPattern) {
    missingFacts.push("dnaMovementPattern");
  }

  if (!Array.isArray(rawExercise.requiredEquipment) || rawExercise.requiredEquipment.length === 0) {
    missingFacts.push("requiredEquipment");
  }

  if (!rawExercise.stabilityDemand) {
    missingFacts.push("stabilityDemand");
  }

  if (!rawExercise.axialLoading) {
    missingFacts.push("axialLoading");
  }

  return missingFacts;
}

export function buildExerciseSimilarityProfile(rawExercise) {
  if (!isPlainObject(rawExercise)) {
    throw new Error("Exercise similarity profile input must be a plain object.");
  }

  if (!isPositiveInteger(rawExercise.exerciseId ?? rawExercise.id)) {
    throw new Error("Exercise similarity profile requires a positive integer exerciseId.");
  }

  if (!isOptionalCatalogString(rawExercise.slug)) {
    throw new Error("Exercise similarity profile slug must be a string or null.");
  }

  if (typeof rawExercise.slug === "string" && !SLUG_PATTERN.test(rawExercise.slug)) {
    throw new Error(`Exercise similarity profile slug "${rawExercise.slug}" is invalid.`);
  }

  assertArrayOfStrings(rawExercise.primaryMuscles ?? [], "primaryMuscles");
  assertArrayOfStrings(rawExercise.secondaryMuscles ?? [], "secondaryMuscles");
  assertArrayOfStrings(rawExercise.requiredEquipment ?? [], "requiredEquipment");

  const profile = {
    version: EXERCISE_SIMILARITY_PROFILE_VERSION,
    exerciseId: rawExercise.exerciseId ?? rawExercise.id,
    slug: rawExercise.slug ?? null,
    dnaMovementPattern: rawExercise.dnaMovementPattern ?? null,
    complexity: rawExercise.complexity ?? null,
    primaryMuscles: cloneAndSortStrings(rawExercise.primaryMuscles ?? []),
    secondaryMuscles: cloneAndSortStrings(rawExercise.secondaryMuscles ?? []),
    requiredEquipment: cloneAndSortStrings(rawExercise.requiredEquipment ?? []),
    difficulty: rawExercise.difficulty ?? null,
    stabilityDemand: rawExercise.stabilityDemand ?? null,
    axialLoading: rawExercise.axialLoading ?? null,
    missingFacts: Object.freeze(inferMissingFacts(rawExercise)),
  };

  return deepFreeze(profile);
}

function normalizeReason(reason) {
  if (!isPlainObject(reason) || typeof reason.code !== "string" || reason.code.trim().length === 0) {
    throw new Error("Comparator reasons must be plain objects with a non-empty string code.");
  }

  if (reason.data !== undefined && reason.data !== null && !isPlainObject(reason.data)) {
    throw new Error(`Comparator reason "${reason.code}" data must be a plain object when provided.`);
  }

  return {
    code: reason.code,
    data: reason.data ?? null,
  };
}

export function validateComparatorResult(result) {
  if (!isPlainObject(result)) {
    throw new Error("Comparator result must be a plain object.");
  }

  if (!VALID_DIMENSIONS.has(result.dimension)) {
    throw new Error(`Comparator result dimension "${result.dimension}" is not supported by the similarity contract.`);
  }

  if (!VALID_STATUSES.has(result.status)) {
    throw new Error(`Comparator result status "${result.status}" is invalid.`);
  }

  if (!Array.isArray(result.reasons) || result.reasons.length === 0) {
    throw new Error("Comparator result must include at least one machine-readable reason.");
  }

  const normalizedReasons = result.reasons.map(normalizeReason);

  if (result.status === SIMILARITY_RESULT_STATUSES.AVAILABLE) {
    if (!isValidScore(result.score)) {
      throw new Error("Comparator result score must be a finite number between 0 and 1 when the dimension is available.");
    }
  } else if (result.score !== null) {
    throw new Error("Comparator result score must be null when the dimension is unavailable.");
  }

  if (result.evidence !== undefined && result.evidence !== null && !isPlainObject(result.evidence)) {
    throw new Error("Comparator result evidence must be a plain object when provided.");
  }

  return deepFreeze({
    dimension: result.dimension,
    status: result.status,
    score: result.status === SIMILARITY_RESULT_STATUSES.AVAILABLE ? result.score : null,
    reasons: normalizedReasons,
    evidence: result.evidence ?? null,
  });
}

export function validateSimilarityPolicy(policy) {
  if (!isPlainObject(policy)) {
    throw new Error("Exercise similarity policy must be a plain object.");
  }

  if (typeof policy.version !== "string" || policy.version.trim().length === 0) {
    throw new Error("Exercise similarity policy requires a non-empty version string.");
  }

  if (!Array.isArray(policy.enabledDimensions) || policy.enabledDimensions.length === 0) {
    throw new Error("Exercise similarity policy requires a non-empty enabledDimensions array.");
  }

  if (!isPlainObject(policy.weights)) {
    throw new Error("Exercise similarity policy requires a weights object.");
  }

  const uniqueDimensions = [];
  const seenDimensions = new Set();
  for (const dimension of policy.enabledDimensions) {
    if (!VALID_DIMENSIONS.has(dimension)) {
      throw new Error(`Exercise similarity policy dimension "${dimension}" is not supported.`);
    }
    if (seenDimensions.has(dimension)) {
      throw new Error(`Exercise similarity policy dimension "${dimension}" is duplicated.`);
    }
    seenDimensions.add(dimension);
    uniqueDimensions.push(dimension);
  }

  const normalizedWeights = {};
  let totalWeight = 0;

  for (const dimension of uniqueDimensions) {
    const weight = policy.weights[dimension];
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
      throw new Error(`Exercise similarity policy weight for "${dimension}" must be a positive finite number.`);
    }
    normalizedWeights[dimension] = weight;
    totalWeight += weight;
  }

  for (const dimension of Object.keys(policy.weights)) {
    if (!seenDimensions.has(dimension)) {
      throw new Error(`Exercise similarity policy provided a weight for disabled or unknown dimension "${dimension}".`);
    }
  }

  return deepFreeze({
    version: policy.version,
    enabledDimensions: uniqueDimensions,
    weights: normalizedWeights,
    totalWeight,
  });
}

function validateComparatorDefinition(comparator) {
  if (!isPlainObject(comparator)) {
    throw new Error("Similarity comparators must be plain objects.");
  }

  if (!VALID_DIMENSIONS.has(comparator.dimension)) {
    throw new Error(`Similarity comparator dimension "${comparator.dimension}" is not supported.`);
  }

  if (typeof comparator.compare !== "function") {
    throw new Error(`Similarity comparator "${comparator.dimension}" must expose a compare(profileA, profileB) function.`);
  }
}

function buildComparatorMap(comparators) {
  if (!Array.isArray(comparators)) {
    throw new Error("Similarity engine requires an array of comparator definitions.");
  }

  const comparatorMap = new Map();

  for (const comparator of comparators) {
    validateComparatorDefinition(comparator);
    if (comparatorMap.has(comparator.dimension)) {
      throw new Error(`Similarity comparator "${comparator.dimension}" was registered more than once.`);
    }
    comparatorMap.set(comparator.dimension, comparator);
  }

  return comparatorMap;
}

function roundScore(value) {
  return Math.round(value * 10000) / 10000;
}

export function compareExerciseProfiles(profileA, profileB, policy, comparators) {
  const frozenProfileA = buildExerciseSimilarityProfile(profileA);
  const frozenProfileB = buildExerciseSimilarityProfile(profileB);
  const validatedPolicy = validateSimilarityPolicy(policy);
  const comparatorMap = buildComparatorMap(comparators);

  const dimensions = [];

  for (const dimension of validatedPolicy.enabledDimensions) {
    const comparator = comparatorMap.get(dimension);
    if (!comparator) {
      throw new Error(`Similarity comparator "${dimension}" is required by policy "${validatedPolicy.version}".`);
    }

    const result = validateComparatorResult(comparator.compare(frozenProfileA, frozenProfileB));
    if (result.dimension !== dimension) {
      throw new Error(
        `Similarity comparator "${dimension}" returned a mismatched dimension result "${result.dimension}".`
      );
    }
    dimensions.push(result);
  }

  const availableDimensions = dimensions.filter(
    (dimension) => dimension.status === SIMILARITY_RESULT_STATUSES.AVAILABLE
  );

  let aggregateScore = null;
  let status = SIMILARITY_RESULT_STATUSES.UNAVAILABLE;
  let aggregateReasons = [
    {
      code: SIMILARITY_REASON_CODES.ENGINE.NO_AVAILABLE_DIMENSIONS,
      data: {
        enabledDimensions: [...validatedPolicy.enabledDimensions],
      },
    },
  ];

  if (availableDimensions.length > 0) {
    const weightedScore = availableDimensions.reduce(
      (sum, dimension) => sum + dimension.score * validatedPolicy.weights[dimension.dimension],
      0
    );
    const totalActiveWeight = availableDimensions.reduce(
      (sum, dimension) => sum + validatedPolicy.weights[dimension.dimension],
      0
    );
    aggregateScore = roundScore(weightedScore / totalActiveWeight);
    status = SIMILARITY_RESULT_STATUSES.AVAILABLE;
    aggregateReasons = availableDimensions.flatMap((dimension) => dimension.reasons);
  }

  return deepFreeze({
    policyVersion: validatedPolicy.version,
    status,
    score: aggregateScore,
    dimensions,
    reasons: aggregateReasons,
  });
}

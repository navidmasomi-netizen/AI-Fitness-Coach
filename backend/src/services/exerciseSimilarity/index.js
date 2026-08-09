import { SLUG_PATTERN } from "../exerciseCatalogValidation.js";

export const EXERCISE_SIMILARITY_PROFILE_VERSION = "v1";
export const EXERCISE_SIMILARITY_POLICY_VERSION = "contract_v1";
export const DEFAULT_EXERCISE_SIMILARITY_POLICY_V1_VERSION = "exercise-similarity-v1";

export const EXERCISE_SIMILARITY_SCORE_PRECISION_DECIMALS = 4;

export const SIMILARITY_DIMENSIONS = Object.freeze({
  MOVEMENT: "movement",
  EXERCISE_CLASS: "exerciseClass",
  MUSCLE: "muscle",
  EQUIPMENT: "equipment",
  DEMAND: "demand",
});

export const ENABLED_SIMILARITY_DIMENSIONS = Object.freeze([
  SIMILARITY_DIMENSIONS.MOVEMENT,
  SIMILARITY_DIMENSIONS.EXERCISE_CLASS,
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
  EXERCISE_CLASS: Object.freeze({
    SAME_EXERCISE_CLASS: "SIMILARITY_EXERCISE_CLASS_SAME_CLASS",
    DIFFERENT_EXERCISE_CLASS: "SIMILARITY_EXERCISE_CLASS_DIFFERENT_CLASS",
    MISSING_EXERCISE_CLASS: "SIMILARITY_EXERCISE_CLASS_MISSING_CLASS",
  }),
  MUSCLE: Object.freeze({
    PRIMARY_MUSCLE_OVERLAP: "SIMILARITY_MUSCLE_PRIMARY_OVERLAP",
    CROSS_ROLE_MUSCLE_OVERLAP: "SIMILARITY_MUSCLE_CROSS_ROLE_OVERLAP",
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

export const MUSCLE_SIMILARITY_PRIMARY_WEIGHT = 1;
export const MUSCLE_SIMILARITY_SECONDARY_WEIGHT = 0.5;

export const STABILITY_DEMAND_ORDER = Object.freeze({
  LOW: 0,
  MODERATE: 1,
  HIGH: 2,
});

export const AXIAL_LOADING_ORDER = Object.freeze({
  NONE: 0,
  LOW: 1,
  HIGH: 2,
});

export const DEFAULT_EXERCISE_SIMILARITY_POLICY_V1 = deepFreeze({
  version: DEFAULT_EXERCISE_SIMILARITY_POLICY_V1_VERSION,
  enabledDimensions: [
    SIMILARITY_DIMENSIONS.MOVEMENT,
    SIMILARITY_DIMENSIONS.EXERCISE_CLASS,
    SIMILARITY_DIMENSIONS.MUSCLE,
    SIMILARITY_DIMENSIONS.EQUIPMENT,
    SIMILARITY_DIMENSIONS.DEMAND,
  ],
  weights: {
    [SIMILARITY_DIMENSIONS.MOVEMENT]: 0.35,
    [SIMILARITY_DIMENSIONS.EXERCISE_CLASS]: 0.1,
    [SIMILARITY_DIMENSIONS.MUSCLE]: 0.25,
    [SIMILARITY_DIMENSIONS.EQUIPMENT]: 0.15,
    [SIMILARITY_DIMENSIONS.DEMAND]: 0.15,
  },
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

function normalizeStringArray(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "en", { sensitivity: "base" }));
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

function roundScore(value) {
  const multiplier = 10 ** EXERCISE_SIMILARITY_SCORE_PRECISION_DECIMALS;
  return Math.round(value * multiplier) / multiplier;
}

function inferMissingFacts(rawExercise) {
  const missingFacts = [];

  if (!rawExercise.dnaMovementPattern) {
    missingFacts.push("dnaMovementPattern");
  }

  if (!rawExercise.complexity) {
    missingFacts.push("complexity");
  }

  const hasAnyMuscleMetadata =
    (Array.isArray(rawExercise.primaryMuscles) && rawExercise.primaryMuscles.length > 0) ||
    (Array.isArray(rawExercise.secondaryMuscles) && rawExercise.secondaryMuscles.length > 0);
  if (!hasAnyMuscleMetadata) {
    missingFacts.push("muscleMetadata");
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

function buildMissingSideData(profileA, profileB, field) {
  const missingOn = [];

  if (!profileA[field] || (Array.isArray(profileA[field]) && profileA[field].length === 0)) {
    missingOn.push("A");
  }

  if (!profileB[field] || (Array.isArray(profileB[field]) && profileB[field].length === 0)) {
    missingOn.push("B");
  }

  return missingOn;
}

function buildSetEvidence(leftValues, rightValues) {
  const leftSet = new Set(leftValues);
  const rightSet = new Set(rightValues);
  const shared = [];
  const onlyA = [];
  const onlyB = [];

  for (const value of leftSet) {
    if (rightSet.has(value)) {
      shared.push(value);
    } else {
      onlyA.push(value);
    }
  }

  for (const value of rightSet) {
    if (!leftSet.has(value)) {
      onlyB.push(value);
    }
  }

  return {
    shared: normalizeStringArray(shared),
    onlyA: normalizeStringArray(onlyA),
    onlyB: normalizeStringArray(onlyB),
  };
}

function buildRoleSets(profile) {
  const primary = new Set(profile.primaryMuscles);
  const secondary = new Set(profile.secondaryMuscles.filter((muscle) => !primary.has(muscle)));
  return { primary, secondary };
}

function buildWeightedMuscleMap(profile) {
  const weightedMuscles = new Map();

  for (const muscle of profile.secondaryMuscles) {
    weightedMuscles.set(muscle, MUSCLE_SIMILARITY_SECONDARY_WEIGHT);
  }

  for (const muscle of profile.primaryMuscles) {
    weightedMuscles.set(muscle, MUSCLE_SIMILARITY_PRIMARY_WEIGHT);
  }

  return weightedMuscles;
}

function buildRoleOverlapEvidence(profileA, profileB) {
  const rolesA = buildRoleSets(profileA);
  const rolesB = buildRoleSets(profileB);
  const allMuscles = new Set([
    ...rolesA.primary,
    ...rolesA.secondary,
    ...rolesB.primary,
    ...rolesB.secondary,
  ]);

  const sharedPrimary = [];
  const sharedCrossRole = [];
  const sharedSecondary = [];
  const onlyA = [];
  const onlyB = [];

  for (const muscle of allMuscles) {
    const inAPrimary = rolesA.primary.has(muscle);
    const inASecondary = rolesA.secondary.has(muscle);
    const inBPrimary = rolesB.primary.has(muscle);
    const inBSecondary = rolesB.secondary.has(muscle);
    const inA = inAPrimary || inASecondary;
    const inB = inBPrimary || inBSecondary;

    if (inA && inB) {
      if (inAPrimary && inBPrimary) {
        sharedPrimary.push(muscle);
      } else if ((inAPrimary && inBSecondary) || (inASecondary && inBPrimary)) {
        sharedCrossRole.push(muscle);
      } else {
        sharedSecondary.push(muscle);
      }
      continue;
    }

    if (inA) {
      onlyA.push(muscle);
    } else if (inB) {
      onlyB.push(muscle);
    }
  }

  return {
    sharedPrimary: normalizeStringArray(sharedPrimary),
    sharedCrossRole: normalizeStringArray(sharedCrossRole),
    sharedSecondary: normalizeStringArray(sharedSecondary),
    onlyA: normalizeStringArray(onlyA),
    onlyB: normalizeStringArray(onlyB),
  };
}

function calculateWeightedJaccard(leftMap, rightMap) {
  const unionKeys = new Set([...leftMap.keys(), ...rightMap.keys()]);
  let intersectionWeight = 0;
  let unionWeight = 0;

  for (const key of unionKeys) {
    const leftWeight = leftMap.get(key) ?? 0;
    const rightWeight = rightMap.get(key) ?? 0;
    intersectionWeight += Math.min(leftWeight, rightWeight);
    unionWeight += Math.max(leftWeight, rightWeight);
  }

  return {
    intersectionWeight,
    unionWeight,
    score: unionWeight === 0 ? null : roundScore(intersectionWeight / unionWeight),
  };
}

function calculateOrdinalSimilarity(valueA, valueB, orderMap) {
  const indexA = orderMap[valueA];
  const indexB = orderMap[valueB];
  const maxDistance = Math.max(...Object.values(orderMap));
  const distance = Math.abs(indexA - indexB);
  return roundScore(1 - distance / maxDistance);
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
    primaryMuscles: normalizeStringArray(rawExercise.primaryMuscles ?? []),
    secondaryMuscles: normalizeStringArray(rawExercise.secondaryMuscles ?? []),
    requiredEquipment: normalizeStringArray(rawExercise.requiredEquipment ?? []),
    difficulty: rawExercise.difficulty ?? null,
    stabilityDemand: rawExercise.stabilityDemand ?? null,
    axialLoading: rawExercise.axialLoading ?? null,
    missingFacts: Object.freeze(inferMissingFacts(rawExercise)),
  };

  return deepFreeze(profile);
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
    score: result.status === SIMILARITY_RESULT_STATUSES.AVAILABLE ? roundScore(result.score) : null,
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

function buildProfileSortKey(profile) {
  return `${profile.slug ?? ""}::${String(profile.exerciseId).padStart(12, "0")}`;
}

function orderProfilesForSymmetricComparison(profileA, profileB) {
  const sortKeyA = buildProfileSortKey(profileA);
  const sortKeyB = buildProfileSortKey(profileB);
  if (sortKeyA <= sortKeyB) {
    return [profileA, profileB];
  }
  return [profileB, profileA];
}

export const MOVEMENT_COMPARATOR_V1 = deepFreeze({
  dimension: SIMILARITY_DIMENSIONS.MOVEMENT,
  compare(profileA, profileB) {
    if (!profileA.dnaMovementPattern || !profileB.dnaMovementPattern) {
      return {
        dimension: SIMILARITY_DIMENSIONS.MOVEMENT,
        status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
        score: null,
        reasons: [
          {
            code: SIMILARITY_REASON_CODES.MOVEMENT.MISSING_DNA_MOVEMENT_PATTERN,
            data: {
              missingFacts: ["dnaMovementPattern"],
              missingOn: buildMissingSideData(profileA, profileB, "dnaMovementPattern"),
            },
          },
        ],
        evidence: {
          patternA: profileA.dnaMovementPattern,
          patternB: profileB.dnaMovementPattern,
        },
      };
    }

    const samePattern = profileA.dnaMovementPattern === profileB.dnaMovementPattern;
    return {
      dimension: SIMILARITY_DIMENSIONS.MOVEMENT,
      status: SIMILARITY_RESULT_STATUSES.AVAILABLE,
      score: samePattern ? 1 : 0,
      reasons: [
        samePattern
          ? {
              code: SIMILARITY_REASON_CODES.MOVEMENT.SAME_MOVEMENT_PATTERN,
              data: { pattern: profileA.dnaMovementPattern },
            }
          : {
              code: SIMILARITY_REASON_CODES.MOVEMENT.DIFFERENT_MOVEMENT_PATTERN,
              data: {
                patternA: profileA.dnaMovementPattern,
                patternB: profileB.dnaMovementPattern,
              },
            },
      ],
      evidence: {
        patternA: profileA.dnaMovementPattern,
        patternB: profileB.dnaMovementPattern,
      },
    };
  },
});

export const EXERCISE_CLASS_COMPARATOR_V1 = deepFreeze({
  dimension: SIMILARITY_DIMENSIONS.EXERCISE_CLASS,
  compare(profileA, profileB) {
    if (!profileA.complexity || !profileB.complexity) {
      return {
        dimension: SIMILARITY_DIMENSIONS.EXERCISE_CLASS,
        status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
        score: null,
        reasons: [
          {
            code: SIMILARITY_REASON_CODES.EXERCISE_CLASS.MISSING_EXERCISE_CLASS,
            data: {
              missingFacts: ["complexity"],
              missingOn: buildMissingSideData(profileA, profileB, "complexity"),
            },
          },
        ],
        evidence: {
          classA: profileA.complexity,
          classB: profileB.complexity,
        },
      };
    }

    const sameClass = profileA.complexity === profileB.complexity;
    return {
      dimension: SIMILARITY_DIMENSIONS.EXERCISE_CLASS,
      status: SIMILARITY_RESULT_STATUSES.AVAILABLE,
      score: sameClass ? 1 : 0,
      reasons: [
        sameClass
          ? {
              code: SIMILARITY_REASON_CODES.EXERCISE_CLASS.SAME_EXERCISE_CLASS,
              data: { exerciseClass: profileA.complexity },
            }
          : {
              code: SIMILARITY_REASON_CODES.EXERCISE_CLASS.DIFFERENT_EXERCISE_CLASS,
              data: {
                classA: profileA.complexity,
                classB: profileB.complexity,
              },
            },
      ],
      evidence: {
        classA: profileA.complexity,
        classB: profileB.complexity,
      },
    };
  },
});

export const MUSCLE_COMPARATOR_V1 = deepFreeze({
  dimension: SIMILARITY_DIMENSIONS.MUSCLE,
  compare(profileA, profileB) {
    const weightedMusclesA = buildWeightedMuscleMap(profileA);
    const weightedMusclesB = buildWeightedMuscleMap(profileB);

    if (weightedMusclesA.size === 0 || weightedMusclesB.size === 0) {
      const missingOn = [];
      if (weightedMusclesA.size === 0) {
        missingOn.push("A");
      }
      if (weightedMusclesB.size === 0) {
        missingOn.push("B");
      }

      return {
        dimension: SIMILARITY_DIMENSIONS.MUSCLE,
        status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
        score: null,
        reasons: [
          {
            code: SIMILARITY_REASON_CODES.MUSCLE.MISSING_MUSCLE_METADATA,
            data: {
              missingFacts: ["primaryMuscles", "secondaryMuscles"],
              missingOn,
            },
          },
        ],
        evidence: {
          sharedPrimary: [],
          sharedCrossRole: [],
          sharedSecondary: [],
          onlyA: normalizeStringArray([...weightedMusclesA.keys()]),
          onlyB: normalizeStringArray([...weightedMusclesB.keys()]),
        },
      };
    }

    const overlapEvidence = buildRoleOverlapEvidence(profileA, profileB);
    const weightedJaccard = calculateWeightedJaccard(weightedMusclesA, weightedMusclesB);
    const reasons = [];

    if (overlapEvidence.sharedPrimary.length > 0) {
      reasons.push({
        code: SIMILARITY_REASON_CODES.MUSCLE.PRIMARY_MUSCLE_OVERLAP,
        data: {
          muscles: overlapEvidence.sharedPrimary,
        },
      });
    }

    if (overlapEvidence.sharedCrossRole.length > 0) {
      reasons.push({
        code: SIMILARITY_REASON_CODES.MUSCLE.CROSS_ROLE_MUSCLE_OVERLAP,
        data: {
          muscles: overlapEvidence.sharedCrossRole,
        },
      });
    }

    if (overlapEvidence.sharedSecondary.length > 0) {
      reasons.push({
        code: SIMILARITY_REASON_CODES.MUSCLE.SECONDARY_MUSCLE_OVERLAP,
        data: {
          muscles: overlapEvidence.sharedSecondary,
        },
      });
    }

    if (reasons.length === 0) {
      reasons.push({
        code: SIMILARITY_REASON_CODES.MUSCLE.NO_MUSCLE_OVERLAP,
        data: {
          onlyA: overlapEvidence.onlyA,
          onlyB: overlapEvidence.onlyB,
        },
      });
    }

    return {
      dimension: SIMILARITY_DIMENSIONS.MUSCLE,
      status: SIMILARITY_RESULT_STATUSES.AVAILABLE,
      score: weightedJaccard.score,
      reasons,
      evidence: {
        ...overlapEvidence,
        intersectionWeight: roundScore(weightedJaccard.intersectionWeight),
        unionWeight: roundScore(weightedJaccard.unionWeight),
      },
    };
  },
});

export const EQUIPMENT_COMPARATOR_V1 = deepFreeze({
  dimension: SIMILARITY_DIMENSIONS.EQUIPMENT,
  compare(profileA, profileB) {
    if (profileA.requiredEquipment.length === 0 || profileB.requiredEquipment.length === 0) {
      return {
        dimension: SIMILARITY_DIMENSIONS.EQUIPMENT,
        status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
        score: null,
        reasons: [
          {
            code: SIMILARITY_REASON_CODES.EQUIPMENT.MISSING_REQUIRED_EQUIPMENT,
            data: {
              missingFacts: ["requiredEquipment"],
              missingOn: buildMissingSideData(profileA, profileB, "requiredEquipment"),
            },
          },
        ],
        evidence: buildSetEvidence(profileA.requiredEquipment, profileB.requiredEquipment),
      };
    }

    const evidence = buildSetEvidence(profileA.requiredEquipment, profileB.requiredEquipment);
    const intersectionSize = evidence.shared.length;
    const unionSize = intersectionSize + evidence.onlyA.length + evidence.onlyB.length;
    const score = roundScore(intersectionSize / unionSize);

    let reasonCode = SIMILARITY_REASON_CODES.EQUIPMENT.PARTIAL_REQUIRED_EQUIPMENT_OVERLAP;
    if (score === 1) {
      reasonCode = SIMILARITY_REASON_CODES.EQUIPMENT.SAME_REQUIRED_EQUIPMENT;
    } else if (score === 0) {
      reasonCode = SIMILARITY_REASON_CODES.EQUIPMENT.DIFFERENT_REQUIRED_EQUIPMENT;
    }

    return {
      dimension: SIMILARITY_DIMENSIONS.EQUIPMENT,
      status: SIMILARITY_RESULT_STATUSES.AVAILABLE,
      score,
      reasons: [
        {
          code: reasonCode,
          data: {
            shared: evidence.shared,
            onlyA: evidence.onlyA,
            onlyB: evidence.onlyB,
          },
        },
      ],
      evidence,
    };
  },
});

export const DEMAND_COMPARATOR_V1 = deepFreeze({
  dimension: SIMILARITY_DIMENSIONS.DEMAND,
  compare(profileA, profileB) {
    const componentResults = [];
    const reasons = [];

    if (!profileA.stabilityDemand || !profileB.stabilityDemand) {
      reasons.push({
        code: SIMILARITY_REASON_CODES.DEMAND.MISSING_STABILITY_DEMAND,
        data: {
          missingFacts: ["stabilityDemand"],
          missingOn: buildMissingSideData(profileA, profileB, "stabilityDemand"),
        },
      });
    } else {
      const score = calculateOrdinalSimilarity(profileA.stabilityDemand, profileB.stabilityDemand, STABILITY_DEMAND_ORDER);
      componentResults.push(score);
      reasons.push({
        code:
          score === 1
            ? SIMILARITY_REASON_CODES.DEMAND.SAME_STABILITY_DEMAND
            : SIMILARITY_REASON_CODES.DEMAND.DIFFERENT_STABILITY_DEMAND,
        data: {
          valueA: profileA.stabilityDemand,
          valueB: profileB.stabilityDemand,
        },
      });
    }

    if (!profileA.axialLoading || !profileB.axialLoading) {
      reasons.push({
        code: SIMILARITY_REASON_CODES.DEMAND.MISSING_AXIAL_LOADING,
        data: {
          missingFacts: ["axialLoading"],
          missingOn: buildMissingSideData(profileA, profileB, "axialLoading"),
        },
      });
    } else {
      const score = calculateOrdinalSimilarity(profileA.axialLoading, profileB.axialLoading, AXIAL_LOADING_ORDER);
      componentResults.push(score);
      reasons.push({
        code:
          score === 1
            ? SIMILARITY_REASON_CODES.DEMAND.SAME_AXIAL_LOADING
            : SIMILARITY_REASON_CODES.DEMAND.DIFFERENT_AXIAL_LOADING,
        data: {
          valueA: profileA.axialLoading,
          valueB: profileB.axialLoading,
        },
      });
    }

    if (componentResults.length === 0) {
      return {
        dimension: SIMILARITY_DIMENSIONS.DEMAND,
        status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
        score: null,
        reasons: [
          {
            code: SIMILARITY_REASON_CODES.DEMAND.MISSING_DEMAND_METADATA,
            data: {
              missingFacts: ["stabilityDemand", "axialLoading"],
            },
          },
          ...reasons,
        ],
        evidence: {
          stability: {
            valueA: profileA.stabilityDemand,
            valueB: profileB.stabilityDemand,
            score: null,
          },
          axialLoading: {
            valueA: profileA.axialLoading,
            valueB: profileB.axialLoading,
            score: null,
          },
        },
      };
    }

    const score = roundScore(componentResults.reduce((sum, value) => sum + value, 0) / componentResults.length);

    return {
      dimension: SIMILARITY_DIMENSIONS.DEMAND,
      status: SIMILARITY_RESULT_STATUSES.AVAILABLE,
      score,
      reasons,
      evidence: {
        stability: {
          valueA: profileA.stabilityDemand,
          valueB: profileB.stabilityDemand,
          score:
            profileA.stabilityDemand && profileB.stabilityDemand
              ? calculateOrdinalSimilarity(profileA.stabilityDemand, profileB.stabilityDemand, STABILITY_DEMAND_ORDER)
              : null,
        },
        axialLoading: {
          valueA: profileA.axialLoading,
          valueB: profileB.axialLoading,
          score:
            profileA.axialLoading && profileB.axialLoading
              ? calculateOrdinalSimilarity(profileA.axialLoading, profileB.axialLoading, AXIAL_LOADING_ORDER)
              : null,
        },
      },
    };
  },
});

export const DEFAULT_EXERCISE_SIMILARITY_COMPARATORS_V1 = deepFreeze([
  MOVEMENT_COMPARATOR_V1,
  EXERCISE_CLASS_COMPARATOR_V1,
  MUSCLE_COMPARATOR_V1,
  EQUIPMENT_COMPARATOR_V1,
  DEMAND_COMPARATOR_V1,
]);

export function compareExerciseProfiles(profileA, profileB, policy, comparators = DEFAULT_EXERCISE_SIMILARITY_COMPARATORS_V1) {
  const rawProfileA = buildExerciseSimilarityProfile(profileA);
  const rawProfileB = buildExerciseSimilarityProfile(profileB);
  const [frozenProfileA, frozenProfileB] = orderProfilesForSymmetricComparison(rawProfileA, rawProfileB);
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

export function compareExercisesV1(rawExerciseA, rawExerciseB, policy = DEFAULT_EXERCISE_SIMILARITY_POLICY_V1) {
  return compareExerciseProfiles(rawExerciseA, rawExerciseB, policy, DEFAULT_EXERCISE_SIMILARITY_COMPARATORS_V1);
}

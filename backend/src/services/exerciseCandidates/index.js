import { compareExercisesV1, SIMILARITY_RESULT_STATUSES } from "../exerciseSimilarity/index.js";

export const REPLACEMENT_CANDIDATE_ENGINE_V1_VERSION = "replacement-candidate-engine-v1";
export const CANDIDATE_SIMILARITY_STATUSES = Object.freeze({
  AVAILABLE: SIMILARITY_RESULT_STATUSES.AVAILABLE,
  UNAVAILABLE: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
  NOT_EVALUATED: "NOT_EVALUATED",
});

export const CANDIDATE_ELIGIBILITY_RULE_IDS = Object.freeze({
  NOT_SOURCE_EXERCISE: "CANDIDATE_RULE_NOT_SOURCE_EXERCISE",
  ACTIVE_CATALOG_EXERCISE: "CANDIDATE_RULE_ACTIVE_CATALOG_EXERCISE",
  COMPLETE_DNA: "CANDIDATE_RULE_COMPLETE_DNA",
  SAME_EXERCISE_CLASS: "CANDIDATE_RULE_SAME_EXERCISE_CLASS",
  SAME_MOVEMENT_PATTERN: "CANDIDATE_RULE_SAME_MOVEMENT_PATTERN",
  AVAILABLE_SIMILARITY: "CANDIDATE_RULE_AVAILABLE_SIMILARITY",
});

export const CANDIDATE_ELIGIBILITY_REASON_CODES = Object.freeze({
  NOT_SOURCE_EXERCISE: "CANDIDATE_NOT_SOURCE_EXERCISE",
  SOURCE_EXERCISE_EXCLUDED: "CANDIDATE_SOURCE_EXERCISE_EXCLUDED",
  ACTIVE_CATALOG_EXERCISE: "CANDIDATE_ACTIVE_CATALOG_EXERCISE",
  INACTIVE_CATALOG_EXERCISE: "CANDIDATE_INACTIVE_CATALOG_EXERCISE",
  COMPLETE_DNA: "CANDIDATE_COMPLETE_DNA",
  INCOMPLETE_DNA: "CANDIDATE_INCOMPLETE_DNA",
  SAME_EXERCISE_CLASS: "CANDIDATE_SAME_EXERCISE_CLASS",
  DIFFERENT_EXERCISE_CLASS: "CANDIDATE_DIFFERENT_EXERCISE_CLASS",
  SAME_MOVEMENT_PATTERN: "CANDIDATE_SAME_MOVEMENT_PATTERN",
  DIFFERENT_MOVEMENT_PATTERN: "CANDIDATE_DIFFERENT_MOVEMENT_PATTERN",
  AVAILABLE_SIMILARITY: "CANDIDATE_AVAILABLE_SIMILARITY",
  UNAVAILABLE_SIMILARITY: "CANDIDATE_UNAVAILABLE_SIMILARITY",
  SIMILARITY_NOT_EVALUATED: "CANDIDATE_SIMILARITY_NOT_EVALUATED",
});

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

function normalizeReason(reason) {
  return deepFreeze({
    ruleId: reason.ruleId,
    status: reason.status,
    code: reason.code,
    data: reason.data ?? null,
  });
}

function assertExerciseLike(exercise, fieldName) {
  if (!isPlainObject(exercise)) {
    throw new Error(`${fieldName} must be a plain exercise object.`);
  }

  const exerciseId = exercise.exerciseId ?? exercise.id;
  if (!Number.isInteger(exerciseId) || exerciseId <= 0) {
    throw new Error(`${fieldName} requires a positive integer exerciseId.`);
  }
}

function assertCatalogExerciseArray(catalogExercises) {
  if (!Array.isArray(catalogExercises)) {
    throw new Error("catalogExercises must be an array of exercise objects.");
  }

  for (const exercise of catalogExercises) {
    assertExerciseLike(exercise, "catalogExercises entry");
  }
}

function buildMissingDnaFacts(exercise) {
  const missingFacts = [];

  if (!exercise.dnaMovementPattern) {
    missingFacts.push("dnaMovementPattern");
  }

  if (!exercise.complexity) {
    missingFacts.push("complexity");
  }

  const hasAnyMuscleMetadata =
    (Array.isArray(exercise.primaryMuscles) && exercise.primaryMuscles.length > 0) ||
    (Array.isArray(exercise.secondaryMuscles) && exercise.secondaryMuscles.length > 0);
  if (!hasAnyMuscleMetadata) {
    missingFacts.push("muscleMetadata");
  }

  if (!Array.isArray(exercise.requiredEquipment) || exercise.requiredEquipment.length === 0) {
    missingFacts.push("requiredEquipment");
  }

  if (!exercise.stabilityDemand) {
    missingFacts.push("stabilityDemand");
  }

  if (!exercise.axialLoading) {
    missingFacts.push("axialLoading");
  }

  return missingFacts;
}

function evaluateSourceIdentityRule(sourceExercise, candidateExercise) {
  const sourceExerciseId = sourceExercise.exerciseId ?? sourceExercise.id;
  const candidateExerciseId = candidateExercise.exerciseId ?? candidateExercise.id;
  const passed = sourceExerciseId !== candidateExerciseId;

  return normalizeReason({
    ruleId: CANDIDATE_ELIGIBILITY_RULE_IDS.NOT_SOURCE_EXERCISE,
    status: passed ? "PASSED" : "BLOCKED",
    code: passed
      ? CANDIDATE_ELIGIBILITY_REASON_CODES.NOT_SOURCE_EXERCISE
      : CANDIDATE_ELIGIBILITY_REASON_CODES.SOURCE_EXERCISE_EXCLUDED,
    data: {
      sourceExerciseId,
      candidateExerciseId,
    },
  });
}

function evaluateActiveCatalogRule(candidateExercise) {
  const passed = candidateExercise.catalogLifecycle === "ACTIVE";

  return normalizeReason({
    ruleId: CANDIDATE_ELIGIBILITY_RULE_IDS.ACTIVE_CATALOG_EXERCISE,
    status: passed ? "PASSED" : "BLOCKED",
    code: passed
      ? CANDIDATE_ELIGIBILITY_REASON_CODES.ACTIVE_CATALOG_EXERCISE
      : CANDIDATE_ELIGIBILITY_REASON_CODES.INACTIVE_CATALOG_EXERCISE,
    data: {
      catalogLifecycle: candidateExercise.catalogLifecycle ?? null,
    },
  });
}

function evaluateCompleteDnaRule(candidateExercise) {
  const missingFacts = buildMissingDnaFacts(candidateExercise);
  const passed = missingFacts.length === 0;

  return normalizeReason({
    ruleId: CANDIDATE_ELIGIBILITY_RULE_IDS.COMPLETE_DNA,
    status: passed ? "PASSED" : "BLOCKED",
    code: passed
      ? CANDIDATE_ELIGIBILITY_REASON_CODES.COMPLETE_DNA
      : CANDIDATE_ELIGIBILITY_REASON_CODES.INCOMPLETE_DNA,
    data: {
      missingFacts,
    },
  });
}

function evaluateExerciseClassRule(sourceExercise, candidateExercise) {
  const sourceComplexity = sourceExercise.complexity ?? null;
  const candidateComplexity = candidateExercise.complexity ?? null;
  const passed = sourceComplexity === candidateComplexity;

  return normalizeReason({
    ruleId: CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_EXERCISE_CLASS,
    status: passed ? "PASSED" : "BLOCKED",
    code: passed
      ? CANDIDATE_ELIGIBILITY_REASON_CODES.SAME_EXERCISE_CLASS
      : CANDIDATE_ELIGIBILITY_REASON_CODES.DIFFERENT_EXERCISE_CLASS,
    data: {
      sourceComplexity,
      candidateComplexity,
    },
  });
}

function evaluateMovementPatternRule(sourceExercise, candidateExercise) {
  const sourcePattern = sourceExercise.dnaMovementPattern ?? null;
  const candidatePattern = candidateExercise.dnaMovementPattern ?? null;
  const passed = sourcePattern === candidatePattern;

  return normalizeReason({
    ruleId: CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_MOVEMENT_PATTERN,
    status: passed ? "PASSED" : "BLOCKED",
    code: passed
      ? CANDIDATE_ELIGIBILITY_REASON_CODES.SAME_MOVEMENT_PATTERN
      : CANDIDATE_ELIGIBILITY_REASON_CODES.DIFFERENT_MOVEMENT_PATTERN,
    data: {
      sourceMovementPattern: sourcePattern,
      candidateMovementPattern: candidatePattern,
    },
  });
}

function evaluateSimilarityAvailabilityRule(similarityResult, blockedRulesBeforeSimilarity) {
  if (similarityResult.status === CANDIDATE_SIMILARITY_STATUSES.NOT_EVALUATED) {
    return normalizeReason({
      ruleId: CANDIDATE_ELIGIBILITY_RULE_IDS.AVAILABLE_SIMILARITY,
      status: "SKIPPED",
      code: CANDIDATE_ELIGIBILITY_REASON_CODES.SIMILARITY_NOT_EVALUATED,
      data: {
        similarityStatus: similarityResult.status,
        blockedByRules: blockedRulesBeforeSimilarity,
      },
    });
  }

  const passed = similarityResult.status === SIMILARITY_RESULT_STATUSES.AVAILABLE;

  return normalizeReason({
    ruleId: CANDIDATE_ELIGIBILITY_RULE_IDS.AVAILABLE_SIMILARITY,
    status: passed ? "PASSED" : "BLOCKED",
    code: passed
      ? CANDIDATE_ELIGIBILITY_REASON_CODES.AVAILABLE_SIMILARITY
      : CANDIDATE_ELIGIBILITY_REASON_CODES.UNAVAILABLE_SIMILARITY,
    data: {
      similarityStatus: similarityResult.status,
      similarityScore: similarityResult.score,
      similarityReasonCodes: similarityResult.reasons.map((reason) => reason.code),
    },
  });
}

function buildCandidateEvaluation(sourceExercise, candidateExercise, compareExercises) {
  const reasons = [];

  reasons.push(evaluateSourceIdentityRule(sourceExercise, candidateExercise));
  reasons.push(evaluateActiveCatalogRule(candidateExercise));
  reasons.push(evaluateCompleteDnaRule(candidateExercise));
  reasons.push(evaluateExerciseClassRule(sourceExercise, candidateExercise));
  reasons.push(evaluateMovementPatternRule(sourceExercise, candidateExercise));

  const blockedRulesBeforeSimilarity = reasons
    .filter((reason) => reason.status === "BLOCKED")
    .map((reason) => reason.ruleId);

  const similarity =
    blockedRulesBeforeSimilarity.length === 0
      ? compareExercises(sourceExercise, candidateExercise)
      : {
          status: CANDIDATE_SIMILARITY_STATUSES.NOT_EVALUATED,
          score: null,
          dimensions: [],
          reasons: [],
        };

  reasons.push(evaluateSimilarityAvailabilityRule(similarity, blockedRulesBeforeSimilarity));

  const passedRules = reasons.filter((reason) => reason.status === "PASSED").map((reason) => reason.ruleId);
  const blockedRules = reasons.filter((reason) => reason.status === "BLOCKED").map((reason) => reason.ruleId);

  return deepFreeze({
    exerciseId: candidateExercise.exerciseId ?? candidateExercise.id,
    similarityScore: similarity.score,
    similarityStatus: similarity.status,
    similarityBreakdown: similarity.dimensions,
    eligibility: blockedRules.length === 0,
    passedRules,
    blockedRules,
    reasons,
  });
}

export function buildReplacementCandidatesV1(
  sourceExercise,
  catalogExercises,
  { compareExercises = compareExercisesV1 } = {}
) {
  assertExerciseLike(sourceExercise, "sourceExercise");
  assertCatalogExerciseArray(catalogExercises);

  if (typeof compareExercises !== "function") {
    throw new Error("compareExercises must be a function.");
  }

  const sourceExerciseId = sourceExercise.exerciseId ?? sourceExercise.id;
  const candidates = catalogExercises.map((candidateExercise) =>
    buildCandidateEvaluation(sourceExercise, candidateExercise, compareExercises)
  );

  const eligibleCount = candidates.filter((candidate) => candidate.eligibility).length;

  return deepFreeze({
    version: REPLACEMENT_CANDIDATE_ENGINE_V1_VERSION,
    sourceExerciseId,
    totalEvaluated: candidates.length,
    eligibleCount,
    candidates,
  });
}

export const WORKOUT_INTEGRITY_ENGINE_V1_VERSION = "workout-integrity-v1";
export const WORKOUT_INTEGRITY_POLICY_V1_VERSION = "workout-integrity-v1";
export const WORKOUT_INTEGRITY_SCORE_PRECISION_DECIMALS = 4;

export const WORKOUT_INTEGRITY_STATUSES = Object.freeze({
  PASS: "PASS",
  WARN: "WARN",
  BLOCK: "BLOCK",
});

export const WORKOUT_INTEGRITY_DIMENSION_STATUSES = Object.freeze({
  PASS: "PASS",
  WARN: "WARN",
  BLOCK: "BLOCK",
  UNAVAILABLE: "UNAVAILABLE",
});

export const WORKOUT_INTEGRITY_DIMENSIONS = Object.freeze({
  EXACT_DUPLICATE: "exactDuplicate",
  MOVEMENT_PATTERN_REDUNDANCY: "movementPatternRedundancy",
  EXERCISE_CLASS_CONCENTRATION: "exerciseClassConcentration",
  PRIMARY_MUSCLE_REDUNDANCY: "primaryMuscleRedundancy",
});

export const WORKOUT_INTEGRITY_REASON_CODES = Object.freeze({
  EXACT_DUPLICATE: "WORKOUT_INTEGRITY_EXACT_DUPLICATE",
  MOVEMENT_PATTERN_BALANCED: "WORKOUT_INTEGRITY_MOVEMENT_PATTERN_BALANCED",
  MOVEMENT_PATTERN_CONCENTRATED: "WORKOUT_INTEGRITY_MOVEMENT_PATTERN_CONCENTRATED",
  EXERCISE_CLASS_BALANCED: "WORKOUT_INTEGRITY_EXERCISE_CLASS_BALANCED",
  EXERCISE_CLASS_CONCENTRATION: "WORKOUT_INTEGRITY_EXERCISE_CLASS_CONCENTRATION",
  PRIMARY_MUSCLE_BALANCED: "WORKOUT_INTEGRITY_PRIMARY_MUSCLE_BALANCED",
  PRIMARY_MUSCLE_CONCENTRATION: "WORKOUT_INTEGRITY_PRIMARY_MUSCLE_CONCENTRATION",
  INSUFFICIENT_METADATA: "WORKOUT_INTEGRITY_INSUFFICIENT_METADATA",
  METADATA_UNAVAILABLE: "WORKOUT_INTEGRITY_METADATA_UNAVAILABLE",
});

export const WORKOUT_INTEGRITY_POLICY_DIMENSIONS = Object.freeze({
  MOVEMENT_PATTERN_REDUNDANCY: WORKOUT_INTEGRITY_DIMENSIONS.MOVEMENT_PATTERN_REDUNDANCY,
  EXERCISE_CLASS_CONCENTRATION: WORKOUT_INTEGRITY_DIMENSIONS.EXERCISE_CLASS_CONCENTRATION,
  PRIMARY_MUSCLE_REDUNDANCY: WORKOUT_INTEGRITY_DIMENSIONS.PRIMARY_MUSCLE_REDUNDANCY,
});

export const DEFAULT_WORKOUT_INTEGRITY_POLICY_V1 = Object.freeze({
  version: WORKOUT_INTEGRITY_POLICY_V1_VERSION,
  enabledDimensions: Object.freeze([
    WORKOUT_INTEGRITY_POLICY_DIMENSIONS.MOVEMENT_PATTERN_REDUNDANCY,
    WORKOUT_INTEGRITY_POLICY_DIMENSIONS.PRIMARY_MUSCLE_REDUNDANCY,
    WORKOUT_INTEGRITY_POLICY_DIMENSIONS.EXERCISE_CLASS_CONCENTRATION,
  ]),
  weights: Object.freeze({
    [WORKOUT_INTEGRITY_POLICY_DIMENSIONS.MOVEMENT_PATTERN_REDUNDANCY]: 0.4,
    [WORKOUT_INTEGRITY_POLICY_DIMENSIONS.PRIMARY_MUSCLE_REDUNDANCY]: 0.4,
    [WORKOUT_INTEGRITY_POLICY_DIMENSIONS.EXERCISE_CLASS_CONCENTRATION]: 0.2,
  }),
  scores: Object.freeze({
    [WORKOUT_INTEGRITY_POLICY_DIMENSIONS.MOVEMENT_PATTERN_REDUNDANCY]: Object.freeze({ PASS: 1, WARN: 0.75 }),
    [WORKOUT_INTEGRITY_POLICY_DIMENSIONS.PRIMARY_MUSCLE_REDUNDANCY]: Object.freeze({ PASS: 1, WARN: 0.75 }),
    [WORKOUT_INTEGRITY_POLICY_DIMENSIONS.EXERCISE_CLASS_CONCENTRATION]: Object.freeze({ PASS: 1, WARN: 0.85 }),
  }),
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function roundScore(value) {
  return Number(value.toFixed(WORKOUT_INTEGRITY_SCORE_PRECISION_DECIMALS));
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

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.filter((value) => typeof value === "string" && value.length > 0))].sort();
}

function normalizeReason(reason, fieldName = "reason") {
  if (!isPlainObject(reason)) {
    throw new Error(`${fieldName} must be a plain object.`);
  }

  if (typeof reason.code !== "string" || reason.code.length === 0) {
    throw new Error(`${fieldName}.code must be a non-empty string.`);
  }

  return deepFreeze({
    code: reason.code,
    data: reason.data ?? null,
  });
}

function validateIntegrityPolicy(policy) {
  if (!isPlainObject(policy)) {
    throw new Error("integrity policy must be a plain object.");
  }

  if (typeof policy.version !== "string" || policy.version.length === 0) {
    throw new Error("integrity policy version must be a non-empty string.");
  }

  if (!Array.isArray(policy.enabledDimensions) || policy.enabledDimensions.length === 0) {
    throw new Error("integrity policy enabledDimensions must be a non-empty array.");
  }

  if (!isPlainObject(policy.weights) || !isPlainObject(policy.scores)) {
    throw new Error("integrity policy must include weights and scores objects.");
  }

  const knownDimensions = Object.values(WORKOUT_INTEGRITY_POLICY_DIMENSIONS);
  const normalizedEnabledDimensions = [...new Set(policy.enabledDimensions)];

  for (const dimension of normalizedEnabledDimensions) {
    if (!knownDimensions.includes(dimension)) {
      throw new Error(`integrity policy includes unknown dimension "${dimension}".`);
    }
  }

  let totalWeight = 0;
  for (const [dimension, weight] of Object.entries(policy.weights)) {
    if (!knownDimensions.includes(dimension)) {
      throw new Error(`integrity policy contains unknown weight dimension "${dimension}".`);
    }
    if (!normalizedEnabledDimensions.includes(dimension)) {
      throw new Error(`integrity policy contains weight for disabled dimension "${dimension}".`);
    }
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight < 0) {
      throw new Error(`integrity policy weight for "${dimension}" must be a non-negative finite number.`);
    }
    totalWeight += weight;
  }

  for (const dimension of normalizedEnabledDimensions) {
    if (!(dimension in policy.weights)) {
      throw new Error(`integrity policy is missing weight for enabled dimension "${dimension}".`);
    }
    const scoreContract = policy.scores[dimension];
    if (!isPlainObject(scoreContract)) {
      throw new Error(`integrity policy is missing score contract for "${dimension}".`);
    }
    for (const status of ["PASS", "WARN"]) {
      if (typeof scoreContract[status] !== "number" || !Number.isFinite(scoreContract[status])) {
        throw new Error(`integrity policy score for "${dimension}" status "${status}" must be finite.`);
      }
      if (scoreContract[status] < 0 || scoreContract[status] > 1) {
        throw new Error(`integrity policy score for "${dimension}" status "${status}" must be between 0 and 1.`);
      }
    }
  }

  if (totalWeight <= 0) {
    throw new Error("integrity policy must have at least one positive weight.");
  }

  return deepFreeze({
    version: policy.version,
    enabledDimensions: normalizedEnabledDimensions,
    weights: Object.freeze({ ...policy.weights }),
    scores: Object.freeze(
      Object.fromEntries(
        Object.entries(policy.scores).map(([dimension, scoreContract]) => [
          dimension,
          Object.freeze({ PASS: scoreContract.PASS, WARN: scoreContract.WARN }),
        ])
      )
    ),
  });
}

function assertWorkoutExerciseList(currentWorkoutExercises) {
  if (!Array.isArray(currentWorkoutExercises) || currentWorkoutExercises.length === 0) {
    throw new Error("currentWorkoutExercises must be a non-empty array of exercise objects.");
  }

  currentWorkoutExercises.forEach((exercise, index) => {
    assertExerciseLike(exercise, `currentWorkoutExercises[${index}]`);
  });
}

function assertRankedCandidateEntries(rankedCandidates) {
  if (!Array.isArray(rankedCandidates)) {
    throw new Error("rankedCandidates must be an array.");
  }

  const seenExerciseIds = new Set();

  rankedCandidates.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(`rankedCandidates[${index}] must be a plain object.`);
    }

    assertExerciseLike(entry.candidateExercise, `rankedCandidates[${index}].candidateExercise`);

    if (!isPlainObject(entry.rankedCandidateResult)) {
      throw new Error(`rankedCandidates[${index}].rankedCandidateResult must be a plain object.`);
    }

    const candidateExerciseId = entry.candidateExercise.exerciseId ?? entry.candidateExercise.id;
    if (entry.rankedCandidateResult.exerciseId !== candidateExerciseId) {
      throw new Error(
        `rankedCandidates[${index}] exerciseId mismatch between candidateExercise and rankedCandidateResult.`
      );
    }

    if (typeof entry.rankedCandidateResult.rank !== "number" || !Number.isInteger(entry.rankedCandidateResult.rank)) {
      throw new Error(`rankedCandidates[${index}] must include integer rank evidence.`);
    }

    if (!Array.isArray(entry.rankedCandidateResult.rankingBreakdown)) {
      throw new Error(`rankedCandidates[${index}] must include rankingBreakdown evidence.`);
    }

    if (!Array.isArray(entry.rankedCandidateResult.rankingReasons)) {
      throw new Error(`rankedCandidates[${index}] must include rankingReasons evidence.`);
    }

    if (!isPlainObject(entry.rankedCandidateResult.eligibilityEvidence)) {
      throw new Error(`rankedCandidates[${index}] must include eligibilityEvidence.`);
    }

    if (!isPlainObject(entry.rankedCandidateResult.similarityEvidence)) {
      throw new Error(`rankedCandidates[${index}] must include similarityEvidence.`);
    }

    if (seenExerciseIds.has(candidateExerciseId)) {
      throw new Error(`rankedCandidates contains duplicate candidate exerciseId ${candidateExerciseId}.`);
    }
    seenExerciseIds.add(candidateExerciseId);
  });
}

function buildRankingEvidence(rankedCandidateResult) {
  return deepFreeze({
    rankingStatus: rankedCandidateResult.rankingStatus,
    rankingScore: rankedCandidateResult.rankingScore,
    rank: rankedCandidateResult.rank,
    rankingBreakdown: cloneJson(rankedCandidateResult.rankingBreakdown),
    rankingReasons: cloneJson(rankedCandidateResult.rankingReasons),
    eligibilityEvidence: cloneJson(rankedCandidateResult.eligibilityEvidence),
    similarityEvidence: cloneJson(rankedCandidateResult.similarityEvidence),
  });
}

function buildExerciseListSummary(exercises, dimension, missingFacts) {
  return {
    dimension,
    missingFacts,
    affectedExerciseIds: exercises
      .filter((exercise) => missingFacts.some((fact) => !hasFactForDimension(exercise, dimension, fact)))
      .map((exercise) => exercise.exerciseId ?? exercise.id),
  };
}

function hasFactForDimension(exercise, dimension, fact) {
  if (dimension === WORKOUT_INTEGRITY_DIMENSIONS.MOVEMENT_PATTERN_REDUNDANCY) {
    return fact !== "dnaMovementPattern" || !!exercise.dnaMovementPattern;
  }
  if (dimension === WORKOUT_INTEGRITY_DIMENSIONS.EXERCISE_CLASS_CONCENTRATION) {
    return fact !== "complexity" || !!exercise.complexity;
  }
  if (dimension === WORKOUT_INTEGRITY_DIMENSIONS.PRIMARY_MUSCLE_REDUNDANCY) {
    return fact !== "primaryMuscles" || normalizeStringArray(exercise.primaryMuscles).length > 0;
  }
  return true;
}

function createDimension(dimension, status, score, reasons, evidence) {
  return deepFreeze({
    dimension,
    status,
    score: score === null ? null : roundScore(score),
    reasons: reasons.map((reason) => normalizeReason(reason)),
    evidence: evidence ?? null,
  });
}

function findSourceExerciseIndex(sourceExerciseId, currentWorkoutExercises) {
  const matchingIndexes = currentWorkoutExercises
    .map((exercise, index) => ((exercise.exerciseId ?? exercise.id) === sourceExerciseId ? index : -1))
    .filter((index) => index >= 0);

  if (matchingIndexes.length === 0) {
    throw new Error(`currentWorkoutExercises does not contain sourceExerciseId ${sourceExerciseId}.`);
  }

  if (matchingIndexes.length > 1) {
    throw new Error(
      `currentWorkoutExercises contains sourceExerciseId ${sourceExerciseId} multiple times; specify a unique occurrence before integrity evaluation.`
    );
  }

  return matchingIndexes[0];
}

function buildHypotheticalWorkout(sourceExerciseId, currentWorkoutExercises, candidateExercise) {
  const sourceIndex = findSourceExerciseIndex(sourceExerciseId, currentWorkoutExercises);
  const resultingWorkoutExercises = currentWorkoutExercises.map((exercise, index) =>
    index === sourceIndex ? cloneJson(candidateExercise) : cloneJson(exercise)
  );

  return {
    sourceIndex,
    resultingWorkoutExercises,
  };
}

function countBy(items) {
  const counts = {};
  for (const item of items) {
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return counts;
}

function evaluateExactDuplicateDimension(candidateExercise, resultingWorkoutExercises, sourceIndex) {
  const candidateExerciseId = candidateExercise.exerciseId ?? candidateExercise.id;
  const duplicateIndexes = resultingWorkoutExercises
    .map((exercise, index) => (((exercise.exerciseId ?? exercise.id) === candidateExerciseId && index !== sourceIndex) ? index : -1))
    .filter((index) => index >= 0);

  const isBlocked = duplicateIndexes.length > 0;

  return createDimension(
    WORKOUT_INTEGRITY_DIMENSIONS.EXACT_DUPLICATE,
    isBlocked ? WORKOUT_INTEGRITY_DIMENSION_STATUSES.BLOCK : WORKOUT_INTEGRITY_DIMENSION_STATUSES.PASS,
    null,
    [
      {
        code: WORKOUT_INTEGRITY_REASON_CODES.EXACT_DUPLICATE,
        data: {
          duplicateExerciseId: candidateExerciseId,
          duplicateIndexes,
        },
      },
    ],
    {
      duplicateExerciseId: candidateExerciseId,
      duplicateIndexes,
      resultingExerciseIds: resultingWorkoutExercises.map((exercise) => exercise.exerciseId ?? exercise.id),
    }
  );
}

function evaluateMovementPatternDimension(resultingWorkoutExercises, policy) {
  const missingExerciseIds = resultingWorkoutExercises
    .filter((exercise) => !exercise.dnaMovementPattern)
    .map((exercise) => exercise.exerciseId ?? exercise.id);

  if (missingExerciseIds.length > 0) {
    return createDimension(
      WORKOUT_INTEGRITY_DIMENSIONS.MOVEMENT_PATTERN_REDUNDANCY,
      WORKOUT_INTEGRITY_DIMENSION_STATUSES.UNAVAILABLE,
      null,
      [
        {
          code: WORKOUT_INTEGRITY_REASON_CODES.METADATA_UNAVAILABLE,
          data: {
            missingFacts: ["dnaMovementPattern"],
            missingExerciseIds,
          },
        },
      ],
      {
        counts: {},
        mostConcentratedPatterns: [],
      }
    );
  }

  const counts = countBy(resultingWorkoutExercises.map((exercise) => exercise.dnaMovementPattern));
  const maxCount = Math.max(...Object.values(counts));
  const mostConcentratedPatterns = Object.keys(counts).filter((pattern) => counts[pattern] === maxCount).sort();
  const status =
    maxCount <= 2 ? WORKOUT_INTEGRITY_DIMENSION_STATUSES.PASS : WORKOUT_INTEGRITY_DIMENSION_STATUSES.WARN;
  const score = policy.scores[WORKOUT_INTEGRITY_POLICY_DIMENSIONS.MOVEMENT_PATTERN_REDUNDANCY][status];

  return createDimension(
    WORKOUT_INTEGRITY_DIMENSIONS.MOVEMENT_PATTERN_REDUNDANCY,
    status,
    score,
    [
      {
        code:
          status === WORKOUT_INTEGRITY_DIMENSION_STATUSES.PASS
            ? WORKOUT_INTEGRITY_REASON_CODES.MOVEMENT_PATTERN_BALANCED
            : WORKOUT_INTEGRITY_REASON_CODES.MOVEMENT_PATTERN_CONCENTRATED,
        data: {
          mostConcentratedPatterns,
          highestPatternCount: maxCount,
          counts,
        },
      },
    ],
    {
      counts,
      mostConcentratedPatterns,
      highestPatternCount: maxCount,
    }
  );
}

function evaluateExerciseClassDimension(resultingWorkoutExercises, policy) {
  const missingExerciseIds = resultingWorkoutExercises
    .filter((exercise) => !exercise.complexity)
    .map((exercise) => exercise.exerciseId ?? exercise.id);

  if (missingExerciseIds.length > 0) {
    return createDimension(
      WORKOUT_INTEGRITY_DIMENSIONS.EXERCISE_CLASS_CONCENTRATION,
      WORKOUT_INTEGRITY_DIMENSION_STATUSES.UNAVAILABLE,
      null,
      [
        {
          code: WORKOUT_INTEGRITY_REASON_CODES.METADATA_UNAVAILABLE,
          data: {
            missingFacts: ["complexity"],
            missingExerciseIds,
          },
        },
      ],
      {
        counts: {},
        workoutSize: resultingWorkoutExercises.length,
      }
    );
  }

  const counts = countBy(resultingWorkoutExercises.map((exercise) => exercise.complexity));
  const workoutSize = resultingWorkoutExercises.length;
  const status =
    workoutSize >= 4 && Object.keys(counts).length === 1
      ? WORKOUT_INTEGRITY_DIMENSION_STATUSES.WARN
      : WORKOUT_INTEGRITY_DIMENSION_STATUSES.PASS;
  const score = policy.scores[WORKOUT_INTEGRITY_POLICY_DIMENSIONS.EXERCISE_CLASS_CONCENTRATION][status];

  return createDimension(
    WORKOUT_INTEGRITY_DIMENSIONS.EXERCISE_CLASS_CONCENTRATION,
    status,
    score,
    [
      {
        code:
          status === WORKOUT_INTEGRITY_DIMENSION_STATUSES.PASS
            ? WORKOUT_INTEGRITY_REASON_CODES.EXERCISE_CLASS_BALANCED
            : WORKOUT_INTEGRITY_REASON_CODES.EXERCISE_CLASS_CONCENTRATION,
        data: {
          counts,
          workoutSize,
        },
      },
    ],
    {
      counts,
      workoutSize,
    }
  );
}

function evaluatePrimaryMuscleDimension(resultingWorkoutExercises, policy) {
  const missingExerciseIds = resultingWorkoutExercises
    .filter((exercise) => normalizeStringArray(exercise.primaryMuscles).length === 0)
    .map((exercise) => exercise.exerciseId ?? exercise.id);

  if (missingExerciseIds.length > 0) {
    return createDimension(
      WORKOUT_INTEGRITY_DIMENSIONS.PRIMARY_MUSCLE_REDUNDANCY,
      WORKOUT_INTEGRITY_DIMENSION_STATUSES.UNAVAILABLE,
      null,
      [
        {
          code: WORKOUT_INTEGRITY_REASON_CODES.METADATA_UNAVAILABLE,
          data: {
            missingFacts: ["primaryMuscles"],
            missingExerciseIds,
          },
        },
      ],
      {
        counts: {},
        concentratedPrimaryMuscles: [],
      }
    );
  }

  const allPrimaryMuscles = resultingWorkoutExercises.flatMap((exercise) => normalizeStringArray(exercise.primaryMuscles));
  const counts = countBy(allPrimaryMuscles);
  const highestCount = Math.max(...Object.values(counts));
  const concentratedPrimaryMuscles = Object.keys(counts).filter((muscle) => counts[muscle] >= 3).sort();
  const status =
    highestCount >= 3 ? WORKOUT_INTEGRITY_DIMENSION_STATUSES.WARN : WORKOUT_INTEGRITY_DIMENSION_STATUSES.PASS;
  const score = policy.scores[WORKOUT_INTEGRITY_POLICY_DIMENSIONS.PRIMARY_MUSCLE_REDUNDANCY][status];

  return createDimension(
    WORKOUT_INTEGRITY_DIMENSIONS.PRIMARY_MUSCLE_REDUNDANCY,
    status,
    score,
    [
      {
        code:
          status === WORKOUT_INTEGRITY_DIMENSION_STATUSES.PASS
            ? WORKOUT_INTEGRITY_REASON_CODES.PRIMARY_MUSCLE_BALANCED
            : WORKOUT_INTEGRITY_REASON_CODES.PRIMARY_MUSCLE_CONCENTRATION,
        data: {
          counts,
          concentratedPrimaryMuscles,
        },
      },
    ],
    {
      counts,
      concentratedPrimaryMuscles,
      highestCount,
    }
  );
}

function buildResultingWorkoutSummary(resultingWorkoutExercises, breakdown) {
  const movementPatternDimension = breakdown.find(
    (dimension) => dimension.dimension === WORKOUT_INTEGRITY_DIMENSIONS.MOVEMENT_PATTERN_REDUNDANCY
  );
  const exerciseClassDimension = breakdown.find(
    (dimension) => dimension.dimension === WORKOUT_INTEGRITY_DIMENSIONS.EXERCISE_CLASS_CONCENTRATION
  );
  const primaryMuscleDimension = breakdown.find(
    (dimension) => dimension.dimension === WORKOUT_INTEGRITY_DIMENSIONS.PRIMARY_MUSCLE_REDUNDANCY
  );

  return deepFreeze({
    totalExercises: resultingWorkoutExercises.length,
    exerciseIds: resultingWorkoutExercises.map((exercise) => exercise.exerciseId ?? exercise.id),
    movementPatternCounts: movementPatternDimension?.evidence?.counts ?? {},
    exerciseClassCounts: exerciseClassDimension?.evidence?.counts ?? {},
    primaryMuscleCounts: primaryMuscleDimension?.evidence?.counts ?? {},
    unavailableDimensions: breakdown
      .filter((dimension) => dimension.status === WORKOUT_INTEGRITY_DIMENSION_STATUSES.UNAVAILABLE)
      .map((dimension) => dimension.dimension),
  });
}

function evaluateCandidateIntegrity(sourceExerciseId, currentWorkoutExercises, candidateEntry, policy) {
  const { sourceIndex, resultingWorkoutExercises } = buildHypotheticalWorkout(
    sourceExerciseId,
    currentWorkoutExercises,
    candidateEntry.candidateExercise
  );

  const exactDuplicateDimension = evaluateExactDuplicateDimension(
    candidateEntry.candidateExercise,
    resultingWorkoutExercises,
    sourceIndex
  );
  const movementPatternDimension = evaluateMovementPatternDimension(resultingWorkoutExercises, policy);
  const exerciseClassDimension = evaluateExerciseClassDimension(resultingWorkoutExercises, policy);
  const primaryMuscleDimension = evaluatePrimaryMuscleDimension(resultingWorkoutExercises, policy);

  const breakdown = deepFreeze([
    exactDuplicateDimension,
    movementPatternDimension,
    exerciseClassDimension,
    primaryMuscleDimension,
  ]);

  const duplicateBlocked = exactDuplicateDimension.status === WORKOUT_INTEGRITY_DIMENSION_STATUSES.BLOCK;
  const nonDuplicateDimensions = breakdown.filter(
    (dimension) => dimension.dimension !== WORKOUT_INTEGRITY_DIMENSIONS.EXACT_DUPLICATE
  );
  const availableDimensions = nonDuplicateDimensions.filter(
    (dimension) =>
      dimension.status === WORKOUT_INTEGRITY_DIMENSION_STATUSES.PASS ||
      dimension.status === WORKOUT_INTEGRITY_DIMENSION_STATUSES.WARN
  );

  let integrityStatus;
  let integrityScore = null;
  const integrityReasons = breakdown.flatMap((dimension) => dimension.reasons);

  if (duplicateBlocked) {
    integrityStatus = WORKOUT_INTEGRITY_STATUSES.BLOCK;
  } else if (availableDimensions.length === 0) {
    integrityStatus = WORKOUT_INTEGRITY_STATUSES.WARN;
    integrityReasons.push(
      normalizeReason({
        code: WORKOUT_INTEGRITY_REASON_CODES.INSUFFICIENT_METADATA,
        data: {
          unavailableDimensions: nonDuplicateDimensions
            .filter((dimension) => dimension.status === WORKOUT_INTEGRITY_DIMENSION_STATUSES.UNAVAILABLE)
            .map((dimension) => dimension.dimension),
        },
      })
    );
  } else {
    const numerator = availableDimensions.reduce(
      (sum, dimension) => sum + dimension.score * policy.weights[dimension.dimension],
      0
    );
    const denominator = availableDimensions.reduce((sum, dimension) => sum + policy.weights[dimension.dimension], 0);
    integrityScore = roundScore(numerator / denominator);
    integrityStatus = availableDimensions.some((dimension) => dimension.status === WORKOUT_INTEGRITY_DIMENSION_STATUSES.WARN)
      ? WORKOUT_INTEGRITY_STATUSES.WARN
      : WORKOUT_INTEGRITY_STATUSES.PASS;
  }

  return deepFreeze({
    exerciseId: candidateEntry.rankedCandidateResult.exerciseId,
    integrityStatus,
    integrityScore,
    integrityBreakdown: breakdown,
    integrityReasons,
    rankingEvidence: buildRankingEvidence(candidateEntry.rankedCandidateResult),
    resultingWorkoutSummary: buildResultingWorkoutSummary(resultingWorkoutExercises, breakdown),
  });
}

export function evaluateWorkoutIntegrityV1(
  sourceExerciseId,
  currentWorkoutExercises,
  rankedCandidates,
  { policy = DEFAULT_WORKOUT_INTEGRITY_POLICY_V1 } = {}
) {
  if (!Number.isInteger(sourceExerciseId) || sourceExerciseId <= 0) {
    throw new Error("sourceExerciseId must be a positive integer.");
  }

  assertWorkoutExerciseList(currentWorkoutExercises);
  assertRankedCandidateEntries(rankedCandidates);
  const validatedPolicy = validateIntegrityPolicy(policy);

  const evaluations = rankedCandidates.map((candidateEntry) =>
    evaluateCandidateIntegrity(sourceExerciseId, currentWorkoutExercises, candidateEntry, validatedPolicy)
  );

  return deepFreeze({
    version: WORKOUT_INTEGRITY_ENGINE_V1_VERSION,
    policyVersion: validatedPolicy.version,
    sourceExerciseId,
    totalEvaluated: evaluations.length,
    evaluations,
  });
}

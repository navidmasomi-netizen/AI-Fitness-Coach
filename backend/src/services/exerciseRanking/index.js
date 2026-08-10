export const REPLACEMENT_RANKING_ENGINE_V1_VERSION = "replacement-ranking-v1";
export const REPLACEMENT_RANKING_POLICY_V1_VERSION = "replacement-ranking-v1";
export const REPLACEMENT_RANKING_SCORE_PRECISION_DECIMALS = 4;

export const RANKING_RESULT_STATUSES = Object.freeze({
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
});

export const RANKING_POLICY_DIMENSIONS = Object.freeze({
  MUSCLE_PRESERVATION: "musclePreservation",
  EQUIPMENT_PRESERVATION: "equipmentPreservation",
  DEMAND_PRESERVATION: "demandPreservation",
});

export const RANKING_REASON_CODES = Object.freeze({
  MUSCLE_FULL_PRIMARY_PRESERVATION: "RANKING_MUSCLE_FULL_PRIMARY_PRESERVATION",
  MUSCLE_PARTIAL_PRIMARY_PRESERVATION: "RANKING_MUSCLE_PARTIAL_PRIMARY_PRESERVATION",
  MUSCLE_SECONDARY_PRESERVATION: "RANKING_MUSCLE_SECONDARY_PRESERVATION",
  MUSCLE_SOURCE_MUSCLE_MISSING: "RANKING_MUSCLE_SOURCE_MUSCLE_MISSING",
  MUSCLE_METADATA_UNAVAILABLE: "RANKING_MUSCLE_METADATA_UNAVAILABLE",
  EQUIPMENT_SOURCE_SETUP_PRESERVED: "RANKING_EQUIPMENT_SOURCE_SETUP_PRESERVED",
  EQUIPMENT_SOURCE_SETUP_PARTIAL: "RANKING_EQUIPMENT_SOURCE_SETUP_PARTIAL",
  EQUIPMENT_SOURCE_SETUP_NOT_PRESERVED: "RANKING_EQUIPMENT_SOURCE_SETUP_NOT_PRESERVED",
  EQUIPMENT_METADATA_UNAVAILABLE: "RANKING_EQUIPMENT_METADATA_UNAVAILABLE",
  DEMAND_PRESERVED: "RANKING_DEMAND_PRESERVED",
  DEMAND_CHANGED: "RANKING_DEMAND_CHANGED",
  DEMAND_METADATA_UNAVAILABLE: "RANKING_DEMAND_METADATA_UNAVAILABLE",
  NO_AVAILABLE_DIMENSIONS: "RANKING_NO_AVAILABLE_DIMENSIONS",
  TIE_BROKEN_BY_EXERCISE_ID: "RANKING_TIE_BROKEN_BY_EXERCISE_ID",
});

export const RANKING_MUSCLE_SOURCE_PRIMARY_WEIGHT = 1.0;
export const RANKING_MUSCLE_SOURCE_SECONDARY_WEIGHT = 0.5;
export const RANKING_MUSCLE_PRIMARY_TO_PRIMARY_CREDIT = 1.0;
export const RANKING_MUSCLE_PRIMARY_TO_SECONDARY_CREDIT = 0.5;
export const RANKING_MUSCLE_SECONDARY_TO_PRIMARY_CREDIT = 1.0;
export const RANKING_MUSCLE_SECONDARY_TO_SECONDARY_CREDIT = 1.0;

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

export const DEFAULT_REPLACEMENT_RANKING_POLICY_V1 = Object.freeze({
  version: REPLACEMENT_RANKING_POLICY_V1_VERSION,
  enabledDimensions: Object.freeze([
    RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION,
    RANKING_POLICY_DIMENSIONS.EQUIPMENT_PRESERVATION,
    RANKING_POLICY_DIMENSIONS.DEMAND_PRESERVATION,
  ]),
  weights: Object.freeze({
    [RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION]: 0.5,
    [RANKING_POLICY_DIMENSIONS.EQUIPMENT_PRESERVATION]: 0.25,
    [RANKING_POLICY_DIMENSIONS.DEMAND_PRESERVATION]: 0.25,
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
  return Number(value.toFixed(REPLACEMENT_RANKING_SCORE_PRECISION_DECIMALS));
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

function normalizeBreakdownDimension(dimensionResult, policy) {
  if (!isPlainObject(dimensionResult)) {
    throw new Error("ranking breakdown entries must be plain objects.");
  }

  if (!policy.enabledDimensions.includes(dimensionResult.dimension)) {
    throw new Error(`Unknown ranking breakdown dimension "${dimensionResult.dimension}".`);
  }

  if (
    dimensionResult.status !== RANKING_RESULT_STATUSES.AVAILABLE &&
    dimensionResult.status !== RANKING_RESULT_STATUSES.UNAVAILABLE
  ) {
    throw new Error("ranking breakdown dimension status must be AVAILABLE or UNAVAILABLE.");
  }

  if (dimensionResult.status === RANKING_RESULT_STATUSES.AVAILABLE) {
    if (typeof dimensionResult.score !== "number" || !Number.isFinite(dimensionResult.score)) {
      throw new Error("ranking breakdown dimension score must be a finite number when available.");
    }
    if (dimensionResult.score < 0 || dimensionResult.score > 1) {
      throw new Error("ranking breakdown dimension score must be between 0 and 1.");
    }
  } else if (dimensionResult.score !== null) {
    throw new Error("ranking breakdown dimension score must be null when unavailable.");
  }

  if (!Array.isArray(dimensionResult.reasons) || dimensionResult.reasons.length === 0) {
    throw new Error("ranking breakdown dimension reasons must be a non-empty array.");
  }

  return deepFreeze({
    dimension: dimensionResult.dimension,
    status: dimensionResult.status,
    score:
      dimensionResult.status === RANKING_RESULT_STATUSES.AVAILABLE ? roundScore(dimensionResult.score) : null,
    reasons: dimensionResult.reasons.map((reason) => normalizeReason(reason)),
    evidence: dimensionResult.evidence ?? null,
  });
}

function validateRankingEvaluationResult(result, policy) {
  if (!isPlainObject(result)) {
    throw new Error("ranking evaluation result must be a plain object.");
  }

  if (result.status !== RANKING_RESULT_STATUSES.AVAILABLE && result.status !== RANKING_RESULT_STATUSES.UNAVAILABLE) {
    throw new Error("ranking evaluation result status must be AVAILABLE or UNAVAILABLE.");
  }

  if (result.status === RANKING_RESULT_STATUSES.AVAILABLE) {
    if (typeof result.score !== "number" || !Number.isFinite(result.score)) {
      throw new Error("ranking evaluation result score must be a finite number when available.");
    }
    if (result.score < 0 || result.score > 1) {
      throw new Error("ranking evaluation result score must be between 0 and 1.");
    }
  } else if (result.score !== null) {
    throw new Error("ranking evaluation result score must be null when unavailable.");
  }

  if (!Array.isArray(result.breakdown) || result.breakdown.length === 0) {
    throw new Error("ranking evaluation result breakdown must be a non-empty array.");
  }

  if (!Array.isArray(result.reasons) || result.reasons.length === 0) {
    throw new Error("ranking evaluation result reasons must be a non-empty array.");
  }

  return deepFreeze({
    status: result.status,
    score: result.status === RANKING_RESULT_STATUSES.AVAILABLE ? roundScore(result.score) : null,
    breakdown: result.breakdown.map((dimension) => normalizeBreakdownDimension(dimension, policy)),
    reasons: result.reasons.map((reason) => normalizeReason(reason)),
  });
}

function validateEligibleCandidateEntry(entry, index) {
  if (!isPlainObject(entry)) {
    throw new Error(`eligibleCandidates[${index}] must be a plain object.`);
  }

  assertExerciseLike(entry.candidateExercise, `eligibleCandidates[${index}].candidateExercise`);

  if (!isPlainObject(entry.candidateResult)) {
    throw new Error(`eligibleCandidates[${index}].candidateResult must be a plain object.`);
  }

  const candidateExerciseId = entry.candidateExercise.exerciseId ?? entry.candidateExercise.id;
  if (entry.candidateResult.exerciseId !== candidateExerciseId) {
    throw new Error(
      `eligibleCandidates[${index}] exerciseId mismatch between candidateExercise and candidateResult.`
    );
  }

  if (entry.candidateResult.eligibility !== true) {
    throw new Error(`eligibleCandidates[${index}] must already be marked eligible.`);
  }

  if (!Array.isArray(entry.candidateResult.blockedRules) || entry.candidateResult.blockedRules.length > 0) {
    throw new Error(`eligibleCandidates[${index}] must not contain blocked rules.`);
  }

  if (!Array.isArray(entry.candidateResult.passedRules) || entry.candidateResult.passedRules.length === 0) {
    throw new Error(`eligibleCandidates[${index}] must contain passed rule evidence.`);
  }

  if (!Array.isArray(entry.candidateResult.reasons)) {
    throw new Error(`eligibleCandidates[${index}] must contain eligibility reasons.`);
  }

  if (!Array.isArray(entry.candidateResult.similarityBreakdown)) {
    throw new Error(`eligibleCandidates[${index}] must contain similarity breakdown evidence.`);
  }

  if (entry.candidateResult.similarityStatus !== RANKING_RESULT_STATUSES.AVAILABLE) {
    throw new Error(`eligibleCandidates[${index}] must have AVAILABLE similarity status.`);
  }

  if (typeof entry.candidateResult.similarityScore !== "number" || !Number.isFinite(entry.candidateResult.similarityScore)) {
    throw new Error(`eligibleCandidates[${index}] must have a finite similarity score.`);
  }

  return candidateExerciseId;
}

function assertEligibleCandidateEntries(eligibleCandidates) {
  if (!Array.isArray(eligibleCandidates)) {
    throw new Error("eligibleCandidates must be an array.");
  }

  const seenExerciseIds = new Set();

  eligibleCandidates.forEach((entry, index) => {
    const candidateExerciseId = validateEligibleCandidateEntry(entry, index);
    if (seenExerciseIds.has(candidateExerciseId)) {
      throw new Error(`eligibleCandidates contains duplicate candidate exerciseId ${candidateExerciseId}.`);
    }
    seenExerciseIds.add(candidateExerciseId);
  });
}

export function validateReplacementRankingPolicy(policy) {
  if (!isPlainObject(policy)) {
    throw new Error("ranking policy must be a plain object.");
  }

  if (typeof policy.version !== "string" || policy.version.length === 0) {
    throw new Error("ranking policy version must be a non-empty string.");
  }

  if (!Array.isArray(policy.enabledDimensions) || policy.enabledDimensions.length === 0) {
    throw new Error("ranking policy enabledDimensions must be a non-empty array.");
  }

  if (!isPlainObject(policy.weights)) {
    throw new Error("ranking policy weights must be a plain object.");
  }

  const knownDimensions = Object.values(RANKING_POLICY_DIMENSIONS);
  const normalizedEnabledDimensions = [...new Set(policy.enabledDimensions)];

  for (const dimension of normalizedEnabledDimensions) {
    if (!knownDimensions.includes(dimension)) {
      throw new Error(`ranking policy includes unknown dimension "${dimension}".`);
    }
  }

  let totalWeight = 0;
  for (const [dimension, weight] of Object.entries(policy.weights)) {
    if (!knownDimensions.includes(dimension)) {
      throw new Error(`ranking policy contains unknown weight dimension "${dimension}".`);
    }
    if (!normalizedEnabledDimensions.includes(dimension)) {
      throw new Error(`ranking policy contains weight for disabled dimension "${dimension}".`);
    }
    if (typeof weight !== "number" || !Number.isFinite(weight)) {
      throw new Error(`ranking policy weight for "${dimension}" must be finite.`);
    }
    if (weight < 0) {
      throw new Error(`ranking policy weight for "${dimension}" must not be negative.`);
    }
    totalWeight += weight;
  }

  for (const dimension of normalizedEnabledDimensions) {
    if (!(dimension in policy.weights)) {
      throw new Error(`ranking policy is missing weight for enabled dimension "${dimension}".`);
    }
  }

  if (totalWeight <= 0) {
    throw new Error("ranking policy must have at least one positive weight.");
  }

  return deepFreeze({
    version: policy.version,
    enabledDimensions: normalizedEnabledDimensions,
    weights: Object.freeze({ ...policy.weights }),
  });
}

function buildRankingInput(sourceExercise, candidateEntry, policy) {
  return deepFreeze({
    sourceExercise: cloneJson(sourceExercise),
    candidateExercise: cloneJson(candidateEntry.candidateExercise),
    candidateResult: cloneJson(candidateEntry.candidateResult),
    policy,
  });
}

function buildEligibilityEvidence(candidateResult) {
  return deepFreeze({
    eligibility: candidateResult.eligibility,
    passedRules: [...candidateResult.passedRules],
    blockedRules: [...candidateResult.blockedRules],
    reasons: cloneJson(candidateResult.reasons),
  });
}

function buildSimilarityEvidence(candidateResult) {
  return deepFreeze({
    similarityScore: candidateResult.similarityScore,
    similarityStatus: candidateResult.similarityStatus,
    similarityBreakdown: cloneJson(candidateResult.similarityBreakdown),
  });
}

function compareRankedCandidates(left, right) {
  if (left.rankingStatus !== right.rankingStatus) {
    return left.rankingStatus === RANKING_RESULT_STATUSES.AVAILABLE ? -1 : 1;
  }

  if (left.rankingStatus === RANKING_RESULT_STATUSES.AVAILABLE && left.rankingScore !== right.rankingScore) {
    return right.rankingScore - left.rankingScore;
  }

  return left.exerciseId - right.exerciseId;
}

function appendTieBreakReasons(rankedCandidates) {
  const updatedCandidates = rankedCandidates.map((candidate) => ({
    ...candidate,
    rankingReasons: [...candidate.rankingReasons],
  }));

  let index = 0;
  while (index < updatedCandidates.length) {
    let groupEnd = index + 1;
    while (
      groupEnd < updatedCandidates.length &&
      updatedCandidates[groupEnd].rankingStatus === updatedCandidates[index].rankingStatus &&
      updatedCandidates[groupEnd].rankingScore === updatedCandidates[index].rankingScore
    ) {
      groupEnd += 1;
    }

    if (groupEnd - index > 1) {
      for (let groupIndex = index; groupIndex < groupEnd; groupIndex += 1) {
        updatedCandidates[groupIndex].rankingReasons.push(
          deepFreeze({
            code: RANKING_REASON_CODES.TIE_BROKEN_BY_EXERCISE_ID,
            data: { exerciseId: updatedCandidates[groupIndex].exerciseId },
          })
        );
      }
    }

    index = groupEnd;
  }

  return updatedCandidates.map((candidate) =>
    deepFreeze({
      ...candidate,
      rankingReasons: candidate.rankingReasons,
    })
  );
}

function buildRoleWeightMap(exercise) {
  const weights = new Map();

  for (const muscle of normalizeStringArray(exercise.primaryMuscles)) {
    weights.set(muscle, RANKING_MUSCLE_SOURCE_PRIMARY_WEIGHT);
  }

  for (const muscle of normalizeStringArray(exercise.secondaryMuscles)) {
    if (!weights.has(muscle)) {
      weights.set(muscle, RANKING_MUSCLE_SOURCE_SECONDARY_WEIGHT);
    }
  }

  return weights;
}

function buildRoleSet(exercise, fieldName) {
  return new Set(normalizeStringArray(exercise[fieldName]));
}

function createAvailableDimension(dimension, score, reasons, evidence) {
  return deepFreeze({
    dimension,
    status: RANKING_RESULT_STATUSES.AVAILABLE,
    score: roundScore(score),
    reasons: reasons.map((reason) => normalizeReason(reason)),
    evidence: evidence ?? null,
  });
}

function createUnavailableDimension(dimension, reasons, evidence) {
  return deepFreeze({
    dimension,
    status: RANKING_RESULT_STATUSES.UNAVAILABLE,
    score: null,
    reasons: reasons.map((reason) => normalizeReason(reason)),
    evidence: evidence ?? null,
  });
}

function evaluateMusclePreservation(sourceExercise, candidateExercise) {
  const sourceWeights = buildRoleWeightMap(sourceExercise);
  const candidatePrimary = buildRoleSet(candidateExercise, "primaryMuscles");
  const candidateSecondary = buildRoleSet(candidateExercise, "secondaryMuscles");

  if (sourceWeights.size === 0) {
    return createUnavailableDimension(
      RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION,
      [
        {
          code: RANKING_REASON_CODES.MUSCLE_METADATA_UNAVAILABLE,
          data: {
            missingOn: ["source"],
            missingFacts: ["primaryMuscles", "secondaryMuscles"],
          },
        },
      ],
      {
        sourcePrimary: normalizeStringArray(sourceExercise.primaryMuscles),
        sourceSecondary: normalizeStringArray(sourceExercise.secondaryMuscles),
        candidatePrimary: normalizeStringArray(candidateExercise.primaryMuscles),
        candidateSecondary: normalizeStringArray(candidateExercise.secondaryMuscles),
      }
    );
  }

  if (candidatePrimary.size === 0 && candidateSecondary.size === 0) {
    return createUnavailableDimension(
      RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION,
      [
        {
          code: RANKING_REASON_CODES.MUSCLE_METADATA_UNAVAILABLE,
          data: {
            missingOn: ["candidate"],
            missingFacts: ["primaryMuscles", "secondaryMuscles"],
          },
        },
      ],
      {
        sourcePrimary: normalizeStringArray(sourceExercise.primaryMuscles),
        sourceSecondary: normalizeStringArray(sourceExercise.secondaryMuscles),
        candidatePrimary: normalizeStringArray(candidateExercise.primaryMuscles),
        candidateSecondary: normalizeStringArray(candidateExercise.secondaryMuscles),
      }
    );
  }

  let totalWeight = 0;
  let preservedWeight = 0;

  const fullPrimary = [];
  const partialPrimary = [];
  const preservedSecondary = [];
  const missingSourceMuscles = [];

  const sourcePrimary = buildRoleSet(sourceExercise, "primaryMuscles");
  const sourceSecondary = buildRoleSet(sourceExercise, "secondaryMuscles");

  for (const [muscle, baseWeight] of sourceWeights.entries()) {
    totalWeight += baseWeight;

    if (sourcePrimary.has(muscle)) {
      if (candidatePrimary.has(muscle)) {
        preservedWeight += baseWeight * RANKING_MUSCLE_PRIMARY_TO_PRIMARY_CREDIT;
        fullPrimary.push(muscle);
      } else if (candidateSecondary.has(muscle)) {
        preservedWeight += baseWeight * RANKING_MUSCLE_PRIMARY_TO_SECONDARY_CREDIT;
        partialPrimary.push(muscle);
      } else {
        missingSourceMuscles.push(muscle);
      }
      continue;
    }

    if (sourceSecondary.has(muscle) && (candidatePrimary.has(muscle) || candidateSecondary.has(muscle))) {
      preservedWeight +=
        baseWeight *
        (candidatePrimary.has(muscle)
          ? RANKING_MUSCLE_SECONDARY_TO_PRIMARY_CREDIT
          : RANKING_MUSCLE_SECONDARY_TO_SECONDARY_CREDIT);
      preservedSecondary.push(muscle);
    } else {
      missingSourceMuscles.push(muscle);
    }
  }

  const reasons = [];
  if (fullPrimary.length > 0) {
    reasons.push({
      code: RANKING_REASON_CODES.MUSCLE_FULL_PRIMARY_PRESERVATION,
      data: { muscles: fullPrimary },
    });
  }
  if (partialPrimary.length > 0) {
    reasons.push({
      code: RANKING_REASON_CODES.MUSCLE_PARTIAL_PRIMARY_PRESERVATION,
      data: { muscles: partialPrimary },
    });
  }
  if (preservedSecondary.length > 0) {
    reasons.push({
      code: RANKING_REASON_CODES.MUSCLE_SECONDARY_PRESERVATION,
      data: { muscles: preservedSecondary },
    });
  }
  if (missingSourceMuscles.length > 0) {
    reasons.push({
      code: RANKING_REASON_CODES.MUSCLE_SOURCE_MUSCLE_MISSING,
      data: { muscles: missingSourceMuscles },
    });
  }

  return createAvailableDimension(
    RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION,
    totalWeight === 0 ? 0 : preservedWeight / totalWeight,
    reasons,
    {
      sourcePrimary: [...sourcePrimary].sort(),
      sourceSecondary: [...sourceSecondary].sort(),
      candidatePrimary: [...candidatePrimary].sort(),
      candidateSecondary: [...candidateSecondary].sort(),
      preservedWeight,
      totalWeight,
      fullPrimary,
      partialPrimary,
      preservedSecondary,
      missingSourceMuscles,
    }
  );
}

function evaluateEquipmentPreservation(sourceExercise, candidateExercise) {
  const sourceRequired = normalizeStringArray(sourceExercise.requiredEquipment);
  const candidateRequired = normalizeStringArray(candidateExercise.requiredEquipment);

  if (sourceRequired.length === 0 || candidateRequired.length === 0) {
    return createUnavailableDimension(
      RANKING_POLICY_DIMENSIONS.EQUIPMENT_PRESERVATION,
      [
        {
          code: RANKING_REASON_CODES.EQUIPMENT_METADATA_UNAVAILABLE,
          data: {
            missingOn: [
              ...(sourceRequired.length === 0 ? ["source"] : []),
              ...(candidateRequired.length === 0 ? ["candidate"] : []),
            ],
            missingFacts: ["requiredEquipment"],
          },
        },
      ],
      {
        sourceRequired,
        candidateRequired,
      }
    );
  }

  const candidateSet = new Set(candidateRequired);
  const shared = sourceRequired.filter((item) => candidateSet.has(item));
  const missingFromCandidate = sourceRequired.filter((item) => !candidateSet.has(item));
  const score = shared.length / sourceRequired.length;

  let code = RANKING_REASON_CODES.EQUIPMENT_SOURCE_SETUP_NOT_PRESERVED;
  if (score === 1) {
    code = RANKING_REASON_CODES.EQUIPMENT_SOURCE_SETUP_PRESERVED;
  } else if (score > 0) {
    code = RANKING_REASON_CODES.EQUIPMENT_SOURCE_SETUP_PARTIAL;
  }

  return createAvailableDimension(
    RANKING_POLICY_DIMENSIONS.EQUIPMENT_PRESERVATION,
    score,
    [
      {
        code,
        data: {
          shared,
          missingFromCandidate,
          sourceRequired,
        },
      },
    ],
    {
      sourceRequired,
      candidateRequired,
      shared,
      missingFromCandidate,
      preservedCount: shared.length,
      sourceRequiredCount: sourceRequired.length,
    }
  );
}

function computeOrdinalPreservation(valueA, valueB, orderMap) {
  if (!valueA || !valueB) {
    return null;
  }

  const distance = Math.abs(orderMap[valueA] - orderMap[valueB]);
  const maxDistance = Math.max(...Object.values(orderMap));
  return 1 - distance / maxDistance;
}

function evaluateDemandPreservation(sourceExercise, candidateExercise) {
  const stabilityScore = computeOrdinalPreservation(
    sourceExercise.stabilityDemand ?? null,
    candidateExercise.stabilityDemand ?? null,
    STABILITY_DEMAND_ORDER
  );

  const axialScore = computeOrdinalPreservation(
    sourceExercise.axialLoading ?? null,
    candidateExercise.axialLoading ?? null,
    AXIAL_LOADING_ORDER
  );

  if (stabilityScore === null && axialScore === null) {
    return createUnavailableDimension(
      RANKING_POLICY_DIMENSIONS.DEMAND_PRESERVATION,
      [
        {
          code: RANKING_REASON_CODES.DEMAND_METADATA_UNAVAILABLE,
          data: {
            missingFacts: ["stabilityDemand", "axialLoading"],
          },
        },
      ],
      {
        stability: {
          source: sourceExercise.stabilityDemand ?? null,
          candidate: candidateExercise.stabilityDemand ?? null,
          score: null,
        },
        axialLoading: {
          source: sourceExercise.axialLoading ?? null,
          candidate: candidateExercise.axialLoading ?? null,
          score: null,
        },
      }
    );
  }

  const availableScores = [stabilityScore, axialScore].filter((value) => value !== null);
  const score = availableScores.reduce((sum, value) => sum + value, 0) / availableScores.length;

  return createAvailableDimension(
    RANKING_POLICY_DIMENSIONS.DEMAND_PRESERVATION,
    score,
    [
      {
        code: score === 1 ? RANKING_REASON_CODES.DEMAND_PRESERVED : RANKING_REASON_CODES.DEMAND_CHANGED,
        data: {
          stabilityScore: stabilityScore === null ? null : roundScore(stabilityScore),
          axialLoadingScore: axialScore === null ? null : roundScore(axialScore),
        },
      },
    ],
    {
      stability: {
        source: sourceExercise.stabilityDemand ?? null,
        candidate: candidateExercise.stabilityDemand ?? null,
        score: stabilityScore === null ? null : roundScore(stabilityScore),
      },
      axialLoading: {
        source: sourceExercise.axialLoading ?? null,
        candidate: candidateExercise.axialLoading ?? null,
        score: axialScore === null ? null : roundScore(axialScore),
      },
    }
  );
}

export function evaluateReplacementRankingV1({ sourceExercise, candidateExercise, candidateResult, policy }) {
  const validatedPolicy = validateReplacementRankingPolicy(policy);

  const allDimensions = [
    evaluateMusclePreservation(sourceExercise, candidateExercise),
    evaluateEquipmentPreservation(sourceExercise, candidateExercise),
    evaluateDemandPreservation(sourceExercise, candidateExercise),
  ];
  const breakdown = allDimensions.filter((dimension) => validatedPolicy.enabledDimensions.includes(dimension.dimension));

  const availableDimensions = breakdown.filter((dimension) => dimension.status === RANKING_RESULT_STATUSES.AVAILABLE);

  if (availableDimensions.length === 0) {
    return deepFreeze({
      status: RANKING_RESULT_STATUSES.UNAVAILABLE,
      score: null,
      breakdown,
      reasons: [
        normalizeReason({
          code: RANKING_REASON_CODES.NO_AVAILABLE_DIMENSIONS,
          data: {
            enabledDimensions: validatedPolicy.enabledDimensions,
          },
        }),
      ],
    });
  }

  const numerator = availableDimensions.reduce(
    (sum, dimension) => sum + dimension.score * validatedPolicy.weights[dimension.dimension],
    0
  );
  const denominator = availableDimensions.reduce(
    (sum, dimension) => sum + validatedPolicy.weights[dimension.dimension],
    0
  );

  return deepFreeze({
    status: RANKING_RESULT_STATUSES.AVAILABLE,
    score: roundScore(numerator / denominator),
    breakdown,
    reasons: availableDimensions.flatMap((dimension) => dimension.reasons),
  });
}

export function rankEligibleCandidatesV1(
  sourceExercise,
  eligibleCandidates,
  { policy, evaluateCandidateRanking } = {}
) {
  assertExerciseLike(sourceExercise, "sourceExercise");
  assertEligibleCandidateEntries(eligibleCandidates);

  if (typeof evaluateCandidateRanking !== "function") {
    throw new Error("evaluateCandidateRanking must be a function.");
  }

  const validatedPolicy = validateReplacementRankingPolicy(policy);
  const sourceExerciseId = sourceExercise.exerciseId ?? sourceExercise.id;

  const evaluatedCandidates = eligibleCandidates.map((candidateEntry) => {
    const rankingInput = buildRankingInput(sourceExercise, candidateEntry, validatedPolicy);
    const evaluationResult = validateRankingEvaluationResult(evaluateCandidateRanking(rankingInput), validatedPolicy);

    return deepFreeze({
      exerciseId: candidateEntry.candidateResult.exerciseId,
      rankingStatus: evaluationResult.status,
      rankingScore: evaluationResult.score,
      rank: null,
      rankingBreakdown: evaluationResult.breakdown,
      rankingReasons: evaluationResult.reasons,
      eligibilityEvidence: buildEligibilityEvidence(candidateEntry.candidateResult),
      similarityEvidence: buildSimilarityEvidence(candidateEntry.candidateResult),
    });
  });

  const sortedCandidates = appendTieBreakReasons([...evaluatedCandidates].sort(compareRankedCandidates)).map(
    (candidate, index) =>
      deepFreeze({
        ...candidate,
        rank: index + 1,
      })
  );

  return deepFreeze({
    version: REPLACEMENT_RANKING_ENGINE_V1_VERSION,
    policyVersion: validatedPolicy.version,
    sourceExerciseId,
    totalRanked: sortedCandidates.length,
    rankedCandidates: sortedCandidates,
  });
}

export function rankReplacementCandidatesV1(sourceExercise, eligibleCandidates) {
  return rankEligibleCandidatesV1(sourceExercise, eligibleCandidates, {
    policy: DEFAULT_REPLACEMENT_RANKING_POLICY_V1,
    evaluateCandidateRanking: evaluateReplacementRankingV1,
  });
}

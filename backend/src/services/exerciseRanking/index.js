export const REPLACEMENT_RANKING_ENGINE_V1_VERSION = "replacement-ranking-contract-v1";

export const RANKING_RESULT_STATUSES = Object.freeze({
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
});

export const RANKING_POLICY_DIMENSIONS = Object.freeze({
  SEMANTIC_SIMILARITY: "semantic_similarity",
  MUSCLE_PRESERVATION: "muscle_preservation",
  EQUIPMENT_DELTA: "equipment_delta",
  DEMAND_DELTA: "demand_delta",
});

export const RANKING_REASON_CODES = Object.freeze({
  EVALUATED: "RANKING_EVALUATED",
  UNAVAILABLE: "RANKING_UNAVAILABLE",
  TIE_BROKEN_BY_EXERCISE_ID: "RANKING_TIE_BROKEN_BY_EXERCISE_ID",
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
  return Number(value.toFixed(4));
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

function assertMachineReadableReason(reason, fieldName) {
  if (!isPlainObject(reason)) {
    throw new Error(`${fieldName} must be a plain object.`);
  }

  if (typeof reason.code !== "string" || reason.code.length === 0) {
    throw new Error(`${fieldName}.code must be a non-empty string.`);
  }
}

function normalizeReason(reason) {
  assertMachineReadableReason(reason, "reason");
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

  if (!Array.isArray(dimensionResult.reasons)) {
    throw new Error("ranking breakdown dimension reasons must be an array.");
  }

  return deepFreeze({
    dimension: dimensionResult.dimension,
    status: dimensionResult.status,
    score:
      dimensionResult.status === RANKING_RESULT_STATUSES.AVAILABLE
        ? roundScore(dimensionResult.score)
        : null,
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

  if (!Array.isArray(result.breakdown)) {
    throw new Error("ranking evaluation result breakdown must be an array.");
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

  if (typeof entry.candidateResult.similarityStatus !== "string" || entry.candidateResult.similarityStatus.length === 0) {
    throw new Error(`eligibleCandidates[${index}] must contain similarity status.`);
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
            data: {
              exerciseId: updatedCandidates[groupIndex].exerciseId,
            },
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

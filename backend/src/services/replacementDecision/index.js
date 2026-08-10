export const REPLACEMENT_DECISION_ENGINE_V1_VERSION = "replacement-decision-v1";

export const REPLACEMENT_DECISION_STATUSES = Object.freeze({
  RECOMMENDED: "RECOMMENDED",
  RECOMMENDED_WITH_WARNING: "RECOMMENDED_WITH_WARNING",
  NO_SAFE_REPLACEMENT: "NO_SAFE_REPLACEMENT",
});

export const REPLACEMENT_DECISION_REASON_CODES = Object.freeze({
  TOP_RANKED_PASS: "REPLACEMENT_DECISION_TOP_RANKED_PASS",
  TOP_RANKED_WARN: "REPLACEMENT_DECISION_TOP_RANKED_WARN",
  BLOCKED_BY_INTEGRITY: "REPLACEMENT_DECISION_BLOCKED_BY_INTEGRITY",
  NO_SAFE_REPLACEMENT: "REPLACEMENT_DECISION_NO_SAFE_REPLACEMENT",
});

const INTEGRITY_STATUSES = Object.freeze({
  PASS: "PASS",
  WARN: "WARN",
  BLOCK: "BLOCK",
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

function normalizeReason(reason) {
  if (!isPlainObject(reason)) {
    throw new Error("decision reason must be a plain object.");
  }

  if (typeof reason.code !== "string" || reason.code.length === 0) {
    throw new Error("decision reason.code must be a non-empty string.");
  }

  return deepFreeze({
    code: reason.code,
    data: reason.data ?? null,
  });
}

function assertPositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
}

function assertIntegrityCandidate(entry, index) {
  if (!isPlainObject(entry)) {
    throw new Error(`integrityEvaluations[${index}] must be a plain object.`);
  }

  assertPositiveInteger(entry.exerciseId, `integrityEvaluations[${index}].exerciseId`);

  if (!Object.values(INTEGRITY_STATUSES).includes(entry.integrityStatus)) {
    throw new Error(`integrityEvaluations[${index}] must have integrityStatus PASS, WARN, or BLOCK.`);
  }

  if (entry.integrityStatus === INTEGRITY_STATUSES.BLOCK) {
    if (entry.integrityScore !== null) {
      throw new Error(`integrityEvaluations[${index}] BLOCK candidates must have integrityScore null.`);
    }
  } else if (entry.integrityScore !== null) {
    if (typeof entry.integrityScore !== "number" || !Number.isFinite(entry.integrityScore)) {
      throw new Error(`integrityEvaluations[${index}] must have finite integrityScore when not null.`);
    }
  }

  if (!Array.isArray(entry.integrityBreakdown)) {
    throw new Error(`integrityEvaluations[${index}] must include integrityBreakdown.`);
  }

  if (!Array.isArray(entry.integrityReasons)) {
    throw new Error(`integrityEvaluations[${index}] must include integrityReasons.`);
  }

  if (!isPlainObject(entry.resultingWorkoutSummary)) {
    throw new Error(`integrityEvaluations[${index}] must include resultingWorkoutSummary.`);
  }

  if (!isPlainObject(entry.rankingEvidence)) {
    throw new Error(`integrityEvaluations[${index}] must include rankingEvidence.`);
  }

  const rankingEvidence = entry.rankingEvidence;

  if (typeof rankingEvidence.rank !== "number" || !Number.isInteger(rankingEvidence.rank) || rankingEvidence.rank <= 0) {
    throw new Error(`integrityEvaluations[${index}] must include positive integer rankingEvidence.rank.`);
  }

  if (!Array.isArray(rankingEvidence.rankingBreakdown) || !Array.isArray(rankingEvidence.rankingReasons)) {
    throw new Error(`integrityEvaluations[${index}] must include ranking breakdown and reasons evidence.`);
  }

  if (!isPlainObject(rankingEvidence.eligibilityEvidence)) {
    throw new Error(`integrityEvaluations[${index}] must include eligibility evidence.`);
  }

  if (rankingEvidence.eligibilityEvidence.eligibility !== true) {
    throw new Error(`integrityEvaluations[${index}] must preserve eligible candidate evidence only.`);
  }

  if (!isPlainObject(rankingEvidence.similarityEvidence)) {
    throw new Error(`integrityEvaluations[${index}] must include similarity evidence.`);
  }
}

function assertIntegrityEvaluations(integrityEvaluations) {
  if (!Array.isArray(integrityEvaluations)) {
    throw new Error("integrityEvaluations must be an array.");
  }

  const seenExerciseIds = new Set();

  integrityEvaluations.forEach((entry, index) => {
    assertIntegrityCandidate(entry, index);

    if (seenExerciseIds.has(entry.exerciseId)) {
      throw new Error(`integrityEvaluations contains duplicate exerciseId ${entry.exerciseId}.`);
    }
    seenExerciseIds.add(entry.exerciseId);

    const expectedRank = index + 1;
    if (entry.rankingEvidence.rank !== expectedRank) {
      throw new Error(
        `integrityEvaluations must preserve upstream ranking order exactly; expected rank ${expectedRank} at index ${index}.`
      );
    }
  });
}

function buildDecisionCandidate(entry) {
  return deepFreeze({
    exerciseId: entry.exerciseId,
    rankingScore: entry.rankingEvidence.rankingScore,
    rank: entry.rankingEvidence.rank,
    integrityStatus: entry.integrityStatus,
    integrityScore: entry.integrityScore,
    similarityEvidence: cloneJson(entry.rankingEvidence.similarityEvidence),
    eligibilityEvidence: cloneJson(entry.rankingEvidence.eligibilityEvidence),
    rankingEvidence: cloneJson(entry.rankingEvidence),
    integrityEvidence: deepFreeze({
      integrityBreakdown: cloneJson(entry.integrityBreakdown),
      integrityReasons: cloneJson(entry.integrityReasons),
      resultingWorkoutSummary: cloneJson(entry.resultingWorkoutSummary),
    }),
  });
}

function buildRejectedCandidate(entry) {
  return deepFreeze({
    exerciseId: entry.exerciseId,
    rank: entry.rankingEvidence.rank,
    integrityStatus: entry.integrityStatus,
    integrityReasons: cloneJson(entry.integrityReasons),
    rankingEvidence: cloneJson(entry.rankingEvidence),
    eligibilityEvidence: cloneJson(entry.rankingEvidence.eligibilityEvidence),
    similarityEvidence: cloneJson(entry.rankingEvidence.similarityEvidence),
  });
}

export function decideReplacementV1(sourceExerciseId, integrityEvaluations) {
  assertPositiveInteger(sourceExerciseId, "sourceExerciseId");
  assertIntegrityEvaluations(integrityEvaluations);

  const rejectedCandidates = [];
  const recommendableCandidates = [];
  const decisionReasons = [];

  for (const evaluation of integrityEvaluations) {
    if (evaluation.integrityStatus === INTEGRITY_STATUSES.BLOCK) {
      rejectedCandidates.push(buildRejectedCandidate(evaluation));
      decisionReasons.push(
        normalizeReason({
          code: REPLACEMENT_DECISION_REASON_CODES.BLOCKED_BY_INTEGRITY,
          data: {
            exerciseId: evaluation.exerciseId,
            rank: evaluation.rankingEvidence.rank,
            integrityStatus: evaluation.integrityStatus,
          },
        })
      );
      continue;
    }

    recommendableCandidates.push(buildDecisionCandidate(evaluation));
  }

  if (recommendableCandidates.length === 0) {
    decisionReasons.push(
      normalizeReason({
        code: REPLACEMENT_DECISION_REASON_CODES.NO_SAFE_REPLACEMENT,
        data: {
          sourceExerciseId,
          blockedCandidateCount: rejectedCandidates.length,
        },
      })
    );

    return deepFreeze({
      version: REPLACEMENT_DECISION_ENGINE_V1_VERSION,
      sourceExerciseId,
      decisionStatus: REPLACEMENT_DECISION_STATUSES.NO_SAFE_REPLACEMENT,
      recommendedCandidate: null,
      alternatives: [],
      rejectedCandidates,
      decisionReasons,
    });
  }

  const [recommendedCandidate, ...alternatives] = recommendableCandidates;
  const decisionStatus =
    recommendedCandidate.integrityStatus === INTEGRITY_STATUSES.WARN
      ? REPLACEMENT_DECISION_STATUSES.RECOMMENDED_WITH_WARNING
      : REPLACEMENT_DECISION_STATUSES.RECOMMENDED;

  decisionReasons.push(
    normalizeReason({
      code:
        decisionStatus === REPLACEMENT_DECISION_STATUSES.RECOMMENDED
          ? REPLACEMENT_DECISION_REASON_CODES.TOP_RANKED_PASS
          : REPLACEMENT_DECISION_REASON_CODES.TOP_RANKED_WARN,
      data: {
        exerciseId: recommendedCandidate.exerciseId,
        rank: recommendedCandidate.rank,
        integrityStatus: recommendedCandidate.integrityStatus,
      },
    })
  );

  return deepFreeze({
    version: REPLACEMENT_DECISION_ENGINE_V1_VERSION,
    sourceExerciseId,
    decisionStatus,
    recommendedCandidate,
    alternatives,
    rejectedCandidates,
    decisionReasons,
  });
}

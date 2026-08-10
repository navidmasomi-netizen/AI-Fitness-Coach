import {
  evaluateExerciseEquipmentAvailability,
  EQUIPMENT_AVAILABILITY_STATUSES,
} from "./equipmentAvailability.js";
import {
  REPLACEMENT_CONTEXT_V1_VERSION,
} from "./replacementContext.js";
import {
  REPLACEMENT_INTENT_TYPES,
} from "./replacementIntent.js";
import {
  REPLACEMENT_DECISION_ENGINE_V1_VERSION,
  REPLACEMENT_DECISION_STATUSES,
} from "../replacementDecision/index.js";

export const CONTEXT_AWARE_DECISION_V1_VERSION = "context-aware-replacement-decision-v1";

export const CONTEXTUAL_DECISION_STATUSES = Object.freeze({
  RECOMMENDED: "RECOMMENDED",
  RECOMMENDED_WITH_WARNING: "RECOMMENDED_WITH_WARNING",
  NO_CONTEXTUAL_REPLACEMENT: "NO_CONTEXTUAL_REPLACEMENT",
});

export const CONTEXTUAL_DECISION_REASON_CODES = Object.freeze({
  CORE_PRESERVED: "CONTEXT_DECISION_CORE_PRESERVED",
  EQUIPMENT_AVAILABLE: "CONTEXT_DECISION_EQUIPMENT_AVAILABLE",
  EQUIPMENT_UNAVAILABLE: "CONTEXT_DECISION_EQUIPMENT_UNAVAILABLE",
  EQUIPMENT_CONTEXT_UNKNOWN: "CONTEXT_DECISION_EQUIPMENT_CONTEXT_UNKNOWN",
  EQUIPMENT_METADATA_UNAVAILABLE: "CONTEXT_DECISION_EQUIPMENT_METADATA_UNAVAILABLE",
  INTENT_PRESERVED: "CONTEXT_DECISION_INTENT_PRESERVED",
  NO_CONTEXTUAL_REPLACEMENT: "CONTEXT_DECISION_NO_CONTEXTUAL_REPLACEMENT",
});

const CORE_RECOMMENDABLE_STATUSES = new Set([
  REPLACEMENT_DECISION_STATUSES.RECOMMENDED,
  REPLACEMENT_DECISION_STATUSES.RECOMMENDED_WITH_WARNING,
]);

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
    throw new Error("context-aware decision reason must be a plain object.");
  }

  if (typeof reason.code !== "string" || reason.code.length === 0) {
    throw new Error("context-aware decision reason.code must be a non-empty string.");
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

function assertString(value, fieldName) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }
}

function assertCoreDecisionCandidate(candidate, fieldName) {
  if (!isPlainObject(candidate)) {
    throw new Error(`${fieldName} must be a plain object.`);
  }

  assertPositiveInteger(candidate.exerciseId, `${fieldName}.exerciseId`);
  if (candidate.rankingScore !== null && (!Number.isFinite(candidate.rankingScore) || typeof candidate.rankingScore !== "number")) {
    throw new Error(`${fieldName}.rankingScore must be a finite number or null.`);
  }
  assertPositiveInteger(candidate.rank, `${fieldName}.rank`);
  assertString(candidate.integrityStatus, `${fieldName}.integrityStatus`);
  if (candidate.integrityScore !== null && (!Number.isFinite(candidate.integrityScore) || typeof candidate.integrityScore !== "number")) {
    throw new Error(`${fieldName}.integrityScore must be a finite number or null.`);
  }
  if (!isPlainObject(candidate.similarityEvidence)) {
    throw new Error(`${fieldName}.similarityEvidence must be a plain object.`);
  }
  if (!isPlainObject(candidate.eligibilityEvidence)) {
    throw new Error(`${fieldName}.eligibilityEvidence must be a plain object.`);
  }
  if (candidate.eligibilityEvidence.eligibility !== true) {
    throw new Error(`${fieldName}.eligibilityEvidence must preserve intrinsic eligible evidence.`);
  }
  if (!isPlainObject(candidate.rankingEvidence)) {
    throw new Error(`${fieldName}.rankingEvidence must be a plain object.`);
  }
  if (candidate.rankingEvidence.rank !== candidate.rank) {
    throw new Error(`${fieldName}.rankingEvidence.rank must match candidate rank.`);
  }
  if (!isPlainObject(candidate.integrityEvidence)) {
    throw new Error(`${fieldName}.integrityEvidence must be a plain object.`);
  }
}

function assertCoreRejectedCandidate(candidate, fieldName) {
  if (!isPlainObject(candidate)) {
    throw new Error(`${fieldName} must be a plain object.`);
  }

  assertPositiveInteger(candidate.exerciseId, `${fieldName}.exerciseId`);
  assertPositiveInteger(candidate.rank, `${fieldName}.rank`);
  if (candidate.integrityStatus !== "BLOCK") {
    throw new Error(`${fieldName}.integrityStatus must be BLOCK.`);
  }
  if (!Array.isArray(candidate.integrityReasons)) {
    throw new Error(`${fieldName}.integrityReasons must be an array.`);
  }
  if (!isPlainObject(candidate.rankingEvidence)) {
    throw new Error(`${fieldName}.rankingEvidence must be a plain object.`);
  }
  if (!isPlainObject(candidate.eligibilityEvidence)) {
    throw new Error(`${fieldName}.eligibilityEvidence must be a plain object.`);
  }
  if (!isPlainObject(candidate.similarityEvidence)) {
    throw new Error(`${fieldName}.similarityEvidence must be a plain object.`);
  }
}

function assertCoreDecision(coreDecision) {
  if (!isPlainObject(coreDecision)) {
    throw new Error("coreDecision must be a plain object.");
  }

  if (coreDecision.version !== REPLACEMENT_DECISION_ENGINE_V1_VERSION) {
    throw new Error(`coreDecision.version must be "${REPLACEMENT_DECISION_ENGINE_V1_VERSION}".`);
  }

  assertPositiveInteger(coreDecision.sourceExerciseId, "coreDecision.sourceExerciseId");

  if (!Object.values(REPLACEMENT_DECISION_STATUSES).includes(coreDecision.decisionStatus)) {
    throw new Error("coreDecision.decisionStatus must be a valid Replacement Decision status.");
  }

  if (!Array.isArray(coreDecision.alternatives)) {
    throw new Error("coreDecision.alternatives must be an array.");
  }

  if (!Array.isArray(coreDecision.rejectedCandidates)) {
    throw new Error("coreDecision.rejectedCandidates must be an array.");
  }

  if (!Array.isArray(coreDecision.decisionReasons)) {
    throw new Error("coreDecision.decisionReasons must be an array.");
  }

  const recommendableCandidates = [];
  if (coreDecision.recommendedCandidate !== null) {
    assertCoreDecisionCandidate(coreDecision.recommendedCandidate, "coreDecision.recommendedCandidate");
    recommendableCandidates.push(coreDecision.recommendedCandidate);
  } else if (CORE_RECOMMENDABLE_STATUSES.has(coreDecision.decisionStatus)) {
    throw new Error("coreDecision.recommendedCandidate must exist when coreDecision is recommendable.");
  }

  coreDecision.alternatives.forEach((candidate, index) => {
    assertCoreDecisionCandidate(candidate, `coreDecision.alternatives[${index}]`);
    recommendableCandidates.push(candidate);
  });

  coreDecision.rejectedCandidates.forEach((candidate, index) => {
    assertCoreRejectedCandidate(candidate, `coreDecision.rejectedCandidates[${index}]`);
  });

  const allRanks = [];
  const seenExerciseIds = new Set();

  recommendableCandidates.forEach((candidate, index) => {
    if (candidate.rank !== index + 1) {
      throw new Error("coreDecision recommendable candidates must preserve upstream core rank order exactly.");
    }
    if (seenExerciseIds.has(candidate.exerciseId)) {
      throw new Error(`coreDecision contains duplicate exerciseId ${candidate.exerciseId}.`);
    }
    seenExerciseIds.add(candidate.exerciseId);
    allRanks.push(candidate.rank);
  });

  let previousRejectedRank = recommendableCandidates.length;
  coreDecision.rejectedCandidates.forEach((candidate) => {
    if (candidate.rank <= previousRejectedRank) {
      throw new Error("coreDecision rejectedCandidates must preserve upstream core rank order exactly.");
    }
    if (seenExerciseIds.has(candidate.exerciseId)) {
      throw new Error(`coreDecision contains duplicate exerciseId ${candidate.exerciseId}.`);
    }
    seenExerciseIds.add(candidate.exerciseId);
    previousRejectedRank = candidate.rank;
    allRanks.push(candidate.rank);
  });

  for (let index = 0; index < allRanks.length; index += 1) {
    if (allRanks[index] !== index + 1) {
      throw new Error("coreDecision rank sequence must be contiguous and start at 1.");
    }
  }

  if (
    coreDecision.decisionStatus === REPLACEMENT_DECISION_STATUSES.NO_SAFE_REPLACEMENT &&
    (coreDecision.recommendedCandidate !== null || coreDecision.alternatives.length > 0)
  ) {
    throw new Error("coreDecision with NO_SAFE_REPLACEMENT must not include recommendable candidates.");
  }
}

function assertReplacementContext(replacementContext) {
  if (!isPlainObject(replacementContext)) {
    throw new Error("replacementContext must be a plain object.");
  }

  if (replacementContext.version !== REPLACEMENT_CONTEXT_V1_VERSION) {
    throw new Error(`replacementContext.version must be "${REPLACEMENT_CONTEXT_V1_VERSION}".`);
  }
}

function assertExerciseLike(exercise, fieldName) {
  if (!isPlainObject(exercise)) {
    throw new Error(`${fieldName} must be a plain exercise object.`);
  }

  const exerciseId = exercise.exerciseId ?? exercise.id;
  assertPositiveInteger(exerciseId, `${fieldName}.exerciseId`);
}

function buildCandidateExerciseMap(candidateExercises) {
  if (!Array.isArray(candidateExercises)) {
    throw new Error("candidateExercises must be an array.");
  }

  const byId = new Map();
  for (const [index, exercise] of candidateExercises.entries()) {
    assertExerciseLike(exercise, `candidateExercises[${index}]`);
    const exerciseId = exercise.exerciseId ?? exercise.id;
    if (byId.has(exerciseId)) {
      throw new Error(`candidateExercises contains duplicate exerciseId ${exerciseId}.`);
    }
    byId.set(exerciseId, exercise);
  }
  return byId;
}

function buildContextSnapshot(replacementContext) {
  return deepFreeze(cloneJson(replacementContext));
}

function buildIntentReason(replacementContext, exerciseId) {
  const replacementIntent = replacementContext.replacementIntent;
  return normalizeReason({
    code: CONTEXTUAL_DECISION_REASON_CODES.INTENT_PRESERVED,
    data: {
      exerciseId,
      replacementIntentType: replacementIntent?.type ?? null,
    },
  });
}

function buildEquipmentReason(availabilityResult) {
  switch (availabilityResult.status) {
    case EQUIPMENT_AVAILABILITY_STATUSES.AVAILABLE:
      return normalizeReason({
        code: CONTEXTUAL_DECISION_REASON_CODES.EQUIPMENT_AVAILABLE,
        data: {
          exerciseId: availabilityResult.exerciseId,
          matchedEquipment: availabilityResult.matchedEquipment,
        },
      });
    case EQUIPMENT_AVAILABILITY_STATUSES.UNAVAILABLE:
      return normalizeReason({
        code: CONTEXTUAL_DECISION_REASON_CODES.EQUIPMENT_UNAVAILABLE,
        data: {
          exerciseId: availabilityResult.exerciseId,
          missingEquipment: availabilityResult.missingEquipment,
        },
      });
    case EQUIPMENT_AVAILABILITY_STATUSES.CONTEXT_UNKNOWN:
      return normalizeReason({
        code: CONTEXTUAL_DECISION_REASON_CODES.EQUIPMENT_CONTEXT_UNKNOWN,
        data: {
          exerciseId: availabilityResult.exerciseId,
        },
      });
    case EQUIPMENT_AVAILABILITY_STATUSES.METADATA_UNAVAILABLE:
      return normalizeReason({
        code: CONTEXTUAL_DECISION_REASON_CODES.EQUIPMENT_METADATA_UNAVAILABLE,
        data: {
          exerciseId: availabilityResult.exerciseId,
        },
      });
    default:
      throw new Error(`Unsupported equipment availability status "${availabilityResult.status}".`);
  }
}

function buildContextualCandidate(candidate, replacementContext, availabilityResult) {
  const contextReasons = [
    buildIntentReason(replacementContext, candidate.exerciseId),
    buildEquipmentReason(availabilityResult),
  ];

  return deepFreeze({
    exerciseId: candidate.exerciseId,
    rankingScore: candidate.rankingScore,
    rank: candidate.rank,
    integrityStatus: candidate.integrityStatus,
    integrityScore: candidate.integrityScore,
    similarityEvidence: cloneJson(candidate.similarityEvidence),
    eligibilityEvidence: cloneJson(candidate.eligibilityEvidence),
    rankingEvidence: cloneJson(candidate.rankingEvidence),
    integrityEvidence: cloneJson(candidate.integrityEvidence),
    equipmentAvailabilityEvidence: cloneJson(availabilityResult),
    replacementContextEvidence: buildContextSnapshot(replacementContext),
    contextReasons,
  });
}

function buildContextRejectedCandidate(candidate, replacementContext, availabilityResult) {
  return deepFreeze({
    ...buildContextualCandidate(candidate, replacementContext, availabilityResult),
    rejectionDomain: "contextual_equipment_availability",
  });
}

function buildCoreDecisionEvidence(coreDecision) {
  return deepFreeze(cloneJson(coreDecision));
}

export function applyReplacementContextV1(coreDecision, replacementContext, candidateExercises) {
  assertCoreDecision(coreDecision);
  assertReplacementContext(replacementContext);

  const candidateExerciseMap = buildCandidateExerciseMap(candidateExercises);
  const coreDecisionEvidence = buildCoreDecisionEvidence(coreDecision);
  const replacementContextEvidence = buildContextSnapshot(replacementContext);
  const coreRejectedCandidates = deepFreeze(cloneJson(coreDecision.rejectedCandidates));

  if (coreDecision.decisionStatus === REPLACEMENT_DECISION_STATUSES.NO_SAFE_REPLACEMENT) {
    return deepFreeze({
      version: CONTEXT_AWARE_DECISION_V1_VERSION,
      sourceExerciseId: coreDecision.sourceExerciseId,
      coreDecisionStatus: coreDecision.decisionStatus,
      contextualDecisionStatus: CONTEXTUAL_DECISION_STATUSES.NO_CONTEXTUAL_REPLACEMENT,
      recommendedCandidate: null,
      alternatives: [],
      contextRejectedCandidates: [],
      coreRejectedCandidates,
      contextReasons: [
        normalizeReason({
          code: CONTEXTUAL_DECISION_REASON_CODES.NO_CONTEXTUAL_REPLACEMENT,
          data: {
            sourceExerciseId: coreDecision.sourceExerciseId,
            basedOnCoreDecisionStatus: coreDecision.decisionStatus,
          },
        }),
      ],
      replacementContextEvidence,
      coreDecisionEvidence,
    });
  }

  const contextRejectedCandidates = [];
  const contextEligibleCandidates = [];
  const contextReasons = [];
  const candidatesInCoreOrder = [coreDecision.recommendedCandidate, ...coreDecision.alternatives];

  for (const candidate of candidatesInCoreOrder) {
    const candidateExercise = candidateExerciseMap.get(candidate.exerciseId);
    if (!candidateExercise) {
      throw new Error(`candidateExercises is missing exerciseId ${candidate.exerciseId} required by coreDecision.`);
    }

    const candidateExerciseId = candidateExercise.exerciseId ?? candidateExercise.id;
    if (candidateExerciseId !== candidate.exerciseId) {
      throw new Error(`candidateExercises contains identity mismatch for exerciseId ${candidate.exerciseId}.`);
    }

    const availabilityResult = evaluateExerciseEquipmentAvailability(candidateExercise, replacementContext.equipmentContext);
    const contextualCandidate = buildContextualCandidate(candidate, replacementContext, availabilityResult);

    if (availabilityResult.status === EQUIPMENT_AVAILABILITY_STATUSES.UNAVAILABLE) {
      const rejectedCandidate = buildContextRejectedCandidate(candidate, replacementContext, availabilityResult);
      contextRejectedCandidates.push(rejectedCandidate);
      contextReasons.push(buildEquipmentReason(availabilityResult));
      continue;
    }

    contextEligibleCandidates.push(contextualCandidate);
  }

  if (contextEligibleCandidates.length === 0) {
    contextReasons.push(
      normalizeReason({
        code: CONTEXTUAL_DECISION_REASON_CODES.NO_CONTEXTUAL_REPLACEMENT,
        data: {
          sourceExerciseId: coreDecision.sourceExerciseId,
          rejectedCandidateCount: contextRejectedCandidates.length,
        },
      })
    );

    return deepFreeze({
      version: CONTEXT_AWARE_DECISION_V1_VERSION,
      sourceExerciseId: coreDecision.sourceExerciseId,
      coreDecisionStatus: coreDecision.decisionStatus,
      contextualDecisionStatus: CONTEXTUAL_DECISION_STATUSES.NO_CONTEXTUAL_REPLACEMENT,
      recommendedCandidate: null,
      alternatives: [],
      contextRejectedCandidates: deepFreeze(contextRejectedCandidates),
      coreRejectedCandidates,
      contextReasons: deepFreeze(contextReasons),
      replacementContextEvidence,
      coreDecisionEvidence,
    });
  }

  const [recommendedCandidate, ...alternatives] = contextEligibleCandidates;
  const contextualDecisionStatus =
    recommendedCandidate.integrityStatus === "WARN"
      ? CONTEXTUAL_DECISION_STATUSES.RECOMMENDED_WITH_WARNING
      : CONTEXTUAL_DECISION_STATUSES.RECOMMENDED;

  if (recommendedCandidate.exerciseId === coreDecision.recommendedCandidate.exerciseId) {
    contextReasons.push(
      normalizeReason({
        code: CONTEXTUAL_DECISION_REASON_CODES.CORE_PRESERVED,
        data: {
          exerciseId: recommendedCandidate.exerciseId,
          rank: recommendedCandidate.rank,
        },
      })
    );
  } else {
    contextReasons.push(buildEquipmentReason(recommendedCandidate.equipmentAvailabilityEvidence));
  }

  return deepFreeze({
    version: CONTEXT_AWARE_DECISION_V1_VERSION,
    sourceExerciseId: coreDecision.sourceExerciseId,
    coreDecisionStatus: coreDecision.decisionStatus,
    contextualDecisionStatus,
    recommendedCandidate,
    alternatives: deepFreeze(alternatives),
    contextRejectedCandidates: deepFreeze(contextRejectedCandidates),
    coreRejectedCandidates,
    contextReasons: deepFreeze(contextReasons),
    replacementContextEvidence,
    coreDecisionEvidence,
  });
}

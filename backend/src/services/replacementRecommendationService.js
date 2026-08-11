import prisma from "../lib/prisma.js";
import { buildReplacementCandidatesV1 } from "./exerciseCandidates/index.js";
import { rankReplacementCandidatesV1 } from "./exerciseRanking/index.js";
import { evaluateWorkoutIntegrityV1 } from "./workoutIntegrity/index.js";
import { decideReplacementV1 } from "./replacementDecision/index.js";
import { buildReplacementContextV1 } from "./replacementContext/replacementContext.js";
import { applyReplacementContextV1 } from "./replacementContext/contextAwareDecision.js";

export const REPLACEMENT_API_V1_VERSION = "replacement-api-v1";

export const REPLACEMENT_API_REASON_CODES = Object.freeze({
  RECOMMENDED: "REPLACEMENT_RECOMMENDED",
  RECOMMENDED_WITH_WARNING: "REPLACEMENT_RECOMMENDED_WITH_WARNING",
  NO_CONTEXTUAL_REPLACEMENT: "REPLACEMENT_NO_CONTEXTUAL_REPLACEMENT",
  EQUIPMENT_AVAILABLE: "REPLACEMENT_EQUIPMENT_AVAILABLE",
  EQUIPMENT_UNAVAILABLE: "REPLACEMENT_EQUIPMENT_UNAVAILABLE",
  EQUIPMENT_CONTEXT_UNKNOWN: "REPLACEMENT_EQUIPMENT_CONTEXT_UNKNOWN",
  EQUIPMENT_METADATA_UNAVAILABLE: "REPLACEMENT_EQUIPMENT_METADATA_UNAVAILABLE",
  INTEGRITY_WARNING: "REPLACEMENT_INTEGRITY_WARNING",
  CONTEXTUAL_FALLBACK: "REPLACEMENT_CONTEXTUAL_FALLBACK",
});

export class ReplacementRecommendationError extends Error {
  constructor(message, { statusCode = 500, code = "REPLACEMENT_RECOMMENDATION_FAILED", cause = null } = {}) {
    super(message);
    this.name = "ReplacementRecommendationError";
    this.statusCode = statusCode;
    this.code = code;
    this.cause = cause;
  }
}

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

function assertPositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ReplacementRecommendationError(`${fieldName} must be a positive integer.`, {
      statusCode: 400,
      code: "REPLACEMENT_REQUEST_INVALID_ID",
    });
  }
}

function buildApiReason(code, data = null) {
  return deepFreeze({
    code,
    ...(data == null ? {} : { data }),
  });
}

function buildApiCandidateReasonCodes(candidate, contextualDecision) {
  const reasonCodes = [];
  const equipmentStatus = candidate.equipmentAvailabilityEvidence?.status ?? null;

  if (candidate.integrityStatus === "WARN") {
    reasonCodes.push(REPLACEMENT_API_REASON_CODES.INTEGRITY_WARNING);
  }

  if (equipmentStatus === "AVAILABLE") {
    reasonCodes.push(REPLACEMENT_API_REASON_CODES.EQUIPMENT_AVAILABLE);
  } else if (equipmentStatus === "UNAVAILABLE") {
    reasonCodes.push(REPLACEMENT_API_REASON_CODES.EQUIPMENT_UNAVAILABLE);
  } else if (equipmentStatus === "CONTEXT_UNKNOWN") {
    reasonCodes.push(REPLACEMENT_API_REASON_CODES.EQUIPMENT_CONTEXT_UNKNOWN);
  } else if (equipmentStatus === "METADATA_UNAVAILABLE") {
    reasonCodes.push(REPLACEMENT_API_REASON_CODES.EQUIPMENT_METADATA_UNAVAILABLE);
  }

  const coreRecommendedExerciseId = contextualDecision.coreDecisionEvidence?.recommendedCandidate?.exerciseId ?? null;
  if (coreRecommendedExerciseId !== null && coreRecommendedExerciseId !== candidate.exerciseId) {
    reasonCodes.push(REPLACEMENT_API_REASON_CODES.CONTEXTUAL_FALLBACK);
  }

  return deepFreeze([...new Set(reasonCodes)]);
}

function projectExerciseIdentity(exercise) {
  return deepFreeze({
    exerciseId: exercise.id,
    nameEn: exercise.nameEn ?? null,
    nameFa: exercise.nameFa ?? null,
  });
}

function projectContextSnapshot(replacementContext) {
  return deepFreeze({
    version: replacementContext.version,
    equipmentContext:
      replacementContext.equipmentContext === null
        ? null
        : {
            availableEquipment: [...replacementContext.equipmentContext.availableEquipment],
          },
    replacementIntent:
      replacementContext.replacementIntent === null
        ? null
        : {
            version: replacementContext.replacementIntent.version,
            type: replacementContext.replacementIntent.type,
          },
  });
}

function projectTraceability(candidate, replacementContext) {
  return deepFreeze({
    eligibility: {
      eligible: candidate.eligibilityEvidence.eligibility,
      passedRuleIds: [...candidate.eligibilityEvidence.passedRules],
    },
    similarity: {
      status: candidate.similarityEvidence.similarityStatus,
    },
    ranking: {
      rank: candidate.rank,
      rankingScore: candidate.rankingScore,
    },
    integrity: {
      status: candidate.integrityStatus,
    },
    context: {
      equipmentAvailabilityStatus: candidate.equipmentAvailabilityEvidence.status,
      replacementIntentType: replacementContext.replacementIntent?.type ?? null,
    },
  });
}

function projectPublicCandidate(candidate, candidateExercise, replacementContext, contextualDecision) {
  return deepFreeze({
    ...projectExerciseIdentity(candidateExercise),
    rank: candidate.rank,
    rankingScore: candidate.rankingScore,
    integrityStatus: candidate.integrityStatus,
    equipmentAvailabilityStatus: candidate.equipmentAvailabilityEvidence.status,
    reasonCodes: buildApiCandidateReasonCodes(candidate, contextualDecision),
    traceability: projectTraceability(candidate, replacementContext),
  });
}

function projectContextRejectedCandidate(candidate, candidateExercise, replacementContext, contextualDecision) {
  return deepFreeze({
    ...projectPublicCandidate(candidate, candidateExercise, replacementContext, contextualDecision),
    rejectionReasonCodes: [REPLACEMENT_API_REASON_CODES.EQUIPMENT_UNAVAILABLE],
  });
}

function buildTopLevelReasonCodes(contextualDecisionStatus, recommendedCandidate) {
  if (contextualDecisionStatus === "NO_CONTEXTUAL_REPLACEMENT") {
    return deepFreeze([REPLACEMENT_API_REASON_CODES.NO_CONTEXTUAL_REPLACEMENT]);
  }

  const reasonCodes = [
    contextualDecisionStatus === "RECOMMENDED_WITH_WARNING"
      ? REPLACEMENT_API_REASON_CODES.RECOMMENDED_WITH_WARNING
      : REPLACEMENT_API_REASON_CODES.RECOMMENDED,
  ];

  if (recommendedCandidate?.integrityStatus === "WARN") {
    reasonCodes.push(REPLACEMENT_API_REASON_CODES.INTEGRITY_WARNING);
  }

  return deepFreeze(reasonCodes);
}

function buildCandidateExerciseMap(exercises) {
  return new Map(exercises.map((exercise) => [exercise.id, exercise]));
}

function ensureSourceOccurrenceEvaluable(sourceTarget, sessionTargets) {
  const sourceOccurrences = sessionTargets.filter((target) => target.exerciseId === sourceTarget.exerciseId);
  if (sourceOccurrences.length > 1) {
    throw new ReplacementRecommendationError(
      "Replacement evaluation requires a unique source exercise occurrence in Workout Integrity V1.",
      {
        statusCode: 422,
        code: "REPLACEMENT_SOURCE_OCCURRENCE_NOT_EVALUABLE",
      }
    );
  }
}

function buildCurrentWorkoutExercises(sessionTargets) {
  return sessionTargets.map((target) => target.exercise);
}

function assertSessionOwnership(session, userId) {
  if (!session || session.userId !== userId) {
    throw new ReplacementRecommendationError("Workout session not found", {
      statusCode: 404,
      code: "WORKOUT_SESSION_NOT_FOUND",
    });
  }
}

function findSourceTarget(sessionTargets, targetId) {
  return sessionTargets.find((target) => target.id === targetId) ?? null;
}

function buildEligibleRankingEntries(candidateResults, activeCatalogById) {
  return candidateResults.candidates
    .filter((candidate) => candidate.eligibility === true)
    .map((candidateResult) => ({
      candidateExercise: activeCatalogById.get(candidateResult.exerciseId),
      candidateResult,
    }));
}

function buildRankedIntegrityEntries(rankedResults, activeCatalogById) {
  return rankedResults.rankedCandidates.map((rankedCandidateResult) => ({
    candidateExercise: activeCatalogById.get(rankedCandidateResult.exerciseId),
    rankedCandidateResult,
  }));
}

function buildContextCandidateExerciseList(contextualDecision, activeCatalogById) {
  const candidateIds = [];

  if (contextualDecision.coreDecisionEvidence?.recommendedCandidate?.exerciseId) {
    candidateIds.push(contextualDecision.coreDecisionEvidence.recommendedCandidate.exerciseId);
  }

  for (const candidate of contextualDecision.coreDecisionEvidence?.alternatives ?? []) {
    candidateIds.push(candidate.exerciseId);
  }

  return candidateIds.map((candidateId) => {
    const exercise = activeCatalogById.get(candidateId);
    if (!exercise) {
      throw new ReplacementRecommendationError(
        `Active exercise catalog is missing candidate exerciseId ${candidateId}.`,
        { statusCode: 500, code: "REPLACEMENT_CANDIDATE_EXERCISE_MISSING" }
      );
    }
    return exercise;
  });
}

function buildPublicResponse({
  sessionId,
  sourceTarget,
  replacementContext,
  contextualDecision,
  activeCatalogById,
}) {
  const recommendedCandidate =
    contextualDecision.recommendedCandidate === null
      ? null
      : projectPublicCandidate(
          contextualDecision.recommendedCandidate,
          activeCatalogById.get(contextualDecision.recommendedCandidate.exerciseId),
          replacementContext,
          contextualDecision
        );

  const alternatives = contextualDecision.alternatives.map((candidate) =>
    projectPublicCandidate(candidate, activeCatalogById.get(candidate.exerciseId), replacementContext, contextualDecision)
  );

  const contextRejectedCandidates = contextualDecision.contextRejectedCandidates.map((candidate) =>
    projectContextRejectedCandidate(
      candidate,
      activeCatalogById.get(candidate.exerciseId),
      replacementContext,
      contextualDecision
    )
  );

  return deepFreeze({
    version: REPLACEMENT_API_V1_VERSION,
    source: {
      sessionId,
      sessionExerciseTargetId: sourceTarget.id,
      exercise: projectExerciseIdentity(sourceTarget.exercise),
    },
    contextualDecisionStatus: contextualDecision.contextualDecisionStatus,
    recommendedReplacement: recommendedCandidate,
    alternatives,
    contextRejectedCandidates,
    reasonCodes: buildTopLevelReasonCodes(contextualDecision.contextualDecisionStatus, contextualDecision.recommendedCandidate),
    context: projectContextSnapshot(replacementContext),
  });
}

export async function getWorkoutExerciseReplacementsV1({
  userId,
  sessionId,
  targetId,
  rawContext,
  db = prisma,
} = {}) {
  assertPositiveInteger(userId, "userId");
  assertPositiveInteger(sessionId, "sessionId");
  assertPositiveInteger(targetId, "targetId");

  if (!isPlainObject(rawContext)) {
    throw new ReplacementRecommendationError("context must be a plain object.", {
      statusCode: 400,
      code: "REPLACEMENT_CONTEXT_INVALID",
    });
  }

  let replacementContext;
  try {
    replacementContext = buildReplacementContextV1(rawContext);
  } catch (error) {
    throw new ReplacementRecommendationError(error.message, {
      statusCode: 400,
      code: "REPLACEMENT_CONTEXT_INVALID",
      cause: error,
    });
  }

  const session = await db.workoutSession.findUnique({
    where: { id: sessionId },
    include: {
      exerciseTargets: {
        include: {
          exercise: true,
          programDayExercise: {
            select: { order: true },
          },
        },
        orderBy: [{ id: "asc" }],
      },
    },
  });

  assertSessionOwnership(session, userId);

  const sourceTarget = findSourceTarget(session.exerciseTargets, targetId);
  if (!sourceTarget) {
    throw new ReplacementRecommendationError("Workout session exercise target not found", {
      statusCode: 404,
      code: "WORKOUT_SESSION_EXERCISE_TARGET_NOT_FOUND",
    });
  }

  ensureSourceOccurrenceEvaluable(sourceTarget, session.exerciseTargets);

  const activeCatalog = await db.exercise.findMany({
    where: { catalogLifecycle: "ACTIVE" },
    orderBy: [{ id: "asc" }],
  });
  const activeCatalogById = buildCandidateExerciseMap(activeCatalog);

  const currentWorkoutExercises = buildCurrentWorkoutExercises(session.exerciseTargets);
  const candidateResults = buildReplacementCandidatesV1(sourceTarget.exercise, activeCatalog);
  const eligibleRankingEntries = buildEligibleRankingEntries(candidateResults, activeCatalogById);
  const rankedResults = rankReplacementCandidatesV1(sourceTarget.exercise, eligibleRankingEntries);
  const rankedIntegrityEntries = buildRankedIntegrityEntries(rankedResults, activeCatalogById);
  const integrityResults = evaluateWorkoutIntegrityV1(
    sourceTarget.exerciseId,
    currentWorkoutExercises,
    rankedIntegrityEntries
  );
  const coreDecision = decideReplacementV1(sourceTarget.exerciseId, integrityResults.evaluations);
  const contextCandidateExercises = buildContextCandidateExerciseList({ coreDecisionEvidence: coreDecision }, activeCatalogById);
  const contextualDecision = applyReplacementContextV1(coreDecision, replacementContext, contextCandidateExercises);

  return buildPublicResponse({
    sessionId,
    sourceTarget,
    replacementContext,
    contextualDecision,
    activeCatalogById,
  });
}

export function __projectReplacementApiResponseForTest(input) {
  return cloneJson(input);
}

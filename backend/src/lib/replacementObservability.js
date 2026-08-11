import { logStructuredEvent } from "./structuredLogger.js";
import { ApplyReplacementError } from "../services/replacementApplyService.js";
import { ReplacementRecommendationError } from "../services/replacementRecommendationService.js";

export const REPLACEMENT_OBSERVABILITY_EVENTS = Object.freeze({
  DISCOVERY_STARTED: "replacement.discovery.started",
  DISCOVERY_COMPLETED: "replacement.discovery.completed",
  DISCOVERY_FAILED: "replacement.discovery.failed",
  APPLY_STARTED: "replacement.apply.started",
  APPLY_COMPLETED: "replacement.apply.completed",
  APPLY_FAILED: "replacement.apply.failed",
});

function roundDurationMs(value) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }

  return Number(value.toFixed(3));
}

export function buildReplacementLogContext({
  req,
  userId = null,
  sessionId = null,
  targetId = null,
  replacementExerciseId = null,
} = {}) {
  return {
    requestId: req?.requestContext?.requestId ?? null,
    replacementFlowId: req?.requestContext?.replacementFlowId ?? null,
    userId,
    sessionId,
    targetId,
    replacementExerciseId,
  };
}

export function classifyReplacementFailure(error) {
  if (
    error instanceof ReplacementRecommendationError ||
    error instanceof ApplyReplacementError
  ) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return "authorization";
    }
    if (error.statusCode === 409) {
      return "conflict";
    }
    if (error.statusCode === 400 || error.statusCode === 404 || error.statusCode === 422) {
      return "validation";
    }
  }

  return "unexpected";
}

export function logReplacementEvent(level, event, fields = {}) {
  logStructuredEvent(level, event, fields);
}

export function buildReplacementDiscoveryStartEvent(baseContext, body) {
  return {
    ...baseContext,
    contextVersion:
      body && typeof body.context === "object" && body.context !== null ? body.context.version ?? null : null,
    replacementIntentType:
      body && typeof body.context === "object" && body.context !== null
        ? body.context.replacementIntent?.type ?? null
        : null,
    hasEquipmentContext:
      Boolean(
        body &&
          typeof body.context === "object" &&
          body.context !== null &&
          body.context.equipmentContext
      ),
  };
}

export function buildReplacementDiscoveryCompletedEvent(baseContext, details = {}) {
  return {
    ...baseContext,
    contextualDecisionStatus: details.contextualDecisionStatus ?? null,
    recommendedExerciseId: details.recommendedExerciseId ?? null,
    alternativeCount: details.alternativeCount ?? null,
    contextRejectedCount: details.contextRejectedCount ?? null,
    activeCatalogCount: details.activeCatalogCount ?? null,
    candidateCount: details.candidateCount ?? null,
    eligibleCandidateCount: details.eligibleCandidateCount ?? null,
    rankedCandidateCount: details.rankedCandidateCount ?? null,
    responseSizeBytes: details.responseSizeBytes ?? null,
    serviceDurationMs: roundDurationMs(details.serviceDurationMs),
    apiDurationMs: roundDurationMs(details.apiDurationMs),
  };
}

export function buildReplacementApplyStartEvent(baseContext) {
  return { ...baseContext };
}

export function buildReplacementApplyCompletedEvent(baseContext, details = {}) {
  return {
    ...baseContext,
    appliedTargetId: details.appliedTargetId ?? null,
    previousExerciseId: details.previousExerciseId ?? null,
    appliedReplacementExerciseId: details.appliedReplacementExerciseId ?? null,
    targetRowsChanged: details.targetRowsChanged ?? null,
    setLogRowsChanged: details.setLogRowsChanged ?? null,
    transactionDurationMs: roundDurationMs(details.transactionDurationMs),
    serviceDurationMs: roundDurationMs(details.serviceDurationMs),
    apiDurationMs: roundDurationMs(details.apiDurationMs),
    responseSizeBytes: details.responseSizeBytes ?? null,
  };
}

export function buildReplacementFailureEvent(baseContext, error, details = {}) {
  const baseFailureCategory = classifyReplacementFailure(error);

  return {
    ...baseContext,
    failureCategory:
      baseFailureCategory === "unexpected" &&
      typeof details.transactionDurationMs === "number" &&
      Number.isFinite(details.transactionDurationMs)
        ? "transaction"
        : baseFailureCategory,
    statusCode: typeof error?.statusCode === "number" ? error.statusCode : 500,
    errorCode: typeof error?.code === "string" ? error.code : null,
    serviceDurationMs: roundDurationMs(details.serviceDurationMs),
    transactionDurationMs: roundDurationMs(details.transactionDurationMs),
    apiDurationMs: roundDurationMs(details.apiDurationMs),
  };
}

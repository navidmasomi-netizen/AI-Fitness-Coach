export class DeloadHistorySignalsError extends Error {
  constructor(message) {
    super(message);
    this.name = "DeloadHistorySignalsError";
  }
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

function createNeutralDeloadHistory() {
  return Object.freeze({
    recentDeloadCount: 0,
    mostRecentDeloadAt: null,
    hasRecentDeload: false,
  });
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function toIsoString(value) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  }

  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
  }

  return null;
}

function compareAppliedDeloadRowsDesc(left, right) {
  const leftTimestamp = Date.parse(left.appliedAtIso);
  const rightTimestamp = Date.parse(right.appliedAtIso);
  if (leftTimestamp !== rightTimestamp) {
    return rightTimestamp - leftTimestamp;
  }

  if (left.applicationId !== right.applicationId) {
    return right.applicationId - left.applicationId;
  }

  return right.recommendationId - left.recommendationId;
}

function normalizeAppliedDeloadRow(row, currentUserProgramId) {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new DeloadHistorySignalsError(
      "Applied deload history rows must be plain objects"
    );
  }

  if (!isPositiveInteger(row.id)) {
    throw new DeloadHistorySignalsError(
      "Applied deload history rows must include a positive application id"
    );
  }

  if (!isPositiveInteger(row.recommendationId)) {
    throw new DeloadHistorySignalsError(
      "Applied deload history rows must include a positive recommendationId"
    );
  }

  const appliedAtIso = toIsoString(row.appliedAt);
  if (!appliedAtIso) {
    throw new DeloadHistorySignalsError(
      "Applied deload history rows must include a valid appliedAt timestamp"
    );
  }

  const workoutSession = row.workoutSession;
  if (!workoutSession || typeof workoutSession !== "object" || Array.isArray(workoutSession)) {
    throw new DeloadHistorySignalsError(
      "Applied deload history rows must include application workout session lineage"
    );
  }

  if (workoutSession.userProgramId !== currentUserProgramId) {
    throw new DeloadHistorySignalsError(
      "Applied deload application rows must belong to the current user program"
    );
  }

  const recommendation = row.recommendation;
  if (!recommendation || typeof recommendation !== "object" || Array.isArray(recommendation)) {
    throw new DeloadHistorySignalsError(
      "Applied deload history rows must include recommendation lineage"
    );
  }

  if (recommendation.id !== row.recommendationId) {
    throw new DeloadHistorySignalsError(
      "Applied deload history recommendation lineage must match recommendationId"
    );
  }

  if (!isPositiveInteger(recommendation.sourceSessionId)) {
    throw new DeloadHistorySignalsError(
      "Applied deload history rows must include a positive sourceSessionId"
    );
  }

  if (
    recommendation.decisionType !== "DELOAD" ||
    recommendation.recommendationType !== "deload"
  ) {
    throw new DeloadHistorySignalsError(
      "Applied deload history rows must represent structurally valid deload recommendations"
    );
  }

  const sourceSession = recommendation.sourceSession;
  if (!sourceSession || typeof sourceSession !== "object" || Array.isArray(sourceSession)) {
    throw new DeloadHistorySignalsError(
      "Applied deload history rows must include source session lineage"
    );
  }

  if (sourceSession.userProgramId !== currentUserProgramId) {
    throw new DeloadHistorySignalsError(
      "Applied deload history rows must belong to the current user program"
    );
  }

  return {
    applicationId: row.id,
    recommendationId: row.recommendationId,
    appliedAtIso,
  };
}

export function deriveDeloadHistory({ appliedDeloadRows, currentUserProgramId }) {
  if (!Array.isArray(appliedDeloadRows)) {
    throw new DeloadHistorySignalsError(
      "appliedDeloadRows must be an array"
    );
  }

  if (!isPositiveInteger(currentUserProgramId)) {
    throw new DeloadHistorySignalsError(
      "currentUserProgramId must be a positive integer"
    );
  }

  if (appliedDeloadRows.length === 0) {
    return createNeutralDeloadHistory();
  }

  const normalizedRows = [];
  const seenRecommendationIds = new Set();
  const seenApplicationIds = new Set();

  for (const row of appliedDeloadRows) {
    if (row?.recommendation === null || row?.recommendation === undefined) {
      throw new DeloadHistorySignalsError(
        "Applied deload history rows must include recommendation lineage"
      );
    }

    const normalizedRow = normalizeAppliedDeloadRow(row, currentUserProgramId);

    if (seenRecommendationIds.has(normalizedRow.recommendationId)) {
      throw new DeloadHistorySignalsError(
        "Applied deload history rows must not duplicate recommendation ids"
      );
    }
    if (seenApplicationIds.has(normalizedRow.applicationId)) {
      throw new DeloadHistorySignalsError(
        "Applied deload history rows must not duplicate application ids"
      );
    }

    seenRecommendationIds.add(normalizedRow.recommendationId);
    seenApplicationIds.add(normalizedRow.applicationId);
    normalizedRows.push(normalizedRow);
  }

  const sortedRows = [...normalizedRows].sort(compareAppliedDeloadRowsDesc);
  const mostRecentDeloadAt = sortedRows[0]?.appliedAtIso ?? null;

  return deepFreeze({
    recentDeloadCount: sortedRows.length,
    mostRecentDeloadAt,
    hasRecentDeload: sortedRows.length > 0,
  });
}

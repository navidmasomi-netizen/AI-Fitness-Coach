import prisma from "../lib/prisma.js";

export const APPLY_REPLACEMENT_V1_VERSION = "replacement-apply-v1";
export const APPLY_REPLACEMENT_DECISION_TYPE = "REPLACEMENT_APPLY_V1";
export const APPLY_REPLACEMENT_AUDIT_VERSION = "replacement-apply-audit-v1";

export class ApplyReplacementError extends Error {
  constructor(message, { statusCode = 500, code = "APPLY_REPLACEMENT_FAILED", cause = null } = {}) {
    super(message);
    this.name = "ApplyReplacementError";
    this.statusCode = statusCode;
    this.code = code;
    this.cause = cause;
  }
}

function assertPositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new ApplyReplacementError(`${fieldName} must be a positive integer.`, {
      statusCode: 422,
      code: "APPLY_REPLACEMENT_INVALID_REQUEST",
    });
  }
}

function parseAuditMetadata(value) {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildAuditMetadata({
  sessionId,
  targetId,
  appliedByUserId,
  previousExerciseId,
  replacementExerciseId,
  previousSourceDecisionType,
  previousSourceRulesVersion,
  appliedAt,
}) {
  return {
    version: APPLY_REPLACEMENT_AUDIT_VERSION,
    sessionId,
    targetId,
    appliedByUserId,
    appliedAt: appliedAt.toISOString(),
    previousExerciseId,
    replacementExerciseId,
    previousSourceDecisionType,
    previousSourceRulesVersion,
  };
}

function assertSessionOwnership(session, userId) {
  if (!session || session.userId !== userId) {
    throw new ApplyReplacementError("Workout session not found", {
      statusCode: 404,
      code: "WORKOUT_SESSION_NOT_FOUND",
    });
  }
}

function assertTargetExists(target) {
  if (!target) {
    throw new ApplyReplacementError("Workout session exercise target not found", {
      statusCode: 404,
      code: "WORKOUT_SESSION_EXERCISE_TARGET_NOT_FOUND",
    });
  }
}

function assertSessionIsActive(session) {
  if (session.status !== "active") {
    throw new ApplyReplacementError("Workout session is not active", {
      statusCode: 422,
      code: "WORKOUT_SESSION_NOT_ACTIVE",
    });
  }
}

function assertReplacementNotAlreadyApplied(target) {
  if (target.sourceDecisionType === APPLY_REPLACEMENT_DECISION_TYPE) {
    throw new ApplyReplacementError("Replacement has already been applied to this workout target", {
      statusCode: 409,
      code: "REPLACEMENT_ALREADY_APPLIED",
    });
  }

  const audit = parseAuditMetadata(target.sourceRulesVersion);
  if (audit?.version === APPLY_REPLACEMENT_AUDIT_VERSION) {
    throw new ApplyReplacementError("Replacement has already been applied to this workout target", {
      statusCode: 409,
      code: "REPLACEMENT_ALREADY_APPLIED",
    });
  }
}

function assertReplacementExerciseIsValid(target, replacementExercise) {
  if (!replacementExercise || replacementExercise.catalogLifecycle !== "ACTIVE") {
    throw new ApplyReplacementError("Selected replacement exercise is invalid", {
      statusCode: 422,
      code: "REPLACEMENT_EXERCISE_INVALID",
    });
  }

  if (replacementExercise.id === target.exerciseId) {
    throw new ApplyReplacementError("Selected replacement exercise must differ from the current target exercise", {
      statusCode: 422,
      code: "REPLACEMENT_EXERCISE_INVALID",
    });
  }
}

function assertSourceSetLogsAreNotAmbiguous(session, target) {
  const sourceOccurrences = session.exerciseTargets.filter(
    (entry) => entry.exerciseId === target.exerciseId
  );

  if (sourceOccurrences.length <= 1) {
    return;
  }

  const sourceSetLogs = session.setLogs.filter((entry) => entry.exerciseId === target.exerciseId);
  if (sourceSetLogs.length > 0) {
    throw new ApplyReplacementError(
      "Replacement cannot be applied because logged sets for this exercise are ambiguous across multiple workout occurrences.",
      {
        statusCode: 409,
        code: "REPLACEMENT_SOURCE_LOGS_AMBIGUOUS",
      }
    );
  }
}

function findTarget(session, targetId) {
  return session.exerciseTargets.find((entry) => entry.id === targetId) ?? null;
}

function buildUpdatedWorkoutResponse({ session, program, programDay, appliedReplacement }) {
  return {
    version: APPLY_REPLACEMENT_V1_VERSION,
    session,
    program,
    programDay,
    exercises: programDay?.exercises ?? [],
    appliedReplacement,
  };
}

export function createReplacementApplyService({
  prismaClient = prisma,
  afterTargetUpdateImpl = async () => {},
} = {}) {
  async function applyWorkoutExerciseReplacementV1({
    userId,
    sessionId,
    targetId,
    replacementExerciseId,
  }) {
    assertPositiveInteger(userId, "userId");
    assertPositiveInteger(sessionId, "sessionId");
    assertPositiveInteger(targetId, "targetId");
    assertPositiveInteger(replacementExerciseId, "replacementExerciseId");

    return prismaClient.$transaction(async (tx) => {
      const session = await tx.workoutSession.findUnique({
        where: { id: sessionId },
        include: {
          setLogs: {
            include: { exercise: true },
            orderBy: [{ loggedAt: "asc" }, { id: "asc" }],
          },
          exerciseTargets: {
            include: {
              exercise: true,
              programDayExercise: {
                include: {
                  exercise: true,
                },
              },
            },
            orderBy: [{ id: "asc" }],
          },
        },
      });

      assertSessionOwnership(session, userId);
      assertSessionIsActive(session);

      const target = findTarget(session, targetId);
      assertTargetExists(target);
      assertReplacementNotAlreadyApplied(target);
      assertSourceSetLogsAreNotAmbiguous(session, target);

      const replacementExercise = await tx.exercise.findUnique({
        where: { id: replacementExerciseId },
      });
      assertReplacementExerciseIsValid(target, replacementExercise);

      const appliedAt = new Date();
      const auditMetadata = buildAuditMetadata({
        sessionId,
        targetId,
        appliedByUserId: userId,
        previousExerciseId: target.exerciseId,
        replacementExerciseId,
        previousSourceDecisionType: target.sourceDecisionType ?? null,
        previousSourceRulesVersion: target.sourceRulesVersion ?? null,
        appliedAt,
      });

      const updatedTarget = await tx.workoutSessionExerciseTarget.update({
        where: { id: targetId },
        data: {
          exerciseId: replacementExerciseId,
          sourceDecisionType: APPLY_REPLACEMENT_DECISION_TYPE,
          // Temporary V1 audit transport: until a dedicated replacement-audit persistence model exists,
          // Apply stores structured audit metadata in sourceRulesVersion without changing schema.
          sourceRulesVersion: JSON.stringify(auditMetadata),
        },
        include: {
          exercise: true,
          programDayExercise: {
            include: {
              exercise: true,
            },
          },
        },
      });

      await afterTargetUpdateImpl({
        tx,
        session,
        target,
        replacementExercise,
        updatedTarget,
        auditMetadata,
      });

      await tx.setLog.updateMany({
        where: {
          sessionId,
          exerciseId: target.exerciseId,
        },
        data: {
          exerciseId: replacementExerciseId,
        },
      });

      const updatedSession = await tx.workoutSession.findUnique({
        where: { id: sessionId },
        include: {
          setLogs: {
            include: { exercise: true },
            orderBy: [{ loggedAt: "asc" }, { id: "asc" }],
          },
          exerciseTargets: {
            include: {
              exercise: true,
              programDayExercise: {
                include: {
                  exercise: true,
                },
              },
            },
            orderBy: [{ id: "asc" }],
          },
        },
      });

      const program = updatedSession.programId
        ? await tx.program.findUnique({ where: { id: updatedSession.programId } })
        : null;
      const programDay = updatedSession.programDayId
        ? await tx.programDay.findUnique({
            where: { id: updatedSession.programDayId },
            include: {
              exercises: {
                orderBy: { order: "asc" },
                include: { exercise: true },
              },
            },
          })
        : null;

      return buildUpdatedWorkoutResponse({
        session: updatedSession,
        program,
        programDay,
        appliedReplacement: {
          targetId: updatedTarget.id,
          previousExerciseId: target.exerciseId,
          replacementExerciseId,
          sourceDecisionType: updatedTarget.sourceDecisionType,
          audit: auditMetadata,
        },
      });
    });
  }

  return {
    applyWorkoutExerciseReplacementV1,
  };
}

export const replacementApplyService = createReplacementApplyService();

export async function applyWorkoutExerciseReplacementV1(input) {
  return replacementApplyService.applyWorkoutExerciseReplacementV1(input);
}

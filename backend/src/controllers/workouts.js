import prisma from "../lib/prisma.js";
import {
  WorkoutSessionCompletionError,
  WorkoutSessionStartError,
  workoutSessionService,
} from "../services/workoutSessionService.js";
import {
  ReplacementRecommendationError,
  getWorkoutExerciseReplacementsV1,
} from "../services/replacementRecommendationService.js";
import {
  ApplyReplacementError,
  applyWorkoutExerciseReplacementV1,
} from "../services/replacementApplyService.js";

function hasOwn(input, key) {
  return Object.prototype.hasOwnProperty.call(input, key);
}

function resolveStartIdempotencyKey(req) {
  return (
    req.body?.idempotencyKey ??
    req.headers?.["idempotency-key"] ??
    req.headers?.["x-idempotency-key"] ??
    null
  );
}

export const createWorkoutSession = async (req, res) => {
  try {
    const body =
      req.body && typeof req.body === "object" && !Array.isArray(req.body)
        ? req.body
        : {};
    const authenticatedUserId = req.userId;
    const suppliedUserId = body.userId == null ? null : Number(body.userId);

    if (hasOwn(body, "programId") || hasOwn(body, "programDayId") || hasOwn(body, "notes")) {
      return res.status(400).json({
        success: false,
        message: "programId, programDayId, and notes are not supported on this endpoint",
      });
    }

    if (
      hasOwn(body, "userId") &&
      (!Number.isInteger(suppliedUserId) || suppliedUserId <= 0 || suppliedUserId !== authenticatedUserId)
    ) {
      return res.status(403).json({
        success: false,
        message: "Cannot create a session for another user",
      });
    }

    const result = await workoutSessionService.startFromActiveProgram({
      userId: authenticatedUserId,
      idempotencyKey: resolveStartIdempotencyKey(req),
    });

    return res.json({ success: true, data: result.session });
  } catch (error) {
    if (error instanceof WorkoutSessionStartError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({ success: false, message: "Failed to create workout session" });
  }
};

export const addSetLog = async (req, res) => {
  const userId = req.userId;
  const { sessionId } = req.params;
  const { exerciseId, setNumber, reps, weightKg } = req.body;
  if (!exerciseId || !setNumber || reps === undefined || reps === null || reps === "") {
    return res.status(400).json({ success: false, message: "exerciseId, setNumber and reps are required" });
  }

  const normalizedExerciseId = Number(exerciseId);
  const normalizedSessionId = Number(sessionId);
  const normalizedSetNumber = Number(setNumber);
  const normalizedReps = Number(reps);
  const normalizedWeightKg =
    weightKg === undefined || weightKg === null || weightKg === ""
      ? null
      : Number(weightKg);

  if (!Number.isInteger(normalizedExerciseId) || normalizedExerciseId <= 0) {
    return res.status(400).json({ success: false, message: "exerciseId must be a positive integer" });
  }

  if (!Number.isInteger(normalizedSetNumber) || normalizedSetNumber <= 0) {
    return res.status(400).json({ success: false, message: "setNumber must be a positive integer" });
  }

  if (!Number.isInteger(normalizedReps) || normalizedReps <= 0) {
    return res.status(400).json({ success: false, message: "reps must be a positive integer" });
  }

  if (normalizedWeightKg !== null && (Number.isNaN(normalizedWeightKg) || normalizedWeightKg < 0)) {
    return res.status(400).json({ success: false, message: "weightKg must be a non-negative number" });
  }

  try {
    const session = await prisma.workoutSession.findUnique({
      where: { id: normalizedSessionId },
    });

    if (!session || session.userId !== userId) {
      return res.status(404).json({ success: false, message: "Workout session not found" });
    }

    if (session.status !== "active") {
      return res.status(400).json({ success: false, message: "Workout session is not active" });
    }

    const exercise = await prisma.exercise.findUnique({
      where: { id: normalizedExerciseId },
    });

    if (!exercise) {
      return res.status(404).json({ success: false, message: "Exercise not found" });
    }

    const setLog = await prisma.setLog.create({
      data: {
        sessionId: normalizedSessionId,
        exerciseId: normalizedExerciseId,
        setNumber: normalizedSetNumber,
        reps: normalizedReps,
        weightKg: normalizedWeightKg,
      },
      include: {
        exercise: true,
      },
    });
    res.json({ success: true, data: setLog });
  } catch (error) {
    res.status(400).json({ success: false, message: "Failed to add set log" });
  }
};

export const completeWorkoutSession = async (req, res) => {
  const userId = req.userId;
  const { sessionId } = req.params;
  const normalizedSessionId = Number(sessionId);

  try {
    const result = await workoutSessionService.completeWorkoutSession({
      userId,
      sessionId: normalizedSessionId,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof WorkoutSessionCompletionError) {
      return res.status(error.statusCode).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: "Failed to complete workout session" });
  }
};

export const getUserWorkoutSessions = async (req, res) => {
  const authenticatedUserId = req.userId;
  const { userId } = req.params;
  const { status } = req.query;

  if (Number(userId) !== authenticatedUserId) {
    return res.status(403).json({ success: false, message: "You can only view your own workout sessions" });
  }

  try {
    const where = { userId: authenticatedUserId };
    if (status) {
      where.status = status;
    }

    const sessions = await prisma.workoutSession.findMany({
      where,
      include: {
        setLogs: {
          include: { exercise: true },
        },
      },
      orderBy: { startedAt: "desc" },
    });

    const programIds = [...new Set(sessions.map((s) => s.programId).filter(Boolean))];
    const programDayIds = [...new Set(sessions.map((s) => s.programDayId).filter(Boolean))];

    const programs = programIds.length
      ? await prisma.program.findMany({ where: { id: { in: programIds } } })
      : [];
    const programDays = programDayIds.length
      ? await prisma.programDay.findMany({ where: { id: { in: programDayIds } } })
      : [];

    const programById = Object.fromEntries(programs.map((p) => [p.id, p]));
    const programDayById = Object.fromEntries(programDays.map((d) => [d.id, d]));

    const enriched = sessions.map((s) => ({
      ...s,
      program: s.programId ? programById[s.programId] || null : null,
      programDay: s.programDayId ? programDayById[s.programDayId] || null : null,
    }));

    res.json({ success: true, data: enriched });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch workout sessions" });
  }
};

export const startFromActiveProgram = async (req, res) => {
  const userId = req.userId;
  const idempotencyKey =
    req.body?.idempotencyKey ??
    req.headers?.["idempotency-key"] ??
    req.headers?.["x-idempotency-key"] ??
    null;

  try {
    const result = await workoutSessionService.startFromActiveProgram({
      userId,
      idempotencyKey,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof WorkoutSessionStartError && error.statusCode === 404) {
      return res.status(404).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: "Failed to start workout session" });
  }
};

export const getSessionById = async (req, res) => {
  const userId = req.userId;
  const { sessionId } = req.params;
  const normalizedSessionId = Number(sessionId);

  try {
    const session = await prisma.workoutSession.findUnique({
      where: { id: normalizedSessionId },
      include: {
        exerciseTargets: {
          include: {
            exercise: true,
          },
          orderBy: { id: "asc" },
        },
        setLogs: {
          include: { exercise: true },
          orderBy: { loggedAt: "asc" },
        },
      },
    });

    if (!session || session.userId !== userId) {
      return res.status(404).json({ success: false, message: "Workout session not found" });
    }

    let program = null;
    let programDay = null;
    if (session.programId) {
      program = await prisma.program.findUnique({ where: { id: session.programId } });
    }
    if (session.programDayId) {
      programDay = await prisma.programDay.findUnique({ where: { id: session.programDayId } });
    }

    res.json({ success: true, data: { session, program, programDay } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch session" });
  }
};

export const getActiveSession = async (req, res) => {
  const userId = req.userId;

  try {
    const activeSession = await prisma.workoutSession.findFirst({
      where: { userId, status: "active" },
      orderBy: { startedAt: "desc" },
      include: {
        exerciseTargets: {
          include: {
            exercise: true,
          },
          orderBy: { id: "asc" },
        },
        setLogs: {
          include: { exercise: true },
        },
      },
    });

    if (!activeSession) {
      return res.json({ success: true, data: null });
    }

    let program = null;
    let programDay = null;
    if (activeSession.programId) {
      program = await prisma.program.findUnique({ where: { id: activeSession.programId } });
    }
    if (activeSession.programDayId) {
      programDay = await prisma.programDay.findUnique({
        where: { id: activeSession.programDayId },
        include: {
          exercises: {
            orderBy: { order: "asc" },
            include: { exercise: true },
          },
        },
      });
    }

    res.json({
      success: true,
      data: {
        session: activeSession,
        program,
        programDay,
        exercises: programDay ? programDay.exercises : [],
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch active session" });
  }
};

export const getWorkoutExerciseReplacements = async (req, res) => {
  const userId = req.userId;
  const normalizedSessionId = Number(req.params.sessionId);
  const normalizedTargetId = Number(req.params.targetId);
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};

  if (Object.keys(body).some((key) => key !== "context")) {
    return res.status(400).json({
      success: false,
      message: 'Only "context" is supported on this endpoint',
    });
  }

  if (!Object.prototype.hasOwnProperty.call(body, "context")) {
    return res.status(400).json({
      success: false,
      message: 'context is required',
    });
  }

  try {
    const result = await getWorkoutExerciseReplacementsV1({
      userId,
      sessionId: normalizedSessionId,
      targetId: normalizedTargetId,
      rawContext: body.context,
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ReplacementRecommendationError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to evaluate workout exercise replacements",
    });
  }
};

export const applyWorkoutExerciseReplacement = async (req, res) => {
  const userId = req.userId;
  const normalizedSessionId = Number(req.params.sessionId);
  const normalizedTargetId = Number(req.params.targetId);
  const body =
    req.body && typeof req.body === "object" && !Array.isArray(req.body)
      ? req.body
      : {};

  if (Object.keys(body).some((key) => key !== "replacementExerciseId")) {
    return res.status(422).json({
      success: false,
      message: 'Only "replacementExerciseId" is supported on this endpoint',
      code: "APPLY_REPLACEMENT_INVALID_REQUEST",
    });
  }

  try {
    const result = await applyWorkoutExerciseReplacementV1({
      userId,
      sessionId: normalizedSessionId,
      targetId: normalizedTargetId,
      replacementExerciseId: Number(body.replacementExerciseId),
    });

    return res.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof ApplyReplacementError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
        code: error.code,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to apply workout exercise replacement",
    });
  }
};

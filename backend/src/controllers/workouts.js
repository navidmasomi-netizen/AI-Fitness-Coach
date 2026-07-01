import prisma from "../lib/prisma.js";
import { evaluateSessionProgression } from "../services/progression.js";

export const createWorkoutSession = async (req, res) => {
  const { userId, programId, programDayId, notes } = req.body;
  if (!userId) {
    return res.status(400).json({ success: false, message: "userId is required" });
  }
  try {
    const session = await prisma.workoutSession.create({
      data: {
        userId: Number(userId),
        programId: programId ? Number(programId) : null,
        programDayId: programDayId ? Number(programDayId) : null,
        notes: notes || null,
      },
    });
    res.json({ success: true, data: session });
  } catch (error) {
    res.status(400).json({ success: false, message: "Failed to create workout session" });
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
    const session = await prisma.workoutSession.findUnique({
      where: { id: normalizedSessionId },
      include: { setLogs: true },
    });

    if (!session || session.userId !== userId) {
      return res.status(404).json({ success: false, message: "Workout session not found" });
    }

    if (session.status !== "active") {
      return res.status(400).json({ success: false, message: "Only an active session can be completed" });
    }

    if (session.setLogs.length === 0) {
      return res.status(400).json({ success: false, message: "Log at least one set before completing the workout" });
    }

    const updatedSession = await prisma.workoutSession.update({
      where: { id: normalizedSessionId },
      data: {
        completedAt: new Date(),
        status: "completed",
      },
      include: {
        setLogs: {
          include: { exercise: true },
        },
      },
    });

    let updatedUserProgram = null;
    let nextProgramDay = null;
    let warning = null;

    const userProgram = await prisma.userProgram.findUnique({
      where: { userId },
    });

    if (!userProgram) {
      warning = "No active program found; day was not advanced";
    } else if (session.programId !== userProgram.programId) {
      warning = "Completed session does not belong to the active program; day was not advanced";
      updatedUserProgram = userProgram;
    } else {
      const programDaysCount = await prisma.programDay.count({
        where: { programId: userProgram.programId },
      });

      if (programDaysCount === 0) {
        warning = "Active program has no days configured; day was not advanced";
        updatedUserProgram = userProgram;
      } else {
        const nextIndex = (userProgram.currentDayIndex + 1) % programDaysCount;
        updatedUserProgram = await prisma.userProgram.update({
          where: { userId },
          data: { currentDayIndex: nextIndex },
        });

        nextProgramDay = await prisma.programDay.findFirst({
          where: { programId: userProgram.programId, dayIndex: nextIndex },
        });
      }
    }

    const progressionResult = await evaluateSessionProgression(normalizedSessionId, userId);

    res.json({
      success: true,
      data: {
        session: updatedSession,
        updatedUserProgram,
        nextProgramDay,
        warning,
        progressionRecommendations: progressionResult.recommendations,
        progressionWarning: progressionResult.warning,
      },
    });
  } catch (error) {
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

  try {
    const existingActiveSession = await prisma.workoutSession.findFirst({
      where: { userId, status: "active" },
      orderBy: { startedAt: "desc" },
      include: {
        setLogs: {
          include: { exercise: true },
        },
      },
    });

    if (existingActiveSession) {
      let existingProgram = null;
      let existingProgramDay = null;
      if (existingActiveSession.programId) {
        existingProgram = await prisma.program.findUnique({ where: { id: existingActiveSession.programId } });
      }
      if (existingActiveSession.programDayId) {
        existingProgramDay = await prisma.programDay.findUnique({
          where: { id: existingActiveSession.programDayId },
          include: {
            exercises: {
              orderBy: { order: "asc" },
              include: { exercise: true },
            },
          },
        });
      }

      return res.json({
        success: true,
        data: {
          session: existingActiveSession,
          program: existingProgram,
          programDay: existingProgramDay,
          exercises: existingProgramDay ? existingProgramDay.exercises : [],
          resumed: true,
        },
      });
    }

    const userProgram = await prisma.userProgram.findUnique({
      where: { userId },
    });

    if (!userProgram) {
      return res.status(404).json({ success: false, message: "No active program found" });
    }

    const programDay = await prisma.programDay.findFirst({
      where: {
        programId: userProgram.programId,
        dayIndex: userProgram.currentDayIndex,
      },
      include: {
        exercises: {
          orderBy: { order: "asc" },
          include: { exercise: true },
        },
      },
    });

    if (!programDay) {
      return res.status(404).json({ success: false, message: "Program day not found for current index" });
    }

    const program = await prisma.program.findUnique({
      where: { id: userProgram.programId },
    });

    const session = await prisma.workoutSession.create({
      data: {
        userId,
        programId: userProgram.programId,
        programDayId: programDay.id,
        status: "active",
      },
    });

    res.json({
      success: true,
      data: {
        session: { ...session, setLogs: [] },
        program,
        programDay,
        exercises: programDay.exercises,
        resumed: false,
      },
    });
  } catch (error) {
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

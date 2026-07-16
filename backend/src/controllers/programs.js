import prisma from "../lib/prisma.js";
import { generateProgramForUser } from "../services/programGenerator.js";
import { analyzeWorkoutHistory } from "../services/workoutAnalyzer.js";
import { computeRecoveryModifier } from "../services/recoveryEngine.js";
import { evaluateRegenerationEligibility } from "../services/regenerationOrchestrator.js";

const dayExerciseInclude = {
  days: {
    orderBy: { dayIndex: "asc" },
    include: {
      exercises: {
        orderBy: { order: "asc" },
        include: { exercise: true },
      },
    },
  },
};

const ACTIVE_PROGRAM_INCLUDE = {
  program: {
    include: {
      days: {
        orderBy: { dayIndex: "asc" },
        include: {
          exercises: {
            orderBy: { order: "asc" },
            include: { exercise: true },
          },
        },
      },
    },
  },
};
const REGENERATION_ANALYSIS_WINDOW_DAYS = 28;
const PROFILE_NOT_FOUND_MESSAGE = "Profile not found. Complete the Fitness Profile Wizard first.";
const PROFILE_INCOMPLETE_MESSAGE = "Profile incomplete. Complete the Fitness Profile Wizard first.";
const REGENERATION_FAILURE_MESSAGE =
  "Something went wrong while checking your program recommendation. Please try again.";

function classifyGenerationError(error) {
  const message = error instanceof Error ? error.message : "";

  if (/^User profile not found for user \d+\.$/.test(message)) {
    return {
      status: 404,
      message: PROFILE_NOT_FOUND_MESSAGE,
    };
  }

  if (/^User profile wizard is not completed for user \d+\.$/.test(message)) {
    return {
      status: 400,
      message: PROFILE_INCOMPLETE_MESSAGE,
    };
  }

  if (/^Program already active for user \d+\.$/.test(message)) {
    return {
      status: 409,
      message: "You already have an active program.",
    };
  }

  if (
    /^Program generation failed for primary slot /.test(message) ||
    /^Program generation failed because dayType=".*" produced zero exercises /.test(message)
  ) {
    return {
      status: 422,
      message:
        "We couldn't build a program with your current equipment and injury settings. Try adjusting your profile.",
    };
  }

  return {
    status: 500,
    message: "Something went wrong while generating your program. Please try again.",
  };
}

function buildKnownLimitations(programProfileSnapshot) {
  const limitations = [];

  if (
    programProfileSnapshot.trainingDaysPerWeek === undefined ||
    programProfileSnapshot.trainingDaysPerWeek === null
  ) {
    limitations.push({
      dimension: "trainingDaysPerWeek",
      reason: "insufficient_historical_snapshot",
    });
  }

  if (!Array.isArray(programProfileSnapshot.equipmentAccess)) {
    limitations.push({
      dimension: "equipmentAccess",
      reason: "insufficient_historical_snapshot",
    });
  }

  if (!Array.isArray(programProfileSnapshot.injuryFlags)) {
    limitations.push({
      dimension: "injuryFlags",
      reason: "insufficient_historical_snapshot",
    });
  }

  return limitations;
}

async function buildRegenerationRecommendation(userId) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    return {
      error: {
        status: 404,
        message: PROFILE_NOT_FOUND_MESSAGE,
      },
    };
  }

  if (profile.wizardCompleted !== true) {
    return {
      error: {
        status: 400,
        message: PROFILE_INCOMPLETE_MESSAGE,
      },
    };
  }

  const activeUserProgram = await prisma.userProgram.findUnique({
    where: { userId },
    include: ACTIVE_PROGRAM_INCLUDE,
  });

  const snapshot = activeUserProgram
    ? await prisma.userProgramProfileSnapshot.findUnique({
        where: { userProgramId: activeUserProgram.id },
      })
    : null;

  const recentSessions = await prisma.workoutSession.findMany({
    where: {
      userId,
      status: "completed",
    },
    orderBy: [{ completedAt: "desc" }, { id: "desc" }],
    take: 3,
    include: {
      progressionRecommendations: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { recommendationType: true },
      },
    },
  });

  const recentCompletedSessions = recentSessions.map((session) => ({
    sessionId: session.id,
    completedAt: session.completedAt,
    progressionRecommendations: session.progressionRecommendations.map((recommendation) => ({
      recommendationType: recommendation.recommendationType,
    })),
  }));

  const workoutAnalysis = await analyzeWorkoutHistory({
    userId,
    windowDays: REGENERATION_ANALYSIS_WINDOW_DAYS,
  });

  const recoveryResult = computeRecoveryModifier({ workoutAnalysis });

  const currentProgram = activeUserProgram
    ? {
        goal: activeUserProgram.program.goal,
        splitFamily: activeUserProgram.program.splitFamily,
        isStatic: activeUserProgram.program.isStatic,
        createdAt: activeUserProgram.program.createdAt,
      }
    : null;
  const userProgram = activeUserProgram
    ? {
        currentDayIndex: activeUserProgram.currentDayIndex,
        activatedAt: activeUserProgram.activatedAt,
      }
    : null;
  const programProfileSnapshot = {
    goal: snapshot?.goal ?? currentProgram?.goal ?? null,
    equipmentAccess: snapshot?.equipmentAccess ?? undefined,
    injuryFlags: snapshot?.injuryFlags ?? undefined,
    trainingDaysPerWeek: snapshot?.trainingDaysPerWeek ?? undefined,
  };

  const regenerationEvaluation = evaluateRegenerationEligibility({
    recentCompletedSessions,
    recoveryModifier: { recoveryModifier: recoveryResult.recoveryModifier },
    currentProgram,
    userProgram,
    userProfile: {
      goal: profile.goal,
      equipmentAccess: profile.equipmentAccess,
      injuryFlags: profile.injuryFlags,
      trainingDaysPerWeek: profile.trainingDaysPerWeek,
    },
    programProfileSnapshot,
  });

  const { trace, ...recommendationWithoutTrace } = regenerationEvaluation;
  const knownLimitations = buildKnownLimitations(programProfileSnapshot);

  if (!activeUserProgram) {
    return {
      data: {
        regenerationRecommended: false,
        urgency: "none",
        reasons: ["No active program exists, so there is nothing to regenerate right now."],
        triggeringFactors: [],
        knownLimitations,
      },
    };
  }

  return {
    data: {
      ...recommendationWithoutTrace,
      knownLimitations,
    },
  };
}

export const getPrograms = async (req, res) => {
  try {
    const programs = await prisma.program.findMany({
      include: dayExerciseInclude,
    });
    res.json({ success: true, data: programs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch programs" });
  }
};

export const generateProgram = async (req, res) => {
  const userId = req.userId;

  try {
    const program = await generateProgramForUser(userId);
    return res.status(201).json({ success: true, data: program });
  } catch (error) {
    const classified = classifyGenerationError(error);
    return res.status(classified.status).json({
      success: false,
      message: classified.message,
    });
  }
};

export const getRegenerationRecommendation = async (req, res) => {
  const userId = req.userId;

  try {
    const result = await buildRegenerationRecommendation(userId);

    if (result.error) {
      return res.status(result.error.status).json({
        success: false,
        message: result.error.message,
      });
    }

    return res.json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: REGENERATION_FAILURE_MESSAGE,
    });
  }
};

export const getProgramById = async (req, res) => {
  try {
    const program = await prisma.program.findUnique({
      where: { id: Number(req.params.id) },
      include: dayExerciseInclude,
    });
    if (!program) {
      return res.status(404).json({ success: false, message: "Program not found" });
    }
    res.json({ success: true, data: program });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch program" });
  }
};

import prisma from "../lib/prisma.js";
import { generateProgramForUser } from "../services/programGenerator.js";

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

function classifyGenerationError(error) {
  const message = error instanceof Error ? error.message : "";

  if (/^User profile not found for user \d+\.$/.test(message)) {
    return {
      status: 404,
      message: "Profile not found. Complete the Fitness Profile Wizard first.",
    };
  }

  if (/^User profile wizard is not completed for user \d+\.$/.test(message)) {
    return {
      status: 400,
      message: "Profile incomplete. Complete the Fitness Profile Wizard first.",
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

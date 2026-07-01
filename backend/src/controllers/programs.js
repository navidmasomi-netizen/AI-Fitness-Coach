import prisma from "../lib/prisma.js";

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

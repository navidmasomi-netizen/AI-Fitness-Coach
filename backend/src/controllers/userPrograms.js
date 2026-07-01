import prisma from "../lib/prisma.js";

const fullProgramInclude = {
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

export const activateProgram = async (req, res) => {
  const userId = req.userId;
  const { programId } = req.body;

  if (!programId) {
    return res.status(400).json({ success: false, message: "programId is required" });
  }

  try {
    const program = await prisma.program.findUnique({ where: { id: Number(programId) } });
    if (!program) {
      return res.status(404).json({ success: false, message: "Program not found" });
    }

    const userProgram = await prisma.userProgram.upsert({
      where: { userId },
      update: {
        programId: Number(programId),
        currentDayIndex: 0,
        activatedAt: new Date(),
      },
      create: {
        userId,
        programId: Number(programId),
        currentDayIndex: 0,
      },
      include: fullProgramInclude,
    });

    res.json({ success: true, data: userProgram });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to activate program" });
  }
};

export const getMyActiveProgram = async (req, res) => {
  const userId = req.userId;

  try {
    const userProgram = await prisma.userProgram.findUnique({
      where: { userId },
      include: fullProgramInclude,
    });

    res.json({ success: true, data: userProgram || null });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch active program" });
  }
};

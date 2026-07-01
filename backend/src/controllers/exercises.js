import prisma from "../lib/prisma.js";

export const getExercises = async (req, res) => {
  try {
    const exercises = await prisma.exercise.findMany({
      select: {
        id: true,
        nameFa: true,
        nameEn: true,
        primaryMuscles: true,
        secondaryMuscles: true,
        movementPattern: true,
        equipment: true,
        difficulty: true,
        complexity: true,
        suitableGoals: true,
        jointStressFlags: true,
        substitutionNames: true,
        description: true,
        icon: true,
        defaultRepRangeLow: true,
        defaultRepRangeHigh: true,
        defaultRestSecondsLow: true,
        defaultRestSecondsHigh: true,
        progressionType: true,
      },
    });
    res.json({ success: true, data: exercises });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch exercises" });
  }
};

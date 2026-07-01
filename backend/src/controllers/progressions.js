import prisma from "../lib/prisma.js";

export const getProgressionsBySession = async (req, res) => {
  const userId = req.userId;
  const { sessionId } = req.params;
  const normalizedSessionId = Number(sessionId);

  try {
    const session = await prisma.workoutSession.findUnique({
      where: { id: normalizedSessionId },
    });

    if (!session || session.userId !== userId) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const recommendations = await prisma.progressionRecommendation.findMany({
      where: { sourceSessionId: normalizedSessionId, userId },
      include: { exercise: true },
      orderBy: { createdAt: "asc" },
    });

    res.json({ success: true, data: recommendations });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch progression recommendations" });
  }
};

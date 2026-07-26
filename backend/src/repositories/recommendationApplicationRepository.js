export function createRecommendationApplicationRepository(db) {
  return {
    async create({ data, include } = {}) {
      return db.recommendationApplication.create({
        data,
        ...(include ? { include } : {}),
      });
    },

    async createMany({ data }) {
      const createdApplications = [];
      for (const entry of data) {
        createdApplications.push(
          await db.recommendationApplication.create({
            data: entry,
          })
        );
      }

      return createdApplications;
    },

    async findByRecommendationId(recommendationId) {
      return db.recommendationApplication.findUnique({
        where: { recommendationId },
      });
    },

    async findBySessionId(workoutSessionId) {
      return db.recommendationApplication.findMany({
        where: { workoutSessionId },
        orderBy: [{ appliedAt: "asc" }, { id: "asc" }],
      });
    },
  };
}

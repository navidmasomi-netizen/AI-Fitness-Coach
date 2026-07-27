import { PROGRESSION_RECOMMENDATION_INCLUDE } from "./repositoryShapes.js";

const ELIGIBLE_PENDING_RECOMMENDATION_WHERE = {
  lifecycleStatus: "PENDING",
  decisionType: { not: null },
  rulesVersion: { not: null },
  application: null,
};

const RECOMMENDATION_ORDER_BY_DESC = [{ createdAt: "desc" }, { id: "desc" }];
const RECOMMENDATION_ORDER_BY_ASC = [{ createdAt: "asc" }, { id: "asc" }];

export function createProgressionRecommendationRepository(db) {
  return {
    async findLatestForExercise({ userId, exerciseId, excludeSourceSessionId = null }) {
      return db.progressionRecommendation.findFirst({
        where: {
          userId,
          exerciseId,
          ...(excludeSourceSessionId ? { sourceSessionId: { not: excludeSourceSessionId } } : {}),
        },
        include: PROGRESSION_RECOMMENDATION_INCLUDE,
        orderBy: RECOMMENDATION_ORDER_BY_DESC,
      });
    },

    async findEligiblePendingForExerciseIds({ userId, exerciseIds }) {
      return db.progressionRecommendation.findMany({
        where: {
          userId,
          exerciseId: {
            in: exerciseIds,
          },
          ...ELIGIBLE_PENDING_RECOMMENDATION_WHERE,
        },
        include: PROGRESSION_RECOMMENDATION_INCLUDE,
        orderBy: RECOMMENDATION_ORDER_BY_DESC,
      });
    },

    async findEligiblePendingForSessionContext({
      userId,
      exerciseId,
      sourceSessionId,
    }) {
      return db.progressionRecommendation.findMany({
        where: {
          userId,
          ...(exerciseId ? { exerciseId } : {}),
          ...(sourceSessionId ? { sourceSessionId: { not: sourceSessionId } } : {}),
          ...ELIGIBLE_PENDING_RECOMMENDATION_WHERE,
        },
        include: PROGRESSION_RECOMMENDATION_INCLUDE,
        orderBy: RECOMMENDATION_ORDER_BY_DESC,
      });
    },

    async markAppliedConditionally({ recommendationId }) {
      const updateResult = await db.progressionRecommendation.updateMany({
        where: {
          id: recommendationId,
          lifecycleStatus: "PENDING",
        },
        data: {
          lifecycleStatus: "APPLIED",
        },
      });

      return {
        matchedCount: updateResult.count,
        recommendation:
          updateResult.count > 0
            ? await db.progressionRecommendation.findUnique({
                where: { id: recommendationId },
                include: PROGRESSION_RECOMMENDATION_INCLUDE,
              })
            : null,
      };
    },

    async createNormalizedRecommendations({ data }) {
      const createdRecommendations = [];
      for (const entry of data) {
        createdRecommendations.push(
          await db.progressionRecommendation.create({
            data: entry,
            include: PROGRESSION_RECOMMENDATION_INCLUDE,
          })
        );
      }

      return createdRecommendations;
    },

    async findBySourceSession({ userId, sourceSessionId }) {
      return db.progressionRecommendation.findMany({
        where: {
          userId,
          sourceSessionId,
        },
        include: PROGRESSION_RECOMMENDATION_INCLUDE,
        orderBy: RECOMMENDATION_ORDER_BY_ASC,
      });
    },
  };
}

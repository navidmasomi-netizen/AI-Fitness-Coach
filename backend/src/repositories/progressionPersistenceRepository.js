import { Prisma } from "@prisma/client";

const RECOMMENDATION_UNIQUE_INDEX_NAME =
  "ProgressionRecommendation_userId_exerciseId_sourceSessionId_key";
const COMPOSITE_TARGET_FIELDS = ["userId", "exerciseId", "sourceSessionId"];

function normalizeTargetComponent(value) {
  return String(value).replace(/["`]/g, "");
}

function compareCompositeTargetArray(target) {
  if (!Array.isArray(target) || target.length !== COMPOSITE_TARGET_FIELDS.length) {
    return false;
  }

  const normalizedTarget = target.map(normalizeTargetComponent).sort();
  const normalizedFields = [...COMPOSITE_TARGET_FIELDS].sort();
  return normalizedTarget.every((field, index) => field === normalizedFields[index]);
}

function compareCompositeTargetName(target) {
  if (typeof target !== "string") {
    return false;
  }

  return normalizeTargetComponent(target) === RECOMMENDATION_UNIQUE_INDEX_NAME;
}

function compareCompositeTargetMessage(message) {
  if (typeof message !== "string") {
    return false;
  }

  const match = message.match(/Unique constraint failed on the fields:\s*\(([^)]+)\)/);
  if (!match) {
    return false;
  }

  const normalizedTarget = match[1]
    .split(",")
    .map((component) => normalizeTargetComponent(component).trim())
    .filter(Boolean)
    .sort();
  const normalizedFields = [...COMPOSITE_TARGET_FIELDS].sort();

  if (normalizedTarget.length !== normalizedFields.length) {
    return false;
  }

  return normalizedTarget.every((field, index) => field === normalizedFields[index]);
}

export function isProgressionRecommendationIdempotencyP2002(error) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  return (
    compareCompositeTargetArray(target) ||
    compareCompositeTargetName(target) ||
    compareCompositeTargetMessage(error.message)
  );
}

export function createProgressionPersistenceRepository(db) {
  return {
    async findExistingProgressionRecommendation(identity) {
      return db.progressionRecommendation.findUnique({
        where: {
          userId_exerciseId_sourceSessionId: {
            userId: identity.userId,
            exerciseId: identity.exerciseId,
            sourceSessionId: identity.sourceSessionId,
          },
        },
        include: { exercise: true },
      });
    },

    async createOrRecoverProgressionRecommendation({ identity, createData }) {
      try {
        const recommendation = await db.progressionRecommendation.create({
          data: createData,
          include: { exercise: true },
        });

        return {
          outcome: "CREATED",
          recommendation,
          duplicateRecovered: false,
        };
      } catch (error) {
        if (!isProgressionRecommendationIdempotencyP2002(error)) {
          throw error;
        }

        const existingRecommendation = await this.findExistingProgressionRecommendation(identity);
        if (!existingRecommendation) {
          throw new Error(
            `Progression recommendation idempotency recovery failed for (${identity.userId}, ${identity.exerciseId}, ${identity.sourceSessionId})`
          );
        }

        return {
          outcome: "ALREADY_EXISTS",
          recommendation: existingRecommendation,
          duplicateRecovered: true,
        };
      }
    },
  };
}

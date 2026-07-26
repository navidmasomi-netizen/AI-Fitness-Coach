import { WORKOUT_SESSION_TARGET_INCLUDE } from "./repositoryShapes.js";

function sortTargetsByProgramDayExerciseOrder(targets) {
  return [...targets].sort((left, right) => {
    const leftOrder = left.programDayExercise?.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.programDayExercise?.order ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.id - right.id;
  });
}

export function createWorkoutSessionExerciseTargetRepository(db) {
  return {
    async createManyForSession({ sessionId, targets }) {
      const createdTargets = [];
      for (const target of targets) {
        createdTargets.push(
          await db.workoutSessionExerciseTarget.create({
            data: {
              ...target,
              sessionId,
            },
            include: WORKOUT_SESSION_TARGET_INCLUDE,
          })
        );
      }

      return sortTargetsByProgramDayExerciseOrder(createdTargets);
    },

    async findBySessionId(sessionId) {
      const targets = await db.workoutSessionExerciseTarget.findMany({
        where: { sessionId },
        include: {
          programDayExercise: {
            select: {
              order: true,
            },
          },
        },
      });

      return sortTargetsByProgramDayExerciseOrder(targets);
    },

    async findBySessionIdWithExerciseContext(sessionId) {
      const targets = await db.workoutSessionExerciseTarget.findMany({
        where: { sessionId },
        include: WORKOUT_SESSION_TARGET_INCLUDE,
      });

      return sortTargetsByProgramDayExerciseOrder(targets);
    },
  };
}

import { PROGRAM_DAY_EXERCISE_BASELINE_INCLUDE } from "./repositoryShapes.js";

const PROGRAM_DAY_EXERCISE_ORDER_BY = [{ order: "asc" }, { id: "asc" }];

export function createProgramDayExerciseRepository(db) {
  return {
    async findByProgramDayId(programDayId) {
      return db.programDayExercise.findMany({
        where: { programDayId },
        orderBy: PROGRAM_DAY_EXERCISE_ORDER_BY,
        include: PROGRAM_DAY_EXERCISE_BASELINE_INCLUDE,
      });
    },

    async findByIds(programDayExerciseIds) {
      return db.programDayExercise.findMany({
        where: {
          id: {
            in: programDayExerciseIds,
          },
        },
        orderBy: PROGRAM_DAY_EXERCISE_ORDER_BY,
        include: PROGRAM_DAY_EXERCISE_BASELINE_INCLUDE,
      });
    },
  };
}

import { PROGRAM_DAY_WITH_EXERCISES_INCLUDE } from "./repositoryShapes.js";

export function createProgramDayRepository(db) {
  return {
    async countByProgramId(programId) {
      return db.programDay.count({
        where: { programId },
      });
    },

    async findDayWithExercises(programDayId) {
      return db.programDay.findUnique({
        where: { id: programDayId },
        include: PROGRAM_DAY_WITH_EXERCISES_INCLUDE,
      });
    },

    async findDayBelongingToUserProgramProgram({ userProgramId, dayIndex }) {
      return db.programDay.findFirst({
        where: {
          dayIndex,
          program: {
            userProgram: {
              some: {
                id: userProgramId,
              },
            },
          },
        },
        include: PROGRAM_DAY_WITH_EXERCISES_INCLUDE,
      });
    },
  };
}

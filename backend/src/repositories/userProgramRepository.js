export function createUserProgramRepository(db) {
  return {
    async findActiveForUser(userId) {
      return db.userProgram.findFirst({
        where: {
          userId,
          isActive: true,
        },
        orderBy: [{ activatedAt: "desc" }, { id: "desc" }],
      });
    },

    async findByIdForUser({ userProgramId, userId }) {
      return db.userProgram.findFirst({
        where: {
          id: userProgramId,
          userId,
        },
      });
    },

    async findByIdWithCurrentDayContext({ userProgramId, userId }) {
      return db.userProgram.findFirst({
        where: {
          id: userProgramId,
          userId,
        },
        include: {
          program: {
            select: {
              id: true,
              name: true,
              description: true,
              splitFamily: true,
              goal: true,
              isStatic: true,
            },
          },
        },
      });
    },

    async advanceCurrentDayIndexConditionally({
      userProgramId,
      expectedCurrentDayIndex,
      nextDayIndex,
    }) {
      const updateResult = await db.userProgram.updateMany({
        where: {
          id: userProgramId,
          currentDayIndex: expectedCurrentDayIndex,
        },
        data: {
          currentDayIndex: nextDayIndex,
        },
      });

      return {
        matchedCount: updateResult.count,
        userProgram:
          updateResult.count > 0
            ? await db.userProgram.findUnique({
                where: { id: userProgramId },
              })
            : null,
      };
    },
  };
}

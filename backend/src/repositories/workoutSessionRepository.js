import { WORKOUT_SESSION_TARGET_INCLUDE } from "./repositoryShapes.js";

const WORKOUT_SESSION_TARGETS_ORDER_BY = [{ id: "asc" }];
const SET_LOGS_ORDER_BY = [{ loggedAt: "asc" }, { id: "asc" }];
const HISTORICAL_WORKOUT_SESSION_ORDER_BY = [
  { completedAt: "desc" },
  { startedAt: "desc" },
  { id: "desc" },
];

function buildWorkoutSessionTargetsInclude() {
  return {
    setLogs: {
      include: { exercise: true },
      orderBy: SET_LOGS_ORDER_BY,
    },
    exerciseTargets: {
      include: WORKOUT_SESSION_TARGET_INCLUDE,
      orderBy: WORKOUT_SESSION_TARGETS_ORDER_BY,
    },
    recommendationApplications: {
      include: {
        recommendation: true,
        workoutTarget: true,
      },
      orderBy: [{ id: "asc" }],
    },
  };
}

export function createWorkoutSessionRepository(db) {
  return {
    async findLatestActiveByUser(userId) {
      return db.workoutSession.findFirst({
        where: {
          userId,
          status: "active",
        },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      });
    },

    async findByUserAndIdempotencyKey({ userId, idempotencyKey }) {
      return db.workoutSession.findUnique({
        where: {
          userId_idempotencyKey: {
            userId,
            idempotencyKey,
          },
        },
      });
    },

    async findActiveByUserProgramId(userProgramId) {
      return db.workoutSession.findFirst({
        where: {
          userProgramId,
          status: "active",
        },
        orderBy: [{ startedAt: "desc" }, { id: "desc" }],
      });
    },

    async findByIdWithTargets(sessionId) {
      return db.workoutSession.findUnique({
        where: { id: sessionId },
        include: buildWorkoutSessionTargetsInclude(),
      });
    },

    async create({ data, include } = {}) {
      return db.workoutSession.create({
        data,
        ...(include ? { include } : {}),
      });
    },

    async markCompletedIfActive({ sessionId, completedAt }) {
      const existingSession = await db.workoutSession.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          userId: true,
          userProgramId: true,
          programId: true,
          programDayId: true,
          status: true,
          startedAt: true,
          completedAt: true,
        },
      });

      if (!existingSession) {
        return {
          found: false,
          transitioned: false,
          existingSession: null,
          session: null,
          updatedCount: 0,
        };
      }

      const updateResult = await db.workoutSession.updateMany({
        where: {
          id: sessionId,
          status: "active",
        },
        data: {
          completedAt,
          status: "completed",
        },
      });

      if (updateResult.count === 0) {
        return {
          found: true,
          transitioned: false,
          existingSession,
          session: null,
          updatedCount: 0,
        };
      }

      const session = await db.workoutSession.findUnique({
        where: { id: sessionId },
        include: {
          setLogs: {
            include: { exercise: true },
            orderBy: SET_LOGS_ORDER_BY,
          },
        },
      });

      return {
        found: true,
        transitioned: true,
        existingSession,
        session,
        updatedCount: updateResult.count,
      };
    },

    async findCompletionContext(sessionId) {
      return db.workoutSession.findUnique({
        where: { id: sessionId },
        include: buildWorkoutSessionTargetsInclude(),
      });
    },

    async findPreviousCompletedSessionsForExercise({
      userId,
      exerciseId,
      excludeSessionId,
    }) {
      return db.workoutSession.findMany({
        where: {
          userId,
          status: "completed",
          ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
          setLogs: {
            some: { exerciseId },
          },
        },
        orderBy: [{ completedAt: "desc" }, { id: "desc" }],
        include: {
          setLogs: {
            where: { exerciseId },
            orderBy: [{ setNumber: "asc" }, { id: "asc" }],
          },
        },
      });
    },

    async findCompletedHistoryForUserProgramDayExercise({
      userProgramId,
      programDayExerciseId,
      limit = 5,
    }) {
      const programDayExercise = await db.programDayExercise.findUnique({
        where: { id: programDayExerciseId },
        select: { exerciseId: true },
      });

      if (!programDayExercise) {
        return [];
      }

      return db.workoutSession.findMany({
        where: {
          userProgramId,
          status: "completed",
          completedAt: { not: null },
          exerciseTargets: {
            some: { programDayExerciseId },
          },
        },
        orderBy: HISTORICAL_WORKOUT_SESSION_ORDER_BY,
        take: limit,
        select: {
          id: true,
          userProgramId: true,
          programDayId: true,
          startedAt: true,
          completedAt: true,
          exerciseTargets: {
            where: { programDayExerciseId },
            orderBy: [{ id: "desc" }],
            take: 1,
            select: {
              id: true,
              programDayExerciseId: true,
              exerciseId: true,
              targetSets: true,
              targetRepRangeLow: true,
              targetRepRangeHigh: true,
              exactRepTarget: true,
              targetLoadKg: true,
              targetDurationSeconds: true,
              progressionType: true,
              sourceRecommendation: {
                select: {
                  id: true,
                  recommendationType: true,
                  decisionType: true,
                  sourceSessionId: true,
                },
              },
            },
          },
          setLogs: {
            where: {
              exerciseId: programDayExercise.exerciseId,
            },
            orderBy: [{ setNumber: "asc" }, { id: "asc" }],
            select: {
              id: true,
              exerciseId: true,
              setNumber: true,
              reps: true,
              weightKg: true,
              loggedAt: true,
            },
          },
        },
      });
    },
  };
}

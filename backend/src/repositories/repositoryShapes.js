export const PROGRAM_DAY_EXERCISE_BASELINE_INCLUDE = Object.freeze({
  exercise: {
    select: {
      id: true,
      nameFa: true,
      nameEn: true,
      movementPattern: true,
      equipment: true,
      difficulty: true,
      complexity: true,
      progressionType: true,
    },
  },
});

export const PROGRAM_DAY_WITH_EXERCISES_INCLUDE = Object.freeze({
  exercises: {
    orderBy: [{ order: "asc" }, { id: "asc" }],
    include: PROGRAM_DAY_EXERCISE_BASELINE_INCLUDE,
  },
});

export const PROGRESSION_RECOMMENDATION_INCLUDE = Object.freeze({
  exercise: true,
  sourceSession: {
    select: {
      id: true,
      userId: true,
      userProgramId: true,
      programId: true,
      programDayId: true,
      startedAt: true,
      completedAt: true,
      status: true,
    },
  },
  sourceTarget: true,
  application: true,
});

export const WORKOUT_SESSION_TARGET_INCLUDE = Object.freeze({
  exercise: true,
  programDayExercise: {
    include: PROGRAM_DAY_EXERCISE_BASELINE_INCLUDE,
  },
  sourceRecommendation: {
    include: PROGRESSION_RECOMMENDATION_INCLUDE,
  },
  recommendationApplication: true,
});

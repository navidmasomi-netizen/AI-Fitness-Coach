interface NamedExercise {
  exercise: { primaryMuscles: string[] };
}

interface TimedExercise extends NamedExercise {
  sets: number;
  restSeconds: number;
}

export function buildWorkoutName(exercises: NamedExercise[]): string {
  if (!exercises || exercises.length === 0) return "Workout";
  const muscles: string[] = [];
  for (const ex of exercises) {
    const primary = ex.exercise.primaryMuscles?.[0];
    if (primary && !muscles.includes(primary)) muscles.push(primary);
    if (muscles.length >= 2) break;
  }
  return muscles.length > 0 ? muscles.join(" + ") : "Workout";
}

export function estimateMinutes(exercises: TimedExercise[]): number {
  if (!exercises || exercises.length === 0) return 0;
  const totalSeconds = exercises.reduce((sum, ex) => {
    const perSet = (ex.restSeconds || 60) + 40;
    return sum + ex.sets * perSet;
  }, 0);
  return Math.max(1, Math.round(totalSeconds / 60));
}

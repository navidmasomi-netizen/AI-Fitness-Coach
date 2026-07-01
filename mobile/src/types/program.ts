import { Exercise, Goal } from "./exercise";

export type SplitFamily = "full_body" | "upper_lower" | "ppl" | "strength_split";

export interface ProgramDayExercise {
  id: number;
  order: number;
  sets: number;
  repRangeLow: number;
  repRangeHigh: number;
  restSeconds: number;
  intensity: string | null;
  progressionType: string | null;
  exercise: Exercise;
}

export interface ProgramDay {
  id: number;
  dayIndex: number;
  name: string;
  exercises: ProgramDayExercise[];
}

export interface Program {
  id: number;
  name: string;
  splitFamily: SplitFamily;
  goal: Goal;
  isStatic: boolean;
  days: ProgramDay[];
}

export type Equipment = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "pull_up_bar";

export type MovementPattern =
  | "squat" | "hinge" | "lunge" | "single_leg"
  | "horizontal_press" | "vertical_press"
  | "horizontal_pull" | "vertical_pull"
  | "elbow_flexion" | "elbow_extension"
  | "trunk_flexion" | "anti_extension";

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Complexity = "compound" | "isolation";
export type Goal = "hypertrophy" | "strength" | "fat_loss" | "recomposition";

export interface Exercise {
  id: number;
  nameFa: string;
  nameEn: string | null;
  description: string | null;
  icon: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  movementPattern: MovementPattern | null;
  equipment: Equipment | null;
  difficulty: Difficulty | null;
  complexity: Complexity | null;
  suitableGoals: Goal[];
  contraindications: string[];
  jointStressFlags: string[];
  substitutionNames: string[];
  defaultRepRangeLow: number | null;
  defaultRepRangeHigh: number | null;
  defaultRestSecondsLow: number | null;
  defaultRestSecondsHigh: number | null;
  progressionType: string | null;
}

import { Exercise } from "./exercise";

export type RecommendationType = "increase" | "maintain" | "deload";

export interface ProgressionRecommendation {
  id: number;
  userId: number;
  exerciseId: number;
  sourceSessionId: number;
  recommendationType: RecommendationType;
  previousWeightKg: number | null;
  recommendedWeightKg: number | null;
  previousTargetLow: number | null;
  previousTargetHigh: number | null;
  recommendedTargetLow: number | null;
  recommendedTargetHigh: number | null;
  consecutiveFailures: number;
  progressionType: string | null;
  reason: string;
  status: string;
  createdAt: string;
  exercise: Exercise;
}

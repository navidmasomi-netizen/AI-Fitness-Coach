import { apiRequest } from "./client";
import { Exercise } from "../types/exercise";

export function getExercises(): Promise<Exercise[]> {
  return apiRequest<Exercise[]>("/exercises");
}

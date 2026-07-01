import { apiRequest } from "./client";
import { ProgressionRecommendation } from "../types/progression";

export function getSessionProgressions(sessionId: number): Promise<ProgressionRecommendation[]> {
  return apiRequest<ProgressionRecommendation[]>(`/progressions/session/${sessionId}`);
}

import { apiRequest } from "./client";

export interface ProfileStatus {
  wizardCompleted: boolean;
  lastCompletedStep: number;
}

export function getMyProfile(): Promise<ProfileStatus | null> {
  return apiRequest<ProfileStatus | null>("/profile");
}

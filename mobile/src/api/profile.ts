import { apiRequest } from "./client";
import { getProfileMetadataDefaults } from "../utils/profileMetadataDefaults";

export interface UserProfile {
  id: string;
  userId: string;
  goal: string;
  trainingLevel: string;
  trainingDaysPerWeek: number;
  sessionDurationMin: number;
  equipmentAccess: string[];
  age: number;
  sex: string;
  heightCm: number;
  weightKg: number;
  occupationType: string;
  recoveryQuality: string;
  nutritionHabits: string;
  mealFrequency: number;
  supplementUse: string[];
  cardioPreference: string;
  injuryFlags: string[];
  injuryNotes: string | null;
  preferredLanguage: string;
  timezone: string;
  units: string;
  lastCompletedStep: number;
  wizardCompleted: boolean;
  wizardCompletedAt: string | null;
}

export interface ProfileStatus {
  wizardCompleted: boolean;
  lastCompletedStep: number;
}

export function getMyProfile(): Promise<ProfileStatus | null> {
  return getFullProfile().then((profile) =>
    profile
      ? {
          wizardCompleted: profile.wizardCompleted,
          lastCompletedStep: profile.lastCompletedStep,
        }
      : null
  );
}

export function getFullProfile(): Promise<UserProfile | null> {
  return apiRequest<UserProfile | null>("/profile");
}

export function patchProfile(partialFields: Record<string, unknown>): Promise<UserProfile> {
  return apiRequest<UserProfile>("/profile", {
    method: "PATCH",
    body: {
      ...getProfileMetadataDefaults(),
      ...partialFields,
    },
  });
}

export function completeProfile(): Promise<UserProfile> {
  return apiRequest<UserProfile>("/profile/complete", {
    method: "POST",
  });
}

import type { UserProfile } from "../api/profile";
import { useWizardDraftStore } from "./wizardDraftStore";

const EMPTY_WIZARD_DRAFT = {
  goal: null,
  trainingLevel: null,
  trainingDaysPerWeek: null,
  sessionDurationMin: null,
  equipmentAccess: [],
  age: null,
  sex: null,
  heightCm: null,
  weightKg: null,
  occupationType: null,
  recoveryQuality: null,
  nutritionHabits: null,
  mealFrequency: null,
  cardioPreference: null,
  supplementUse: [],
  supplementOther: null,
  injuryFlags: [],
  injuryNotes: null,
};

export function resetWizardDraft() {
  useWizardDraftStore.setState(EMPTY_WIZARD_DRAFT);
}

export function hydrateWizardDraft(profile: UserProfile | null) {
  if (!profile) {
    resetWizardDraft();
    return;
  }

  useWizardDraftStore.setState({
    goal: profile.goal || null,
    trainingLevel: profile.trainingLevel || null,
    trainingDaysPerWeek: profile.trainingDaysPerWeek > 0 ? profile.trainingDaysPerWeek : null,
    sessionDurationMin: profile.sessionDurationMin > 0 ? profile.sessionDurationMin : null,
    equipmentAccess: profile.equipmentAccess || [],
    age: profile.age > 0 ? profile.age : null,
    sex: profile.sex || null,
    heightCm: profile.heightCm > 0 ? profile.heightCm : null,
    weightKg: profile.weightKg > 0 ? profile.weightKg : null,
    occupationType: profile.occupationType || null,
    recoveryQuality: profile.recoveryQuality || null,
    nutritionHabits: profile.nutritionHabits || null,
    mealFrequency: profile.mealFrequency > 0 ? profile.mealFrequency : null,
    cardioPreference: profile.cardioPreference || null,
    supplementUse: profile.supplementUse || [],
    supplementOther: null,
    injuryFlags: profile.injuryFlags || [],
    injuryNotes: profile.injuryNotes || null,
  });
}

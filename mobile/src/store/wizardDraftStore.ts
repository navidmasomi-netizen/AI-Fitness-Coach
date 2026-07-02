import { create } from "zustand";

interface WizardDraftState {
  goal: string | null;
  trainingLevel: string | null;
  trainingDaysPerWeek: number | null;
  sessionDurationMin: number | null;
  equipmentAccess: string[];
  age: number | null;
  sex: string | null;
  heightCm: number | null;
  weightKg: number | null;
  occupationType: string | null;
  recoveryQuality: string | null;
  nutritionHabits: string | null;
  mealFrequency: number | null;
  cardioPreference: string | null;
  supplementUse: string[];
  injuryFlags: string[];
  injuryNotes: string | null;
  setGoal: (goal: string) => void;
  setTrainingLevel: (trainingLevel: string) => void;
  setTrainingDaysPerWeek: (trainingDaysPerWeek: number) => void;
  setSessionDurationMin: (sessionDurationMin: number) => void;
  setEquipmentAccess: (equipmentAccess: string[]) => void;
  setAge: (age: number | null) => void;
  setSex: (sex: string) => void;
  setHeightCm: (heightCm: number | null) => void;
  setWeightKg: (weightKg: number | null) => void;
  setOccupationType: (occupationType: string) => void;
  setRecoveryQuality: (recoveryQuality: string) => void;
  setNutritionHabits: (nutritionHabits: string) => void;
  setMealFrequency: (mealFrequency: number | null) => void;
  setCardioPreference: (cardioPreference: string) => void;
  setSupplementUse: (supplementUse: string[]) => void;
  setInjuryFlags: (injuryFlags: string[]) => void;
  setInjuryNotes: (injuryNotes: string | null) => void;
}

export const useWizardDraftStore = create<WizardDraftState>()((set) => ({
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
  injuryFlags: [],
  injuryNotes: null,
  setGoal: (goal) => set({ goal }),
  setTrainingLevel: (trainingLevel) => set({ trainingLevel }),
  setTrainingDaysPerWeek: (trainingDaysPerWeek) => set({ trainingDaysPerWeek }),
  setSessionDurationMin: (sessionDurationMin) => set({ sessionDurationMin }),
  setEquipmentAccess: (equipmentAccess) => set({ equipmentAccess }),
  setAge: (age) => set({ age }),
  setSex: (sex) => set({ sex }),
  setHeightCm: (heightCm) => set({ heightCm }),
  setWeightKg: (weightKg) => set({ weightKg }),
  setOccupationType: (occupationType) => set({ occupationType }),
  setRecoveryQuality: (recoveryQuality) => set({ recoveryQuality }),
  setNutritionHabits: (nutritionHabits) => set({ nutritionHabits }),
  setMealFrequency: (mealFrequency) => set({ mealFrequency }),
  setCardioPreference: (cardioPreference) => set({ cardioPreference }),
  setSupplementUse: (supplementUse) => set({ supplementUse }),
  setInjuryFlags: (injuryFlags) => set({ injuryFlags }),
  setInjuryNotes: (injuryNotes) => set({ injuryNotes }),
}));

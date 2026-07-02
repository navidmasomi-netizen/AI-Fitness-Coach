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
}));

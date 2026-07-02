import { create } from "zustand";

interface WizardDraftState {
  goal: string | null;
  trainingLevel: string | null;
  trainingDaysPerWeek: number | null;
  sessionDurationMin: number | null;
  equipmentAccess: string[];
  setGoal: (goal: string) => void;
  setTrainingLevel: (trainingLevel: string) => void;
  setTrainingDaysPerWeek: (trainingDaysPerWeek: number) => void;
  setSessionDurationMin: (sessionDurationMin: number) => void;
  setEquipmentAccess: (equipmentAccess: string[]) => void;
}

export const useWizardDraftStore = create<WizardDraftState>()((set) => ({
  goal: null,
  trainingLevel: null,
  trainingDaysPerWeek: null,
  sessionDurationMin: null,
  equipmentAccess: [],
  setGoal: (goal) => set({ goal }),
  setTrainingLevel: (trainingLevel) => set({ trainingLevel }),
  setTrainingDaysPerWeek: (trainingDaysPerWeek) => set({ trainingDaysPerWeek }),
  setSessionDurationMin: (sessionDurationMin) => set({ sessionDurationMin }),
  setEquipmentAccess: (equipmentAccess) => set({ equipmentAccess }),
}));

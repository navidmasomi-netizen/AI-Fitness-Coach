import { apiRequest } from "./client";
import { Program } from "../types/program";
import { Exercise, Goal } from "../types/exercise";

export function getPrograms(): Promise<Program[]> {
  return apiRequest<Program[]>("/programs");
}

export function getProgramById(id: number): Promise<Program> {
  return apiRequest<Program>(`/programs/${id}`);
}

export interface GeneratedProgramDayExercise {
  id: number;
  programDayId: number;
  exerciseId: number;
  order: number;
  sets: number;
  repRangeLow: number;
  repRangeHigh: number;
  restSeconds: number;
  intensity: string | null;
  progressionType: string | null;
  exercise: Exercise;
}

export interface GeneratedProgramDay {
  id: number;
  programId: number;
  dayIndex: number;
  name: string;
  exercises: GeneratedProgramDayExercise[];
}

export interface GeneratedUserProgram {
  id: number;
  userId: number;
  programId: number;
  currentDayIndex: number;
  activatedAt: string;
}

export interface GeneratedProgram {
  id: number;
  name: string;
  description: string | null;
  splitFamily: Program["splitFamily"];
  goal: Goal;
  isStatic: boolean;
  createdAt: string;
  days: GeneratedProgramDay[];
  userProgram: GeneratedUserProgram[];
}

export function generateProgram(): Promise<GeneratedProgram> {
  return apiRequest<GeneratedProgram>("/programs/generate", {
    method: "POST",
  });
}

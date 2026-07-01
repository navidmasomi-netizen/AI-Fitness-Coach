import { Exercise } from "./exercise";

export interface SetLog {
  id: number;
  sessionId: number;
  exerciseId: number;
  setNumber: number;
  weightKg: number | null;
  reps: number;
  loggedAt: string;
  exercise?: Exercise;
}

export interface WorkoutSession {
  id: number;
  userId: number;
  programId: number | null;
  programDayId: number | null;
  startedAt: string;
  completedAt: string | null;
  status: "active" | "completed";
  notes: string | null;
  setLogs?: SetLog[];
}

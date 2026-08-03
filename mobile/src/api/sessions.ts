import { apiRequest } from "./client";
import { WorkoutSession, SetLog } from "../types/session";
import { Program, ProgramDay } from "../types/program";
import { UserProgram } from "./userPrograms";
import { ProgressionRecommendation } from "../types/progression";

export function createSession(params: {
  userId: number;
  programId?: number;
  programDayId?: number;
  notes?: string;
}): Promise<WorkoutSession> {
  return apiRequest<WorkoutSession>("/sessions", { method: "POST", body: params });
}

export function addSetLog(
  sessionId: number,
  params: { exerciseId: number; setNumber: number; reps: number; weightKg?: number }
): Promise<SetLog> {
  return apiRequest<SetLog>(`/sessions/${sessionId}/set-logs`, { method: "POST", body: params });
}

export interface CompleteSessionResponse {
  session: WorkoutSession;
  updatedUserProgram: UserProgram | null;
  nextProgramDay: ProgramDay | null;
  warning: string | null;
  progressionRecommendations: ProgressionRecommendation[];
  progressionWarning: null;
}

export function completeSession(sessionId: number): Promise<CompleteSessionResponse> {
  return apiRequest<CompleteSessionResponse>(`/sessions/${sessionId}/complete`, { method: "PATCH" });
}

export function getUserSessions(userId: number): Promise<WorkoutSession[]> {
  return apiRequest<WorkoutSession[]>(`/sessions/user/${userId}`);
}

export interface StartFromActiveProgramResponse {
  session: WorkoutSession;
  program: Program;
  programDay: ProgramDay;
  exercises: ProgramDay["exercises"];
}

export function startFromActiveProgram(): Promise<StartFromActiveProgramResponse> {
  return apiRequest<StartFromActiveProgramResponse>("/sessions/startFromActiveProgram", {
    method: "POST",
  });
}

export interface SessionDetailResponse {
  session: WorkoutSession;
  program: import("../types/program").Program | null;
  programDay: import("../types/program").ProgramDay | null;
}

export function getSession(sessionId: number): Promise<SessionDetailResponse> {
  return apiRequest<SessionDetailResponse>(`/sessions/${sessionId}`);
}

export function getMyCompletedSessions(userId: number): Promise<WorkoutSession[]> {
  return apiRequest<WorkoutSession[]>(`/sessions/user/${userId}?status=completed`);
}

export function getActiveSession(): Promise<StartFromActiveProgramResponse | null> {
  return apiRequest<StartFromActiveProgramResponse | null>("/sessions/active");
}

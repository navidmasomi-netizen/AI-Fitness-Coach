import { apiRequest } from "./client";
import { Program } from "../types/program";

export interface UserProgram {
  id: number;
  userId: number;
  programId: number;
  currentDayIndex: number;
  activatedAt: string;
  program: Program;
}

export function activateProgram(programId: number): Promise<UserProgram> {
  return apiRequest<UserProgram>("/userprograms/activate", {
    method: "POST",
    body: { programId },
  });
}

export function getMyProgram(): Promise<UserProgram | null> {
  return apiRequest<UserProgram | null>("/userprograms/me");
}

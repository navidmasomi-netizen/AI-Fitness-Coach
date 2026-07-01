import { apiRequest } from "./client";
import { Program } from "../types/program";

export function getPrograms(): Promise<Program[]> {
  return apiRequest<Program[]>("/programs");
}

export function getProgramById(id: number): Promise<Program> {
  return apiRequest<Program>(`/programs/${id}`);
}

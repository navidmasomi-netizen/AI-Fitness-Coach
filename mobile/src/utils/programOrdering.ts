import type { ProgramDay } from "../types/program";

export function getOrderedProgramDays(days: ProgramDay[]): ProgramDay[] {
  return [...days]
    .sort((left, right) => left.dayIndex - right.dayIndex)
    .map((day) => ({
      ...day,
      exercises: [...day.exercises].sort((left, right) => left.order - right.order),
    }));
}

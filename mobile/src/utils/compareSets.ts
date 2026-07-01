import { WorkoutSession, SetLog } from "../types/session";

export function getLastSetForExercise(session: WorkoutSession | undefined, exerciseId: number): SetLog | null {
  if (!session || !session.setLogs) return null;
  const logs = session.setLogs.filter((s) => s.exerciseId === exerciseId);
  if (logs.length === 0) return null;
  return logs.reduce((max, s) => (s.setNumber > max.setNumber ? s : max), logs[0]);
}

export type Trend = "up" | "same" | "down";

export function getTrend(current: SetLog, previous: SetLog): Trend {
  const cw = current.weightKg ?? 0;
  const pw = previous.weightKg ?? 0;
  if (cw > pw) return "up";
  if (cw < pw) return "down";
  if (current.reps > previous.reps) return "up";
  if (current.reps < previous.reps) return "down";
  return "same";
}

export function trendArrow(trend: Trend): string {
  if (trend === "up") return "\u2191";
  if (trend === "down") return "\u2193";
  return "\u2192";
}

export function comparisonText(current: SetLog, previous: SetLog): string {
  const prevText = `${previous.reps} reps${previous.weightKg !== null ? ` @ ${previous.weightKg}kg` : ""}`;
  const nowText = `${current.reps} reps${current.weightKg !== null ? ` @ ${current.weightKg}kg` : ""}`;
  return `Last time: ${prevText} \u2192 Now: ${nowText}`;
}

export function findPreviousSession(
  sessions: WorkoutSession[] | undefined,
  currentSessionId: number
): WorkoutSession | undefined {
  if (!sessions) return undefined;
  const index = sessions.findIndex((s) => s.id === currentSessionId);
  if (index === -1 || index + 1 >= sessions.length) return undefined;
  return sessions[index + 1];
}

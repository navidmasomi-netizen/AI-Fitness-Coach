export function createRestDeadline(restSeconds: number, nowMs: number): number {
  const durationSeconds = Number.isFinite(restSeconds) && restSeconds > 0 ? restSeconds : 60;
  return nowMs + Math.ceil(durationSeconds) * 1000;
}

export function getRestSecondsRemaining(deadlineMs: number, nowMs: number): number {
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) return 0;

  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

export function resumeRestDeadline(remainingSeconds: number, nowMs: number): number | null {
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) return null;

  return nowMs + Math.ceil(remainingSeconds) * 1000;
}

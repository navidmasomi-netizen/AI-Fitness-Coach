export type ReplacementMobileEvent =
  | "replacement.discovery.started"
  | "replacement.discovery.completed"
  | "replacement.discovery.failed"
  | "replacement.apply.started"
  | "replacement.apply.completed"
  | "replacement.apply.failed";

function buildRandomSegment() {
  return Math.random().toString(36).slice(2, 10);
}

export function createReplacementFlowId(sessionId: number, targetId: number) {
  return `replacement-flow-${sessionId}-${targetId}-${Date.now()}-${buildRandomSegment()}`;
}

export function logReplacementMobileEvent(
  event: ReplacementMobileEvent,
  fields: Record<string, unknown> = {}
) {
  console.info(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event,
      platform: "mobile",
      ...fields,
    })
  );
}

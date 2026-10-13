export type RouteParam = string | string[] | undefined;

function getSingleStringParam(value: RouteParam): string | null {
  return typeof value === "string" ? value : null;
}

export function getRequiredRouteString(value: RouteParam): string | null {
  const param = getSingleStringParam(value);
  return param && param.trim().length > 0 ? param : null;
}

export function getPositiveRouteId(value: RouteParam): number | null {
  const param = getSingleStringParam(value);
  if (!param || !/^[1-9]\d*$/.test(param)) return null;

  const id = Number(param);
  return Number.isSafeInteger(id) ? id : null;
}

export function parseRequiredRouteArray<T>(
  value: RouteParam,
  isItem: (item: unknown) => item is T
): T[] | null {
  const param = getSingleStringParam(value);
  if (param === null) return null;

  try {
    const parsed: unknown = JSON.parse(param);
    return Array.isArray(parsed) && parsed.every(isItem) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseOptionalRouteArray<T>(
  value: RouteParam,
  isItem: (item: unknown) => item is T
): T[] | null {
  if (value === undefined) return [];
  return parseRequiredRouteArray(value, isItem);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

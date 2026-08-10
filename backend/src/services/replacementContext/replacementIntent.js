export const REPLACEMENT_INTENT_V1_VERSION = "replacement-intent-v1";

export const REPLACEMENT_INTENT_TYPES = Object.freeze({
  UNKNOWN: "UNKNOWN",
  NO_EQUIPMENT: "NO_EQUIPMENT",
  EQUIPMENT_BUSY: "EQUIPMENT_BUSY",
  EXERCISE_UNAVAILABLE: "EXERCISE_UNAVAILABLE",
  PREFER_VARIATION: "PREFER_VARIATION",
  DISCOMFORT: "DISCOMFORT",
});

const ALLOWED_TOP_LEVEL_FIELDS = Object.freeze(["version", "type"]);
const ALLOWED_INTENT_TYPES = new Set(Object.values(REPLACEMENT_INTENT_TYPES));

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }

  Object.freeze(value);
  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue);
  }
  return value;
}

function assertExactKeys(object, allowedKeys, fieldName) {
  for (const key of Object.keys(object)) {
    if (!allowedKeys.includes(key)) {
      throw new Error(`${fieldName} contains unsupported field "${key}".`);
    }
  }
}

export function buildReplacementIntentV1(rawIntent) {
  if (!isPlainObject(rawIntent)) {
    throw new Error("replacement intent must be a plain object.");
  }

  assertExactKeys(rawIntent, ALLOWED_TOP_LEVEL_FIELDS, "replacement intent");

  if (rawIntent.version !== REPLACEMENT_INTENT_V1_VERSION) {
    throw new Error(`replacement intent version must be "${REPLACEMENT_INTENT_V1_VERSION}".`);
  }

  if (typeof rawIntent.type !== "string" || rawIntent.type.length === 0) {
    throw new Error("replacement intent.type must be a non-empty string.");
  }

  if (!ALLOWED_INTENT_TYPES.has(rawIntent.type)) {
    throw new Error(`replacement intent.type "${rawIntent.type}" is not supported in ${REPLACEMENT_INTENT_V1_VERSION}.`);
  }

  return deepFreeze({
    version: REPLACEMENT_INTENT_V1_VERSION,
    type: rawIntent.type,
  });
}

import { CATALOG_EQUIPMENT_VALUES } from "../exerciseCatalogValidation.js";

export const REPLACEMENT_CONTEXT_V1_VERSION = "replacement-context-v1";

const CATALOG_EQUIPMENT_SET = new Set(CATALOG_EQUIPMENT_VALUES);
const ALLOWED_TOP_LEVEL_FIELDS = Object.freeze(["version", "equipmentContext", "replacementIntent"]);
const ALLOWED_EQUIPMENT_CONTEXT_FIELDS = Object.freeze(["availableEquipment"]);

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

function normalizeEquipmentArray(values, fieldName) {
  if (!Array.isArray(values)) {
    throw new Error(`${fieldName} must be an array of CatalogEquipment values.`);
  }

  const normalized = [];
  const seen = new Set();

  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`${fieldName} must contain non-empty CatalogEquipment strings.`);
    }
    if (!CATALOG_EQUIPMENT_SET.has(value)) {
      throw new Error(`${fieldName} contains unsupported CatalogEquipment value "${value}".`);
    }
    if (!seen.has(value)) {
      seen.add(value);
      normalized.push(value);
    }
  }

  return normalized.sort();
}

function normalizeEquipmentContext(equipmentContext) {
  if (equipmentContext === undefined || equipmentContext === null) {
    return null;
  }

  if (!isPlainObject(equipmentContext)) {
    throw new Error("equipmentContext must be a plain object or null.");
  }

  assertExactKeys(equipmentContext, ALLOWED_EQUIPMENT_CONTEXT_FIELDS, "equipmentContext");

  if (!Object.prototype.hasOwnProperty.call(equipmentContext, "availableEquipment")) {
    throw new Error('equipmentContext must include "availableEquipment" when provided.');
  }

  return deepFreeze({
    availableEquipment: normalizeEquipmentArray(equipmentContext.availableEquipment, "equipmentContext.availableEquipment"),
  });
}

function normalizeReplacementIntent(replacementIntent) {
  if (replacementIntent === undefined || replacementIntent === null) {
    return null;
  }

  throw new Error("replacementIntent is reserved and must be null in replacement-context-v1.");
}

export function buildReplacementContextV1(rawContext) {
  if (!isPlainObject(rawContext)) {
    throw new Error("replacement context must be a plain object.");
  }

  assertExactKeys(rawContext, ALLOWED_TOP_LEVEL_FIELDS, "replacement context");

  if (rawContext.version !== REPLACEMENT_CONTEXT_V1_VERSION) {
    throw new Error(`replacement context version must be "${REPLACEMENT_CONTEXT_V1_VERSION}".`);
  }

  return deepFreeze({
    version: REPLACEMENT_CONTEXT_V1_VERSION,
    equipmentContext: normalizeEquipmentContext(rawContext.equipmentContext),
    replacementIntent: normalizeReplacementIntent(rawContext.replacementIntent),
  });
}

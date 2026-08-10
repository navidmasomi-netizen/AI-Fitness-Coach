import { CATALOG_EQUIPMENT_VALUES } from "../exerciseCatalogValidation.js";

export const EQUIPMENT_AVAILABILITY_V1_VERSION = "equipment-availability-v1";
export const BODYWEIGHT_CATALOG_EQUIPMENT = "bodyweight";

export const EQUIPMENT_AVAILABILITY_STATUSES = Object.freeze({
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
  CONTEXT_UNKNOWN: "CONTEXT_UNKNOWN",
  METADATA_UNAVAILABLE: "METADATA_UNAVAILABLE",
});

export const EQUIPMENT_AVAILABILITY_REASON_CODES = Object.freeze({
  ALL_REQUIREMENTS_MET: "EQUIPMENT_AVAILABILITY_ALL_REQUIREMENTS_MET",
  REQUIRED_ITEM_MISSING: "EQUIPMENT_AVAILABILITY_REQUIRED_ITEM_MISSING",
  CONTEXT_UNKNOWN: "EQUIPMENT_AVAILABILITY_CONTEXT_UNKNOWN",
  METADATA_UNAVAILABLE: "EQUIPMENT_AVAILABILITY_METADATA_UNAVAILABLE",
  BODYWEIGHT_IMPLICIT: "EQUIPMENT_AVAILABILITY_BODYWEIGHT_IMPLICIT",
});

const CATALOG_EQUIPMENT_SET = new Set(CATALOG_EQUIPMENT_VALUES);

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

function normalizeReason(reason) {
  if (!isPlainObject(reason)) {
    throw new Error("equipment availability reason must be a plain object.");
  }

  if (typeof reason.code !== "string" || reason.code.length === 0) {
    throw new Error("equipment availability reason.code must be a non-empty string.");
  }

  return deepFreeze({
    code: reason.code,
    data: reason.data ?? null,
  });
}

function assertPositiveInteger(value, fieldName) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }
}

function assertExerciseLike(exercise, fieldName) {
  if (!isPlainObject(exercise)) {
    throw new Error(`${fieldName} must be a plain exercise object.`);
  }

  const exerciseId = exercise.exerciseId ?? exercise.id;
  assertPositiveInteger(exerciseId, `${fieldName}.exerciseId`);
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

function normalizeRequiredEquipment(exercise) {
  return normalizeEquipmentArray(exercise.requiredEquipment ?? [], "exercise.requiredEquipment");
}

function normalizeAvailableEquipmentContext(context) {
  if (context === null || context === undefined) {
    return deepFreeze({
      status: EQUIPMENT_AVAILABILITY_STATUSES.CONTEXT_UNKNOWN,
      explicitAvailableEquipment: null,
      effectiveAvailableEquipment: null,
      implicitEquipment: [],
      reasons: [
        normalizeReason({
          code: EQUIPMENT_AVAILABILITY_REASON_CODES.CONTEXT_UNKNOWN,
        }),
      ],
    });
  }

  if (!isPlainObject(context)) {
    throw new Error("equipment availability context must be a plain object when provided.");
  }

  if (!Object.prototype.hasOwnProperty.call(context, "availableEquipment")) {
    return deepFreeze({
      status: EQUIPMENT_AVAILABILITY_STATUSES.CONTEXT_UNKNOWN,
      explicitAvailableEquipment: null,
      effectiveAvailableEquipment: null,
      implicitEquipment: [],
      reasons: [
        normalizeReason({
          code: EQUIPMENT_AVAILABILITY_REASON_CODES.CONTEXT_UNKNOWN,
        }),
      ],
    });
  }

  const explicitAvailableEquipment = normalizeEquipmentArray(
    context.availableEquipment,
    "context.availableEquipment"
  );

  const effectiveAvailableEquipmentSet = new Set(explicitAvailableEquipment);
  const implicitEquipment = [];

  if (!effectiveAvailableEquipmentSet.has(BODYWEIGHT_CATALOG_EQUIPMENT)) {
    effectiveAvailableEquipmentSet.add(BODYWEIGHT_CATALOG_EQUIPMENT);
    implicitEquipment.push(BODYWEIGHT_CATALOG_EQUIPMENT);
  }

  return deepFreeze({
    status: null,
    explicitAvailableEquipment,
    effectiveAvailableEquipment: [...effectiveAvailableEquipmentSet].sort(),
    implicitEquipment,
    reasons: implicitEquipment.length
      ? [
          normalizeReason({
            code: EQUIPMENT_AVAILABILITY_REASON_CODES.BODYWEIGHT_IMPLICIT,
            data: {
              implicitEquipment,
            },
          }),
        ]
      : [],
  });
}

export function evaluateExerciseEquipmentAvailability(exercise, context) {
  assertExerciseLike(exercise, "exercise");

  const exerciseId = exercise.exerciseId ?? exercise.id;
  const requiredEquipment = normalizeRequiredEquipment(exercise);

  if (requiredEquipment.length === 0) {
    return deepFreeze({
      exerciseId,
      status: EQUIPMENT_AVAILABILITY_STATUSES.METADATA_UNAVAILABLE,
      requiredEquipment,
      availableEquipment: null,
      matchedEquipment: [],
      missingEquipment: [],
      reasons: [
        normalizeReason({
          code: EQUIPMENT_AVAILABILITY_REASON_CODES.METADATA_UNAVAILABLE,
          data: {
            exerciseId,
          },
        }),
      ],
    });
  }

  const normalizedContext = normalizeAvailableEquipmentContext(context);
  if (normalizedContext.status === EQUIPMENT_AVAILABILITY_STATUSES.CONTEXT_UNKNOWN) {
    return deepFreeze({
      exerciseId,
      status: EQUIPMENT_AVAILABILITY_STATUSES.CONTEXT_UNKNOWN,
      requiredEquipment,
      availableEquipment: null,
      matchedEquipment: [],
      missingEquipment: [],
      reasons: normalizedContext.reasons,
    });
  }

  const availableEquipment = normalizedContext.effectiveAvailableEquipment;
  const availableEquipmentSet = new Set(availableEquipment);
  const matchedEquipment = [];
  const missingEquipment = [];

  for (const requiredItem of requiredEquipment) {
    if (availableEquipmentSet.has(requiredItem)) {
      matchedEquipment.push(requiredItem);
    } else {
      missingEquipment.push(requiredItem);
    }
  }

  const reasons = [...normalizedContext.reasons];

  if (missingEquipment.length > 0) {
    reasons.push(
      normalizeReason({
        code: EQUIPMENT_AVAILABILITY_REASON_CODES.REQUIRED_ITEM_MISSING,
        data: {
          exerciseId,
          missingEquipment,
        },
      })
    );

    return deepFreeze({
      exerciseId,
      status: EQUIPMENT_AVAILABILITY_STATUSES.UNAVAILABLE,
      requiredEquipment,
      availableEquipment,
      matchedEquipment,
      missingEquipment,
      reasons,
    });
  }

  reasons.push(
    normalizeReason({
      code: EQUIPMENT_AVAILABILITY_REASON_CODES.ALL_REQUIREMENTS_MET,
      data: {
        exerciseId,
        matchedEquipment,
      },
    })
  );

  return deepFreeze({
    exerciseId,
    status: EQUIPMENT_AVAILABILITY_STATUSES.AVAILABLE,
    requiredEquipment,
    availableEquipment,
    matchedEquipment,
    missingEquipment,
    reasons,
  });
}

export function evaluateEquipmentAvailabilityForExercises(exercises, context) {
  if (!Array.isArray(exercises)) {
    throw new Error("exercises must be an array.");
  }

  const evaluations = exercises.map((exercise) => evaluateExerciseEquipmentAvailability(exercise, context));

  return deepFreeze({
    version: EQUIPMENT_AVAILABILITY_V1_VERSION,
    totalEvaluated: evaluations.length,
    evaluations,
  });
}

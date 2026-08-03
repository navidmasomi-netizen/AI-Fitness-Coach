export class TrainingStateSignalsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TrainingStateSignalsValidationError";
  }
}

const ALLOWED_ROOT_KEYS = Object.freeze(["fatigue", "consistency", "adaptation"]);
const ALLOWED_CONSISTENCY_KEYS = Object.freeze([
  "exerciseAdherence",
  "missedSessions",
  "sessionDensity",
]);
const ALLOWED_ADAPTATION_KEYS = Object.freeze([
  "plateauDetection",
  "deloadHistory",
]);
const PLATEAU_STATUSES = new Set(["NONE", "POSSIBLE", "CONFIRMED"]);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isValidNullableNumber(value) {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isValidNullableIsoString(value) {
  return value === null || typeof value === "string";
}

function validateAllowedKeys(value, path, allowedKeys) {
  const allowedKeySet = new Set(allowedKeys);
  for (const key of Object.keys(value)) {
    if (!allowedKeySet.has(key)) {
      throw new TrainingStateSignalsValidationError(`${path}.${key} is not supported`);
    }
  }
}

function cloneSerializable(value, path) {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => cloneSerializable(entry, `${path}[${index}]`));
  }

  if (isPlainObject(value)) {
    const cloned = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      cloned[key] = cloneSerializable(nestedValue, `${path}.${key}`);
    }
    return cloned;
  }

  throw new TrainingStateSignalsValidationError(
    `${path} must be composed of plain objects, arrays, and JSON-like primitive values`
  );
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

function validateFatigueDomain(fatigue) {
  if (!isPlainObject(fatigue)) {
    throw new TrainingStateSignalsValidationError("fatigue is required");
  }

  validateAllowedKeys(fatigue, "fatigue", ["historicalTrainingSignals"]);

  if (!isPlainObject(fatigue.historicalTrainingSignals)) {
    throw new TrainingStateSignalsValidationError(
      "fatigue.historicalTrainingSignals is required"
    );
  }
}

function validateExerciseAdherence(value) {
  if (!isPlainObject(value)) {
    throw new TrainingStateSignalsValidationError(
      "consistency.exerciseAdherence is required when consistency is provided"
    );
  }

  validateAllowedKeys(value, "consistency.exerciseAdherence", [
    "timesPrescribed",
    "timesLogged",
    "adherenceRate",
  ]);

  if (!isNonNegativeInteger(value.timesPrescribed)) {
    throw new TrainingStateSignalsValidationError(
      "consistency.exerciseAdherence.timesPrescribed must be a non-negative integer"
    );
  }

  if (!isNonNegativeInteger(value.timesLogged)) {
    throw new TrainingStateSignalsValidationError(
      "consistency.exerciseAdherence.timesLogged must be a non-negative integer"
    );
  }

  if (!isValidNullableNumber(value.adherenceRate)) {
    throw new TrainingStateSignalsValidationError(
      "consistency.exerciseAdherence.adherenceRate must be a finite number or null"
    );
  }
}

function validateMissedSessions(value) {
  if (!isPlainObject(value)) {
    throw new TrainingStateSignalsValidationError(
      "consistency.missedSessions is required when consistency is provided"
    );
  }

  validateAllowedKeys(value, "consistency.missedSessions", [
    "completionRate",
    "missedSessionGapCount",
    "largestMissedSessionGapDays",
  ]);

  if (!isValidNullableNumber(value.completionRate)) {
    throw new TrainingStateSignalsValidationError(
      "consistency.missedSessions.completionRate must be a finite number or null"
    );
  }

  if (!isNonNegativeInteger(value.missedSessionGapCount)) {
    throw new TrainingStateSignalsValidationError(
      "consistency.missedSessions.missedSessionGapCount must be a non-negative integer"
    );
  }

  if (!isValidNullableNumber(value.largestMissedSessionGapDays)) {
    throw new TrainingStateSignalsValidationError(
      "consistency.missedSessions.largestMissedSessionGapDays must be a finite number or null"
    );
  }
}

function validateSessionDensity(value) {
  if (!isPlainObject(value)) {
    throw new TrainingStateSignalsValidationError(
      "consistency.sessionDensity is required when consistency is provided"
    );
  }

  validateAllowedKeys(value, "consistency.sessionDensity", [
    "sessionsPerWeek",
    "averageGapDays",
    "recentGapDays",
  ]);

  for (const field of ["sessionsPerWeek", "averageGapDays", "recentGapDays"]) {
    if (!isValidNullableNumber(value[field])) {
      throw new TrainingStateSignalsValidationError(
        `consistency.sessionDensity.${field} must be a finite number or null`
      );
    }
  }
}

function validateConsistencyDomain(consistency) {
  if (!isPlainObject(consistency)) {
    throw new TrainingStateSignalsValidationError(
      "consistency must be an object when provided"
    );
  }

  validateAllowedKeys(consistency, "consistency", ALLOWED_CONSISTENCY_KEYS);
  validateExerciseAdherence(consistency.exerciseAdherence);
  validateMissedSessions(consistency.missedSessions);
  validateSessionDensity(consistency.sessionDensity);
}

function validatePlateauDetection(value) {
  if (!isPlainObject(value)) {
    throw new TrainingStateSignalsValidationError(
      "adaptation.plateauDetection is required when adaptation is provided"
    );
  }

  validateAllowedKeys(value, "adaptation.plateauDetection", [
    "status",
    "basedOnStableTrend",
    "basedOnRepeatedMaintains",
  ]);

  if (!PLATEAU_STATUSES.has(value.status)) {
    throw new TrainingStateSignalsValidationError(
      "adaptation.plateauDetection.status must be NONE, POSSIBLE, or CONFIRMED"
    );
  }

  for (const field of ["basedOnStableTrend", "basedOnRepeatedMaintains"]) {
    if (typeof value[field] !== "boolean") {
      throw new TrainingStateSignalsValidationError(
        `adaptation.plateauDetection.${field} must be a boolean`
      );
    }
  }
}

function validateDeloadHistory(value) {
  if (!isPlainObject(value)) {
    throw new TrainingStateSignalsValidationError(
      "adaptation.deloadHistory is required when adaptation is provided"
    );
  }

  validateAllowedKeys(value, "adaptation.deloadHistory", [
    "recentDeloadCount",
    "mostRecentDeloadAt",
    "hasRecentDeload",
  ]);

  if (!isNonNegativeInteger(value.recentDeloadCount)) {
    throw new TrainingStateSignalsValidationError(
      "adaptation.deloadHistory.recentDeloadCount must be a non-negative integer"
    );
  }

  if (!isValidNullableIsoString(value.mostRecentDeloadAt)) {
    throw new TrainingStateSignalsValidationError(
      "adaptation.deloadHistory.mostRecentDeloadAt must be a string or null"
    );
  }

  if (typeof value.hasRecentDeload !== "boolean") {
    throw new TrainingStateSignalsValidationError(
      "adaptation.deloadHistory.hasRecentDeload must be a boolean"
    );
  }
}

function validateAdaptationDomain(adaptation) {
  if (!isPlainObject(adaptation)) {
    throw new TrainingStateSignalsValidationError(
      "adaptation must be an object when provided"
    );
  }

  validateAllowedKeys(adaptation, "adaptation", ALLOWED_ADAPTATION_KEYS);
  validatePlateauDetection(adaptation.plateauDetection);
  validateDeloadHistory(adaptation.deloadHistory);
}

export function createTrainingStateSignals(input) {
  if (!isPlainObject(input)) {
    throw new TrainingStateSignalsValidationError(
      "training state signals input is required"
    );
  }

  validateAllowedKeys(input, "trainingStateSignals", ALLOWED_ROOT_KEYS);

  validateFatigueDomain(input.fatigue);
  if (input.consistency !== undefined) {
    validateConsistencyDomain(input.consistency);
  }
  if (input.adaptation !== undefined) {
    validateAdaptationDomain(input.adaptation);
  }

  const output = {
    fatigue: {
      historicalTrainingSignals: cloneSerializable(
        input.fatigue.historicalTrainingSignals,
        "fatigue.historicalTrainingSignals"
      ),
    },
  };

  if (input.consistency !== undefined) {
    output.consistency = cloneSerializable(input.consistency, "consistency");
  }

  if (input.adaptation !== undefined) {
    output.adaptation = cloneSerializable(input.adaptation, "adaptation");
  }

  return deepFreeze(output);
}

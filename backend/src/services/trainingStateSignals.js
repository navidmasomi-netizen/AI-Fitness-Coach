export class TrainingStateSignalsValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "TrainingStateSignalsValidationError";
  }
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
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

  if (!isPlainObject(fatigue.historicalTrainingSignals)) {
    throw new TrainingStateSignalsValidationError(
      "fatigue.historicalTrainingSignals is required"
    );
  }
}

export function createTrainingStateSignals(input) {
  if (!isPlainObject(input)) {
    throw new TrainingStateSignalsValidationError(
      "training state signals input is required"
    );
  }

  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== "fatigue") {
    throw new TrainingStateSignalsValidationError(
      "training state signals currently support only the fatigue domain"
    );
  }

  validateFatigueDomain(input.fatigue);

  return deepFreeze({
    fatigue: {
      historicalTrainingSignals: cloneSerializable(
        input.fatigue.historicalTrainingSignals,
        "fatigue.historicalTrainingSignals"
      ),
    },
  });
}

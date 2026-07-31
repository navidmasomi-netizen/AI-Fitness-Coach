export class ProgressionDecisionContextValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProgressionDecisionContextValidationError";
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

  throw new ProgressionDecisionContextValidationError(
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

function validateSection(input, fieldName) {
  if (!isPlainObject(input[fieldName])) {
    throw new ProgressionDecisionContextValidationError(`${fieldName} is required`);
  }
}

function validatePreviousDecisionContext(previousDecisionContext) {
  if (previousDecisionContext === null) {
    return;
  }

  if (!isPlainObject(previousDecisionContext)) {
    throw new ProgressionDecisionContextValidationError(
      "previousDecisionContext must be null or an object"
    );
  }
}

function validateLegacyTrainingStateInput(input) {
  validateSection(input, "historicalTrainingSignals");
}

function validateTrainingStateSignalsInput(input) {
  validateSection(input, "trainingStateSignals");

  if (!isPlainObject(input.trainingStateSignals.fatigue)) {
    throw new ProgressionDecisionContextValidationError(
      "trainingStateSignals.fatigue is required"
    );
  }

  if (!isPlainObject(input.trainingStateSignals.fatigue.historicalTrainingSignals)) {
    throw new ProgressionDecisionContextValidationError(
      "trainingStateSignals.fatigue.historicalTrainingSignals is required"
    );
  }
}

function validateTrainingStateInput(input) {
  if (isPlainObject(input.trainingStateSignals)) {
    validateTrainingStateSignalsInput(input);
    return;
  }

  validateLegacyTrainingStateInput(input);
}

function cloneLegacyTrainingStateInput(input) {
  return {
    historicalTrainingSignals: cloneSerializable(
      input.historicalTrainingSignals,
      "historicalTrainingSignals"
    ),
  };
}

function cloneTrainingStateInput(input) {
  if (isPlainObject(input.trainingStateSignals)) {
    return {
      historicalTrainingSignals: cloneSerializable(
        input.trainingStateSignals.fatigue.historicalTrainingSignals,
        "trainingStateSignals.fatigue.historicalTrainingSignals"
      ),
    };
  }

  return cloneLegacyTrainingStateInput(input);
}

function adaptLegacyTrainingStateInput(context) {
  return {
    historicalTrainingSignals: context.historicalTrainingSignals,
  };
}

function validateInput(input) {
  if (!isPlainObject(input)) {
    throw new ProgressionDecisionContextValidationError("decision context input is required");
  }

  validateSection(input, "analysis");
  validateSection(input, "progressionPolicy");
  validateSection(input, "recoveryConstraint");
  validateTrainingStateInput(input);
  validatePreviousDecisionContext(input.previousDecisionContext ?? null);
}

export function createProgressionDecisionContext(input) {
  validateInput(input);

  return deepFreeze({
    analysis: cloneSerializable(input.analysis, "analysis"),
    progressionPolicy: cloneSerializable(
      input.progressionPolicy,
      "progressionPolicy"
    ),
    recoveryConstraint: cloneSerializable(
      input.recoveryConstraint,
      "recoveryConstraint"
    ),
    previousDecisionContext: cloneSerializable(
      input.previousDecisionContext ?? null,
      "previousDecisionContext"
    ),
    // Temporary compatibility until Phase 10.4: unwrap the new training-state
    // contract back to the existing historical signal boundary without changing
    // any downstream engine inputs.
    ...cloneTrainingStateInput(input),
  });
}

export function toProgressionDecisionEngineInput(context) {
  validateInput(context);

  return {
    analysis: context.analysis,
    progressionPolicy: context.progressionPolicy,
    recoveryConstraint: context.recoveryConstraint,
    previousDecisionContext: context.previousDecisionContext,
    ...adaptLegacyTrainingStateInput(context),
    existingRecommendationContext: null,
    policyThresholds: {
      deloadFailureStreak: 2,
    },
  };
}

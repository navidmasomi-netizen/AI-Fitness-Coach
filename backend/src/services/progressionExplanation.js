export const PROGRESSION_EXPLANATION_VERSION = "progression_explanation_v1";
export const PROGRESSION_EXPLANATION_MESSAGE_KEY_PREFIX = "progression_explanation";

const ALLOWED_EXPLANATION_INPUT_KEYS = new Set([
  "messageKey",
  "userSummary",
  "developerSummary",
  "primaryReason",
  "secondaryReasons",
]);
const ALLOWED_REASON_KEYS = new Set(["code"]);

export class ProgressionExplanationValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProgressionExplanationValidationError";
  }
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function assertNoUnsupportedKeys(value, allowedKeys, label) {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) {
      throw new ProgressionExplanationValidationError(
        `${label}.${key} is not supported`
      );
    }
  }
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

function normalizeReasonCode(code, label) {
  if (!isNonEmptyString(code)) {
    throw new ProgressionExplanationValidationError(`${label} must be a non-empty string`);
  }

  return code.trim();
}

function normalizeReason(input, label) {
  if (!isPlainObject(input)) {
    throw new ProgressionExplanationValidationError(`${label} is required`);
  }

  assertNoUnsupportedKeys(input, ALLOWED_REASON_KEYS, label);

  return {
    code: normalizeReasonCode(input.code, `${label}.code`),
  };
}

export function createProgressionExplanationMessageKey(primaryReasonCode) {
  const normalizedCode = normalizeReasonCode(
    primaryReasonCode,
    "primaryReason.code"
  ).toLowerCase();

  return `${PROGRESSION_EXPLANATION_MESSAGE_KEY_PREFIX}.${normalizedCode}`;
}

function normalizeSecondaryReasons(secondaryReasons, primaryReasonCode) {
  if (typeof secondaryReasons === "undefined") {
    return [];
  }

  if (!Array.isArray(secondaryReasons)) {
    throw new ProgressionExplanationValidationError(
      "secondaryReasons must be an array"
    );
  }

  const normalized = [];
  const seen = new Set();

  for (let index = 0; index < secondaryReasons.length; index += 1) {
    const secondaryReason = normalizeReason(
      secondaryReasons[index],
      `secondaryReasons[${index}]`
    );

    if (secondaryReason.code === primaryReasonCode) {
      throw new ProgressionExplanationValidationError(
        "secondaryReasons must not repeat primaryReason.code"
      );
    }

    if (seen.has(secondaryReason.code)) {
      throw new ProgressionExplanationValidationError(
        "secondaryReasons must not contain duplicate codes"
      );
    }

    seen.add(secondaryReason.code);
    normalized.push(secondaryReason);
  }

  return normalized;
}

function normalizeDeveloperSummary(developerSummary) {
  if (typeof developerSummary === "undefined" || developerSummary === null) {
    return null;
  }

  if (!isNonEmptyString(developerSummary)) {
    throw new ProgressionExplanationValidationError(
      "developerSummary must be null or a non-empty string"
    );
  }

  return developerSummary.trim();
}

export function createProgressionExplanation(input) {
  if (!isPlainObject(input)) {
    throw new ProgressionExplanationValidationError("input is required");
  }

  assertNoUnsupportedKeys(input, ALLOWED_EXPLANATION_INPUT_KEYS, "input");

  const primaryReason = normalizeReason(input.primaryReason, "primaryReason");
  const expectedMessageKey = createProgressionExplanationMessageKey(
    primaryReason.code
  );

  if (!isNonEmptyString(input.messageKey)) {
    throw new ProgressionExplanationValidationError(
      "messageKey must be a non-empty string"
    );
  }

  const messageKey = input.messageKey.trim();
  if (messageKey !== expectedMessageKey) {
    throw new ProgressionExplanationValidationError(
      `messageKey must equal "${expectedMessageKey}"`
    );
  }

  if (!isNonEmptyString(input.userSummary)) {
    throw new ProgressionExplanationValidationError(
      "userSummary must be a non-empty string"
    );
  }

  const explanation = {
    version: PROGRESSION_EXPLANATION_VERSION,
    messageKey,
    userSummary: input.userSummary.trim(),
    developerSummary: normalizeDeveloperSummary(input.developerSummary),
    primaryReason,
    secondaryReasons: normalizeSecondaryReasons(
      input.secondaryReasons,
      primaryReason.code
    ),
  };

  return deepFreeze(explanation);
}

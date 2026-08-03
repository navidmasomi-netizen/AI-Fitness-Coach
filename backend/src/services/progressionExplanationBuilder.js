import {
  createProgressionExplanation,
  createProgressionExplanationMessageKey,
} from "./progressionExplanation.js";

const DECISION_TYPES = Object.freeze({
  INCREASE_LOAD: "INCREASE_LOAD",
  INCREASE_REPS: "INCREASE_REPS",
  INCREASE_DURATION: "INCREASE_DURATION",
  MAINTAIN: "MAINTAIN",
  DELOAD: "DELOAD",
  INSUFFICIENT_DATA: "INSUFFICIENT_DATA",
  SKIP: "SKIP",
  MANUAL_REVIEW: "MANUAL_REVIEW",
});

const DECISION_TYPE_VALUES = new Set(Object.values(DECISION_TYPES));
const GENERIC_SAFE_USER_SUMMARY =
  "Progression decision recorded for the next session.";

const EXPLANATION_TEMPLATES = Object.freeze({
  RULE_V1_INVALID_ANALYSIS: Object.freeze({
    userSummary: GENERIC_SAFE_USER_SUMMARY,
    classification: "generic-safe",
  }),
  RULE_V1_ZERO_PRESCRIPTION: Object.freeze({
    userSummary: GENERIC_SAFE_USER_SUMMARY,
    classification: "generic-safe",
  }),
  RULE_V1_INSUFFICIENT_HISTORY: Object.freeze({
    userSummary: GENERIC_SAFE_USER_SUMMARY,
    classification: "generic-safe",
  }),
  RULE_V1_TARGETS_FULLY_MET: Object.freeze({
    userSummary: "Targets were fully met, so the next session stays the same.",
    classification: "precise",
  }),
  RULE_V1_TARGETS_PARTIALLY_MET: Object.freeze({
    userSummary: "Targets were not fully met, so the next session stays the same.",
    classification: "precise",
  }),
  RULE_V1_PERFORMANCE_IMPROVED: Object.freeze({
    userSummary: "Performance improved, so the next session increases the challenge.",
    classification: "precise",
  }),
  RULE_V1_REP_PERFORMANCE_IMPROVED: Object.freeze({
    userSummary: "Repetition performance improved, so the next session increases the challenge.",
    classification: "precise",
  }),
  RULE_V1_TIME_PERFORMANCE_IMPROVED: Object.freeze({
    userSummary: "Duration performance improved, so the next session increases the challenge.",
    classification: "precise",
  }),
  RULE_V1_PERFORMANCE_REGRESSED: Object.freeze({
    userSummary: "Performance regressed, so the next session stays the same.",
    classification: "precise",
  }),
  RULE_V1_REPEATED_SUCCESS: Object.freeze({
    userSummary: "Repeated success supported a progression for the next session.",
    classification: "precise",
  }),
  RULE_V1_REPEATED_REP_SUCCESS: Object.freeze({
    userSummary: "Repeated success supported a repetition increase for the next session.",
    classification: "precise",
  }),
  RULE_V1_REPEATED_TIME_SUCCESS: Object.freeze({
    userSummary: "Repeated success supported a duration increase for the next session.",
    classification: "precise",
  }),
  RULE_V1_REPEATED_FAILURE: Object.freeze({
    userSummary: "Repeated failed attempts led to a deload for the next session.",
    classification: "precise",
  }),
  RULE_V1_RECOVERY_OVERRIDE: Object.freeze({
    userSummary:
      "Recovery constraints led to a more conservative recommendation for the next session.",
    classification: "precise",
  }),
  RULE_V2_HISTORICAL_TREND_CONFLICT: Object.freeze({
    userSummary:
      "Recent training history did not support the increase, so the next session stays more conservative.",
    classification: "precise",
  }),
  RULE_V1_MISSING_LOAD_DATA: Object.freeze({
    userSummary:
      "Load data was incomplete, so the next session stays the same.",
    classification: "precise",
  }),
  RULE_V1_MISSING_DURATION_TARGET: Object.freeze({
    userSummary: GENERIC_SAFE_USER_SUMMARY,
    classification: "generic-safe",
  }),
  RULE_V1_NO_VALID_INCREMENT: Object.freeze({
    userSummary: GENERIC_SAFE_USER_SUMMARY,
    classification: "generic-safe",
  }),
  RULE_V1_ALREADY_EVALUATED: Object.freeze({
    userSummary: GENERIC_SAFE_USER_SUMMARY,
    classification: "generic-safe",
  }),
});

class ProgressionExplanationBuilderError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProgressionExplanationBuilderError";
  }
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeNonEmptyString(value, label) {
  if (!isNonEmptyString(value)) {
    throw new ProgressionExplanationBuilderError(
      `${label} must be a non-empty string`
    );
  }

  return value.trim();
}

function normalizeDecisionType(decisionType) {
  const normalizedDecisionType = normalizeNonEmptyString(
    decisionType,
    "decision.decisionType"
  );

  if (!DECISION_TYPE_VALUES.has(normalizedDecisionType)) {
    throw new ProgressionExplanationBuilderError(
      "decision.decisionType must be a known decision type"
    );
  }

  return normalizedDecisionType;
}

function normalizeSecondaryReasonCodes(secondaryReasonCodes, primaryReasonCode) {
  if (!Array.isArray(secondaryReasonCodes)) {
    throw new ProgressionExplanationBuilderError(
      "decision.secondaryReasonCodes must be an array"
    );
  }

  const normalized = [];
  const seen = new Set();

  for (let index = 0; index < secondaryReasonCodes.length; index += 1) {
    const reasonCode = normalizeNonEmptyString(
      secondaryReasonCodes[index],
      `decision.secondaryReasonCodes[${index}]`
    );

    if (reasonCode === primaryReasonCode) {
      throw new ProgressionExplanationBuilderError(
        "decision.secondaryReasonCodes must not repeat decision.reasonCode"
      );
    }

    if (seen.has(reasonCode)) {
      throw new ProgressionExplanationBuilderError(
        "decision.secondaryReasonCodes must not contain duplicates"
      );
    }

    seen.add(reasonCode);
    normalized.push(reasonCode);
  }

  return normalized;
}

function normalizeDecision(decision) {
  if (!isPlainObject(decision)) {
    throw new ProgressionExplanationBuilderError("decision is required");
  }

  const primaryReasonCode = normalizeNonEmptyString(
    decision.reasonCode,
    "decision.reasonCode"
  );

  return {
    decisionType: normalizeDecisionType(decision.decisionType),
    reasonCode: primaryReasonCode,
    secondaryReasonCodes: normalizeSecondaryReasonCodes(
      decision.secondaryReasonCodes,
      primaryReasonCode
    ),
    rulesVersion: normalizeNonEmptyString(
      decision.rulesVersion,
      "decision.rulesVersion"
    ),
  };
}

function resolveTemplate(reasonCode) {
  return (
    EXPLANATION_TEMPLATES[reasonCode] ??
    Object.freeze({
      userSummary: GENERIC_SAFE_USER_SUMMARY,
      classification: "generic-safe",
    })
  );
}

function buildDeveloperSummary({
  decisionType,
  reasonCode,
  secondaryReasonCodes,
  rulesVersion,
}) {
  const segments = [
    `decisionType=${decisionType}`,
    `primaryReason=${reasonCode}`,
    `secondaryReasons=[${
      secondaryReasonCodes.length > 0
        ? secondaryReasonCodes.join(", ")
        : ""
    }]`,
    `rulesVersion=${rulesVersion}`,
  ];

  return segments.join("; ");
}

export function buildProgressionExplanation({ decision }) {
  const normalizedDecision = normalizeDecision(decision);
  const template = resolveTemplate(normalizedDecision.reasonCode);

  return createProgressionExplanation({
    messageKey: createProgressionExplanationMessageKey(
      normalizedDecision.reasonCode
    ),
    userSummary: template.userSummary,
    developerSummary: buildDeveloperSummary(normalizedDecision),
    primaryReason: {
      code: normalizedDecision.reasonCode,
    },
    secondaryReasons: normalizedDecision.secondaryReasonCodes.map((code) => ({
      code,
    })),
  });
}

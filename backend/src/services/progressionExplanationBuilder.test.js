import assert from "node:assert/strict";

import {
  DECISION_TYPES,
  PROGRESSION_RULES_VERSION,
  REASON_CODES,
} from "./progressionDecisionEngine.js";
import {
  createProgressionExplanationMessageKey,
  PROGRESSION_EXPLANATION_VERSION,
} from "./progressionExplanation.js";
import { buildProgressionExplanation } from "./progressionExplanationBuilder.js";

function serializeForLog(value) {
  return JSON.stringify(value, null, 2);
}

function printCaseStart(name, input) {
  console.log(`CASE: ${name}`);
  console.log(`INPUT: ${serializeForLog(input)}`);
}

function printCaseResult(passed, actual, error) {
  if (typeof actual !== "undefined") {
    console.log(`ACTUAL: ${serializeForLog(actual)}`);
  }
  if (error) {
    console.log(`ERROR: ${error.stack || error.message}`);
  }
  console.log(`RESULT: ${passed ? "PASS" : "FAIL"}`);
  console.log("---");
}

async function runCase(name, input, fn) {
  printCaseStart(name, input);
  try {
    const actual = await fn();
    printCaseResult(true, actual);
    return true;
  } catch (error) {
    printCaseResult(false, undefined, error);
    return false;
  }
}

function buildDecision(overrides = {}) {
  return {
    exerciseId: 15,
    sourceSessionId: 501,
    decisionType: DECISION_TYPES.MAINTAIN,
    loadAdjustmentSteps: 0,
    setAdjustment: 0,
    repAdjustment: 0,
    durationAdjustmentSteps: 0,
    reasonCode: REASON_CODES.TARGETS_FULLY_MET,
    secondaryReasonCodes: [],
    confidence: 0.5,
    requiresManualReview: false,
    shouldPersist: true,
    rulesVersion: PROGRESSION_RULES_VERSION,
    ...overrides,
  };
}

function expectedExplanation({
  reasonCode,
  userSummary,
  decisionType,
  secondaryReasonCodes = [],
  rulesVersion = PROGRESSION_RULES_VERSION,
}) {
  return {
    version: PROGRESSION_EXPLANATION_VERSION,
    messageKey: createProgressionExplanationMessageKey(reasonCode),
    userSummary,
    developerSummary: `decisionType=${decisionType}; primaryReason=${reasonCode}; secondaryReasons=[${
      secondaryReasonCodes.length > 0 ? secondaryReasonCodes.join(", ") : ""
    }]; rulesVersion=${rulesVersion}`,
    primaryReason: {
      code: reasonCode,
    },
    secondaryReasons: secondaryReasonCodes.map((code) => ({ code })),
  };
}

const REASON_EXPECTATIONS = [
  {
    reasonCode: REASON_CODES.INVALID_ANALYSIS,
    decisionType: DECISION_TYPES.MANUAL_REVIEW,
    userSummary: "Progression decision recorded for the next session.",
    classification: "generic-safe",
  },
  {
    reasonCode: REASON_CODES.ZERO_PRESCRIPTION,
    decisionType: DECISION_TYPES.SKIP,
    userSummary: "Progression decision recorded for the next session.",
    classification: "generic-safe",
  },
  {
    reasonCode: REASON_CODES.INSUFFICIENT_HISTORY,
    decisionType: DECISION_TYPES.INSUFFICIENT_DATA,
    userSummary: "Progression decision recorded for the next session.",
    classification: "generic-safe",
  },
  {
    reasonCode: REASON_CODES.TARGETS_FULLY_MET,
    decisionType: DECISION_TYPES.MAINTAIN,
    userSummary: "Targets were fully met, so the next session stays the same.",
    classification: "precise",
  },
  {
    reasonCode: REASON_CODES.TARGETS_PARTIALLY_MET,
    decisionType: DECISION_TYPES.MAINTAIN,
    userSummary: "Targets were not fully met, so the next session stays the same.",
    classification: "precise",
  },
  {
    reasonCode: REASON_CODES.PERFORMANCE_IMPROVED,
    decisionType: DECISION_TYPES.INCREASE_LOAD,
    userSummary:
      "Performance improved, so the next session increases the challenge.",
    classification: "precise",
  },
  {
    reasonCode: REASON_CODES.REP_PERFORMANCE_IMPROVED,
    decisionType: DECISION_TYPES.INCREASE_REPS,
    userSummary:
      "Repetition performance improved, so the next session increases the challenge.",
    classification: "precise",
  },
  {
    reasonCode: REASON_CODES.TIME_PERFORMANCE_IMPROVED,
    decisionType: DECISION_TYPES.INCREASE_DURATION,
    userSummary:
      "Duration performance improved, so the next session increases the challenge.",
    classification: "precise",
  },
  {
    reasonCode: REASON_CODES.PERFORMANCE_REGRESSED,
    decisionType: DECISION_TYPES.MAINTAIN,
    userSummary: "Performance regressed, so the next session stays the same.",
    classification: "precise",
  },
  {
    reasonCode: REASON_CODES.REPEATED_SUCCESS,
    decisionType: DECISION_TYPES.INCREASE_LOAD,
    userSummary:
      "Repeated success supported a progression for the next session.",
    classification: "precise",
  },
  {
    reasonCode: REASON_CODES.REPEATED_REP_SUCCESS,
    decisionType: DECISION_TYPES.INCREASE_REPS,
    userSummary:
      "Repeated success supported a repetition increase for the next session.",
    classification: "precise",
  },
  {
    reasonCode: REASON_CODES.REPEATED_TIME_SUCCESS,
    decisionType: DECISION_TYPES.INCREASE_DURATION,
    userSummary:
      "Repeated success supported a duration increase for the next session.",
    classification: "precise",
  },
  {
    reasonCode: REASON_CODES.REPEATED_FAILURE,
    decisionType: DECISION_TYPES.DELOAD,
    userSummary:
      "Repeated failed attempts led to a deload for the next session.",
    classification: "precise",
  },
  {
    reasonCode: REASON_CODES.RECOVERY_OVERRIDE,
    decisionType: DECISION_TYPES.MAINTAIN,
    userSummary:
      "Recovery constraints led to a more conservative recommendation for the next session.",
    classification: "precise",
  },
  {
    reasonCode: REASON_CODES.HISTORICAL_TREND_CONFLICT,
    decisionType: DECISION_TYPES.MAINTAIN,
    userSummary:
      "Recent training history did not support the increase, so the next session stays more conservative.",
    classification: "precise",
  },
  {
    reasonCode: REASON_CODES.MISSING_LOAD_DATA,
    decisionType: DECISION_TYPES.MAINTAIN,
    userSummary: "Load data was incomplete, so the next session stays the same.",
    classification: "precise",
  },
  {
    reasonCode: REASON_CODES.MISSING_DURATION_TARGET,
    decisionType: DECISION_TYPES.INSUFFICIENT_DATA,
    userSummary: "Progression decision recorded for the next session.",
    classification: "generic-safe",
  },
  {
    reasonCode: REASON_CODES.NO_VALID_INCREMENT,
    decisionType: DECISION_TYPES.SKIP,
    userSummary: "Progression decision recorded for the next session.",
    classification: "generic-safe",
  },
  {
    reasonCode: REASON_CODES.ALREADY_EVALUATED,
    decisionType: DECISION_TYPES.SKIP,
    userSummary: "Progression decision recorded for the next session.",
    classification: "generic-safe",
  },
];

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "covers every production primary reason with a valid explanation",
      input: REASON_EXPECTATIONS.map((item) => item.reasonCode),
      fn: () => {
        const actual = REASON_EXPECTATIONS.map((item) =>
          buildProgressionExplanation({
            decision: buildDecision({
              decisionType: item.decisionType,
              reasonCode: item.reasonCode,
            }),
          })
        );

        assert.deepEqual(
          actual,
          REASON_EXPECTATIONS.map((item) =>
            expectedExplanation({
              reasonCode: item.reasonCode,
              userSummary: item.userSummary,
              decisionType: item.decisionType,
            })
          )
        );

        return actual;
      },
    },
    {
      name: "explains historical conflict downgrade with supporting secondary reasons",
      input: "historical modifier outcome with preserved supporting reasons",
      fn: () => {
        const actual = buildProgressionExplanation({
          decision: buildDecision({
            decisionType: DECISION_TYPES.MAINTAIN,
            reasonCode: REASON_CODES.HISTORICAL_TREND_CONFLICT,
            secondaryReasonCodes: [
              REASON_CODES.PERFORMANCE_IMPROVED,
              REASON_CODES.TARGETS_FULLY_MET,
            ],
          }),
        });

        assert.deepEqual(
          actual,
          expectedExplanation({
            reasonCode: REASON_CODES.HISTORICAL_TREND_CONFLICT,
            userSummary:
              "Recent training history did not support the increase, so the next session stays more conservative.",
            decisionType: DECISION_TYPES.MAINTAIN,
            secondaryReasonCodes: [
              REASON_CODES.PERFORMANCE_IMPROVED,
              REASON_CODES.TARGETS_FULLY_MET,
            ],
          })
        );

        return actual;
      },
    },
    {
      name: "explains recovery override without changing the primary message key",
      input: "recovery override with positive supporting reasons",
      fn: () => {
        const actual = buildProgressionExplanation({
          decision: buildDecision({
            decisionType: DECISION_TYPES.MAINTAIN,
            reasonCode: REASON_CODES.RECOVERY_OVERRIDE,
            secondaryReasonCodes: [
              REASON_CODES.REPEATED_SUCCESS,
              REASON_CODES.TARGETS_FULLY_MET,
            ],
          }),
        });

        assert.equal(
          actual.messageKey,
          createProgressionExplanationMessageKey(
            REASON_CODES.RECOVERY_OVERRIDE
          )
        );
        assert.deepEqual(actual.secondaryReasons, [
          { code: REASON_CODES.REPEATED_SUCCESS },
          { code: REASON_CODES.TARGETS_FULLY_MET },
        ]);

        return actual;
      },
    },
    {
      name: "uses safe generic output for unknown but valid primary reasons",
      input: "future reason code with valid normalized decision shape",
      fn: () => {
        const actual = buildProgressionExplanation({
          decision: buildDecision({
            reasonCode: "RULE_V9_FUTURE_REASON",
          }),
        });

        assert.deepEqual(
          actual,
          expectedExplanation({
            reasonCode: "RULE_V9_FUTURE_REASON",
            userSummary: "Progression decision recorded for the next session.",
            decisionType: DECISION_TYPES.MAINTAIN,
          })
        );

        return actual;
      },
    },
    {
      name: "preserves unknown valid secondary reasons as technical context",
      input: "known primary reason with an unknown secondary reason",
      fn: () => {
        const actual = buildProgressionExplanation({
          decision: buildDecision({
            secondaryReasonCodes: ["RULE_V9_FUTURE_SECONDARY"],
          }),
        });

        assert.deepEqual(actual.secondaryReasons, [
          { code: "RULE_V9_FUTURE_SECONDARY" },
        ]);
        assert.match(
          actual.developerSummary,
          /secondaryReasons=\[RULE_V9_FUTURE_SECONDARY\]/
        );

        return actual;
      },
    },
    {
      name: "rejects missing decision objects",
      input: "decision is undefined",
      fn: () => {
        assert.throws(
          () => buildProgressionExplanation({ decision: undefined }),
          (error) => error?.name === "ProgressionExplanationBuilderError"
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects invalid primary reason types",
      input: "decision.reasonCode is not a string",
      fn: () => {
        assert.throws(
          () =>
            buildProgressionExplanation({
              decision: buildDecision({
                reasonCode: 42,
              }),
            }),
          (error) => error?.name === "ProgressionExplanationBuilderError"
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects malformed secondary reason arrays",
      input: "decision.secondaryReasonCodes is not an array",
      fn: () => {
        assert.throws(
          () =>
            buildProgressionExplanation({
              decision: buildDecision({
                secondaryReasonCodes: "RULE_V1_TARGETS_FULLY_MET",
              }),
            }),
          (error) => error?.name === "ProgressionExplanationBuilderError"
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects duplicate secondary reasons",
      input: "same secondary reason appears twice",
      fn: () => {
        assert.throws(
          () =>
            buildProgressionExplanation({
              decision: buildDecision({
                secondaryReasonCodes: [
                  REASON_CODES.PERFORMANCE_IMPROVED,
                  REASON_CODES.PERFORMANCE_IMPROVED,
                ],
              }),
            }),
          (error) => error?.name === "ProgressionExplanationBuilderError"
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects primary reason repeated in secondary reasons",
      input: "secondary reasons repeat the primary code",
      fn: () => {
        assert.throws(
          () =>
            buildProgressionExplanation({
              decision: buildDecision({
                secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
              }),
            }),
          (error) => error?.name === "ProgressionExplanationBuilderError"
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects invalid decision types",
      input: "decision type is not from the normalized engine enum",
      fn: () => {
        assert.throws(
          () =>
            buildProgressionExplanation({
              decision: buildDecision({
                decisionType: "ADVANCE_TO_THE_MOON",
              }),
            }),
          (error) => error?.name === "ProgressionExplanationBuilderError"
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects missing rulesVersion",
      input: "builder requires the normalized decision rules version",
      fn: () => {
        assert.throws(
          () =>
            buildProgressionExplanation({
              decision: buildDecision({
                rulesVersion: "",
              }),
            }),
          (error) => error?.name === "ProgressionExplanationBuilderError"
        );

        return { rejected: true };
      },
    },
    {
      name: "does not mutate source decision objects or arrays",
      input: "frozen decision remains unchanged after explanation build",
      fn: () => {
        const decision = buildDecision({
          secondaryReasonCodes: [REASON_CODES.PERFORMANCE_IMPROVED],
        });
        const snapshot = structuredClone(decision);
        const actual = buildProgressionExplanation({ decision });

        assert.deepEqual(decision, snapshot);
        assert.notEqual(actual.secondaryReasons, decision.secondaryReasonCodes);

        return actual;
      },
    },
    {
      name: "returns immutable output with frozen nested arrays",
      input: "explanation output cannot be mutated",
      fn: () => {
        const actual = buildProgressionExplanation({
          decision: buildDecision({
            secondaryReasonCodes: [REASON_CODES.PERFORMANCE_IMPROVED],
          }),
        });

        assert.equal(Object.isFrozen(actual), true);
        assert.equal(Object.isFrozen(actual.primaryReason), true);
        assert.equal(Object.isFrozen(actual.secondaryReasons), true);
        assert.throws(() => {
          actual.secondaryReasons.push({ code: REASON_CODES.REPEATED_SUCCESS });
        }, TypeError);

        return actual;
      },
    },
    {
      name: "is deterministic across repeated calls",
      input: "same normalized decision twice",
      fn: () => {
        const decision = buildDecision({
          secondaryReasonCodes: [REASON_CODES.PERFORMANCE_IMPROVED],
        });
        const first = buildProgressionExplanation({ decision });
        const second = buildProgressionExplanation({ decision });

        assert.deepEqual(first, second);
        assert.notEqual(first, second);

        return { first, second };
      },
    },
    {
      name: "matches the message-key convention exactly",
      input: "primary reason code determines the explanation key",
      fn: () => {
        const actual = buildProgressionExplanation({
          decision: buildDecision({
            reasonCode: REASON_CODES.REPEATED_SUCCESS,
            decisionType: DECISION_TYPES.INCREASE_LOAD,
          }),
        });

        assert.equal(
          actual.messageKey,
          "progression_explanation.rule_v1_repeated_success"
        );

        return actual;
      },
    },
  ];

  for (const testCase of cases) {
    const ok = await runCase(testCase.name, testCase.input, testCase.fn);
    if (ok) passed += 1;
    else failed += 1;
  }

  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

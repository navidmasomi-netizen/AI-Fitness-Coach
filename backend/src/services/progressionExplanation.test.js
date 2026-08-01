import assert from "node:assert/strict";

import {
  createProgressionExplanation,
  createProgressionExplanationMessageKey,
  ProgressionExplanationValidationError,
  PROGRESSION_EXPLANATION_VERSION,
} from "./progressionExplanation.js";

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

function buildInput(overrides = {}) {
  return {
    messageKey: createProgressionExplanationMessageKey(
      "RULE_V1_TARGETS_FULLY_MET"
    ),
    userSummary: "Targets were fully met for the next session.",
    developerSummary:
      "Primary reason RULE_V1_TARGETS_FULLY_MET produced a maintain-compatible explanation.",
    primaryReason: {
      code: "RULE_V1_TARGETS_FULLY_MET",
    },
    secondaryReasons: [],
    ...overrides,
  };
}

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "builds a valid minimal immutable explanation",
      input: "primary reason with required user summary only",
      fn: () => {
        const actual = createProgressionExplanation(
          buildInput({
            developerSummary: undefined,
          })
        );

        assert.deepEqual(actual, {
          version: PROGRESSION_EXPLANATION_VERSION,
          messageKey:
            "progression_explanation.rule_v1_targets_fully_met",
          userSummary: "Targets were fully met for the next session.",
          developerSummary: null,
          primaryReason: {
            code: "RULE_V1_TARGETS_FULLY_MET",
          },
          secondaryReasons: [],
        });
        assert.equal(Object.isFrozen(actual), true);
        assert.equal(Object.isFrozen(actual.primaryReason), true);
        assert.equal(Object.isFrozen(actual.secondaryReasons), true);

        return actual;
      },
    },
    {
      name: "preserves complete explanation with ordered secondary reasons",
      input: "primary plus two secondary reason codes",
      fn: () => {
        const actual = createProgressionExplanation(
          buildInput({
            messageKey: createProgressionExplanationMessageKey(
              "RULE_V1_RECOVERY_OVERRIDE"
            ),
            userSummary:
              "Recovery signals held the recommendation for the next session.",
            developerSummary:
              "Recovery override preserved the session recommendation despite positive performance signals.",
            primaryReason: {
              code: "RULE_V1_RECOVERY_OVERRIDE",
            },
            secondaryReasons: [
              { code: "RULE_V1_PERFORMANCE_IMPROVED" },
              { code: "RULE_V1_TARGETS_FULLY_MET" },
            ],
          })
        );

        assert.deepEqual(actual.secondaryReasons, [
          { code: "RULE_V1_PERFORMANCE_IMPROVED" },
          { code: "RULE_V1_TARGETS_FULLY_MET" },
        ]);

        return actual;
      },
    },
    {
      name: "does not mutate source inputs and freezes nested arrays",
      input: "mutable input object reused after construction",
      fn: () => {
        const input = buildInput({
          secondaryReasons: [{ code: "RULE_V1_PERFORMANCE_IMPROVED" }],
        });
        const snapshot = structuredClone(input);
        const actual = createProgressionExplanation(input);

        assert.deepEqual(input, snapshot);
        assert.notEqual(actual.primaryReason, input.primaryReason);
        assert.notEqual(actual.secondaryReasons, input.secondaryReasons);
        assert.throws(() => {
          actual.secondaryReasons.push({ code: "RULE_V1_REPEATED_SUCCESS" });
        }, TypeError);

        return actual;
      },
    },
    {
      name: "repeated construction is deterministic",
      input: "same valid explanation input twice",
      fn: () => {
        const input = buildInput({
          secondaryReasons: [{ code: "RULE_V1_PERFORMANCE_IMPROVED" }],
        });
        const first = createProgressionExplanation(input);
        const second = createProgressionExplanation(input);

        assert.deepEqual(first, second);
        assert.notEqual(first, second);

        return { first, second };
      },
    },
    {
      name: "supports a safe generic explanation representation",
      input: "generic wording without unsupported causal claims",
      fn: () => {
        const actual = createProgressionExplanation(
          buildInput({
            messageKey: createProgressionExplanationMessageKey(
              "RULE_V1_INSUFFICIENT_HISTORY"
            ),
            userSummary: "Progression decision recorded for the next session.",
            developerSummary: null,
            primaryReason: {
              code: "RULE_V1_INSUFFICIENT_HISTORY",
            },
          })
        );

        assert.equal(actual.developerSummary, null);
        return actual;
      },
    },
    {
      name: "rejects missing messageKey",
      input: "empty message key",
      fn: () => {
        assert.throws(
          () =>
            createProgressionExplanation(
              buildInput({
                messageKey: "",
              })
            ),
          ProgressionExplanationValidationError
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects invalid userSummary",
      input: "blank user summary",
      fn: () => {
        assert.throws(
          () =>
            createProgressionExplanation(
              buildInput({
                userSummary: "   ",
              })
            ),
          ProgressionExplanationValidationError
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects invalid primary reason",
      input: "missing primary reason code",
      fn: () => {
        assert.throws(
          () =>
            createProgressionExplanation(
              buildInput({
                primaryReason: {
                  code: "",
                },
              })
            ),
          ProgressionExplanationValidationError
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects malformed secondary reasons arrays",
      input: "secondary reason is not an object",
      fn: () => {
        assert.throws(
          () =>
            createProgressionExplanation(
              buildInput({
                secondaryReasons: ["RULE_V1_PERFORMANCE_IMPROVED"],
              })
            ),
          ProgressionExplanationValidationError
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects duplicate secondary reason codes",
      input: "same secondary reason twice",
      fn: () => {
        assert.throws(
          () =>
            createProgressionExplanation(
              buildInput({
                secondaryReasons: [
                  { code: "RULE_V1_PERFORMANCE_IMPROVED" },
                  { code: "RULE_V1_PERFORMANCE_IMPROVED" },
                ],
              })
            ),
          ProgressionExplanationValidationError
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects primary reason duplicated in secondary reasons",
      input: "secondary reasons repeat primary code",
      fn: () => {
        assert.throws(
          () =>
            createProgressionExplanation(
              buildInput({
                secondaryReasons: [
                  { code: "RULE_V1_TARGETS_FULLY_MET" },
                ],
              })
            ),
          ProgressionExplanationValidationError
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects unsupported extra fields when strict shape is selected",
      input: "top-level metadata field not allowed",
      fn: () => {
        assert.throws(
          () =>
            createProgressionExplanation({
              ...buildInput(),
              metadata: {},
            }),
          ProgressionExplanationValidationError
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects message keys that do not match the stable convention",
      input: "message key does not match primary reason code",
      fn: () => {
        assert.throws(
          () =>
            createProgressionExplanation(
              buildInput({
                messageKey: "progression_explanation.custom_key",
              })
            ),
          ProgressionExplanationValidationError
        );

        return { rejected: true };
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

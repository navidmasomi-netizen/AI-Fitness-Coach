import assert from "node:assert/strict";

import {
  createTrainingStateSignals,
  TrainingStateSignalsValidationError,
} from "./trainingStateSignals.js";

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

function buildHistoricalTrainingSignals(overrides = {}) {
  return {
    completedExposureCount: 2,
    averageCompletionRatio: 1,
    averageCompletedSets: 3,
    latestCompletedAt: "2026-07-20T10:00:00.000Z",
    previousCompletedAt: "2026-07-13T10:00:00.000Z",
    loadTrend: "INCREASING",
    repTrend: "STABLE",
    ...overrides,
  };
}

function buildTrainingStateInput(overrides = {}) {
  return {
    fatigue: {
      historicalTrainingSignals: buildHistoricalTrainingSignals(),
    },
    ...overrides,
  };
}

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "constructs immutable fatigue-only training state signals",
      input: "historical facts are copied and deeply frozen under the fatigue domain",
      fn: () => {
        const input = buildTrainingStateInput();
        const snapshot = structuredClone(input);
        const actual = createTrainingStateSignals(input);

        assert.deepEqual(actual, snapshot);
        assert.notEqual(actual, input);
        assert.notEqual(actual.fatigue, input.fatigue);
        assert.notEqual(
          actual.fatigue.historicalTrainingSignals,
          input.fatigue.historicalTrainingSignals
        );
        assert.deepEqual(input, snapshot);
        assert.equal(Object.isFrozen(actual), true);
        assert.equal(Object.isFrozen(actual.fatigue), true);
        assert.equal(Object.isFrozen(actual.fatigue.historicalTrainingSignals), true);

        return actual;
      },
    },
    {
      name: "rejects missing or unknown domains",
      input: "only the fatigue domain is currently supported",
      fn: () => {
        assert.throws(
          () => createTrainingStateSignals({}),
          TrainingStateSignalsValidationError
        );
        assert.throws(
          () =>
            createTrainingStateSignals({
              fatigue: {
                historicalTrainingSignals: buildHistoricalTrainingSignals(),
              },
              recovery: {},
            }),
          TrainingStateSignalsValidationError
        );

        return {
          errorClass: "TrainingStateSignalsValidationError",
        };
      },
    },
    {
      name: "rejects missing fatigue historical facts",
      input: "fatigue.historicalTrainingSignals is required",
      fn: () => {
        assert.throws(
          () =>
            createTrainingStateSignals({
              fatigue: {
                historicalTrainingSignals: null,
              },
            }),
          TrainingStateSignalsValidationError
        );

        return {
          errorClass: "TrainingStateSignalsValidationError",
        };
      },
    },
    {
      name: "rejects non-serializable values",
      input: "functions and non-plain objects are blocked",
      fn: () => {
        assert.throws(
          () =>
            createTrainingStateSignals({
              fatigue: {
                historicalTrainingSignals: buildHistoricalTrainingSignals({
                  unsupported: () => "nope",
                }),
              },
            }),
          TrainingStateSignalsValidationError
        );

        return {
          errorClass: "TrainingStateSignalsValidationError",
        };
      },
    },
    {
      name: "deterministic repeated input yields equivalent output",
      input: "same fatigue facts produce deep-equal immutable contracts",
      fn: () => {
        const input = buildTrainingStateInput({
          fatigue: {
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              loadTrend: "DECREASING",
            }),
          },
        });
        const first = createTrainingStateSignals(input);
        const second = createTrainingStateSignals(input);

        assert.deepEqual(first, second);
        assert.notEqual(first, second);

        return { first, second };
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

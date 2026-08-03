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

function buildConsistency(overrides = {}) {
  return {
    exerciseAdherence: {
      timesPrescribed: 4,
      timesLogged: 3,
      adherenceRate: 0.75,
    },
    missedSessions: {
      completionRate: 0.75,
      missedSessionGapCount: 1,
      largestMissedSessionGapDays: 3.5,
    },
    sessionDensity: {
      sessionsPerWeek: 2.5,
      averageGapDays: 2.8,
      recentGapDays: 3,
    },
    ...overrides,
  };
}

function buildAdaptation(overrides = {}) {
  return {
    plateauDetection: {
      status: "POSSIBLE",
      basedOnStableTrend: true,
      basedOnRepeatedMaintains: false,
    },
    deloadHistory: {
      recentDeloadCount: 1,
      mostRecentDeloadAt: "2026-07-20T10:00:00.000Z",
      hasRecentDeload: true,
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
      name: "backward compatible fatigue-only input remains valid",
      input: "existing fatigue-only callers construct the same immutable contract",
      fn: () => {
        const actual = createTrainingStateSignals(buildTrainingStateInput());

        assert.deepEqual(Object.keys(actual), ["fatigue"]);
        assert.equal(Object.hasOwn(actual, "consistency"), false);
        assert.equal(Object.hasOwn(actual, "adaptation"), false);

        return actual;
      },
    },
    {
      name: "constructs immutable optional consistency and adaptation domains",
      input: "approved optional domains are copied and deeply frozen",
      fn: () => {
        const input = buildTrainingStateInput({
          consistency: buildConsistency(),
          adaptation: buildAdaptation(),
        });
        const snapshot = structuredClone(input);
        const actual = createTrainingStateSignals(input);

        assert.deepEqual(actual, snapshot);
        assert.notEqual(actual.consistency, input.consistency);
        assert.notEqual(actual.adaptation, input.adaptation);
        assert.equal(Object.isFrozen(actual.consistency), true);
        assert.equal(Object.isFrozen(actual.adaptation), true);
        assert.equal(Object.isFrozen(actual.consistency.exerciseAdherence), true);
        assert.equal(Object.isFrozen(actual.adaptation.plateauDetection), true);

        assert.throws(() => {
          actual.consistency.exerciseAdherence.timesLogged = 99;
        }, TypeError);
        assert.throws(() => {
          actual.adaptation.deloadHistory.hasRecentDeload = false;
        }, TypeError);

        return actual;
      },
    },
    {
      name: "deterministic repeated input yields equivalent output",
      input: "same signal facts produce deep-equal immutable contracts",
      fn: () => {
        const input = buildTrainingStateInput({
          fatigue: {
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              loadTrend: "DECREASING",
            }),
          },
          consistency: buildConsistency(),
          adaptation: buildAdaptation(),
        });
        const first = createTrainingStateSignals(input);
        const second = createTrainingStateSignals(input);

        assert.deepEqual(first, second);
        assert.notEqual(first, second);

        return { first, second };
      },
    },
    {
      name: "serializes deterministically with optional domains",
      input: "all approved fields survive JSON serialization without shape changes",
      fn: () => {
        const actual = createTrainingStateSignals(
          buildTrainingStateInput({
            consistency: buildConsistency(),
            adaptation: buildAdaptation(),
          })
        );
        const serialized = JSON.stringify(actual);
        const reparsed = JSON.parse(serialized);

        assert.deepEqual(reparsed, {
          fatigue: {
            historicalTrainingSignals: buildHistoricalTrainingSignals(),
          },
          consistency: buildConsistency(),
          adaptation: buildAdaptation(),
        });

        return reparsed;
      },
    },
    {
      name: "rejects unknown domains",
      input: "only fatigue consistency and adaptation are supported",
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
      name: "rejects malformed consistency domain",
      input: "consistency must provide all approved signal objects with valid shapes",
      fn: () => {
        assert.throws(
          () =>
            createTrainingStateSignals(
              buildTrainingStateInput({
                consistency: {
                  exerciseAdherence: {
                    timesPrescribed: 4,
                    timesLogged: 3,
                    adherenceRate: 0.75,
                  },
                  missedSessions: {
                    completionRate: 0.75,
                    missedSessionGapCount: -1,
                    largestMissedSessionGapDays: 3.5,
                  },
                  sessionDensity: {
                    sessionsPerWeek: 2.5,
                    averageGapDays: 2.8,
                    recentGapDays: 3,
                  },
                },
              })
            ),
          TrainingStateSignalsValidationError
        );
        assert.throws(
          () =>
            createTrainingStateSignals(
              buildTrainingStateInput({
                consistency: {
                  ...buildConsistency(),
                  unexpected: {},
                },
              })
            ),
          TrainingStateSignalsValidationError
        );

        return {
          errorClass: "TrainingStateSignalsValidationError",
        };
      },
    },
    {
      name: "rejects malformed adaptation domain",
      input: "adaptation must provide all approved signal objects with valid shapes",
      fn: () => {
        assert.throws(
          () =>
            createTrainingStateSignals(
              buildTrainingStateInput({
                adaptation: {
                  plateauDetection: {
                    status: "MAYBE",
                    basedOnStableTrend: true,
                    basedOnRepeatedMaintains: false,
                  },
                  deloadHistory: buildAdaptation().deloadHistory,
                },
              })
            ),
          TrainingStateSignalsValidationError
        );
        assert.throws(
          () =>
            createTrainingStateSignals(
              buildTrainingStateInput({
                adaptation: {
                  plateauDetection: buildAdaptation().plateauDetection,
                  deloadHistory: {
                    recentDeloadCount: 1,
                    mostRecentDeloadAt: null,
                    hasRecentDeload: "yes",
                  },
                },
              })
            ),
          TrainingStateSignalsValidationError
        );

        return {
          errorClass: "TrainingStateSignalsValidationError",
        };
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

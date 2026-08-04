import assert from "node:assert/strict";

import { deriveHistoricalTrainingSignals } from "./historicalTrainingSignals.js";
import {
  aggregateTrainingStateSignals,
  deriveTrainingStateSignalsFromExposures,
} from "./trainingStateAggregator.js";

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

function buildDeloadHistory(overrides = {}) {
  return {
    recentDeloadCount: 1,
    mostRecentDeloadAt: "2026-07-20T10:00:00.000Z",
    hasRecentDeload: true,
    ...overrides,
  };
}

function buildExposure({
  id,
  completedAt,
  startedAt,
  progressionType = "load",
  targetSets = 3,
  exerciseId = 15,
  programDayExerciseId = 901,
  setLogs,
}) {
  return {
    id,
    completedAt,
    startedAt,
    exerciseTargets: [
      {
        id: id * 10,
        exerciseId,
        programDayExerciseId,
        targetSets,
        progressionType,
      },
    ],
    setLogs,
  };
}

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "aggregates immutable training state from historical signals",
      input: "precomputed historical training signals",
      fn: () => {
        const historicalTrainingSignals = buildHistoricalTrainingSignals();
        const snapshot = structuredClone(historicalTrainingSignals);
        const actual = aggregateTrainingStateSignals({ historicalTrainingSignals });

        assert.deepEqual(actual, {
          fatigue: {
            historicalTrainingSignals: snapshot,
          },
        });
        assert.notEqual(actual.fatigue.historicalTrainingSignals, historicalTrainingSignals);
        assert.deepEqual(historicalTrainingSignals, snapshot);
        assert.equal(Object.isFrozen(actual), true);
        assert.equal(Object.isFrozen(actual.fatigue), true);
        assert.equal(Object.isFrozen(actual.fatigue.historicalTrainingSignals), true);

        return actual;
      },
    },
    {
      name: "aggregates optional deloadHistory without synthesizing sibling adaptation signals",
      input: "precomputed historical signals plus a passive deloadHistory fact",
      fn: () => {
        const historicalTrainingSignals = buildHistoricalTrainingSignals();
        const deloadHistory = buildDeloadHistory();
        const actual = aggregateTrainingStateSignals({
          historicalTrainingSignals,
          deloadHistory,
        });

        assert.deepEqual(actual, {
          fatigue: {
            historicalTrainingSignals,
          },
          adaptation: {
            deloadHistory,
          },
        });
        assert.equal(Object.hasOwn(actual.adaptation, "plateauDetection"), false);
        assert.equal(Object.hasOwn(actual.adaptation, "sessionDensity"), false);
        assert.equal(Object.isFrozen(actual.adaptation), true);
        assert.equal(Object.isFrozen(actual.adaptation.deloadHistory), true);

        return actual;
      },
    },
    {
      name: "deterministic repeated aggregation yields deep-equal output",
      input: "same historical signals twice",
      fn: () => {
        const historicalTrainingSignals = buildHistoricalTrainingSignals({
          loadTrend: "DECREASING",
        });

        const first = aggregateTrainingStateSignals({ historicalTrainingSignals });
        const second = aggregateTrainingStateSignals({ historicalTrainingSignals });

        assert.deepEqual(first, second);
        assert.notEqual(first, second);

        return { first, second };
      },
    },
    {
      name: "derives training state from exposures using existing historical derivation",
      input: "two ordered completed exposures",
      fn: () => {
        const exposures = [
          buildExposure({
            id: 1,
            startedAt: "2026-07-13T09:00:00.000Z",
            completedAt: "2026-07-13T09:30:00.000Z",
            setLogs: [
              { exerciseId: 15, setNumber: 1, reps: 8, weightKg: 40 },
              { exerciseId: 15, setNumber: 2, reps: 8, weightKg: 42.5 },
              { exerciseId: 15, setNumber: 3, reps: 8, weightKg: 42.5 },
            ],
          }),
          buildExposure({
            id: 2,
            startedAt: "2026-07-20T09:00:00.000Z",
            completedAt: "2026-07-20T09:30:00.000Z",
            setLogs: [
              { exerciseId: 15, setNumber: 1, reps: 8, weightKg: 45 },
              { exerciseId: 15, setNumber: 2, reps: 9, weightKg: 45 },
              { exerciseId: 15, setNumber: 3, reps: 8, weightKg: 45 },
            ],
          }),
        ];

        const expectedHistoricalSignals = deriveHistoricalTrainingSignals(exposures);
        const actual = deriveTrainingStateSignalsFromExposures(exposures);

        assert.deepEqual(actual, {
          fatigue: {
            historicalTrainingSignals: expectedHistoricalSignals,
          },
        });

        return actual;
      },
    },
    {
      name: "exposure-derived aggregation preserves neutral historical output exactly",
      input: "empty exposures array",
      fn: () => {
        const expectedHistoricalSignals = deriveHistoricalTrainingSignals([]);
        const actual = deriveTrainingStateSignalsFromExposures([]);

        assert.deepEqual(actual, {
          fatigue: {
            historicalTrainingSignals: expectedHistoricalSignals,
          },
        });

        return actual;
      },
    },
    {
      name: "exposure-derived aggregation composes deloadHistory unchanged",
      input: "derived historical signals plus a supplied passive deloadHistory fact",
      fn: () => {
        const exposures = [
          buildExposure({
            id: 8,
            startedAt: "2026-07-13T09:00:00.000Z",
            completedAt: "2026-07-13T09:30:00.000Z",
            setLogs: [{ exerciseId: 15, setNumber: 1, reps: 8, weightKg: 40 }],
          }),
        ];
        const deloadHistory = buildDeloadHistory({
          recentDeloadCount: 0,
          mostRecentDeloadAt: null,
          hasRecentDeload: false,
        });

        const actual = deriveTrainingStateSignalsFromExposures(exposures, {
          deloadHistory,
        });

        assert.deepEqual(actual, {
          fatigue: {
            historicalTrainingSignals: deriveHistoricalTrainingSignals(exposures),
          },
          adaptation: {
            deloadHistory,
          },
        });

        return actual;
      },
    },
    {
      name: "aggregator does not mutate exposure input",
      input: "frozen exposures remain unchanged after derivation",
      fn: () => {
        const exposures = Object.freeze([
          Object.freeze(
            buildExposure({
              id: 7,
              startedAt: "2026-07-01T09:00:00.000Z",
              completedAt: "2026-07-01T09:30:00.000Z",
              setLogs: Object.freeze([
                Object.freeze({ exerciseId: 15, setNumber: 1, reps: 8, weightKg: 40 }),
              ]),
            })
          ),
        ]);
        const before = structuredClone(exposures);

        const actual = deriveTrainingStateSignalsFromExposures(exposures);

        assert.deepEqual(exposures, before);
        return actual;
      },
    },
    {
      name: "malformed deloadHistory fails through contract validation",
      input: "aggregator does not repair malformed passive adaptation facts",
      fn: () => {
        assert.throws(
          () =>
            aggregateTrainingStateSignals({
              historicalTrainingSignals: buildHistoricalTrainingSignals(),
              deloadHistory: {
                recentDeloadCount: 1,
                mostRecentDeloadAt: null,
                hasRecentDeload: "yes",
              },
            }),
          Error
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

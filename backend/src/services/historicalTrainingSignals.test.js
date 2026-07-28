import assert from "node:assert/strict";

import {
  deriveHistoricalTrainingSignals,
  HistoricalTrainingSignalsError,
} from "./historicalTrainingSignals.js";

function serializeForLog(value) {
  return JSON.stringify(
    value,
    (key, currentValue) => {
      if (currentValue instanceof Date) {
        return currentValue.toISOString();
      }
      return currentValue;
    },
    2
  );
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

function buildTarget(overrides = {}) {
  return {
    id: 901,
    programDayExerciseId: 301,
    exerciseId: 41,
    targetSets: 3,
    targetRepRangeLow: 8,
    targetRepRangeHigh: 10,
    exactRepTarget: 8,
    targetLoadKg: 40,
    targetDurationSeconds: null,
    progressionType: "load",
    sourceRecommendation: {
      id: 7001,
      recommendationType: "maintain",
      decisionType: "MAINTAIN",
      sourceSessionId: 88,
    },
    ...overrides,
  };
}

function buildSetLog(overrides = {}) {
  return {
    id: 1001,
    exerciseId: 41,
    setNumber: 1,
    reps: 10,
    weightKg: 40,
    loggedAt: new Date("2026-07-25T10:00:00.000Z"),
    ...overrides,
  };
}

function buildExposure(overrides = {}) {
  const id = overrides.id ?? 501;
  const target = buildTarget(overrides.targetOverrides);
  const setLogs =
    overrides.setLogs ??
    [
      buildSetLog({ id: id * 10 + 1, setNumber: 1, reps: 10, weightKg: 40 }),
      buildSetLog({ id: id * 10 + 2, setNumber: 2, reps: 9, weightKg: 42.5 }),
      buildSetLog({ id: id * 10 + 3, setNumber: 3, reps: 8, weightKg: 45 }),
    ];

  return {
    id,
    userProgramId: 201,
    programDayId: 11,
    startedAt: new Date("2026-07-25T09:00:00.000Z"),
    completedAt: new Date("2026-07-25T10:00:00.000Z"),
    exerciseTargets:
      overrides.exerciseTargets ??
      (overrides.targetOverrides === null ? [] : [target]),
    setLogs,
    ...overrides,
    targetOverrides: undefined,
  };
}

function buildNeutralSignals() {
  return {
    completedExposureCount: 0,
    averageCompletionRatio: null,
    averageCompletedSets: null,
    latestCompletedAt: null,
    previousCompletedAt: null,
    loadTrend: "UNKNOWN",
    repTrend: "UNKNOWN",
  };
}

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "empty history returns neutral signals",
      input: [],
      fn: () => {
        const actual = deriveHistoricalTrainingSignals([]);
        assert.deepEqual(actual, buildNeutralSignals());
        assert.equal(Object.isFrozen(actual), true);
        return actual;
      },
    },
    {
      name: "non-array input is rejected",
      input: { exposures: [] },
      fn: () => {
        assert.throws(
          () => deriveHistoricalTrainingSignals({ exposures: [] }),
          (error) =>
            error instanceof TypeError &&
            error.message === "Historical exposures must be provided as an array."
        );
        return { rejected: true };
      },
    },
    {
      name: "duplicate session ids are rejected with a domain error",
      input: [buildExposure({ id: 10 }), buildExposure({ id: 10 })],
      fn: () => {
        assert.throws(
          () =>
            deriveHistoricalTrainingSignals([
              buildExposure({ id: 10 }),
              buildExposure({ id: 10 }),
            ]),
          (error) =>
            error instanceof HistoricalTrainingSignalsError &&
            error.message === "Duplicate historical exposure session id: 10"
        );
        return { rejected: true };
      },
    },
    {
      name: "one valid exposure produces counts averages and latest timestamp",
      input: [buildExposure()],
      fn: () => {
        const actual = deriveHistoricalTrainingSignals([buildExposure()]);
        assert.deepEqual(actual, {
          completedExposureCount: 1,
          averageCompletionRatio: 1,
          averageCompletedSets: 3,
          latestCompletedAt: "2026-07-25T10:00:00.000Z",
          previousCompletedAt: null,
          loadTrend: "UNKNOWN",
          repTrend: "UNKNOWN",
        });
        return actual;
      },
    },
    {
      name: "five valid exposures are all counted and averaged",
      input: "five descending completed sessions",
      fn: () => {
        const exposures = [
          buildExposure({
            id: 1,
            completedAt: new Date("2026-07-25T10:00:00.000Z"),
            setLogs: [1, 2, 3].map((setNumber) =>
              buildSetLog({ id: 100 + setNumber, setNumber, reps: 8, weightKg: 40 })
            ),
          }),
          buildExposure({
            id: 2,
            completedAt: new Date("2026-07-24T10:00:00.000Z"),
            setLogs: [1, 2].map((setNumber) =>
              buildSetLog({ id: 200 + setNumber, setNumber, reps: 8, weightKg: 40 })
            ),
          }),
          buildExposure({
            id: 3,
            completedAt: new Date("2026-07-23T10:00:00.000Z"),
            setLogs: [1].map((setNumber) =>
              buildSetLog({ id: 300 + setNumber, setNumber, reps: 8, weightKg: 40 })
            ),
          }),
          buildExposure({
            id: 4,
            completedAt: new Date("2026-07-22T10:00:00.000Z"),
            setLogs: [1, 2, 3, 4].map((setNumber) =>
              buildSetLog({ id: 400 + setNumber, setNumber, reps: 8, weightKg: 40 })
            ),
          }),
          buildExposure({
            id: 5,
            completedAt: new Date("2026-07-21T10:00:00.000Z"),
            setLogs: [1, 2, 3].map((setNumber) =>
              buildSetLog({ id: 500 + setNumber, setNumber, reps: 8, weightKg: 40 })
            ),
          }),
        ];

        const actual = deriveHistoricalTrainingSignals(exposures);
        assert.equal(actual.completedExposureCount, 5);
        assert.equal(actual.averageCompletionRatio, (1 + 2 / 3 + 1 / 3 + 1 + 1) / 5);
        assert.equal(actual.averageCompletedSets, (3 + 2 + 1 + 4 + 3) / 5);
        assert.equal(actual.latestCompletedAt, "2026-07-25T10:00:00.000Z");
        assert.equal(actual.previousCompletedAt, "2026-07-24T10:00:00.000Z");
        return actual;
      },
    },
    {
      name: "more than five supplied exposures are all processed by the pure aggregator",
      input: "repository owns limiting, aggregator processes supplied input",
      fn: () => {
        const exposures = Array.from({ length: 6 }, (_, index) =>
          buildExposure({
            id: index + 1,
            completedAt: new Date(`2026-07-${25 - index}T10:00:00.000Z`),
            setLogs: [
              buildSetLog({
                id: 600 + index,
                setNumber: 1,
                reps: 8,
                weightKg: 40,
              }),
            ],
          })
        );

        const actual = deriveHistoricalTrainingSignals(exposures);
        assert.equal(actual.completedExposureCount, 6);
        assert.equal(actual.averageCompletionRatio, 1 / 3);
        assert.equal(actual.averageCompletedSets, 1);
        return actual;
      },
    },
    {
      name: "input is normalized to newest first before processing",
      input: "older exposure first, newer exposure second",
      fn: () => {
        const older = buildExposure({
          id: 1,
          completedAt: new Date("2026-07-20T10:00:00.000Z"),
          setLogs: [buildSetLog({ id: 101, setNumber: 1, reps: 8, weightKg: 40 })],
        });
        const newer = buildExposure({
          id: 2,
          completedAt: new Date("2026-07-25T10:00:00.000Z"),
          setLogs: [buildSetLog({ id: 201, setNumber: 1, reps: 8, weightKg: 45 })],
        });

        const actual = deriveHistoricalTrainingSignals([older, newer]);
        assert.equal(actual.latestCompletedAt, "2026-07-25T10:00:00.000Z");
        assert.equal(actual.previousCompletedAt, "2026-07-20T10:00:00.000Z");
        assert.equal(actual.loadTrend, "INCREASING");
        return actual;
      },
    },
    {
      name: "equal completedAt timestamps use startedAt and id tie-breakers",
      input: "three equal completion times",
      fn: () => {
        const exposures = [
          buildExposure({
            id: 1,
            startedAt: new Date("2026-07-25T08:00:00.000Z"),
            completedAt: new Date("2026-07-25T10:00:00.000Z"),
            setLogs: [buildSetLog({ id: 101, setNumber: 1, reps: 8, weightKg: 40 })],
          }),
          buildExposure({
            id: 3,
            startedAt: new Date("2026-07-25T09:00:00.000Z"),
            completedAt: new Date("2026-07-25T10:00:00.000Z"),
            setLogs: [buildSetLog({ id: 301, setNumber: 1, reps: 8, weightKg: 45 })],
          }),
          buildExposure({
            id: 2,
            startedAt: new Date("2026-07-25T09:00:00.000Z"),
            completedAt: new Date("2026-07-25T10:00:00.000Z"),
            setLogs: [buildSetLog({ id: 201, setNumber: 1, reps: 8, weightKg: 42.5 })],
          }),
        ];

        const actual = deriveHistoricalTrainingSignals(exposures);
        assert.equal(actual.latestCompletedAt, "2026-07-25T10:00:00.000Z");
        assert.equal(actual.previousCompletedAt, "2026-07-25T10:00:00.000Z");
        assert.equal(actual.loadTrend, "INCREASING");
        return actual;
      },
    },
    {
      name: "malformed completed timestamps exclude the exposure",
      input: "one malformed timestamp and one valid exposure",
      fn: () => {
        const actual = deriveHistoricalTrainingSignals([
          buildExposure({
            id: 1,
            completedAt: "not-a-timestamp",
          }),
          buildExposure({
            id: 2,
            completedAt: new Date("2026-07-25T10:00:00.000Z"),
          }),
        ]);

        assert.equal(actual.completedExposureCount, 1);
        assert.equal(actual.latestCompletedAt, "2026-07-25T10:00:00.000Z");
        return actual;
      },
    },
    {
      name: "missing target snapshots exclude the exposure",
      input: "target array omitted",
      fn: () => {
        const actual = deriveHistoricalTrainingSignals([
          buildExposure({
            id: 1,
            exerciseTargets: [],
          }),
          buildExposure({
            id: 2,
          }),
        ]);

        assert.equal(actual.completedExposureCount, 1);
        assert.equal(actual.latestCompletedAt, "2026-07-25T10:00:00.000Z");
        return actual;
      },
    },
    {
      name: "multiple target snapshots in one exposure exclude that exposure",
      input: "ambiguous target mapping",
      fn: () => {
        const actual = deriveHistoricalTrainingSignals([
          buildExposure({
            id: 1,
            exerciseTargets: [buildTarget({ id: 11 }), buildTarget({ id: 12 })],
          }),
          buildExposure({
            id: 2,
          }),
        ]);

        assert.equal(actual.completedExposureCount, 1);
        assert.equal(actual.latestCompletedAt, "2026-07-25T10:00:00.000Z");
        return actual;
      },
    },
    {
      name: "exposures with no valid set logs are excluded",
      input: "wrong exercise ids and malformed sets",
      fn: () => {
        const actual = deriveHistoricalTrainingSignals([
          buildExposure({
            id: 1,
            setLogs: [
              buildSetLog({ id: 11, exerciseId: 999, setNumber: 1, reps: 10, weightKg: 40 }),
              buildSetLog({ id: 12, setNumber: 0, reps: 10, weightKg: 40 }),
            ],
          }),
          buildExposure({
            id: 2,
            setLogs: [buildSetLog({ id: 21, setNumber: 1, reps: 8, weightKg: 40 })],
          }),
        ]);

        assert.equal(actual.completedExposureCount, 1);
        assert.equal(actual.averageCompletedSets, 1);
        return actual;
      },
    },
    {
      name: "partial exact and excess completion ratios follow the approved algorithm",
      input: "1 set, 3 sets, and 4 sets against targetSets 3",
      fn: () => {
        const actual = deriveHistoricalTrainingSignals([
          buildExposure({
            id: 1,
            completedAt: new Date("2026-07-25T10:00:00.000Z"),
            setLogs: [buildSetLog({ id: 101, setNumber: 1, reps: 8, weightKg: 40 })],
          }),
          buildExposure({
            id: 2,
            completedAt: new Date("2026-07-24T10:00:00.000Z"),
            setLogs: [1, 2, 3].map((setNumber) =>
              buildSetLog({ id: 200 + setNumber, setNumber, reps: 8, weightKg: 40 })
            ),
          }),
          buildExposure({
            id: 3,
            completedAt: new Date("2026-07-23T10:00:00.000Z"),
            setLogs: [1, 2, 3, 4].map((setNumber) =>
              buildSetLog({ id: 300 + setNumber, setNumber, reps: 8, weightKg: 40 })
            ),
          }),
        ]);

        assert.equal(actual.averageCompletionRatio, (1 / 3 + 1 + 1) / 3);
        assert.equal(actual.averageCompletedSets, (1 + 3 + 4) / 3);
        return actual;
      },
    },
    {
      name: "weighted exercise load trend increasing uses best weighted set tie-breakers",
      input: "higher best load in latest exposure",
      fn: () => {
        const latest = buildExposure({
          id: 1,
          completedAt: new Date("2026-07-25T10:00:00.000Z"),
          setLogs: [
            buildSetLog({ id: 11, setNumber: 1, reps: 8, weightKg: 45 }),
            buildSetLog({ id: 12, setNumber: 2, reps: 10, weightKg: 50 }),
            buildSetLog({ id: 13, setNumber: 3, reps: 9, weightKg: 50 }),
          ],
        });
        const previous = buildExposure({
          id: 2,
          completedAt: new Date("2026-07-24T10:00:00.000Z"),
          setLogs: [
            buildSetLog({ id: 21, setNumber: 1, reps: 8, weightKg: 47.5 }),
            buildSetLog({ id: 22, setNumber: 2, reps: 9, weightKg: 47.5 }),
          ],
        });

        const actual = deriveHistoricalTrainingSignals([previous, latest]);
        assert.equal(actual.loadTrend, "INCREASING");
        assert.equal(actual.repTrend, "INCREASING");
        return actual;
      },
    },
    {
      name: "weighted exercise load trend decreasing is deterministic",
      input: "lower best load in latest exposure",
      fn: () => {
        const actual = deriveHistoricalTrainingSignals([
          buildExposure({
            id: 1,
            completedAt: new Date("2026-07-25T10:00:00.000Z"),
            setLogs: [buildSetLog({ id: 11, setNumber: 1, reps: 8, weightKg: 40 })],
          }),
          buildExposure({
            id: 2,
            completedAt: new Date("2026-07-24T10:00:00.000Z"),
            setLogs: [buildSetLog({ id: 21, setNumber: 1, reps: 8, weightKg: 45 })],
          }),
        ]);

        assert.equal(actual.loadTrend, "DECREASING");
        return actual;
      },
    },
    {
      name: "weighted exercise load trend stable treats equal best load as stable",
      input: "same best weighted set load",
      fn: () => {
        const actual = deriveHistoricalTrainingSignals([
          buildExposure({
            id: 1,
            completedAt: new Date("2026-07-25T10:00:00.000Z"),
            setLogs: [buildSetLog({ id: 11, setNumber: 1, reps: 9, weightKg: 45 })],
          }),
          buildExposure({
            id: 2,
            completedAt: new Date("2026-07-24T10:00:00.000Z"),
            setLogs: [buildSetLog({ id: 21, setNumber: 1, reps: 8, weightKg: 45 })],
          }),
        ]);

        assert.equal(actual.loadTrend, "STABLE");
        assert.equal(actual.repTrend, "INCREASING");
        return actual;
      },
    },
    {
      name: "bodyweight exposures keep rep trend but degrade load trend to unknown",
      input: "all weights null",
      fn: () => {
        const actual = deriveHistoricalTrainingSignals([
          buildExposure({
            id: 1,
            completedAt: new Date("2026-07-25T10:00:00.000Z"),
            setLogs: [
              buildSetLog({ id: 11, setNumber: 1, reps: 15, weightKg: null }),
              buildSetLog({ id: 12, setNumber: 2, reps: 14, weightKg: null }),
            ],
          }),
          buildExposure({
            id: 2,
            completedAt: new Date("2026-07-24T10:00:00.000Z"),
            setLogs: [
              buildSetLog({ id: 21, setNumber: 1, reps: 12, weightKg: null }),
              buildSetLog({ id: 22, setNumber: 2, reps: 11, weightKg: null }),
            ],
          }),
        ]);

        assert.equal(actual.loadTrend, "UNKNOWN");
        assert.equal(actual.repTrend, "INCREASING");
        return actual;
      },
    },
    {
      name: "duration exercises degrade both trends to unknown",
      input: "time progression target",
      fn: () => {
        const actual = deriveHistoricalTrainingSignals([
          buildExposure({
            id: 1,
            targetOverrides: {
              progressionType: "time",
              targetLoadKg: null,
              targetDurationSeconds: 60,
            },
            setLogs: [
              buildSetLog({ id: 11, setNumber: 1, reps: 60, weightKg: null }),
              buildSetLog({ id: 12, setNumber: 2, reps: 60, weightKg: null }),
            ],
          }),
          buildExposure({
            id: 2,
            completedAt: new Date("2026-07-24T10:00:00.000Z"),
            targetOverrides: {
              progressionType: "time",
              targetLoadKg: null,
              targetDurationSeconds: 50,
            },
            setLogs: [
              buildSetLog({ id: 21, setNumber: 1, reps: 50, weightKg: null }),
              buildSetLog({ id: 22, setNumber: 2, reps: 50, weightKg: null }),
            ],
          }),
        ]);

        assert.equal(actual.loadTrend, "UNKNOWN");
        assert.equal(actual.repTrend, "UNKNOWN");
        return actual;
      },
    },
    {
      name: "missing load values yield unknown load trend when no comparable facts exist",
      input: "latest and previous with only null weights",
      fn: () => {
        const actual = deriveHistoricalTrainingSignals([
          buildExposure({
            id: 1,
            setLogs: [buildSetLog({ id: 11, setNumber: 1, reps: 9, weightKg: null })],
          }),
          buildExposure({
            id: 2,
            completedAt: new Date("2026-07-24T10:00:00.000Z"),
            setLogs: [buildSetLog({ id: 21, setNumber: 1, reps: 8, weightKg: null })],
          }),
        ]);

        assert.equal(actual.loadTrend, "UNKNOWN");
        assert.equal(actual.repTrend, "INCREASING");
        return actual;
      },
    },
    {
      name: "missing reps invalidate set logs and can neutralize the entire result",
      input: "all set logs malformed",
      fn: () => {
        const actual = deriveHistoricalTrainingSignals([
          buildExposure({
            id: 1,
            setLogs: [buildSetLog({ id: 11, setNumber: 1, reps: 0, weightKg: 40 })],
          }),
        ]);

        assert.deepEqual(actual, buildNeutralSignals());
        return actual;
      },
    },
    {
      name: "duplicate set logs are included deterministically without deduplication",
      input: "two identical set numbers plus a third set",
      fn: () => {
        const actual = deriveHistoricalTrainingSignals([
          buildExposure({
            id: 1,
            setLogs: [
              buildSetLog({ id: 11, setNumber: 1, reps: 8, weightKg: 40 }),
              buildSetLog({ id: 12, setNumber: 1, reps: 8, weightKg: 40 }),
              buildSetLog({ id: 13, setNumber: 2, reps: 8, weightKg: 42.5 }),
            ],
          }),
        ]);

        assert.equal(actual.averageCompletedSets, 3);
        assert.equal(actual.averageCompletionRatio, 1);
        return actual;
      },
    },
    {
      name: "ambiguous recommendation mapping has no effect on the reduced contract",
      input: "recommendation fields differ but outputs remain fact-only",
      fn: () => {
        const withRecommendation = buildExposure({
          id: 1,
          targetOverrides: {
            sourceRecommendation: {
              id: 7001,
              recommendationType: "decrease",
              decisionType: "DECREASE_LOAD",
              sourceSessionId: 88,
            },
          },
        });
        const withoutRecommendation = buildExposure({
          id: 1,
          targetOverrides: {
            sourceRecommendation: null,
          },
        });

        const actualWithRecommendation = deriveHistoricalTrainingSignals([withRecommendation]);
        const actualWithoutRecommendation = deriveHistoricalTrainingSignals([withoutRecommendation]);
        assert.deepEqual(actualWithRecommendation, actualWithoutRecommendation);
        return actualWithRecommendation;
      },
    },
    {
      name: "input immutability is preserved",
      input: "deep-frozen exposure array",
      fn: () => {
        const frozenInput = deepFreeze([
          buildExposure({
            id: 1,
            setLogs: [
              buildSetLog({ id: 11, setNumber: 1, reps: 8, weightKg: 40 }),
              buildSetLog({ id: 12, setNumber: 2, reps: 9, weightKg: 42.5 }),
            ],
          }),
        ]);

        const before = serializeForLog(frozenInput);
        const actual = deriveHistoricalTrainingSignals(frozenInput);
        const after = serializeForLog(frozenInput);

        assert.equal(before, after);
        assert.equal(Object.isFrozen(actual), true);
        return actual;
      },
    },
    {
      name: "deterministic repeated execution returns structurally identical output",
      input: "same input run twice",
      fn: () => {
        const exposures = [
          buildExposure({
            id: 1,
            setLogs: [buildSetLog({ id: 11, setNumber: 1, reps: 8, weightKg: 40 })],
          }),
          buildExposure({
            id: 2,
            completedAt: new Date("2026-07-24T10:00:00.000Z"),
            setLogs: [buildSetLog({ id: 21, setNumber: 1, reps: 9, weightKg: 37.5 })],
          }),
        ];

        const first = deriveHistoricalTrainingSignals(exposures);
        const second = deriveHistoricalTrainingSignals(exposures);
        assert.deepEqual(first, second);
        return first;
      },
    },
  ];

  for (const testCase of cases) {
    if (await runCase(testCase.name, testCase.input, testCase.fn)) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

await main();

import assert from "node:assert/strict";

import { createTrainingStateSignals } from "./trainingStateSignals.js";
import {
  DeloadHistorySignalsError,
  deriveDeloadHistory,
} from "./deloadHistorySignals.js";

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

function buildHistoricalTrainingSignals() {
  return {
    completedExposureCount: 1,
    averageCompletionRatio: 1,
    averageCompletedSets: 3,
    latestCompletedAt: "2026-07-20T10:00:00.000Z",
    previousCompletedAt: null,
    loadTrend: "STABLE",
    repTrend: "STABLE",
  };
}

function buildAppliedDeloadRow(overrides = {}) {
  const recommendationOverrides = overrides.recommendation ?? {};
  const recommendation = {
    id: 101,
    decisionType: "DELOAD",
    recommendationType: "deload",
    sourceSessionId: 7001,
    sourceSession: {
      userProgramId: 501,
    },
    ...recommendationOverrides,
  };

  const { recommendation: _ignoredRecommendationOverride, ...rowOverrides } = overrides;
  const row = {
    id: 9001,
    recommendationId: recommendation.id,
    appliedAt: "2026-07-20T10:00:00.000Z",
    workoutSession: {
      userProgramId: 501,
    },
    recommendation,
    ...rowOverrides,
  };

  if (overrides.recommendationId === undefined) {
    row.recommendationId = recommendation.id;
  }

  return row;
}

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "returns neutral deload history for valid empty input",
      input: { appliedDeloadRows: [], currentUserProgramId: 501 },
      fn: () => {
        const actual = deriveDeloadHistory({
          appliedDeloadRows: [],
          currentUserProgramId: 501,
        });

        assert.deepEqual(actual, {
          recentDeloadCount: 0,
          mostRecentDeloadAt: null,
          hasRecentDeload: false,
        });
        assert.equal(Object.isFrozen(actual), true);

        return actual;
      },
    },
    {
      name: "derives applied deload history from one valid applied row",
      input: "one applied deload counts once and returns its application timestamp",
      fn: () => {
        const actual = deriveDeloadHistory({
          appliedDeloadRows: [buildAppliedDeloadRow()],
          currentUserProgramId: 501,
        });

        assert.deepEqual(actual, {
          recentDeloadCount: 1,
          mostRecentDeloadAt: "2026-07-20T10:00:00.000Z",
          hasRecentDeload: true,
        });

        return actual;
      },
    },
    {
      name: "selects latest application timestamp regardless of input order",
      input: "rows are sorted by appliedAt descending with stable id tie-breakers",
      fn: () => {
        const newer = buildAppliedDeloadRow({
          id: 9002,
          recommendation: {
            id: 102,
            sourceSessionId: 7002,
          },
          appliedAt: "2026-07-22T10:00:00.000Z",
        });
        const older = buildAppliedDeloadRow({
          id: 9001,
          recommendation: {
            id: 101,
            sourceSessionId: 7001,
          },
          appliedAt: "2026-07-18T10:00:00.000Z",
        });

        const actual = deriveDeloadHistory({
          appliedDeloadRows: [older, newer],
          currentUserProgramId: 501,
        });

        assert.deepEqual(actual, {
          recentDeloadCount: 2,
          mostRecentDeloadAt: "2026-07-22T10:00:00.000Z",
          hasRecentDeload: true,
        });

        return actual;
      },
    },
    {
      name: "equal timestamps resolve deterministically by application id",
      input: "same appliedAt prefers the greater application id as most recent",
      fn: () => {
        const first = buildAppliedDeloadRow({
          id: 9001,
          recommendation: {
            id: 101,
            sourceSessionId: 7001,
          },
        });
        const second = buildAppliedDeloadRow({
          id: 9002,
          recommendation: {
            id: 102,
            sourceSessionId: 7002,
          },
        });

        const actual = deriveDeloadHistory({
          appliedDeloadRows: [first, second],
          currentUserProgramId: 501,
        });

        assert.equal(actual.mostRecentDeloadAt, "2026-07-20T10:00:00.000Z");
        assert.equal(actual.recentDeloadCount, 2);
        assert.equal(actual.hasRecentDeload, true);

        return actual;
      },
    },
    {
      name: "rejects foreign user program lineage",
      input: "applied deload rows must remain inside the current user program boundary",
      fn: () => {
        assert.throws(
          () =>
            deriveDeloadHistory({
              appliedDeloadRows: [
                buildAppliedDeloadRow({
                  recommendation: {
                    sourceSession: {
                      userProgramId: 999,
                    },
                  },
                }),
              ],
              currentUserProgramId: 501,
            }),
          DeloadHistorySignalsError
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects duplicate recommendation ids",
      input: "one applied recommendation may only appear once",
      fn: () => {
        const duplicateRows = [
          buildAppliedDeloadRow({
            id: 9001,
            recommendation: { id: 101, sourceSessionId: 7001 },
          }),
          buildAppliedDeloadRow({
            id: 9002,
            recommendation: { id: 101, sourceSessionId: 7002 },
          }),
        ];

        assert.throws(
          () =>
            deriveDeloadHistory({
              appliedDeloadRows: duplicateRows,
              currentUserProgramId: 501,
            }),
          DeloadHistorySignalsError
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects duplicate application ids",
      input: "one application row may only appear once",
      fn: () => {
        const duplicateRows = [
          buildAppliedDeloadRow({
            id: 9001,
            recommendation: { id: 101, sourceSessionId: 7001 },
          }),
          buildAppliedDeloadRow({
            id: 9001,
            recommendation: { id: 102, sourceSessionId: 7002 },
          }),
        ];

        assert.throws(
          () =>
            deriveDeloadHistory({
              appliedDeloadRows: duplicateRows,
              currentUserProgramId: 501,
            }),
          DeloadHistorySignalsError
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects unknown recommendation application lineage",
      input: "application recommendationId must match recommendation.id",
      fn: () => {
        assert.throws(
          () =>
            deriveDeloadHistory({
              appliedDeloadRows: [
                buildAppliedDeloadRow({
                  recommendationId: 777,
                }),
              ],
              currentUserProgramId: 501,
            }),
          DeloadHistorySignalsError
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects non-deload applied rows",
      input: "structurally non-deload recommendation rows must not be counted",
      fn: () => {
        assert.throws(
          () =>
            deriveDeloadHistory({
              appliedDeloadRows: [
                buildAppliedDeloadRow({
                  recommendation: {
                    decisionType: "MAINTAIN",
                    recommendationType: "maintain",
                  },
                }),
              ],
              currentUserProgramId: 501,
            }),
          DeloadHistorySignalsError
        );

        return { rejected: true };
      },
    },
    {
      name: "rejects missing appliedAt on applied rows",
      input: "applied deload rows require a valid application timestamp",
      fn: () => {
        assert.throws(
          () =>
            deriveDeloadHistory({
              appliedDeloadRows: [
                buildAppliedDeloadRow({
                  appliedAt: null,
                }),
              ],
              currentUserProgramId: 501,
            }),
          DeloadHistorySignalsError
        );

        return { rejected: true };
      },
    },
    {
      name: "does not mutate input rows and returns immutable output",
      input: "repository rows remain unchanged and output is deeply frozen",
      fn: () => {
        const input = deepFreeze([
          buildAppliedDeloadRow({
            id: 9002,
            recommendation: {
              id: 102,
              sourceSessionId: 7002,
            },
          }),
        ]);

        const actual = deriveDeloadHistory({
          appliedDeloadRows: input,
          currentUserProgramId: 501,
        });

        assert.equal(Object.isFrozen(actual), true);
        assert.throws(() => {
          actual.hasRecentDeload = false;
        }, TypeError);
        assert.deepEqual(input, [
          buildAppliedDeloadRow({
            id: 9002,
            recommendation: {
              id: 102,
              sourceSessionId: 7002,
            },
          }),
        ]);

        return actual;
      },
    },
    {
      name: "repeated calls are deeply equal and integrate directly with TrainingStateSignals",
      input: "derived deload history plugs into the adaptation contract without mapping",
      fn: () => {
        const appliedDeloadRows = deepFreeze([
          buildAppliedDeloadRow({
            id: 9003,
            recommendation: {
              id: 103,
              sourceSessionId: 7003,
            },
            appliedAt: "2026-07-23T10:00:00.000Z",
          }),
        ]);

        const first = deriveDeloadHistory({
          appliedDeloadRows,
          currentUserProgramId: 501,
        });
        const second = deriveDeloadHistory({
          appliedDeloadRows,
          currentUserProgramId: 501,
        });

        assert.deepEqual(first, second);
        assert.notEqual(first, second);

        const trainingStateSignals = createTrainingStateSignals({
          fatigue: {
            historicalTrainingSignals: buildHistoricalTrainingSignals(),
          },
          adaptation: {
            plateauDetection: {
              status: "NONE",
              basedOnStableTrend: false,
              basedOnRepeatedMaintains: false,
            },
            deloadHistory: first,
          },
        });

        assert.deepEqual(trainingStateSignals.adaptation.deloadHistory, first);

        return trainingStateSignals.adaptation.deloadHistory;
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

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});

import assert from "node:assert/strict";

import { analyzeExercisePerformance } from "./exercisePerformanceAnalyzer.js";

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

function buildInput(overrides = {}) {
  return {
    exerciseId: 15,
    sourceSessionId: 501,
    prescription: {
      prescribedSets: 3,
      prescribedRepLow: 8,
      prescribedRepHigh: 12,
      prescribedRestSeconds: 90,
    },
    currentSession: {
      sets: [
        { setNumber: 1, reps: 12, weightKg: 40 },
        { setNumber: 2, reps: 10, weightKg: 42.5 },
        { setNumber: 3, reps: 8, weightKg: 45 },
      ],
    },
    previousSessions: [],
    ...overrides,
  };
}

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "complete successful performance",
      input: "all prescribed sets logged and all meet target",
      fn: () => {
        const actual = analyzeExercisePerformance(buildInput());
        assert.equal(actual.observedPerformance.loggedSetCount, 3);
        assert.equal(actual.observedPerformance.successfulSetCount, 3);
        assert.equal(actual.observedPerformance.failedSetCount, 0);
        assert.equal(actual.observedPerformance.prescribedSetCompletionRate, 1);
        assert.equal(actual.observedPerformance.targetRepHitRate, 1);
        assert.equal(actual.observedPerformance.totalReps, 30);
        assert.equal(actual.observedPerformance.totalVolumeKg, 1265);
        return actual;
      },
    },
    {
      name: "partial performance",
      input: "fewer sets logged than prescribed",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            currentSession: {
              sets: [
                { setNumber: 1, reps: 12, weightKg: 40 },
                { setNumber: 2, reps: 10, weightKg: 42.5 },
              ],
            },
          })
        );
        assert.equal(actual.observedPerformance.loggedSetCount, 2);
        assert.equal(actual.observedPerformance.prescribedSetCompletionRate, 0.6667);
        assert.equal(actual.observedPerformance.targetRepHitRate, 1);
        return actual;
      },
    },
    {
      name: "mixed successful and failed sets",
      input: "some sets below prescribedRepLow",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            currentSession: {
              sets: [
                { setNumber: 1, reps: 12, weightKg: 40 },
                { setNumber: 2, reps: 7, weightKg: 42.5 },
                { setNumber: 3, reps: 6, weightKg: 45 },
              ],
            },
          })
        );
        assert.equal(actual.observedPerformance.successfulSetCount, 1);
        assert.equal(actual.observedPerformance.failedSetCount, 2);
        assert.equal(actual.observedPerformance.targetRepHitRate, 0.3333);
        return actual;
      },
    },
    {
      name: "upper rep bound true when all planned sets meet it exactly",
      input: "4 planned sets at prescribed high reps",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            prescription: {
              prescribedSets: 4,
              prescribedRepLow: 8,
              prescribedRepHigh: 12,
              prescribedRestSeconds: 90,
            },
            currentSession: {
              sets: [
                { setNumber: 1, reps: 12, weightKg: 40 },
                { setNumber: 2, reps: 12, weightKg: 40 },
                { setNumber: 3, reps: 12, weightKg: 40 },
                { setNumber: 4, reps: 12, weightKg: 40 },
              ],
            },
          })
        );
        assert.equal(actual.observedPerformance.allPlannedSetsReachedUpperRepBound, true);
        return actual;
      },
    },
    {
      name: "upper rep bound false when any planned set is below it",
      input: "4 planned sets with one set at 11 while bound is 12",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            prescription: {
              prescribedSets: 4,
              prescribedRepLow: 8,
              prescribedRepHigh: 12,
              prescribedRestSeconds: 90,
            },
            currentSession: {
              sets: [
                { setNumber: 1, reps: 12, weightKg: 40 },
                { setNumber: 2, reps: 12, weightKg: 40 },
                { setNumber: 3, reps: 11, weightKg: 40 },
                { setNumber: 4, reps: 12, weightKg: 40 },
              ],
            },
          })
        );
        assert.equal(actual.observedPerformance.allPlannedSetsReachedUpperRepBound, false);
        return actual;
      },
    },
    {
      name: "upper rep bound true when every planned set exceeds it",
      input: "all planned sets above the prescribed high reps",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            prescription: {
              prescribedSets: 4,
              prescribedRepLow: 8,
              prescribedRepHigh: 12,
              prescribedRestSeconds: 90,
            },
            currentSession: {
              sets: [
                { setNumber: 1, reps: 13, weightKg: 40 },
                { setNumber: 2, reps: 14, weightKg: 40 },
                { setNumber: 3, reps: 15, weightKg: 40 },
                { setNumber: 4, reps: 16, weightKg: 40 },
              ],
            },
          })
        );
        assert.equal(actual.observedPerformance.allPlannedSetsReachedUpperRepBound, true);
        return actual;
      },
    },
    {
      name: "upper rep bound false when fewer completed sets than planned are logged",
      input: "planned set count exceeds the number of logged completed sets",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            prescription: {
              prescribedSets: 4,
              prescribedRepLow: 8,
              prescribedRepHigh: 12,
              prescribedRestSeconds: 90,
            },
            currentSession: {
              sets: [
                { setNumber: 1, reps: 12, weightKg: 40 },
                { setNumber: 2, reps: 12, weightKg: 40 },
                { setNumber: 3, reps: 12, weightKg: 40 },
              ],
            },
          })
        );
        assert.equal(actual.observedPerformance.allPlannedSetsReachedUpperRepBound, false);
        return actual;
      },
    },
    {
      name: "upper rep bound uses the first planned eligible work sets only",
      input: "extra completed sets after the planned count do not repair a missed planned set",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            prescription: {
              prescribedSets: 4,
              prescribedRepLow: 8,
              prescribedRepHigh: 12,
              prescribedRestSeconds: 90,
            },
            currentSession: {
              sets: [
                { setNumber: 1, reps: 12, weightKg: 40 },
                { setNumber: 2, reps: 12, weightKg: 40 },
                { setNumber: 3, reps: 11, weightKg: 40 },
                { setNumber: 4, reps: 12, weightKg: 40 },
                { setNumber: 5, reps: 15, weightKg: 40 },
              ],
            },
          })
        );
        assert.equal(actual.observedPerformance.allPlannedSetsReachedUpperRepBound, false);
        return actual;
      },
    },
    {
      name: "upper rep bound false when prescribedRepHigh is missing",
      input: "missing upper rep target never yields a load-transition signal",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            prescription: {
              prescribedSets: 4,
              prescribedRepLow: 8,
              prescribedRepHigh: null,
              prescribedRestSeconds: 90,
            },
            currentSession: {
              sets: [
                { setNumber: 1, reps: 12, weightKg: 40 },
                { setNumber: 2, reps: 12, weightKg: 40 },
                { setNumber: 3, reps: 12, weightKg: 40 },
                { setNumber: 4, reps: 12, weightKg: 40 },
              ],
            },
          })
        );
        assert.equal(actual.observedPerformance.allPlannedSetsReachedUpperRepBound, false);
        return actual;
      },
    },
    {
      name: "invalid prescribedRepHigh still fails at analyzer validation",
      input: "non-positive upper rep targets are rejected before any signal is derived",
      fn: () => {
        assert.throws(
          () =>
            analyzeExercisePerformance(
              buildInput({
                prescription: {
                  prescribedSets: 4,
                  prescribedRepLow: 8,
                  prescribedRepHigh: 0,
                  prescribedRestSeconds: 90,
                },
              })
            ),
          /prescribedRepHigh must be a positive integer or null/
        );
      },
    },
    {
      name: "upper rep bound false when there are no set logs",
      input: "empty sessions never yield a transition signal",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            prescription: {
              prescribedSets: 4,
              prescribedRepLow: 8,
              prescribedRepHigh: 12,
              prescribedRestSeconds: 90,
            },
            currentSession: { sets: [] },
          })
        );
        assert.equal(actual.observedPerformance.allPlannedSetsReachedUpperRepBound, false);
        return actual;
      },
    },
    {
      name: "invalid reps still fail before any upper-bound signal is derived",
      input: "zero, null, and non-integer reps remain invalid analyzer input",
      fn: () => {
        assert.throws(
          () =>
            analyzeExercisePerformance(
              buildInput({
                currentSession: {
                  sets: [
                    { setNumber: 1, reps: 12, weightKg: 40 },
                    { setNumber: 2, reps: 0, weightKg: 40 },
                    { setNumber: 3, reps: 12, weightKg: 40 },
                  ],
                },
              })
            ),
          /currentSession\.sets\[1\]\.reps must be a positive integer/
        );
        assert.throws(
          () =>
            analyzeExercisePerformance(
              buildInput({
                currentSession: {
                  sets: [
                    { setNumber: 1, reps: 12, weightKg: 40 },
                    { setNumber: 2, reps: null, weightKg: 40 },
                    { setNumber: 3, reps: 12, weightKg: 40 },
                  ],
                },
              })
            ),
          /currentSession\.sets\[1\]\.reps must be a positive integer/
        );
        assert.throws(
          () =>
            analyzeExercisePerformance(
              buildInput({
                currentSession: {
                  sets: [
                    { setNumber: 1, reps: 12, weightKg: 40 },
                    { setNumber: 2, reps: 11.5, weightKg: 40 },
                    { setNumber: 3, reps: 12, weightKg: 40 },
                  ],
                },
              })
            ),
          /currentSession\.sets\[1\]\.reps must be a positive integer/
        );
      },
    },
    {
      name: "upper rep bound false when the completed work is incomplete",
      input: "a session missing planned completed sets is treated as not having reached the upper bound",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            prescription: {
              prescribedSets: 4,
              prescribedRepLow: 8,
              prescribedRepHigh: 12,
              prescribedRestSeconds: 90,
            },
            currentSession: {
              sets: [
                { setNumber: 1, reps: 12, weightKg: 40 },
                { setNumber: 2, reps: 12, weightKg: 40 },
              ],
            },
          })
        );
        assert.equal(actual.observedPerformance.allPlannedSetsReachedUpperRepBound, false);
        return actual;
      },
    },
    {
      name: "upper rep bound derivation does not mutate analyzer input",
      input: "the new signal remains a pure derivation from current session data",
      fn: () => {
        const frozenInput = deepFreeze(
          buildInput({
            prescription: {
              prescribedSets: 4,
              prescribedRepLow: 8,
              prescribedRepHigh: 12,
              prescribedRestSeconds: 90,
            },
            currentSession: {
              sets: [
                { setNumber: 1, reps: 12, weightKg: 40 },
                { setNumber: 2, reps: 12, weightKg: 40 },
                { setNumber: 3, reps: 12, weightKg: 40 },
                { setNumber: 4, reps: 12, weightKg: 40 },
              ],
            },
          })
        );
        const actual = analyzeExercisePerformance(frozenInput);
        assert.equal(actual.observedPerformance.allPlannedSetsReachedUpperRepBound, true);
        return actual;
      },
    },
    {
      name: "empty set list",
      input: "current session has no sets",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            currentSession: { sets: [] },
          })
        );
        assert.equal(actual.observedPerformance.loggedSetCount, 0);
        assert.equal(actual.observedPerformance.bestSet, null);
        assert.equal(actual.observedPerformance.finalSet, null);
        assert.equal(actual.observedPerformance.targetRepHitRate, null);
        assert.equal(actual.dataQualityFlags.includes("no_logged_sets"), true);
        return actual;
      },
    },
    {
      name: "single set",
      input: "single logged set only",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            currentSession: {
              sets: [{ setNumber: 1, reps: 10, weightKg: 50 }],
            },
          })
        );
        assert.deepEqual(actual.observedPerformance.bestSet, {
          setNumber: 1,
          reps: 10,
          weightKg: 50,
        });
        assert.deepEqual(actual.observedPerformance.finalSet, {
          setNumber: 1,
          reps: 10,
          weightKg: 50,
        });
        return actual;
      },
    },
    {
      name: "multiple weights",
      input: "average/min/max weights from multiple weighted sets",
      fn: () => {
        const actual = analyzeExercisePerformance(buildInput());
        assert.equal(actual.observedPerformance.averageWeightKg, 42.5);
        assert.equal(actual.observedPerformance.minimumWeightKg, 40);
        assert.equal(actual.observedPerformance.maximumWeightKg, 45);
        return actual;
      },
    },
    {
      name: "best-set tie breaker",
      input: "same weight, same reps, earliest setNumber wins",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            currentSession: {
              sets: [
                { setNumber: 2, reps: 10, weightKg: 50 },
                { setNumber: 1, reps: 10, weightKg: 50 },
                { setNumber: 3, reps: 8, weightKg: 47.5 },
              ],
            },
          })
        );
        assert.deepEqual(actual.observedPerformance.bestSet, {
          setNumber: 1,
          reps: 10,
          weightKg: 50,
        });
        return actual;
      },
    },
    {
      name: "null or missing optional weight",
      input: "bodyweight/null-weight sets remain factual without fabricated load",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            currentSession: {
              sets: [
                { setNumber: 1, reps: 12, weightKg: null },
                { setNumber: 2, reps: 10, weightKg: null },
                { setNumber: 3, reps: 9, weightKg: null },
              ],
            },
          })
        );
        assert.equal(actual.observedPerformance.totalVolumeKg, 0);
        assert.equal(actual.observedPerformance.averageWeightKg, null);
        assert.equal(actual.dataQualityFlags.includes("missing_weight_data"), true);
        return actual;
      },
    },
    {
      name: "zero prescribed sets",
      input: "zero prescribed sets never produce Infinity or NaN",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            prescription: {
              prescribedSets: 0,
              prescribedRepLow: 8,
              prescribedRepHigh: 12,
              prescribedRestSeconds: 90,
            },
          })
        );
        assert.equal(actual.observedPerformance.prescribedSetCompletionRate, null);
        assert.equal(actual.dataQualityFlags.includes("zero_prescribed_sets"), true);
        return actual;
      },
    },
    {
      name: "no previous history",
      input: "history facts are null/zero when no prior sessions exist",
      fn: () => {
        const actual = analyzeExercisePerformance(buildInput());
        assert.equal(actual.historyFacts.previousSessionWeightKg, null);
        assert.equal(actual.historyFacts.weightDeltaKg, null);
        assert.equal(actual.historyFacts.consecutiveSuccessfulSessions, 1);
        assert.equal(actual.dataQualityFlags.includes("missing_previous_history"), true);
        return actual;
      },
    },
    {
      name: "one previous session",
      input: "previous session facts compare against most recent prior entry",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            previousSessions: [
              {
                sourceSessionId: 500,
                sets: [
                  { setNumber: 1, reps: 10, weightKg: 40 },
                  { setNumber: 2, reps: 9, weightKg: 42.5 },
                  { setNumber: 3, reps: 8, weightKg: 42.5 },
                ],
              },
            ],
          })
        );
        assert.equal(actual.historyFacts.previousSessionWeightKg, 42.5);
        assert.equal(actual.historyFacts.weightDeltaKg, 2.5);
        return actual;
      },
    },
    {
      name: "multiple prior sessions",
      input: "streaks scan current plus prior sessions in provided order",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            previousSessions: [
              {
                sourceSessionId: 500,
                sets: [
                  { setNumber: 1, reps: 12, weightKg: 42.5 },
                  { setNumber: 2, reps: 10, weightKg: 42.5 },
                  { setNumber: 3, reps: 8, weightKg: 42.5 },
                ],
              },
              {
                sourceSessionId: 499,
                sets: [
                  { setNumber: 1, reps: 12, weightKg: 40 },
                  { setNumber: 2, reps: 10, weightKg: 40 },
                  { setNumber: 3, reps: 8, weightKg: 40 },
                ],
              },
            ],
          })
        );
        assert.equal(actual.historyFacts.consecutiveSuccessfulSessions, 3);
        assert.equal(actual.historyFacts.consecutiveFailedSessions, 0);
        return actual;
      },
    },
    {
      name: "weight increase vs previous session",
      input: "current best set heavier than previous best set",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            previousSessions: [
              {
                sourceSessionId: 500,
                sets: [
                  { setNumber: 1, reps: 10, weightKg: 40 },
                  { setNumber: 2, reps: 10, weightKg: 42.5 },
                ],
              },
            ],
          })
        );
        assert.equal(actual.historyFacts.weightDeltaKg, 2.5);
        assert.equal(actual.historyFacts.weightDeltaPercent, 5.8824);
        return actual;
      },
    },
    {
      name: "weight decrease vs previous session",
      input: "current best set lighter than previous best set",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            currentSession: {
              sets: [
                { setNumber: 1, reps: 10, weightKg: 35 },
                { setNumber: 2, reps: 9, weightKg: 37.5 },
                { setNumber: 3, reps: 8, weightKg: 40 },
              ],
            },
            previousSessions: [
              {
                sourceSessionId: 500,
                sets: [
                  { setNumber: 1, reps: 10, weightKg: 42.5 },
                  { setNumber: 2, reps: 8, weightKg: 45 },
                ],
              },
            ],
          })
        );
        assert.equal(actual.historyFacts.weightDeltaKg, -5);
        assert.equal(actual.historyFacts.weightDeltaPercent, -11.1111);
        return actual;
      },
    },
    {
      name: "completion-rate improvement",
      input: "current prescribed-set completion improves over previous session",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            previousSessions: [
              {
                sourceSessionId: 500,
                sets: [
                  { setNumber: 1, reps: 12, weightKg: 40 },
                  { setNumber: 2, reps: 10, weightKg: 42.5 },
                ],
              },
            ],
          })
        );
        assert.equal(actual.historyFacts.previousPrescribedSetCompletionRate, 0.6667);
        assert.equal(actual.historyFacts.prescribedSetCompletionRateDelta, 0.3333);
        return actual;
      },
    },
    {
      name: "completion-rate regression",
      input: "current prescribed-set completion regresses vs previous session",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            currentSession: {
              sets: [
                { setNumber: 1, reps: 12, weightKg: 40 },
                { setNumber: 2, reps: 10, weightKg: 42.5 },
              ],
            },
            previousSessions: [
              {
                sourceSessionId: 500,
                sets: [
                  { setNumber: 1, reps: 12, weightKg: 40 },
                  { setNumber: 2, reps: 10, weightKg: 42.5 },
                  { setNumber: 3, reps: 8, weightKg: 45 },
                ],
              },
            ],
          })
        );
        assert.equal(actual.historyFacts.previousPrescribedSetCompletionRate, 1);
        assert.equal(actual.historyFacts.prescribedSetCompletionRateDelta, -0.3333);
        return actual;
      },
    },
    {
      name: "consecutive successful sessions",
      input: "current and prior sessions all satisfy full success definition",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            previousSessions: [
              {
                sourceSessionId: 500,
                sets: [
                  { setNumber: 1, reps: 12, weightKg: 42.5 },
                  { setNumber: 2, reps: 10, weightKg: 42.5 },
                  { setNumber: 3, reps: 8, weightKg: 42.5 },
                ],
              },
              {
                sourceSessionId: 499,
                sets: [
                  { setNumber: 1, reps: 12, weightKg: 40 },
                  { setNumber: 2, reps: 10, weightKg: 40 },
                  { setNumber: 3, reps: 8, weightKg: 40 },
                ],
              },
              {
                sourceSessionId: 498,
                sets: [
                  { setNumber: 1, reps: 12, weightKg: 37.5 },
                  { setNumber: 2, reps: 10, weightKg: 37.5 },
                  { setNumber: 3, reps: 8, weightKg: 37.5 },
                ],
              },
            ],
          })
        );
        assert.equal(actual.historyFacts.consecutiveSuccessfulSessions, 4);
        return actual;
      },
    },
    {
      name: "consecutive failed sessions",
      input: "current and prior sessions all fail success definition",
      fn: () => {
        const actual = analyzeExercisePerformance(
          buildInput({
            currentSession: {
              sets: [
                { setNumber: 1, reps: 7, weightKg: 40 },
                { setNumber: 2, reps: 7, weightKg: 42.5 },
              ],
            },
            previousSessions: [
              {
                sourceSessionId: 500,
                sets: [
                  { setNumber: 1, reps: 7, weightKg: 40 },
                  { setNumber: 2, reps: 7, weightKg: 40 },
                ],
              },
              {
                sourceSessionId: 499,
                sets: [
                  { setNumber: 1, reps: 6, weightKg: 37.5 },
                ],
              },
            ],
          })
        );
        assert.equal(actual.historyFacts.consecutiveSuccessfulSessions, 0);
        assert.equal(actual.historyFacts.consecutiveFailedSessions, 3);
        return actual;
      },
    },
    {
      name: "input immutability",
      input: "deep-frozen input remains unchanged",
      fn: () => {
        const frozenInput = deepFreeze(buildInput({
          previousSessions: [
            {
              sourceSessionId: 500,
              sets: [{ setNumber: 1, reps: 10, weightKg: 40 }],
            },
          ],
        }));
        const before = serializeForLog(frozenInput);
        const actual = analyzeExercisePerformance(frozenInput);
        assert.equal(serializeForLog(frozenInput), before);
        return {
          actual,
          frozenInput,
        };
      },
    },
    {
      name: "determinism",
      input: "same input run repeatedly yields deep-equal output",
      fn: () => {
        const input = buildInput({
          previousSessions: [
            {
              sourceSessionId: 500,
              sets: [{ setNumber: 1, reps: 10, weightKg: 40 }],
            },
          ],
        });
        const first = analyzeExercisePerformance(input);
        const second = analyzeExercisePerformance(input);
        assert.deepEqual(first, second);
        return first;
      },
    },
    {
      name: "invalid negative reps",
      input: "negative reps must throw",
      fn: () => {
        assert.throws(
          () =>
            analyzeExercisePerformance(
              buildInput({
                currentSession: {
                  sets: [{ setNumber: 1, reps: -1, weightKg: 40 }],
                },
              })
            ),
          /reps must be a positive integer/
        );
        return { throws: true };
      },
    },
    {
      name: "invalid negative weight",
      input: "negative weight must throw",
      fn: () => {
        assert.throws(
          () =>
            analyzeExercisePerformance(
              buildInput({
                currentSession: {
                  sets: [{ setNumber: 1, reps: 10, weightKg: -5 }],
                },
              })
            ),
          /weightKg must be a non-negative number or null/
        );
        return { throws: true };
      },
    },
    {
      name: "missing required identity/context",
      input: "missing exerciseId must throw",
      fn: () => {
        assert.throws(
          () =>
            analyzeExercisePerformance(
              buildInput({
                exerciseId: null,
              })
            ),
          /exerciseId must be a positive integer/
        );
        return { throws: true };
      },
    },
    {
      name: "no use of real clock",
      input: "Date access is blocked and analyzer still succeeds",
      fn: () => {
        const originalDate = globalThis.Date;
        class ThrowingDate extends Date {
          constructor(...args) {
            if (args.length === 0) {
              throw new Error("real clock access is forbidden");
            }
            super(...args);
          }

          static now() {
            throw new Error("real clock access is forbidden");
          }
        }

        globalThis.Date = ThrowingDate;
        try {
          const actual = analyzeExercisePerformance(buildInput());
          assert.equal(actual.exerciseId, 15);
          return actual;
        } finally {
          globalThis.Date = originalDate;
        }
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

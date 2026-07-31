import assert from "node:assert/strict";

import {
  applyHistoricalProgressionModifier,
} from "./progressionHistoricalModifier.js";
import {
  DECISION_TYPES,
  ProgressionDecisionValidationError,
  REASON_CODES,
} from "./progressionDecisionEngine.js";

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
  for (const nested of Object.values(value)) {
    deepFreeze(nested);
  }
  return value;
}

function buildCandidateDecision(overrides = {}) {
  return {
    ruleId: "R010_PERFORMANCE_IMPROVED_INCREASE",
    decisionType: DECISION_TYPES.INCREASE_LOAD,
    primaryReasonCode: REASON_CODES.PERFORMANCE_IMPROVED,
    secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
    terminal: false,
    requiresManualReview: false,
    shouldPersist: true,
    loadAdjustmentSteps: 1,
    setAdjustment: 0,
    repAdjustment: 0,
    durationAdjustmentSteps: 0,
    ...overrides,
  };
}

function buildHistoricalTrainingSignals(overrides = {}) {
  return {
    completedExposureCount: 2,
    averageCompletionRatio: 1,
    averageCompletedSets: 3,
    latestCompletedAt: "2026-07-28T10:00:00.000Z",
    previousCompletedAt: "2026-07-21T10:00:00.000Z",
    loadTrend: "INCREASING",
    repTrend: "STABLE",
    ...overrides,
  };
}

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "downgrades R010 load-oriented increase on declining load trend",
      input: "load increase with exposure count 2 and DECREASING load trend",
      fn: () => {
        const candidateDecision = deepFreeze(buildCandidateDecision());
        const historicalTrainingSignals = deepFreeze(
          buildHistoricalTrainingSignals({
            completedExposureCount: 2,
            loadTrend: "DECREASING",
            repTrend: "INCREASING",
          })
        );
        const beforeCandidate = serializeForLog(candidateDecision);
        const beforeSignals = serializeForLog(historicalTrainingSignals);

        const actual = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals,
        });

        assert.notEqual(actual, candidateDecision);
        assert.equal(Object.isFrozen(actual), true);
        assert.deepEqual(actual, {
          ruleId: "R015_HISTORICAL_TREND_CONFLICT_DOWNGRADE",
          decisionType: DECISION_TYPES.MAINTAIN,
          primaryReasonCode: REASON_CODES.HISTORICAL_TREND_CONFLICT,
          secondaryReasonCodes: [
            REASON_CODES.PERFORMANCE_IMPROVED,
            REASON_CODES.TARGETS_FULLY_MET,
          ],
          terminal: true,
          requiresManualReview: false,
          shouldPersist: true,
          loadAdjustmentSteps: 0,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
        });
        assert.equal(serializeForLog(candidateDecision), beforeCandidate);
        assert.equal(serializeForLog(historicalTrainingSignals), beforeSignals);
        return actual;
      },
    },
    {
      name: "downgrades R010 rep-oriented increase on declining rep trend",
      input: "rep increase with exposure count 2 and DECREASING rep trend",
      fn: () => {
        const candidateDecision = deepFreeze(
          buildCandidateDecision({
            decisionType: DECISION_TYPES.INCREASE_REPS,
            loadAdjustmentSteps: 0,
            repAdjustment: 1,
            primaryReasonCode: REASON_CODES.REP_PERFORMANCE_IMPROVED,
          })
        );
        const actual = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals: deepFreeze(
            buildHistoricalTrainingSignals({
              completedExposureCount: 2,
              loadTrend: "INCREASING",
              repTrend: "DECREASING",
            })
          ),
        });

        assert.notEqual(actual, candidateDecision);
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.primaryReasonCode, REASON_CODES.HISTORICAL_TREND_CONFLICT);
        assert.deepEqual(actual.secondaryReasonCodes, [
          REASON_CODES.REP_PERFORMANCE_IMPROVED,
          REASON_CODES.TARGETS_FULLY_MET,
        ]);
        return actual;
      },
    },
    {
      name: "exposure count above threshold still downgrades",
      input: "completedExposureCount greater than 2 remains eligible",
      fn: () => {
        const candidateDecision = deepFreeze(buildCandidateDecision());
        const actual = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals: deepFreeze(
            buildHistoricalTrainingSignals({
              completedExposureCount: 4,
              loadTrend: "DECREASING",
            })
          ),
        });

        assert.equal(actual.primaryReasonCode, REASON_CODES.HISTORICAL_TREND_CONFLICT);
        return actual;
      },
    },
    {
      name: "missing or populated historical dates do not affect target downgrade",
      input: "date presence remains irrelevant to the isolated rule",
      fn: () => {
        const candidateDecision = deepFreeze(buildCandidateDecision());
        const withoutDates = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals: deepFreeze(
            buildHistoricalTrainingSignals({
              loadTrend: "DECREASING",
              latestCompletedAt: null,
              previousCompletedAt: null,
            })
          ),
        });
        const withDates = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals: deepFreeze(
            buildHistoricalTrainingSignals({
              loadTrend: "DECREASING",
              latestCompletedAt: "2026-07-28T10:00:00.000Z",
              previousCompletedAt: "2026-07-21T10:00:00.000Z",
            })
          ),
        });

        assert.deepEqual(withDates, withoutDates);
        return { withoutDates, withDates };
      },
    },
    {
      name: "returns strict identity for exposure counts 0 and 1",
      input: "insufficient history fails closed",
      fn: () => {
        const candidateDecision = deepFreeze(buildCandidateDecision());
        const zero = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals: deepFreeze(
            buildHistoricalTrainingSignals({
              completedExposureCount: 0,
              loadTrend: "DECREASING",
            })
          ),
        });
        const one = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals: deepFreeze(
            buildHistoricalTrainingSignals({
              completedExposureCount: 1,
              loadTrend: "DECREASING",
            })
          ),
        });

        assert.equal(zero, candidateDecision);
        assert.equal(one, candidateDecision);
        return { zeroIdentity: true, oneIdentity: true };
      },
    },
    {
      name: "returns strict identity for neutral positive null and missing relevant trends",
      input: "ordinary inactive trend states do not throw or clone",
      fn: () => {
        const candidateDecision = deepFreeze(buildCandidateDecision());
        const neutral = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals: deepFreeze(
            buildHistoricalTrainingSignals({ loadTrend: "STABLE" })
          ),
        });
        const positive = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals: deepFreeze(
            buildHistoricalTrainingSignals({ loadTrend: "INCREASING" })
          ),
        });
        const nullTrend = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals: deepFreeze(
            buildHistoricalTrainingSignals({ loadTrend: null })
          ),
        });
        const missingTrend = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals: deepFreeze({
            ...buildHistoricalTrainingSignals(),
            loadTrend: undefined,
          })
        });

        assert.equal(neutral, candidateDecision);
        assert.equal(positive, candidateDecision);
        assert.equal(nullTrend, candidateDecision);
        assert.equal(missingTrend, candidateDecision);
        return { identity: true };
      },
    },
    {
      name: "declining irrelevant trend only does not trigger downgrade",
      input: "load candidate ignores rep decline and rep candidate ignores load decline",
      fn: () => {
        const loadCandidate = deepFreeze(buildCandidateDecision());
        const repCandidate = deepFreeze(
          buildCandidateDecision({
            decisionType: DECISION_TYPES.INCREASE_REPS,
            loadAdjustmentSteps: 0,
            repAdjustment: 1,
            primaryReasonCode: REASON_CODES.REP_PERFORMANCE_IMPROVED,
          })
        );

        const loadActual = applyHistoricalProgressionModifier({
          candidateDecision: loadCandidate,
          historicalTrainingSignals: deepFreeze(
            buildHistoricalTrainingSignals({
              loadTrend: "INCREASING",
              repTrend: "DECREASING",
            })
          ),
        });
        const repActual = applyHistoricalProgressionModifier({
          candidateDecision: repCandidate,
          historicalTrainingSignals: deepFreeze(
            buildHistoricalTrainingSignals({
              loadTrend: "DECREASING",
              repTrend: "INCREASING",
            })
          ),
        });

        assert.equal(loadActual, loadCandidate);
        assert.equal(repActual, repCandidate);
        return { loadIdentity: true, repIdentity: true };
      },
    },
    {
      name: "non-target valid decisions preserve strict identity",
      input: "non-R010 increase, maintain, recovery override, deload, duration, and missing history remain unchanged",
      fn: () => {
        const scenarios = [
          deepFreeze(
            buildCandidateDecision({
              primaryReasonCode: REASON_CODES.REPEATED_SUCCESS,
            })
          ),
          deepFreeze(
            buildCandidateDecision({
              decisionType: DECISION_TYPES.MAINTAIN,
              loadAdjustmentSteps: 0,
              primaryReasonCode: REASON_CODES.TARGETS_FULLY_MET,
              terminal: true,
            })
          ),
          deepFreeze(
            buildCandidateDecision({
              decisionType: DECISION_TYPES.MAINTAIN,
              loadAdjustmentSteps: 0,
              primaryReasonCode: REASON_CODES.RECOVERY_OVERRIDE,
              terminal: true,
            })
          ),
          deepFreeze(
            buildCandidateDecision({
              decisionType: DECISION_TYPES.DELOAD,
              loadAdjustmentSteps: -1,
              primaryReasonCode: REASON_CODES.REPEATED_FAILURE,
              terminal: true,
            })
          ),
          deepFreeze(
            buildCandidateDecision({
              decisionType: DECISION_TYPES.INCREASE_DURATION,
              loadAdjustmentSteps: 0,
              durationAdjustmentSteps: 1,
              primaryReasonCode: REASON_CODES.TIME_PERFORMANCE_IMPROVED,
            })
          ),
          deepFreeze(
            buildCandidateDecision({
              decisionType: DECISION_TYPES.INSUFFICIENT_DATA,
              loadAdjustmentSteps: 0,
              primaryReasonCode: REASON_CODES.INSUFFICIENT_HISTORY,
              terminal: true,
              shouldPersist: false,
            })
          ),
        ];

        for (const scenario of scenarios) {
          const actual = applyHistoricalProgressionModifier({
            candidateDecision: scenario,
            historicalTrainingSignals: deepFreeze(buildHistoricalTrainingSignals({
              completedExposureCount: 4,
              loadTrend: "DECREASING",
              repTrend: "DECREASING",
            })),
          });
          assert.equal(actual, scenario);
        }

        return { scenarioCount: scenarios.length };
      },
    },
    {
      name: "missing historical signals and neutral fallback preserve strict identity",
      input: "ordinary absent or neutral history remains inactive",
      fn: () => {
        const candidateDecision = deepFreeze(buildCandidateDecision());

        const missing = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals: undefined,
        });
        const neutralFallback = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals: deepFreeze(
            buildHistoricalTrainingSignals({
              completedExposureCount: 0,
              averageCompletionRatio: null,
              averageCompletedSets: null,
              latestCompletedAt: null,
              previousCompletedAt: null,
              loadTrend: "UNKNOWN",
              repTrend: "UNKNOWN",
            })
          ),
        });

        assert.equal(missing, candidateDecision);
        assert.equal(neutralFallback, candidateDecision);
        return { missingIdentity: true, neutralIdentity: true };
      },
    },
    {
      name: "unsupported trend value and malformed historical input fail closed by identity",
      input: "ordinary invalid history does not throw when candidate is otherwise valid",
      fn: () => {
        const candidateDecision = deepFreeze(buildCandidateDecision());

        const unsupportedTrend = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals: deepFreeze(
            buildHistoricalTrainingSignals({ loadTrend: "DOWNWARD" })
          ),
        });
        const malformedHistory = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals: deepFreeze({
            completedExposureCount: "2",
            loadTrend: "DECREASING",
          }),
        });

        assert.equal(unsupportedTrend, candidateDecision);
        assert.equal(malformedHistory, candidateDecision);
        return { unsupportedIdentity: true, malformedIdentity: true };
      },
    },
    {
      name: "malformed candidate input follows existing validation convention",
      input: "missing candidate decision throws ProgressionDecisionValidationError",
      fn: () => {
        assert.throws(
          () =>
            applyHistoricalProgressionModifier({
              candidateDecision: null,
              historicalTrainingSignals: buildHistoricalTrainingSignals(),
            }),
          ProgressionDecisionValidationError
        );

        assert.throws(
          () =>
            applyHistoricalProgressionModifier({
              candidateDecision: {
                ruleId: "R010_PERFORMANCE_IMPROVED_INCREASE",
              },
              historicalTrainingSignals: buildHistoricalTrainingSignals(),
            }),
          ProgressionDecisionValidationError
        );

        return { errorClass: "ProgressionDecisionValidationError" };
      },
    },
    {
      name: "deterministic repeated calls preserve inputs and produce deep-equal outputs",
      input: "same target inputs always yield the same downgraded decision",
      fn: () => {
        const candidateDecision = deepFreeze(buildCandidateDecision());
        const historicalTrainingSignals = deepFreeze(
          buildHistoricalTrainingSignals({ loadTrend: "DECREASING" })
        );
        const beforeCandidate = serializeForLog(candidateDecision);
        const beforeSignals = serializeForLog(historicalTrainingSignals);

        const first = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals,
        });
        const second = applyHistoricalProgressionModifier({
          candidateDecision,
          historicalTrainingSignals,
        });

        assert.deepEqual(second, first);
        assert.equal(serializeForLog(candidateDecision), beforeCandidate);
        assert.equal(serializeForLog(historicalTrainingSignals), beforeSignals);
        return first;
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

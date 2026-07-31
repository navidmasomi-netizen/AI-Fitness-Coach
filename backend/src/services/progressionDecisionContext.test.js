import assert from "node:assert/strict";

import {
  createProgressionDecisionContext,
  ProgressionDecisionContextValidationError,
  toProgressionDecisionEngineInput,
} from "./progressionDecisionContext.js";
import { decideProgression } from "./progressionDecisionEngine.js";
import { createTrainingStateSignals } from "./trainingStateSignals.js";

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

function buildAnalysis(overrides = {}) {
  return {
    exerciseId: 15,
    sourceSessionId: 501,
    prescription: {
      prescribedSets: 3,
      prescribedRepLow: 8,
      prescribedRepHigh: 12,
      prescribedRestSeconds: 90,
    },
    observedPerformance: {
      loggedSetCount: 3,
      completedSetCount: 3,
      successfulSetCount: 3,
      failedSetCount: 0,
      totalReps: 32,
      totalVolumeKg: 1265,
      averageWeightKg: 42.17,
      maximumWeightKg: 45,
      minimumWeightKg: 40,
      bestSet: { setNumber: 3, reps: 10, weightKg: 45 },
      finalSet: { setNumber: 3, reps: 10, weightKg: 45 },
      allPlannedSetsReachedUpperRepBound: false,
      prescribedSetCompletionRate: 1,
      targetRepHitRate: 1,
    },
    historyFacts: {
      previousSessionWeightKg: 42.5,
      weightDeltaKg: 2.5,
      weightDeltaPercent: 5.88,
      previousPrescribedSetCompletionRate: 1,
      prescribedSetCompletionRateDelta: 0,
      consecutiveSuccessfulSessions: 2,
      consecutiveFailedSessions: 0,
    },
    hasSufficientData: true,
    dataQualityFlags: [],
    ...overrides,
  };
}

function buildProgressionPolicy(overrides = {}) {
  return {
    progressionMode: "load",
    allowsLoadAdjustment: true,
    allowsSetAdjustment: false,
    allowsRepAdjustment: false,
    validIncrement: true,
    ...overrides,
  };
}

function buildRecoveryConstraint(overrides = {}) {
  return {
    recoveryModifier: "neutral",
    confidence: 0.4,
    signalStrength: "moderate",
    reasonCode: null,
    ...overrides,
  };
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

function buildTrainingStateSignals(signalOverrides = {}) {
  return createTrainingStateSignals({
    fatigue: {
      historicalTrainingSignals: buildHistoricalTrainingSignals(signalOverrides),
    },
  });
}

function buildContextInput(overrides = {}) {
  return {
    analysis: buildAnalysis(),
    progressionPolicy: buildProgressionPolicy(),
    recoveryConstraint: buildRecoveryConstraint(),
    previousDecisionContext: {
      previousDecisionType: "MAINTAIN",
      consecutiveFailures: 0,
    },
    trainingStateSignals: buildTrainingStateSignals(),
    ...overrides,
  };
}

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "current decision context shape remains stable during training state migration",
      input: "public input moves to trainingStateSignals while the context output remains unchanged",
      fn: () => {
        const actual = createProgressionDecisionContext(buildContextInput());

        assert.deepEqual(Object.keys(actual), [
          "analysis",
          "progressionPolicy",
          "recoveryConstraint",
          "previousDecisionContext",
          "historicalTrainingSignals",
        ]);
        assert.equal(Object.hasOwn(actual, "trainingStateSignals"), false);

        return actual;
      },
    },
    {
      name: "constructs immutable nested decision context",
      input: "plain facts are copied and deeply frozen",
      fn: () => {
        const input = buildContextInput();
        const snapshot = structuredClone(input);
        const actual = createProgressionDecisionContext(input);

        assert.deepEqual(actual, {
          analysis: snapshot.analysis,
          progressionPolicy: snapshot.progressionPolicy,
          recoveryConstraint: snapshot.recoveryConstraint,
          previousDecisionContext: snapshot.previousDecisionContext,
          historicalTrainingSignals:
            snapshot.trainingStateSignals.fatigue.historicalTrainingSignals,
        });
        assert.notEqual(actual, input);
        assert.notEqual(actual.analysis, input.analysis);
        assert.notEqual(
          actual.historicalTrainingSignals,
          input.trainingStateSignals.fatigue.historicalTrainingSignals
        );
        assert.deepEqual(input, snapshot);
        return actual;
      },
    },
    {
      name: "deep freeze protects nested values",
      input: "nested objects and arrays reject mutation after construction",
      fn: () => {
        const actual = createProgressionDecisionContext(
          buildContextInput({
            analysis: buildAnalysis({
              dataQualityFlags: ["missing_previous_session"],
            }),
          })
        );

        assert.equal(Object.isFrozen(actual), true);
        assert.equal(Object.isFrozen(actual.analysis), true);
        assert.equal(Object.isFrozen(actual.analysis.dataQualityFlags), true);
        assert.equal(Object.isFrozen(actual.historicalTrainingSignals), true);
        assert.throws(() => {
          actual.analysis.exerciseId = 999;
        }, TypeError);
        assert.throws(() => {
          actual.analysis.dataQualityFlags.push("new_flag");
        }, TypeError);
        return actual;
      },
    },
    {
      name: "validates required sections",
      input: "missing analysis fails closed and trainingStateSignals remain required",
      fn: () => {
        assert.throws(
          () =>
            createProgressionDecisionContext(
              buildContextInput({
                analysis: null,
              })
            ),
          ProgressionDecisionContextValidationError
        );

        return {
          errorClass: "ProgressionDecisionContextValidationError",
        };
      },
    },
    {
      name: "validates training state contract boundary",
      input: "trainingStateSignals must expose fatigue.historicalTrainingSignals",
      fn: () => {
        assert.throws(
          () =>
            createProgressionDecisionContext(
              buildContextInput({
                trainingStateSignals: {
                  fatigue: null,
                },
              })
            ),
          ProgressionDecisionContextValidationError
        );

        assert.throws(
          () =>
            createProgressionDecisionContext(
              buildContextInput({
                trainingStateSignals: {
                  fatigue: {},
                },
              })
            ),
          ProgressionDecisionContextValidationError
        );

        return {
          errorClass: "ProgressionDecisionContextValidationError",
        };
      },
    },
    {
      name: "validates nullable previous decision context",
      input: "previousDecisionContext must be null or a plain object",
      fn: () => {
        assert.throws(
          () =>
            createProgressionDecisionContext(
              buildContextInput({
                previousDecisionContext: ["not", "an", "object"],
              })
            ),
          ProgressionDecisionContextValidationError
        );

        const actual = createProgressionDecisionContext(
          buildContextInput({
            previousDecisionContext: null,
          })
        );
        assert.equal(actual.previousDecisionContext, null);
        return actual;
      },
    },
    {
      name: "rejects non-serializable values",
      input: "functions and non-plain objects are blocked during cloning",
      fn: () => {
        assert.throws(
          () =>
            createProgressionDecisionContext(
              buildContextInput({
                analysis: buildAnalysis({
                  observedPerformance: {
                    ...buildAnalysis().observedPerformance,
                    unsupported: () => "nope",
                  },
                }),
              })
            ),
          ProgressionDecisionContextValidationError
        );

        return {
          errorClass: "ProgressionDecisionContextValidationError",
        };
      },
    },
    {
      name: "adapter output shape remains stable during training state migration",
      input: "engine input still exposes historicalTrainingSignals directly",
      fn: () => {
        const context = createProgressionDecisionContext(buildContextInput());
        const actual = toProgressionDecisionEngineInput(context);

        assert.deepEqual(Object.keys(actual), [
          "analysis",
          "progressionPolicy",
          "recoveryConstraint",
          "previousDecisionContext",
          "historicalTrainingSignals",
          "existingRecommendationContext",
          "policyThresholds",
        ]);
        assert.equal(Object.hasOwn(actual, "trainingStateSignals"), false);

        return actual;
      },
    },
    {
      name: "adapter preserves current engine input contract",
      input: "unwrapped historical signals pass through as the exact frozen reference",
      fn: () => {
        const context = createProgressionDecisionContext(buildContextInput());
        const actual = toProgressionDecisionEngineInput(context);

        assert.deepEqual(actual.analysis, context.analysis);
        assert.deepEqual(actual.progressionPolicy, context.progressionPolicy);
        assert.deepEqual(actual.recoveryConstraint, context.recoveryConstraint);
        assert.deepEqual(
          actual.previousDecisionContext,
          context.previousDecisionContext
        );
        assert.equal(Object.hasOwn(actual, "historicalTrainingSignals"), true);
        assert.equal(
          actual.historicalTrainingSignals,
          context.historicalTrainingSignals
        );
        assert.equal(Object.isFrozen(actual.historicalTrainingSignals), true);
        assert.deepEqual(actual.existingRecommendationContext, null);
        assert.deepEqual(actual.policyThresholds, {
          deloadFailureStreak: 2,
        });

        return actual;
      },
    },
    {
      name: "training state contract is unwrapped without changing decision context outputs",
      input: "fatigue-domain training state feeds the same legacy engine-facing boundary",
      fn: () => {
        const trainingStateSignals = buildTrainingStateSignals();
        const context = createProgressionDecisionContext(buildContextInput());
        const adaptedInput = toProgressionDecisionEngineInput(context);

        assert.deepEqual(trainingStateSignals, {
          fatigue: {
            historicalTrainingSignals: buildHistoricalTrainingSignals(),
          },
        });
        assert.equal(Object.hasOwn(context, "trainingStateSignals"), false);
        assert.equal(Object.hasOwn(adaptedInput, "trainingStateSignals"), false);

        return {
          trainingStateSignals,
          contextKeys: Object.keys(context),
          adaptedInputKeys: Object.keys(adaptedInput),
        };
      },
    },
    {
      name: "legacy historical signal input remains temporarily compatible until phase 10.4",
      input: "current production callers can still pass historicalTrainingSignals without behavior change",
      fn: () => {
        const legacyContext = createProgressionDecisionContext({
          analysis: buildAnalysis(),
          progressionPolicy: buildProgressionPolicy(),
          recoveryConstraint: buildRecoveryConstraint(),
          previousDecisionContext: {
            previousDecisionType: "MAINTAIN",
            consecutiveFailures: 0,
          },
          historicalTrainingSignals: buildHistoricalTrainingSignals(),
        });
        const migratedContext = createProgressionDecisionContext(buildContextInput());

        assert.deepEqual(legacyContext, migratedContext);
        assert.equal(Object.hasOwn(legacyContext, "trainingStateSignals"), false);

        return legacyContext;
      },
    },
    {
      name: "decision output remains identical across historical signal variants",
      input: "only the unwrapped historicalTrainingSignals change while the normalized decision stays identical",
      fn: () => {
        const legacyInput = {
          analysis: buildAnalysis(),
          progressionPolicy: buildProgressionPolicy(),
          recoveryConstraint: buildRecoveryConstraint(),
          previousDecisionContext: {
            previousDecisionType: "MAINTAIN",
            consecutiveFailures: 0,
          },
          existingRecommendationContext: null,
          policyThresholds: {
            deloadFailureStreak: 2,
          },
        };
        const historicalVariants = [
          {
            name: "neutral-fallback",
            signals: buildHistoricalTrainingSignals({
              completedExposureCount: 0,
              averageCompletionRatio: null,
              averageCompletedSets: null,
              latestCompletedAt: null,
              previousCompletedAt: null,
              loadTrend: "UNKNOWN",
              repTrend: "UNKNOWN",
            }),
          },
          {
            name: "zero-completed-exposure",
            signals: buildHistoricalTrainingSignals({
              completedExposureCount: 0,
              averageCompletionRatio: 0,
              averageCompletedSets: 0,
              latestCompletedAt: null,
              previousCompletedAt: null,
            }),
          },
          {
            name: "one-completed-exposure",
            signals: buildHistoricalTrainingSignals({
              completedExposureCount: 1,
              averageCompletionRatio: 1,
              averageCompletedSets: 3,
              latestCompletedAt: "2026-07-20T10:00:00.000Z",
              previousCompletedAt: null,
              loadTrend: "UNKNOWN",
              repTrend: "UNKNOWN",
            }),
          },
          {
            name: "positive-load-trend",
            signals: buildHistoricalTrainingSignals({
              loadTrend: "INCREASING",
            }),
          },
          {
            name: "negative-load-trend",
            signals: buildHistoricalTrainingSignals({
              loadTrend: "DECREASING",
            }),
          },
          {
            name: "positive-rep-trend",
            signals: buildHistoricalTrainingSignals({
              repTrend: "INCREASING",
            }),
          },
          {
            name: "negative-rep-trend",
            signals: buildHistoricalTrainingSignals({
              repTrend: "DECREASING",
            }),
          },
          {
            name: "missing-historical-dates",
            signals: buildHistoricalTrainingSignals({
              latestCompletedAt: null,
              previousCompletedAt: null,
            }),
          },
          {
            name: "populated-historical-dates",
            signals: buildHistoricalTrainingSignals({
              latestCompletedAt: "2026-07-28T10:00:00.000Z",
              previousCompletedAt: "2026-07-21T10:00:00.000Z",
            }),
          },
        ];

        const baseline = decideProgression(legacyInput);
        const results = [];

        for (const variant of historicalVariants) {
          const context = createProgressionDecisionContext(
            buildContextInput({
              analysis: legacyInput.analysis,
              progressionPolicy: legacyInput.progressionPolicy,
              recoveryConstraint: legacyInput.recoveryConstraint,
              previousDecisionContext: legacyInput.previousDecisionContext,
              trainingStateSignals: buildTrainingStateSignals(variant.signals),
            })
          );
          const adaptedInput = toProgressionDecisionEngineInput(context);
          const before = structuredClone(adaptedInput.historicalTrainingSignals);
          const actual = decideProgression(adaptedInput);

          assert.equal(
            adaptedInput.historicalTrainingSignals,
            context.historicalTrainingSignals
          );
          assert.equal(Object.isFrozen(adaptedInput.historicalTrainingSignals), true);
          assert.deepEqual(adaptedInput.historicalTrainingSignals, before);
          assert.deepEqual(actual, baseline);

          results.push({
            variant: variant.name,
            decision: actual,
          });
        }

        return {
          baseline,
          variants: results.map((result) => result.variant),
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

import assert from "node:assert/strict";

import {
  DECISION_TYPES,
  PROGRESSION_RULES_VERSION,
  ProgressionDecisionValidationError,
  REASON_CODES,
  RULE_CATALOG,
  decideProgression,
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
  for (const nestedValue of Object.values(value)) {
    deepFreeze(nestedValue);
  }
  return value;
}

function assertNoUndefined(value, path = "root") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoUndefined(entry, `${path}[${index}]`));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    assert.notEqual(nestedValue, undefined, `${path}.${key} must not be undefined`);
    assertNoUndefined(nestedValue, `${path}.${key}`);
  }
}

function buildAnalysis(overrides = {}) {
  const base = {
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
      totalReps: 30,
      totalVolumeKg: 1265,
      averageWeightKg: 42.5,
      maximumWeightKg: 45,
      minimumWeightKg: 40,
      bestSet: { setNumber: 3, reps: 8, weightKg: 45 },
      finalSet: { setNumber: 3, reps: 8, weightKg: 45 },
      allPlannedSetsReachedUpperRepBound: false,
      prescribedSetCompletionRate: 1,
      targetRepHitRate: 1,
    },
    historyFacts: {
      previousSessionWeightKg: 42.5,
      weightDeltaKg: 2.5,
      weightDeltaPercent: 5.8824,
      previousPrescribedSetCompletionRate: 1,
      prescribedSetCompletionRateDelta: 0,
      consecutiveSuccessfulSessions: 2,
      consecutiveFailedSessions: 0,
    },
    hasSufficientData: true,
    dataQualityFlags: [],
  };

  return {
    ...base,
    ...overrides,
    prescription: {
      ...base.prescription,
      ...(overrides.prescription ?? {}),
    },
    observedPerformance: {
      ...base.observedPerformance,
      ...(overrides.observedPerformance ?? {}),
    },
    historyFacts: {
      ...base.historyFacts,
      ...(overrides.historyFacts ?? {}),
    },
  };
}

function buildInput(overrides = {}) {
  const historicalTrainingSignals =
    overrides.historicalTrainingSignals ?? buildHistoricalTrainingSignals();
  const {
    historicalTrainingSignals: _legacyHistoricalTrainingSignals,
    trainingStateSignals,
    ...rest
  } = overrides;

  return {
    analysis: buildAnalysis(),
    progressionPolicy: {
      progressionMode: "load",
      allowsLoadAdjustment: true,
      allowsSetAdjustment: false,
      allowsRepAdjustment: false,
      validIncrement: true,
    },
    recoveryConstraint: null,
    previousDecisionContext: null,
    trainingStateSignals:
      trainingStateSignals ??
      buildTrainingStateSignals({
        historicalTrainingSignals,
      }),
    existingRecommendationContext: null,
    policyThresholds: {
      deloadFailureStreak: 2,
    },
    ...rest,
  };
}

function buildHistoricalTrainingSignals(overrides = {}) {
  return {
    completedExposureCount: 0,
    averageCompletionRatio: null,
    averageCompletedSets: null,
    latestCompletedAt: null,
    previousCompletedAt: null,
    loadTrend: "UNKNOWN",
    repTrend: "UNKNOWN",
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

function buildTrainingStateSignals({
  historicalTrainingSignals = buildHistoricalTrainingSignals(),
  deloadHistory,
} = {}) {
  return {
    fatigue: {
      historicalTrainingSignals,
    },
    ...(deloadHistory !== undefined
      ? {
          adaptation: {
            deloadHistory,
          },
        }
      : {}),
  };
}

function buildCanonicalR010Input(overrides = {}) {
  const baseAnalysis = buildAnalysis({
    historyFacts: {
      previousSessionWeightKg: 42.5,
      weightDeltaKg: 2.5,
      weightDeltaPercent: 5.8824,
      previousPrescribedSetCompletionRate: 0.6667,
      prescribedSetCompletionRateDelta: 0.3333,
      consecutiveSuccessfulSessions: 1,
      consecutiveFailedSessions: 0,
    },
  });

  return buildInput({
    historicalTrainingSignals: buildHistoricalTrainingSignals(),
    ...overrides,
    analysis: {
      ...baseAnalysis,
      ...(overrides.analysis ?? {}),
      prescription: {
        ...baseAnalysis.prescription,
        ...(overrides.analysis?.prescription ?? {}),
      },
      observedPerformance: {
        ...baseAnalysis.observedPerformance,
        ...(overrides.analysis?.observedPerformance ?? {}),
      },
      historyFacts: {
        ...baseAnalysis.historyFacts,
        ...(overrides.analysis?.historyFacts ?? {}),
      },
    },
  });
}

function buildRepsAnalysis(overrides = {}) {
  const base = {
    exerciseId: 52,
    sourceSessionId: 552,
    prescription: {
      prescribedSets: 3,
      prescribedRepLow: 12,
      prescribedRepHigh: 20,
      prescribedRestSeconds: 60,
    },
    observedPerformance: {
      loggedSetCount: 3,
      completedSetCount: 3,
      successfulSetCount: 3,
      failedSetCount: 0,
      totalReps: 54,
      totalVolumeKg: 0,
      averageWeightKg: null,
      maximumWeightKg: null,
      minimumWeightKg: null,
      bestSet: { setNumber: 3, reps: 18, weightKg: null },
      finalSet: { setNumber: 3, reps: 18, weightKg: null },
      allPlannedSetsReachedUpperRepBound: false,
      prescribedSetCompletionRate: 1,
      targetRepHitRate: 1,
    },
    historyFacts: {
      previousSessionWeightKg: null,
      weightDeltaKg: null,
      weightDeltaPercent: null,
      previousPrescribedSetCompletionRate: 1,
      prescribedSetCompletionRateDelta: 0,
      consecutiveSuccessfulSessions: 2,
      consecutiveFailedSessions: 0,
    },
    hasSufficientData: true,
    dataQualityFlags: [],
  };

  return {
    ...base,
    ...overrides,
    prescription: {
      ...base.prescription,
      ...(overrides.prescription ?? {}),
    },
    observedPerformance: {
      ...base.observedPerformance,
      ...(overrides.observedPerformance ?? {}),
    },
    historyFacts: {
      ...base.historyFacts,
      ...(overrides.historyFacts ?? {}),
    },
  };
}

function buildRepsInput(overrides = {}) {
  return buildInput({
    analysis: buildRepsAnalysis(),
    progressionPolicy: {
      progressionMode: "reps",
      allowsLoadAdjustment: false,
      allowsSetAdjustment: false,
      allowsRepAdjustment: true,
      validIncrement: true,
    },
    ...overrides,
  });
}

function buildTimeAnalysis(overrides = {}) {
  const base = {
    exerciseId: 31,
    sourceSessionId: 631,
    prescription: {
      prescribedSets: 3,
      prescribedRepLow: 30,
      prescribedRepHigh: 45,
      prescribedRestSeconds: 45,
    },
    observedPerformance: {
      loggedSetCount: 3,
      completedSetCount: 3,
      successfulSetCount: 3,
      failedSetCount: 0,
      totalReps: 105,
      totalVolumeKg: 0,
      averageWeightKg: null,
      maximumWeightKg: null,
      minimumWeightKg: null,
      bestSet: { setNumber: 3, reps: 35, weightKg: null },
      finalSet: { setNumber: 3, reps: 35, weightKg: null },
      allPlannedSetsReachedUpperRepBound: false,
      prescribedSetCompletionRate: 1,
      targetRepHitRate: 1,
    },
    historyFacts: {
      previousSessionWeightKg: null,
      weightDeltaKg: null,
      weightDeltaPercent: null,
      previousPrescribedSetCompletionRate: 1,
      prescribedSetCompletionRateDelta: 0,
      consecutiveSuccessfulSessions: 2,
      consecutiveFailedSessions: 0,
    },
    hasSufficientData: true,
    dataQualityFlags: [],
  };

  return {
    ...base,
    ...overrides,
    prescription: {
      ...base.prescription,
      ...(overrides.prescription ?? {}),
    },
    observedPerformance: {
      ...base.observedPerformance,
      ...(overrides.observedPerformance ?? {}),
    },
    historyFacts: {
      ...base.historyFacts,
      ...(overrides.historyFacts ?? {}),
    },
  };
}

function buildTimeInput(overrides = {}) {
  return buildInput({
    analysis: buildTimeAnalysis(),
    progressionPolicy: {
      progressionMode: "time",
      allowsLoadAdjustment: false,
      allowsSetAdjustment: false,
      allowsRepAdjustment: false,
      validIncrement: true,
    },
    ...overrides,
  });
}

function buildRepsThenLoadInput(overrides = {}) {
  return buildInput({
    analysis: buildAnalysis(),
    progressionPolicy: {
      progressionMode: "reps_then_load",
      allowsLoadAdjustment: true,
      allowsSetAdjustment: false,
      allowsRepAdjustment: true,
      validIncrement: true,
    },
    ...overrides,
  });
}

function assertExactDecisionPayload(actual, expected) {
  assert.equal(actual.exerciseId, expected.exerciseId);
  assert.equal(actual.sourceSessionId, expected.sourceSessionId);
  assert.equal(actual.decisionType, expected.decisionType);
  assert.equal(actual.loadAdjustmentSteps, expected.loadAdjustmentSteps);
  assert.equal(actual.setAdjustment, expected.setAdjustment);
  assert.equal(actual.repAdjustment, expected.repAdjustment);
  assert.equal(actual.durationAdjustmentSteps, expected.durationAdjustmentSteps);
  assert.equal(actual.reasonCode, expected.reasonCode);
  assert.deepEqual(actual.secondaryReasonCodes, expected.secondaryReasonCodes);
  assert.equal(actual.confidence, expected.confidence);
  assert.equal(actual.requiresManualReview, expected.requiresManualReview);
  assert.equal(actual.shouldPersist, expected.shouldPersist);
  assert.equal(actual.rulesVersion, expected.rulesVersion);
}

function expectValidationError(fn, messagePart) {
  assert.throws(fn, (error) => {
    assert.equal(error instanceof ProgressionDecisionValidationError, true);
    if (messagePart) {
      assert.match(error.message, new RegExp(messagePart));
    }
    return true;
  });
}

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "full success repeated success increases load",
      input: "valid analyzer output with repeated successful sessions",
      fn: () => {
        const actual = decideProgression(buildInput());
        assert.equal(actual.decisionType, DECISION_TYPES.INCREASE_LOAD);
        assert.equal(actual.loadAdjustmentSteps, 1);
        assert.equal(actual.setAdjustment, 0);
        assert.equal(actual.repAdjustment, 0);
        assert.equal(actual.durationAdjustmentSteps, 0);
        assert.equal(actual.reasonCode, REASON_CODES.REPEATED_SUCCESS);
        assert.deepEqual(actual.secondaryReasonCodes, [REASON_CODES.TARGETS_FULLY_MET]);
        assert.equal(actual.shouldPersist, true);
        assert.equal(actual.requiresManualReview, false);
        assert.equal(actual.rulesVersion, PROGRESSION_RULES_VERSION);
        return actual;
      },
    },
    {
      name: "canonical R010 performance-improved increase remains fully normalized",
      input: "full success with positive deltas but below repeated-success threshold",
      fn: () => {
        const actual = decideProgression(buildCanonicalR010Input());
        assertExactDecisionPayload(actual, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.INCREASE_LOAD,
          loadAdjustmentSteps: 1,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.PERFORMANCE_IMPROVED,
          secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
          confidence: 0.65,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });
        return actual;
      },
    },
    {
      name: "historical signal variants preserve the activated R010 characterization baseline",
      input: "only historicalTrainingSignals changes around the active historical modifier boundary",
      fn: () => {
        const baselineInput = buildCanonicalR010Input({
          historicalTrainingSignals: buildHistoricalTrainingSignals(),
        });
        const baseline = decideProgression(baselineInput);
        const variants = [
          {
            name: "neutral-fallback",
            historicalTrainingSignals: buildHistoricalTrainingSignals(),
          },
          {
            name: "zero-completed-exposures",
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              completedExposureCount: 0,
              averageCompletionRatio: 0,
              averageCompletedSets: 0,
            }),
          },
          {
            name: "one-completed-exposure",
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              completedExposureCount: 1,
              averageCompletionRatio: 1,
              averageCompletedSets: 3,
              latestCompletedAt: "2026-07-20T10:00:00.000Z",
              previousCompletedAt: null,
            }),
          },
          {
            name: "two-exposures-neutral-trend",
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              completedExposureCount: 2,
              averageCompletionRatio: 1,
              averageCompletedSets: 3,
              loadTrend: "STABLE",
              repTrend: "STABLE",
            }),
          },
          {
            name: "two-exposures-positive-load",
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              completedExposureCount: 2,
              averageCompletionRatio: 1,
              averageCompletedSets: 3,
              loadTrend: "INCREASING",
              repTrend: "STABLE",
            }),
          },
          {
            name: "two-exposures-negative-load",
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              completedExposureCount: 2,
              averageCompletionRatio: 1,
              averageCompletedSets: 3,
              loadTrend: "DECREASING",
              repTrend: "STABLE",
            }),
          },
          {
            name: "two-exposures-positive-rep",
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              completedExposureCount: 2,
              averageCompletionRatio: 1,
              averageCompletedSets: 3,
              loadTrend: "STABLE",
              repTrend: "INCREASING",
            }),
          },
          {
            name: "two-exposures-negative-rep",
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              completedExposureCount: 2,
              averageCompletionRatio: 1,
              averageCompletedSets: 3,
              loadTrend: "STABLE",
              repTrend: "DECREASING",
            }),
          },
          {
            name: "three-or-more-exposures",
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              completedExposureCount: 4,
              averageCompletionRatio: 0.9,
              averageCompletedSets: 2.75,
              loadTrend: "STABLE",
              repTrend: "STABLE",
            }),
          },
          {
            name: "missing-historical-dates",
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              completedExposureCount: 2,
              averageCompletionRatio: 1,
              averageCompletedSets: 3,
              latestCompletedAt: null,
              previousCompletedAt: null,
              loadTrend: "STABLE",
              repTrend: "STABLE",
            }),
          },
          {
            name: "populated-historical-dates",
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              completedExposureCount: 2,
              averageCompletionRatio: 1,
              averageCompletedSets: 3,
              latestCompletedAt: "2026-07-28T10:00:00.000Z",
              previousCompletedAt: "2026-07-21T10:00:00.000Z",
              loadTrend: "STABLE",
              repTrend: "STABLE",
            }),
          },
          {
            name: "conflicting-load-and-rep-trends",
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              completedExposureCount: 2,
              averageCompletionRatio: 1,
              averageCompletedSets: 3,
              loadTrend: "DECREASING",
              repTrend: "INCREASING",
            }),
          },
        ];

        const results = [];
        for (const variant of variants) {
          const input = deepFreeze(
            buildCanonicalR010Input({
              historicalTrainingSignals: deepFreeze(variant.historicalTrainingSignals),
            })
          );
          const beforeSignals = serializeForLog(
            input.trainingStateSignals.fatigue.historicalTrainingSignals
          );
          const actual = decideProgression(input);

          assert.equal(
            Object.isFrozen(input.trainingStateSignals.fatigue.historicalTrainingSignals),
            true
          );
          assert.equal(
            serializeForLog(input.trainingStateSignals.fatigue.historicalTrainingSignals),
            beforeSignals
          );

          if (
            variant.name === "two-exposures-negative-load" ||
            variant.name === "conflicting-load-and-rep-trends"
          ) {
            assertExactDecisionPayload(actual, {
              exerciseId: 15,
              sourceSessionId: 501,
              decisionType: DECISION_TYPES.MAINTAIN,
              loadAdjustmentSteps: 0,
              setAdjustment: 0,
              repAdjustment: 0,
              durationAdjustmentSteps: 0,
              reasonCode: REASON_CODES.HISTORICAL_TREND_CONFLICT,
              secondaryReasonCodes: [
                REASON_CODES.PERFORMANCE_IMPROVED,
                REASON_CODES.TARGETS_FULLY_MET,
              ],
              confidence: 0.5,
              requiresManualReview: false,
              shouldPersist: true,
              rulesVersion: PROGRESSION_RULES_VERSION,
            });
          } else {
            assert.deepEqual(actual, baseline);
            assert.notEqual(actual.reasonCode, REASON_CODES.HISTORICAL_TREND_CONFLICT);
            assert.equal(
              actual.secondaryReasonCodes.includes(REASON_CODES.HISTORICAL_TREND_CONFLICT),
              false
            );
          }

          results.push(variant.name);
        }

        return {
          baseline,
          variants: results,
        };
      },
    },
    {
      name: "deload history variants remain behaviorally inert across representative decision families",
      input: "adaptation.deloadHistory changes while final decision output remains identical",
      fn: () => {
        const maintainInput = buildInput({
          analysis: buildAnalysis({
            historyFacts: {
              previousSessionWeightKg: 42.5,
              weightDeltaKg: 0,
              weightDeltaPercent: 0,
              previousPrescribedSetCompletionRate: 1,
              prescribedSetCompletionRateDelta: 0,
              consecutiveSuccessfulSessions: 0,
              consecutiveFailedSessions: 0,
            },
          }),
        });
        const historicalConflictInput = buildCanonicalR010Input({
          historicalTrainingSignals: buildHistoricalTrainingSignals({
            completedExposureCount: 2,
            averageCompletionRatio: 1,
            averageCompletedSets: 3,
            loadTrend: "DECREASING",
            repTrend: "STABLE",
          }),
        });
        const recoveryOverrideInput = buildCanonicalR010Input({
          recoveryConstraint: {
            recoveryModifier: "caution",
            confidence: 0.8,
            signalStrength: "strong",
            reasonCode: null,
          },
        });
        const deloadCandidateInput = buildInput({
          analysis: buildAnalysis({
            observedPerformance: {
              completedSetCount: 2,
              successfulSetCount: 1,
              failedSetCount: 2,
              totalReps: 18,
              totalVolumeKg: 720,
              averageWeightKg: 40,
              maximumWeightKg: 40,
              minimumWeightKg: 40,
              bestSet: { setNumber: 1, reps: 10, weightKg: 40 },
              finalSet: { setNumber: 3, reps: 4, weightKg: 40 },
              allPlannedSetsReachedUpperRepBound: false,
              prescribedSetCompletionRate: 0.6667,
              targetRepHitRate: 0.3333,
            },
            historyFacts: {
              previousSessionWeightKg: 42.5,
              weightDeltaKg: -2.5,
              weightDeltaPercent: -5.8824,
              previousPrescribedSetCompletionRate: 1,
              prescribedSetCompletionRateDelta: -0.3333,
              consecutiveSuccessfulSessions: 0,
              consecutiveFailedSessions: 2,
            },
          }),
        });
        const doNotPersistInput = buildInput({
          analysis: buildAnalysis({
            hasSufficientData: false,
          }),
        });

        const scenarios = [
          { name: "increase-candidate", input: buildCanonicalR010Input() },
          { name: "maintain-candidate", input: maintainInput },
          { name: "historical-conflict-downgrade", input: historicalConflictInput },
          { name: "recovery-override", input: recoveryOverrideInput },
          { name: "existing-deload-candidate", input: deloadCandidateInput },
          { name: "do-not-persist-candidate", input: doNotPersistInput },
        ];

        const deloadHistoryVariants = [
          {
            name: "neutral-deload-history",
            deloadHistory: buildDeloadHistory({
              recentDeloadCount: 0,
              mostRecentDeloadAt: null,
              hasRecentDeload: false,
            }),
          },
          {
            name: "one-applied-deload",
            deloadHistory: buildDeloadHistory(),
          },
          {
            name: "multiple-applied-deloads-different-timestamps",
            deloadHistory: buildDeloadHistory({
              recentDeloadCount: 2,
              mostRecentDeloadAt: "2026-07-22T10:00:00.000Z",
              hasRecentDeload: true,
            }),
          },
          {
            name: "multiple-applied-deloads-equal-most-recent-timestamp",
            deloadHistory: buildDeloadHistory({
              recentDeloadCount: 3,
              mostRecentDeloadAt: "2026-07-20T10:00:00.000Z",
              hasRecentDeload: true,
            }),
          },
          {
            name: "older-applied-deload",
            deloadHistory: buildDeloadHistory({
              recentDeloadCount: 1,
              mostRecentDeloadAt: "2024-01-01T10:00:00.000Z",
              hasRecentDeload: true,
            }),
          },
        ];

        for (const scenario of scenarios) {
          const baseline = decideProgression(scenario.input);

          for (const variant of deloadHistoryVariants) {
            const actual = decideProgression({
              ...scenario.input,
              trainingStateSignals: buildTrainingStateSignals({
                historicalTrainingSignals:
                  scenario.input.trainingStateSignals.fatigue.historicalTrainingSignals,
                deloadHistory: variant.deloadHistory,
              }),
            });

            assert.deepEqual(
              actual,
              baseline,
              `${scenario.name} changed under ${variant.name}`
            );
          }
        }

        return {
          scenarios: scenarios.map((scenario) => scenario.name),
          variants: deloadHistoryVariants.map((variant) => variant.name),
        };
      },
    },
    {
      name: "reps mode performance-improved increase downgrades on declining rep trend",
      input: "rep-oriented R010 uses repTrend and emits historical conflict maintain",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            analysis: buildRepsAnalysis({
              historyFacts: {
                previousSessionWeightKg: null,
                weightDeltaKg: null,
                weightDeltaPercent: null,
                previousPrescribedSetCompletionRate: 0.6667,
                prescribedSetCompletionRateDelta: 0.3333,
                consecutiveSuccessfulSessions: 1,
                consecutiveFailedSessions: 0,
              },
            }),
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              completedExposureCount: 2,
              averageCompletionRatio: 1,
              averageCompletedSets: 3,
              loadTrend: "INCREASING",
              repTrend: "DECREASING",
            }),
          })
        );

        assertExactDecisionPayload(actual, {
          exerciseId: 52,
          sourceSessionId: 552,
          decisionType: DECISION_TYPES.MAINTAIN,
          loadAdjustmentSteps: 0,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.HISTORICAL_TREND_CONFLICT,
          secondaryReasonCodes: [
            REASON_CODES.REP_PERFORMANCE_IMPROVED,
            REASON_CODES.TARGETS_FULLY_MET,
          ],
          confidence: 0.5,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });

        return actual;
      },
    },
    {
      name: "recovery downgrade preserves candidate-selection precedence around canonical R010",
      input: "performance-improved increase candidate exists first, then caution recovery downgrades it",
      fn: () => {
        const candidateInput = buildCanonicalR010Input({
          recoveryConstraint: {
            recoveryModifier: "neutral",
            confidence: 0.5,
            signalStrength: "moderate",
            reasonCode: null,
          },
        });
        const downgradeInput = buildCanonicalR010Input({
          recoveryConstraint: {
            recoveryModifier: "caution",
            confidence: 0.8,
            signalStrength: "strong",
            reasonCode: "behavioral",
          },
        });

        const candidate = decideProgression(candidateInput);
        const downgraded = decideProgression(downgradeInput);

        assertExactDecisionPayload(candidate, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.INCREASE_LOAD,
          loadAdjustmentSteps: 1,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.PERFORMANCE_IMPROVED,
          secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
          confidence: 0.65,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });
        assertExactDecisionPayload(downgraded, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.MAINTAIN,
          loadAdjustmentSteps: 0,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.RECOVERY_OVERRIDE,
          secondaryReasonCodes: [
            REASON_CODES.PERFORMANCE_IMPROVED,
            REASON_CODES.TARGETS_FULLY_MET,
          ],
          confidence: 0.4,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });
        assert.notEqual(downgraded.reasonCode, REASON_CODES.HISTORICAL_TREND_CONFLICT);
        assert.equal(downgraded.secondaryReasonCodes.includes(REASON_CODES.HISTORICAL_TREND_CONFLICT), false);

        return {
          candidate,
          downgraded,
        };
      },
    },
    {
      name: "historical downgrade precedes recovery when both conditions are true",
      input: "declining relevant history downgrades the selected R010 candidate before caution recovery applies",
      fn: () => {
        const actual = decideProgression(
          buildCanonicalR010Input({
            recoveryConstraint: {
              recoveryModifier: "caution",
              confidence: 0.8,
              signalStrength: "strong",
              reasonCode: "behavioral",
            },
            historicalTrainingSignals: buildHistoricalTrainingSignals({
              completedExposureCount: 2,
              averageCompletionRatio: 1,
              averageCompletedSets: 3,
              loadTrend: "DECREASING",
              repTrend: "INCREASING",
            }),
          })
        );

        assertExactDecisionPayload(actual, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.MAINTAIN,
          loadAdjustmentSteps: 0,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.HISTORICAL_TREND_CONFLICT,
          secondaryReasonCodes: [
            REASON_CODES.PERFORMANCE_IMPROVED,
            REASON_CODES.TARGETS_FULLY_MET,
          ],
          confidence: 0.5,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });

        return actual;
      },
    },
    {
      name: "reps mode repeated success increases reps",
      input: "bodyweight-style progression through repetitions only",
      fn: () => {
        const actual = decideProgression(buildRepsInput());
        assert.equal(actual.decisionType, DECISION_TYPES.INCREASE_REPS);
        assert.equal(actual.loadAdjustmentSteps, 0);
        assert.equal(actual.setAdjustment, 0);
        assert.equal(actual.repAdjustment, 1);
        assert.equal(actual.durationAdjustmentSteps, 0);
        assert.equal(actual.reasonCode, REASON_CODES.REPEATED_REP_SUCCESS);
        assert.deepEqual(actual.secondaryReasonCodes, [REASON_CODES.TARGETS_FULLY_MET]);
        assert.equal(actual.shouldPersist, true);
        return actual;
      },
    },
    {
      name: "reps mode performance improvement increases reps",
      input: "full success with better completion than previous session",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            analysis: buildRepsAnalysis({
              historyFacts: {
                previousSessionWeightKg: null,
                weightDeltaKg: null,
                weightDeltaPercent: null,
                previousPrescribedSetCompletionRate: 0.6667,
                prescribedSetCompletionRateDelta: 0.3333,
                consecutiveSuccessfulSessions: 1,
                consecutiveFailedSessions: 0,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.INCREASE_REPS);
        assert.equal(actual.loadAdjustmentSteps, 0);
        assert.equal(actual.repAdjustment, 1);
        assert.equal(actual.reasonCode, REASON_CODES.REP_PERFORMANCE_IMPROVED);
        assert.deepEqual(actual.secondaryReasonCodes, [REASON_CODES.TARGETS_FULLY_MET]);
        return actual;
      },
    },
    {
      name: "reps mode full success without progression evidence maintains",
      input: "targets met but no repeated success or positive delta",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            analysis: buildRepsAnalysis({
              historyFacts: {
                previousSessionWeightKg: null,
                weightDeltaKg: null,
                weightDeltaPercent: null,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: 0,
                consecutiveSuccessfulSessions: 1,
                consecutiveFailedSessions: 0,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.TARGETS_FULLY_MET);
        assert.equal(actual.loadAdjustmentSteps, 0);
        assert.equal(actual.repAdjustment, 0);
        return actual;
      },
    },
    {
      name: "reps mode partial completion does not increase",
      input: "prescribed sets not fully completed in reps mode",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            analysis: buildRepsAnalysis({
              observedPerformance: {
                loggedSetCount: 2,
                completedSetCount: 2,
                successfulSetCount: 2,
                failedSetCount: 0,
                totalReps: 28,
                totalVolumeKg: 0,
                averageWeightKg: null,
                maximumWeightKg: null,
                minimumWeightKg: null,
                bestSet: { setNumber: 2, reps: 14, weightKg: null },
                finalSet: { setNumber: 2, reps: 14, weightKg: null },
                prescribedSetCompletionRate: 0.6667,
                targetRepHitRate: 1,
              },
              historyFacts: {
                previousSessionWeightKg: null,
                weightDeltaKg: null,
                weightDeltaPercent: null,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: -0.3333,
                consecutiveSuccessfulSessions: 0,
                consecutiveFailedSessions: 1,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.TARGETS_PARTIALLY_MET);
        assert.equal(actual.loadAdjustmentSteps, 0);
        assert.equal(actual.repAdjustment, 0);
        assert.deepEqual(actual.secondaryReasonCodes, [
          REASON_CODES.PERFORMANCE_REGRESSED,
          REASON_CODES.REPEATED_FAILURE,
        ]);
        return actual;
      },
    },
    {
      name: "reps mode repeated failure deloads without load adjustment",
      input: "repeated failed bodyweight sessions",
      fn: () => {
        const input = buildRepsInput({
          analysis: buildRepsAnalysis({
            observedPerformance: {
              loggedSetCount: 3,
              completedSetCount: 3,
              successfulSetCount: 1,
              failedSetCount: 2,
              totalReps: 30,
              totalVolumeKg: 0,
              averageWeightKg: null,
              maximumWeightKg: null,
              minimumWeightKg: null,
              bestSet: { setNumber: 1, reps: 12, weightKg: null },
              finalSet: { setNumber: 3, reps: 8, weightKg: null },
              prescribedSetCompletionRate: 1,
              targetRepHitRate: 0.3333,
            },
            historyFacts: {
              previousSessionWeightKg: null,
              weightDeltaKg: null,
              weightDeltaPercent: null,
              previousPrescribedSetCompletionRate: 1,
              prescribedSetCompletionRateDelta: -0.6667,
              consecutiveSuccessfulSessions: 0,
              consecutiveFailedSessions: 2,
            },
          }),
        });
        const frozenInput = deepFreeze(structuredClone(input));
        const actual = decideProgression(frozenInput);
        assertExactDecisionPayload(actual, {
          exerciseId: 52,
          sourceSessionId: 552,
          decisionType: DECISION_TYPES.DELOAD,
          loadAdjustmentSteps: 0,
          setAdjustment: 0,
          repAdjustment: -1,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.REPEATED_FAILURE,
          secondaryReasonCodes: [REASON_CODES.PERFORMANCE_REGRESSED],
          confidence: 0.6,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });
        return actual;
      },
    },
    {
      name: "deload threshold boundaries remain exact at 1, 2, and 3 consecutive failures",
      input: "otherwise identical load-mode inputs around the accepted threshold",
      fn: () => {
        const buildThresholdInput = (consecutiveFailedSessions) =>
          buildInput({
            analysis: buildRepsAnalysis({
              exerciseId: 15,
              sourceSessionId: 501,
              prescription: {
                prescribedSets: 3,
                prescribedRepLow: 8,
                prescribedRepHigh: 12,
                prescribedRestSeconds: 90,
              },
              historyFacts: {
                previousSessionWeightKg: 47.5,
                weightDeltaKg: -2.5,
                weightDeltaPercent: -5.2632,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: 0,
                consecutiveSuccessfulSessions: 0,
                consecutiveFailedSessions,
              },
            }),
          });

        const belowThreshold = decideProgression(buildThresholdInput(1));
        assertExactDecisionPayload(belowThreshold, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.MAINTAIN,
          loadAdjustmentSteps: 0,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.MISSING_LOAD_DATA,
          secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
          confidence: 0.5,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });

        const atThreshold = decideProgression(buildThresholdInput(2));
        assertExactDecisionPayload(atThreshold, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.DELOAD,
          loadAdjustmentSteps: -1,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.REPEATED_FAILURE,
          secondaryReasonCodes: [REASON_CODES.PERFORMANCE_REGRESSED],
          confidence: 0.6,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });

        const aboveThreshold = decideProgression(buildThresholdInput(3));
        assertExactDecisionPayload(aboveThreshold, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.DELOAD,
          loadAdjustmentSteps: -1,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.REPEATED_FAILURE,
          secondaryReasonCodes: [REASON_CODES.PERFORMANCE_REGRESSED],
          confidence: 0.6,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });

        return {
          belowThreshold,
          atThreshold,
          aboveThreshold,
        };
      },
    },
    {
      name: "reps mode single failed session maintains",
      input: "failed reps without reaching deload threshold",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            analysis: buildRepsAnalysis({
              observedPerformance: {
                loggedSetCount: 3,
                completedSetCount: 3,
                successfulSetCount: 2,
                failedSetCount: 1,
                totalReps: 35,
                totalVolumeKg: 0,
                averageWeightKg: null,
                maximumWeightKg: null,
                minimumWeightKg: null,
                bestSet: { setNumber: 1, reps: 12, weightKg: null },
                finalSet: { setNumber: 3, reps: 11, weightKg: null },
                prescribedSetCompletionRate: 1,
                targetRepHitRate: 0.6667,
              },
              historyFacts: {
                previousSessionWeightKg: null,
                weightDeltaKg: null,
                weightDeltaPercent: null,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: -0.3333,
                consecutiveSuccessfulSessions: 0,
                consecutiveFailedSessions: 1,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.TARGETS_PARTIALLY_MET);
        assert.equal(actual.loadAdjustmentSteps, 0);
        assert.equal(actual.repAdjustment, 0);
        return actual;
      },
    },
    {
      name: "reps mode missing load data does not trigger missing-load rule",
      input: "bodyweight sets with null weight remain valid",
      fn: () => {
        const actual = decideProgression(buildRepsInput());
        assert.notEqual(actual.reasonCode, REASON_CODES.MISSING_LOAD_DATA);
        assert.equal(actual.decisionType, DECISION_TYPES.INCREASE_REPS);
        return actual;
      },
    },
    {
      name: "reps mode unexpected weight values remain irrelevant to abstract load output",
      input: "bodyweight progression with incidental load values present",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            analysis: buildRepsAnalysis({
              observedPerformance: {
                loggedSetCount: 3,
                completedSetCount: 3,
                successfulSetCount: 3,
                failedSetCount: 0,
                totalReps: 54,
                totalVolumeKg: 30,
                averageWeightKg: 1,
                maximumWeightKg: 1,
                minimumWeightKg: 1,
                bestSet: { setNumber: 3, reps: 18, weightKg: 1 },
                finalSet: { setNumber: 3, reps: 18, weightKg: 1 },
                prescribedSetCompletionRate: 1,
                targetRepHitRate: 1,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.INCREASE_REPS);
        assert.equal(actual.loadAdjustmentSteps, 0);
        assert.equal(actual.repAdjustment, 1);
        return actual;
      },
    },
    {
      name: "reps mode recovery downgrades increase reps to maintain",
      input: "caution recovery blocks positive repetition progression",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            recoveryConstraint: {
              recoveryModifier: "caution",
              confidence: 0.7,
              signalStrength: "strong",
              reasonCode: "behavioral",
            },
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.RECOVERY_OVERRIDE);
        assert.deepEqual(actual.secondaryReasonCodes, [
          REASON_CODES.REPEATED_REP_SUCCESS,
          REASON_CODES.TARGETS_FULLY_MET,
        ]);
        assert.equal(actual.loadAdjustmentSteps, 0);
        assert.equal(actual.repAdjustment, 0);
        return actual;
      },
    },
    {
      name: "reps mode supportive recovery never upgrades maintain",
      input: "supportive recovery does not promote a hold decision",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            analysis: buildRepsAnalysis({
              historyFacts: {
                previousSessionWeightKg: null,
                weightDeltaKg: null,
                weightDeltaPercent: null,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: 0,
                consecutiveSuccessfulSessions: 1,
                consecutiveFailedSessions: 0,
              },
            }),
            recoveryConstraint: {
              recoveryModifier: "supportive",
              confidence: 0.8,
              signalStrength: "strong",
              reasonCode: "behavioral",
            },
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.TARGETS_FULLY_MET);
        return actual;
      },
    },
    {
      name: "historical signal variants do not alter non-target branches",
      input: "R009, maintain, deload, and insufficient-data paths stay unchanged",
      fn: () => {
        const scenarios = [
          {
            name: "R009 repeated-success increase",
            input: buildInput({
              historicalTrainingSignals: buildHistoricalTrainingSignals(),
            }),
          },
          {
            name: "R012 maintain",
            input: buildRepsInput({
              analysis: buildRepsAnalysis({
                historyFacts: {
                  previousSessionWeightKg: null,
                  weightDeltaKg: null,
                  weightDeltaPercent: null,
                  previousPrescribedSetCompletionRate: 1,
                  prescribedSetCompletionRateDelta: 0,
                  consecutiveSuccessfulSessions: 1,
                  consecutiveFailedSessions: 0,
                },
              }),
              historicalTrainingSignals: buildHistoricalTrainingSignals(),
            }),
          },
          {
            name: "R006 deload",
            input: buildRepsInput({
              analysis: buildRepsAnalysis({
                observedPerformance: {
                  loggedSetCount: 3,
                  completedSetCount: 3,
                  successfulSetCount: 1,
                  failedSetCount: 2,
                  totalReps: 30,
                  totalVolumeKg: 0,
                  averageWeightKg: null,
                  maximumWeightKg: null,
                  minimumWeightKg: null,
                  bestSet: { setNumber: 1, reps: 12, weightKg: null },
                  finalSet: { setNumber: 3, reps: 8, weightKg: null },
                  prescribedSetCompletionRate: 1,
                  targetRepHitRate: 0.3333,
                },
                historyFacts: {
                  previousSessionWeightKg: null,
                  weightDeltaKg: null,
                  weightDeltaPercent: null,
                  previousPrescribedSetCompletionRate: 1,
                  prescribedSetCompletionRateDelta: -0.6667,
                  consecutiveSuccessfulSessions: 0,
                  consecutiveFailedSessions: 2,
                },
              }),
              historicalTrainingSignals: buildHistoricalTrainingSignals(),
            }),
          },
          {
            name: "R004 insufficient data",
            input: buildRepsInput({
              analysis: buildRepsAnalysis({
                hasSufficientData: false,
                dataQualityFlags: ["missing_previous_history"],
                historyFacts: {
                  previousSessionWeightKg: null,
                  weightDeltaKg: null,
                  weightDeltaPercent: null,
                  previousPrescribedSetCompletionRate: null,
                  prescribedSetCompletionRateDelta: null,
                  consecutiveSuccessfulSessions: 0,
                  consecutiveFailedSessions: 0,
                },
              }),
              historicalTrainingSignals: buildHistoricalTrainingSignals(),
            }),
          },
          {
            name: "R013 recovery override maintain",
            input: buildRepsInput({
              recoveryConstraint: {
                recoveryModifier: "caution",
                confidence: 0.7,
                signalStrength: "strong",
                reasonCode: "behavioral",
              },
              historicalTrainingSignals: buildHistoricalTrainingSignals(),
            }),
          },
        ];
        const variants = [
          buildHistoricalTrainingSignals(),
          buildHistoricalTrainingSignals({
            completedExposureCount: 2,
            averageCompletionRatio: 1,
            averageCompletedSets: 3,
            loadTrend: "DECREASING",
            repTrend: "INCREASING",
            latestCompletedAt: "2026-07-28T10:00:00.000Z",
            previousCompletedAt: "2026-07-21T10:00:00.000Z",
          }),
        ];

        const results = [];
        for (const scenario of scenarios) {
          const baseline = decideProgression(deepFreeze(scenario.input));
          for (const variant of variants) {
            const actual = decideProgression(
              deepFreeze({
                ...scenario.input,
                historicalTrainingSignals: deepFreeze(variant),
              })
            );
            assert.deepEqual(actual, baseline);
          }
          results.push({
            scenario: scenario.name,
            decisionType: baseline.decisionType,
            reasonCode: baseline.reasonCode,
          });
        }

        return results;
      },
    },
    {
      name: "reps mode insufficient history remains non-persistable",
      input: "valid reps mode with insufficient prior history",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            analysis: buildRepsAnalysis({
              hasSufficientData: false,
              dataQualityFlags: ["missing_previous_history"],
              historyFacts: {
                previousSessionWeightKg: null,
                weightDeltaKg: null,
                weightDeltaPercent: null,
                previousPrescribedSetCompletionRate: null,
                prescribedSetCompletionRateDelta: null,
                consecutiveSuccessfulSessions: 0,
                consecutiveFailedSessions: 0,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.INSUFFICIENT_DATA);
        assert.equal(actual.shouldPersist, false);
        return actual;
      },
    },
    {
      name: "reps mode zero prescribed sets skips",
      input: "zero prescription remains a policy skip",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            analysis: buildRepsAnalysis({
              prescription: {
                prescribedSets: 0,
                prescribedRepLow: 12,
                prescribedRepHigh: 20,
                prescribedRestSeconds: 60,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.SKIP);
        assert.equal(actual.reasonCode, REASON_CODES.ZERO_PRESCRIPTION);
        return actual;
      },
    },
    {
      name: "reps mode already evaluated skips deterministically",
      input: "same-source context remains terminal in reps mode",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            existingRecommendationContext: {
              alreadyEvaluated: true,
            },
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.SKIP);
        assert.equal(actual.reasonCode, REASON_CODES.ALREADY_EVALUATED);
        return actual;
      },
    },
    {
      name: "reps mode invalid increment skips without guessing",
      input: "policy marks reps increment invalid",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            progressionPolicy: {
              progressionMode: "reps",
              allowsLoadAdjustment: false,
              allowsSetAdjustment: false,
              allowsRepAdjustment: true,
              validIncrement: false,
            },
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.SKIP);
        assert.equal(actual.reasonCode, REASON_CODES.NO_VALID_INCREMENT);
        return actual;
      },
    },
    {
      name: "reps mode confidence does not alter selected decision",
      input: "manual quality penalties still preserve increase reps decision",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            analysis: buildRepsAnalysis({
              dataQualityFlags: ["unexpected_weight_present", "extra_flag"],
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.INCREASE_REPS);
        assert.equal(actual.confidence < 0.8, true);
        return actual;
      },
    },
    {
      name: "reps mode missing weight does not lower confidence compared with incidental weight",
      input: "weight absence is irrelevant in reps mode",
      fn: () => {
        const withoutWeight = decideProgression(buildRepsInput());
        const withWeight = decideProgression(
          buildRepsInput({
            analysis: buildRepsAnalysis({
              observedPerformance: {
                loggedSetCount: 3,
                completedSetCount: 3,
                successfulSetCount: 3,
                failedSetCount: 0,
                totalReps: 54,
                totalVolumeKg: 30,
                averageWeightKg: 1,
                maximumWeightKg: 1,
                minimumWeightKg: 1,
                bestSet: { setNumber: 3, reps: 18, weightKg: 1 },
                finalSet: { setNumber: 3, reps: 18, weightKg: 1 },
                prescribedSetCompletionRate: 1,
                targetRepHitRate: 1,
              },
            }),
          })
        );
        assert.equal(withoutWeight.confidence, withWeight.confidence);
        return { withoutWeight, withWeight };
      },
    },
    {
      name: "reps mode secondary reasons stay ordered without duplicates",
      input: "recovery override preserves prior evidence once",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            recoveryConstraint: {
              recoveryModifier: "caution",
              confidence: 0.9,
              signalStrength: "strong",
              reasonCode: null,
            },
          })
        );
        assert.deepEqual(actual.secondaryReasonCodes, [
          REASON_CODES.REPEATED_REP_SUCCESS,
          REASON_CODES.TARGETS_FULLY_MET,
        ]);
        assert.equal(new Set(actual.secondaryReasonCodes).size, actual.secondaryReasonCodes.length);
        return actual;
      },
    },
    {
      name: "reps mode input remains immutable",
      input: "deep-frozen reps input stays unchanged",
      fn: () => {
        const input = deepFreeze(buildRepsInput());
        const before = serializeForLog(input);
        decideProgression(input);
        assert.equal(serializeForLog(input), before);
        return { immutable: true };
      },
    },
    {
      name: "reps mode output is deterministic",
      input: "same reps input yields deep-equal decisions",
      fn: () => {
        const input = buildRepsInput();
        const first = decideProgression(input);
        const second = decideProgression(input);
        assert.deepEqual(second, first);
        return first;
      },
    },
    {
      name: "canonical R010 output is deterministic across repeated executions",
      input: "same canonical performance-improved input yields identical full decisions",
      fn: () => {
        const input = deepFreeze(buildCanonicalR010Input());
        const first = decideProgression(input);
        const second = decideProgression(input);
        const third = decideProgression(input);

        assert.deepEqual(second, first);
        assert.deepEqual(third, first);

        return first;
      },
    },
    {
      name: "reps mode output contains no concrete targets",
      input: "abstract adjustment only",
      fn: () => {
        const actual = decideProgression(buildRepsInput());
        assert.equal("targetWeightKg" in actual, false);
        assert.equal("targetRepLow" in actual, false);
        assert.equal("targetRepHigh" in actual, false);
        assert.equal(actual.loadAdjustmentSteps, 0);
        assert.equal(actual.repAdjustment, 1);
        return actual;
      },
    },
    {
      name: "time mode repeated success increases duration",
      input: "successful time progression emits first-class duration decision",
      fn: () => {
        const actual = decideProgression(buildTimeInput());
        assert.equal(actual.decisionType, DECISION_TYPES.INCREASE_DURATION);
        assert.equal(actual.loadAdjustmentSteps, 0);
        assert.equal(actual.setAdjustment, 0);
        assert.equal(actual.repAdjustment, 0);
        assert.equal(actual.durationAdjustmentSteps, 1);
        assert.equal(actual.reasonCode, REASON_CODES.REPEATED_TIME_SUCCESS);
        assert.deepEqual(actual.secondaryReasonCodes, [REASON_CODES.TARGETS_FULLY_MET]);
        return actual;
      },
    },
    {
      name: "time mode performance improvement increases duration",
      input: "full time success with positive completion delta but without repeated-success threshold",
      fn: () => {
        const actual = decideProgression(
          buildTimeInput({
            analysis: buildTimeAnalysis({
              historyFacts: {
                previousSessionWeightKg: null,
                weightDeltaKg: null,
                weightDeltaPercent: null,
                previousPrescribedSetCompletionRate: 0.6667,
                prescribedSetCompletionRateDelta: 0.3333,
                consecutiveSuccessfulSessions: 1,
                consecutiveFailedSessions: 0,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.INCREASE_DURATION);
        assert.equal(actual.durationAdjustmentSteps, 1);
        assert.equal(actual.reasonCode, REASON_CODES.TIME_PERFORMANCE_IMPROVED);
        assert.deepEqual(actual.secondaryReasonCodes, [REASON_CODES.TARGETS_FULLY_MET]);
        return actual;
      },
    },
    {
      name: "time mode deload intentionally carries no abstract adjustment",
      input: "accepted time-mode deload keeps every adjustment field at zero",
      fn: () => {
        const input = buildTimeInput({
          analysis: buildTimeAnalysis({
            observedPerformance: {
              loggedSetCount: 3,
              completedSetCount: 3,
              successfulSetCount: 1,
              failedSetCount: 2,
              totalReps: 75,
              totalVolumeKg: 0,
              averageWeightKg: null,
              maximumWeightKg: null,
              minimumWeightKg: null,
              bestSet: { setNumber: 1, reps: 25, weightKg: null },
              finalSet: { setNumber: 3, reps: 25, weightKg: null },
              prescribedSetCompletionRate: 1,
              targetRepHitRate: 0.3333,
            },
            historyFacts: {
              previousSessionWeightKg: null,
              weightDeltaKg: null,
              weightDeltaPercent: null,
              previousPrescribedSetCompletionRate: 1,
              prescribedSetCompletionRateDelta: -0.6667,
              consecutiveSuccessfulSessions: 0,
              consecutiveFailedSessions: 2,
            },
          }),
        });
        const frozenInput = deepFreeze(structuredClone(input));
        const actual = decideProgression(frozenInput);
        assertExactDecisionPayload(actual, {
          exerciseId: 31,
          sourceSessionId: 631,
          decisionType: DECISION_TYPES.DELOAD,
          loadAdjustmentSteps: 0,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.REPEATED_FAILURE,
          secondaryReasonCodes: [REASON_CODES.PERFORMANCE_REGRESSED],
          confidence: 0.6,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });
        return actual;
      },
    },
    {
      name: "reps_then_load below the upper rep bound increases reps",
      input: "full success below the prescribed high reps stays in the repetition phase",
      fn: () => {
        const input = buildRepsThenLoadInput({
          analysis: buildAnalysis({
            prescription: {
              prescribedSets: 4,
              prescribedRepLow: 8,
              prescribedRepHigh: 12,
              prescribedRestSeconds: 90,
            },
            observedPerformance: {
              loggedSetCount: 4,
              completedSetCount: 4,
              successfulSetCount: 4,
              failedSetCount: 0,
              totalReps: 47,
              totalVolumeKg: 1880,
              averageWeightKg: 40,
              maximumWeightKg: 40,
              minimumWeightKg: 40,
              bestSet: { setNumber: 1, reps: 12, weightKg: 40 },
              finalSet: { setNumber: 4, reps: 12, weightKg: 40 },
              allPlannedSetsReachedUpperRepBound: false,
              prescribedSetCompletionRate: 1,
              targetRepHitRate: 1,
            },
          }),
        });
        const frozenInput = deepFreeze(structuredClone(input));
        const actual = decideProgression(frozenInput);
        assertExactDecisionPayload(actual, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.INCREASE_REPS,
          loadAdjustmentSteps: 0,
          setAdjustment: 0,
          repAdjustment: 1,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.REPEATED_REP_SUCCESS,
          secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
          confidence: 0.65,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });
        return actual;
      },
    },
    {
      name: "reps_then_load at the upper rep bound increases load",
      input: "full success with every planned set at the prescribed high reps transitions to load",
      fn: () => {
        const input = buildRepsThenLoadInput({
          analysis: buildAnalysis({
            prescription: {
              prescribedSets: 4,
              prescribedRepLow: 8,
              prescribedRepHigh: 12,
              prescribedRestSeconds: 90,
            },
            observedPerformance: {
              loggedSetCount: 4,
              completedSetCount: 4,
              successfulSetCount: 4,
              failedSetCount: 0,
              totalReps: 48,
              totalVolumeKg: 1920,
              averageWeightKg: 40,
              maximumWeightKg: 40,
              minimumWeightKg: 40,
              bestSet: { setNumber: 1, reps: 12, weightKg: 40 },
              finalSet: { setNumber: 4, reps: 12, weightKg: 40 },
              allPlannedSetsReachedUpperRepBound: true,
              prescribedSetCompletionRate: 1,
              targetRepHitRate: 1,
            },
          }),
        });
        const frozenInput = deepFreeze(structuredClone(input));
        const actual = decideProgression(frozenInput);
        assertExactDecisionPayload(actual, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.INCREASE_LOAD,
          loadAdjustmentSteps: 1,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.REPEATED_SUCCESS,
          secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
          confidence: 0.8,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });
        return actual;
      },
    },
    {
      name: "reps_then_load mode deload uses abstract negative load step",
      input: "current hybrid mode deload stays on loadAdjustmentSteps",
      fn: () => {
        const input = buildRepsThenLoadInput({
          analysis: buildAnalysis({
            historyFacts: {
              previousSessionWeightKg: 47.5,
              weightDeltaKg: -2.5,
              weightDeltaPercent: -5.2632,
              previousPrescribedSetCompletionRate: 1,
              prescribedSetCompletionRateDelta: -0.3333,
              consecutiveSuccessfulSessions: 0,
              consecutiveFailedSessions: 2,
            },
          }),
        });
        const frozenInput = deepFreeze(structuredClone(input));
        const actual = decideProgression(frozenInput);
        assertExactDecisionPayload(actual, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.DELOAD,
          loadAdjustmentSteps: -1,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.REPEATED_FAILURE,
          secondaryReasonCodes: [REASON_CODES.PERFORMANCE_REGRESSED],
          confidence: 0.6,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });
        return actual;
      },
    },
    {
      name: "reps_then_load performance improvement below the upper bound increases reps",
      input: "explicit false upper-bound signal prevents a premature load increase",
      fn: () => {
        const actual = decideProgression(
          buildRepsThenLoadInput({
            analysis: buildAnalysis({
              prescription: {
                prescribedSets: 4,
                prescribedRepLow: 8,
                prescribedRepHigh: 12,
                prescribedRestSeconds: 90,
              },
              observedPerformance: {
                loggedSetCount: 4,
                completedSetCount: 4,
                successfulSetCount: 4,
                failedSetCount: 0,
                totalReps: 47,
                totalVolumeKg: 1880,
                averageWeightKg: 40,
                maximumWeightKg: 40,
                minimumWeightKg: 40,
                bestSet: { setNumber: 1, reps: 12, weightKg: 40 },
                finalSet: { setNumber: 4, reps: 12, weightKg: 40 },
                allPlannedSetsReachedUpperRepBound: false,
                prescribedSetCompletionRate: 1,
                targetRepHitRate: 1,
              },
              historyFacts: {
                previousSessionWeightKg: 40,
                weightDeltaKg: 0,
                weightDeltaPercent: 0,
                previousPrescribedSetCompletionRate: 0.75,
                prescribedSetCompletionRateDelta: 0.25,
                consecutiveSuccessfulSessions: 1,
                consecutiveFailedSessions: 0,
              },
            }),
          })
        );
        assertExactDecisionPayload(actual, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.INCREASE_REPS,
          loadAdjustmentSteps: 0,
          setAdjustment: 0,
          repAdjustment: 1,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.REP_PERFORMANCE_IMPROVED,
          secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
          confidence: 0.65,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });
        return actual;
      },
    },
    {
      name: "reps_then_load performance improvement at the upper bound increases load",
      input: "explicit true upper-bound signal transitions the successful hybrid mode into load progression",
      fn: () => {
        const actual = decideProgression(
          buildRepsThenLoadInput({
            analysis: buildAnalysis({
              prescription: {
                prescribedSets: 4,
                prescribedRepLow: 8,
                prescribedRepHigh: 12,
                prescribedRestSeconds: 90,
              },
              observedPerformance: {
                loggedSetCount: 4,
                completedSetCount: 4,
                successfulSetCount: 4,
                failedSetCount: 0,
                totalReps: 48,
                totalVolumeKg: 1920,
                averageWeightKg: 40,
                maximumWeightKg: 40,
                minimumWeightKg: 40,
                bestSet: { setNumber: 1, reps: 12, weightKg: 40 },
                finalSet: { setNumber: 4, reps: 12, weightKg: 40 },
                allPlannedSetsReachedUpperRepBound: true,
                prescribedSetCompletionRate: 1,
                targetRepHitRate: 1,
              },
              historyFacts: {
                previousSessionWeightKg: 40,
                weightDeltaKg: 0,
                weightDeltaPercent: 0,
                previousPrescribedSetCompletionRate: 0.75,
                prescribedSetCompletionRateDelta: 0.25,
                consecutiveSuccessfulSessions: 1,
                consecutiveFailedSessions: 0,
              },
            }),
          })
        );
        assertExactDecisionPayload(actual, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.INCREASE_LOAD,
          loadAdjustmentSteps: 1,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.PERFORMANCE_IMPROVED,
          secondaryReasonCodes: [REASON_CODES.TARGETS_FULLY_MET],
          confidence: 0.65,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });
        return actual;
      },
    },
    {
      name: "reps_then_load missing upper-bound signal fails validation instead of producing load increase",
      input: "the hybrid transition signal is now a required analyzer output",
      fn: () => {
        expectValidationError(
          () =>
            decideProgression(
              buildRepsThenLoadInput({
                analysis: buildAnalysis({
                  prescription: {
                    prescribedSets: 4,
                    prescribedRepLow: 8,
                    prescribedRepHigh: 12,
                    prescribedRestSeconds: 90,
                  },
                  observedPerformance: {
                    loggedSetCount: 4,
                    completedSetCount: 4,
                    successfulSetCount: 4,
                    failedSetCount: 0,
                    totalReps: 48,
                    totalVolumeKg: 1920,
                    averageWeightKg: 40,
                    maximumWeightKg: 40,
                    minimumWeightKg: 40,
                    bestSet: { setNumber: 1, reps: 12, weightKg: 40 },
                    finalSet: { setNumber: 4, reps: 12, weightKg: 40 },
                    allPlannedSetsReachedUpperRepBound: undefined,
                    prescribedSetCompletionRate: 1,
                    targetRepHitRate: 1,
                  },
                }),
              })
            ),
          "allPlannedSetsReachedUpperRepBound must be a boolean"
        );
      },
    },
    {
      name: "reps_then_load deload still wins over an upper-bound success signal",
      input: "the new transition signal does not override accepted deload precedence",
      fn: () => {
        const actual = decideProgression(
          buildRepsThenLoadInput({
            analysis: buildAnalysis({
              prescription: {
                prescribedSets: 4,
                prescribedRepLow: 8,
                prescribedRepHigh: 12,
                prescribedRestSeconds: 90,
              },
              observedPerformance: {
                loggedSetCount: 4,
                completedSetCount: 4,
                successfulSetCount: 4,
                failedSetCount: 0,
                totalReps: 48,
                totalVolumeKg: 1920,
                averageWeightKg: 40,
                maximumWeightKg: 40,
                minimumWeightKg: 40,
                bestSet: { setNumber: 1, reps: 12, weightKg: 40 },
                finalSet: { setNumber: 4, reps: 12, weightKg: 40 },
                allPlannedSetsReachedUpperRepBound: true,
                prescribedSetCompletionRate: 1,
                targetRepHitRate: 1,
              },
              historyFacts: {
                previousSessionWeightKg: 47.5,
                weightDeltaKg: -2.5,
                weightDeltaPercent: -5.2632,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: -0.3333,
                consecutiveSuccessfulSessions: 0,
                consecutiveFailedSessions: 2,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.DELOAD);
        assert.equal(actual.loadAdjustmentSteps, -1);
        assert.equal(actual.repAdjustment, 0);
        assert.equal(actual.reasonCode, REASON_CODES.REPEATED_FAILURE);
        return actual;
      },
    },
    {
      name: "reps_then_load maintain remains unchanged without positive progression evidence",
      input: "fully met targets without repeated success or improvement still hold",
      fn: () => {
        const actual = decideProgression(
          buildRepsThenLoadInput({
            analysis: buildAnalysis({
              prescription: {
                prescribedSets: 4,
                prescribedRepLow: 8,
                prescribedRepHigh: 12,
                prescribedRestSeconds: 90,
              },
              observedPerformance: {
                loggedSetCount: 4,
                completedSetCount: 4,
                successfulSetCount: 4,
                failedSetCount: 0,
                totalReps: 48,
                totalVolumeKg: 1920,
                averageWeightKg: 40,
                maximumWeightKg: 40,
                minimumWeightKg: 40,
                bestSet: { setNumber: 1, reps: 12, weightKg: 40 },
                finalSet: { setNumber: 4, reps: 12, weightKg: 40 },
                allPlannedSetsReachedUpperRepBound: true,
                prescribedSetCompletionRate: 1,
                targetRepHitRate: 1,
              },
              historyFacts: {
                previousSessionWeightKg: 40,
                weightDeltaKg: 0,
                weightDeltaPercent: 0,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: 0,
                consecutiveSuccessfulSessions: 1,
                consecutiveFailedSessions: 0,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.TARGETS_FULLY_MET);
        return actual;
      },
    },
    {
      name: "reps mode manual review still beats progression",
      input: "invalid rep policy data remains terminal",
      fn: () => {
        const actual = decideProgression(
          buildRepsInput({
            analysis: buildRepsAnalysis({
              dataQualityFlags: ["missing_prescribed_rep_low"],
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MANUAL_REVIEW);
        assert.equal(actual.shouldPersist, false);
        return actual;
      },
    },
    {
      name: "unknown progression mode still fails validation",
      input: "unsupported mode rejected after reps addition",
      fn: () => {
        expectValidationError(
          () =>
            decideProgression(
              buildRepsInput({
                progressionPolicy: {
                  progressionMode: "velocity",
                  allowsLoadAdjustment: false,
                  allowsSetAdjustment: false,
                  allowsRepAdjustment: true,
                  validIncrement: true,
                },
              })
            ),
          "progressionMode"
        );
        return { error: "validated" };
      },
    },
    {
      name: "partial prescribed completion maintains",
      input: "fewer successful reps than prescription requires",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              observedPerformance: {
                loggedSetCount: 2,
                completedSetCount: 2,
                successfulSetCount: 2,
                failedSetCount: 0,
                totalReps: 20,
                totalVolumeKg: 825,
                averageWeightKg: 41.25,
                maximumWeightKg: 42.5,
                minimumWeightKg: 40,
                bestSet: { setNumber: 2, reps: 10, weightKg: 42.5 },
                finalSet: { setNumber: 2, reps: 10, weightKg: 42.5 },
                prescribedSetCompletionRate: 0.6667,
                targetRepHitRate: 1,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.TARGETS_PARTIALLY_MET);
        return actual;
      },
    },
    {
      name: "mixed success and failure maintains",
      input: "some sets below prescribedRepLow",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              observedPerformance: {
                loggedSetCount: 3,
                completedSetCount: 3,
                successfulSetCount: 1,
                failedSetCount: 2,
                totalReps: 25,
                totalVolumeKg: 1162.5,
                averageWeightKg: 42.5,
                maximumWeightKg: 45,
                minimumWeightKg: 40,
                bestSet: { setNumber: 3, reps: 6, weightKg: 45 },
                finalSet: { setNumber: 3, reps: 6, weightKg: 45 },
                prescribedSetCompletionRate: 1,
                targetRepHitRate: 0.3333,
              },
              historyFacts: {
                previousSessionWeightKg: 45,
                weightDeltaKg: 0,
                weightDeltaPercent: 0,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: 0,
                consecutiveSuccessfulSessions: 0,
                consecutiveFailedSessions: 1,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.TARGETS_PARTIALLY_MET);
        assert.equal(actual.secondaryReasonCodes.includes(REASON_CODES.REPEATED_FAILURE), true);
        return actual;
      },
    },
    {
      name: "invalid analysis flags trigger manual review",
      input: "severe analyzer data-quality flag present",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              dataQualityFlags: ["missing_prescribed_rep_low"],
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MANUAL_REVIEW);
        assert.equal(actual.reasonCode, REASON_CODES.INVALID_ANALYSIS);
        assert.equal(actual.requiresManualReview, true);
        assert.equal(actual.shouldPersist, false);
        return actual;
      },
    },
    {
      name: "insufficient data returns non-persisted outcome",
      input: "analyzer marks exercise history as insufficient",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              hasSufficientData: false,
              dataQualityFlags: ["missing_previous_history"],
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.INSUFFICIENT_DATA);
        assert.equal(actual.reasonCode, REASON_CODES.INSUFFICIENT_HISTORY);
        assert.equal(actual.shouldPersist, false);
        return actual;
      },
    },
    {
      name: "repeated failed sessions deload",
      input: "history failure streak meets deload threshold",
      fn: () => {
        const input = buildInput({
          analysis: buildAnalysis({
            observedPerformance: {
              loggedSetCount: 3,
              completedSetCount: 3,
              successfulSetCount: 1,
              failedSetCount: 2,
              totalReps: 23,
              totalVolumeKg: 1010,
              averageWeightKg: 42.5,
              maximumWeightKg: 45,
              minimumWeightKg: 40,
              bestSet: { setNumber: 3, reps: 5, weightKg: 45 },
              finalSet: { setNumber: 3, reps: 5, weightKg: 45 },
              prescribedSetCompletionRate: 1,
              targetRepHitRate: 0.3333,
            },
            historyFacts: {
              previousSessionWeightKg: 47.5,
              weightDeltaKg: -2.5,
              weightDeltaPercent: -5.2632,
              previousPrescribedSetCompletionRate: 1,
              prescribedSetCompletionRateDelta: 0,
              consecutiveSuccessfulSessions: 0,
              consecutiveFailedSessions: 2,
            },
          }),
        });
        const frozenInput = deepFreeze(structuredClone(input));
        const actual = decideProgression(frozenInput);
        assertExactDecisionPayload(actual, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.DELOAD,
          loadAdjustmentSteps: -1,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.REPEATED_FAILURE,
          secondaryReasonCodes: [REASON_CODES.PERFORMANCE_REGRESSED],
          confidence: 0.6,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });
        return actual;
      },
    },
    {
      name: "repeated failure precedence beats repeated success increase",
      input: "deload wins when repeated failure threshold and repeated success evidence coexist",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              observedPerformance: {
                loggedSetCount: 3,
                completedSetCount: 3,
                successfulSetCount: 3,
                failedSetCount: 0,
                totalReps: 30,
                totalVolumeKg: 1265,
                averageWeightKg: 42.5,
                maximumWeightKg: 45,
                minimumWeightKg: 40,
                bestSet: { setNumber: 3, reps: 8, weightKg: 45 },
                finalSet: { setNumber: 3, reps: 8, weightKg: 45 },
                prescribedSetCompletionRate: 1,
                targetRepHitRate: 1,
              },
              historyFacts: {
                previousSessionWeightKg: 42.5,
                weightDeltaKg: 2.5,
                weightDeltaPercent: 5.8824,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: 0,
                consecutiveSuccessfulSessions: 2,
                consecutiveFailedSessions: 2,
              },
            }),
          })
        );
        assertExactDecisionPayload(actual, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.DELOAD,
          loadAdjustmentSteps: -1,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.REPEATED_FAILURE,
          secondaryReasonCodes: [],
          confidence: 0.6,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });
        return actual;
      },
    },
    {
      name: "previous decision context can trigger deload",
      input: "legacy consecutiveFailures context is honored",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              historyFacts: {
                previousSessionWeightKg: 47.5,
                weightDeltaKg: -2.5,
                weightDeltaPercent: -5.2632,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: 0,
                consecutiveSuccessfulSessions: 0,
                consecutiveFailedSessions: 1,
              },
            }),
            previousDecisionContext: {
              previousDecisionType: DECISION_TYPES.MAINTAIN,
              consecutiveFailures: 2,
            },
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.DELOAD);
        assert.equal(actual.reasonCode, REASON_CODES.REPEATED_FAILURE);
        return actual;
      },
    },
    {
      name: "full targets met but regressed performance maintains",
      input: "completion remains full while load regresses",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              historyFacts: {
                previousSessionWeightKg: 47.5,
                weightDeltaKg: -2.5,
                weightDeltaPercent: -5.2632,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: 0,
                consecutiveSuccessfulSessions: 0,
                consecutiveFailedSessions: 0,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.PERFORMANCE_REGRESSED);
        return actual;
      },
    },
    {
      name: "full targets met without improvement maintains",
      input: "flat performance after complete success",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              historyFacts: {
                previousSessionWeightKg: 45,
                weightDeltaKg: 0,
                weightDeltaPercent: 0,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: 0,
                consecutiveSuccessfulSessions: 1,
                consecutiveFailedSessions: 0,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.TARGETS_FULLY_MET);
        return actual;
      },
    },
    {
      name: "recovery caution downgrades increase to maintain",
      input: "performance supports increase but recovery forbids upgrade",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            recoveryConstraint: {
              recoveryModifier: "caution",
              confidence: 0.8,
              signalStrength: "strong",
              reasonCode: "recovery_caution",
            },
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.RECOVERY_OVERRIDE);
        assert.deepEqual(actual.secondaryReasonCodes, [
          REASON_CODES.REPEATED_SUCCESS,
          REASON_CODES.TARGETS_FULLY_MET,
        ]);
        return actual;
      },
    },
    {
      name: "time recovery caution downgrades increase duration to maintain",
      input: "successful time progression is still subject to downgrade-only recovery policy",
      fn: () => {
        const actual = decideProgression(
          buildTimeInput({
            recoveryConstraint: {
              recoveryModifier: "caution",
              confidence: 0.8,
              signalStrength: "strong",
              reasonCode: "recovery_caution",
            },
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.RECOVERY_OVERRIDE);
        assert.deepEqual(actual.secondaryReasonCodes, [
          REASON_CODES.REPEATED_TIME_SUCCESS,
          REASON_CODES.TARGETS_FULLY_MET,
        ]);
        assert.equal(actual.durationAdjustmentSteps, 0);
        return actual;
      },
    },
    {
      name: "recovery supportive never upgrades maintain",
      input: "supportive recovery cannot turn maintain into increase",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              historyFacts: {
                previousSessionWeightKg: 45,
                weightDeltaKg: 0,
                weightDeltaPercent: 0,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: 0,
                consecutiveSuccessfulSessions: 1,
                consecutiveFailedSessions: 0,
              },
            }),
            recoveryConstraint: {
              recoveryModifier: "supportive",
              confidence: 0.9,
              signalStrength: "strong",
              reasonCode: "recovery_supportive",
            },
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.TARGETS_FULLY_MET);
        return actual;
      },
    },
    {
      name: "missing load data holds despite full success",
      input: "load-based progression without best-set load",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              observedPerformance: {
                loggedSetCount: 3,
                completedSetCount: 3,
                successfulSetCount: 3,
                failedSetCount: 0,
                totalReps: 30,
                totalVolumeKg: 0,
                averageWeightKg: null,
                maximumWeightKg: null,
                minimumWeightKg: null,
                bestSet: { setNumber: 3, reps: 8, weightKg: null },
                finalSet: { setNumber: 3, reps: 8, weightKg: null },
                prescribedSetCompletionRate: 1,
                targetRepHitRate: 1,
              },
              dataQualityFlags: ["missing_weight_data"],
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.MISSING_LOAD_DATA);
        return actual;
      },
    },
    {
      name: "bodyweight non-load policy maintains without missing-load hold rule",
      input: "non-load policy keeps complete bodyweight performance factual",
      fn: () => {
        const actual = decideProgression(
          buildTimeInput({
            analysis: buildTimeAnalysis({
              observedPerformance: {
                loggedSetCount: 3,
                completedSetCount: 3,
                successfulSetCount: 3,
                failedSetCount: 0,
                totalReps: 105,
                totalVolumeKg: 0,
                averageWeightKg: null,
                maximumWeightKg: null,
                minimumWeightKg: null,
                bestSet: { setNumber: 3, reps: 35, weightKg: null },
                finalSet: { setNumber: 3, reps: 35, weightKg: null },
                prescribedSetCompletionRate: 1,
                targetRepHitRate: 1,
              },
              historyFacts: {
                previousSessionWeightKg: null,
                weightDeltaKg: null,
                weightDeltaPercent: null,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: 0,
                consecutiveSuccessfulSessions: 2,
                consecutiveFailedSessions: 0,
              },
              dataQualityFlags: ["missing_weight_data"],
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.INCREASE_DURATION);
        assert.equal(actual.reasonCode, REASON_CODES.REPEATED_TIME_SUCCESS);
        assert.equal(actual.loadAdjustmentSteps, 0);
        assert.equal(actual.repAdjustment, 0);
        assert.equal(actual.durationAdjustmentSteps, 1);
        return actual;
      },
    },
    {
      name: "missing duration target returns insufficient data",
      input: "time mode without duration-equivalent prescription does not progress",
      fn: () => {
        const actual = decideProgression(
          buildTimeInput({
            analysis: buildTimeAnalysis({
              prescription: {
                prescribedSets: 3,
                prescribedRepLow: null,
                prescribedRepHigh: null,
                prescribedRestSeconds: 45,
              },
              hasSufficientData: false,
              dataQualityFlags: ["missing_prescribed_rep_low", "missing_prescribed_rep_high"],
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.INSUFFICIENT_DATA);
        assert.equal(actual.reasonCode, REASON_CODES.MISSING_DURATION_TARGET);
        assert.equal(actual.durationAdjustmentSteps, 0);
        assert.equal(actual.shouldPersist, false);
        return actual;
      },
    },
    {
      name: "zero prescribed sets skip with dedicated reason",
      input: "valid structure but unusable zero-prescription domain case",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              prescription: {
                prescribedSets: 0,
                prescribedRepLow: 8,
                prescribedRepHigh: 12,
                prescribedRestSeconds: 90,
              },
              observedPerformance: {
                loggedSetCount: 0,
                completedSetCount: 0,
                successfulSetCount: 0,
                failedSetCount: 0,
                totalReps: 0,
                totalVolumeKg: 0,
                averageWeightKg: null,
                maximumWeightKg: null,
                minimumWeightKg: null,
                bestSet: null,
                finalSet: null,
                prescribedSetCompletionRate: null,
                targetRepHitRate: null,
              },
              historyFacts: {
                previousSessionWeightKg: null,
                weightDeltaKg: null,
                weightDeltaPercent: null,
                previousPrescribedSetCompletionRate: null,
                prescribedSetCompletionRateDelta: null,
                consecutiveSuccessfulSessions: 0,
                consecutiveFailedSessions: 0,
              },
              hasSufficientData: true,
              dataQualityFlags: ["zero_prescribed_sets", "no_logged_sets"],
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.SKIP);
        assert.equal(actual.reasonCode, REASON_CODES.ZERO_PRESCRIPTION);
        assert.equal(actual.shouldPersist, false);
        return actual;
      },
    },
    {
      name: "invalid increment skips recommendation",
      input: "policy cannot resolve a valid progression step",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            progressionPolicy: {
              progressionMode: "load",
              allowsLoadAdjustment: true,
              allowsSetAdjustment: false,
              allowsRepAdjustment: false,
              validIncrement: false,
            },
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.SKIP);
        assert.equal(actual.reasonCode, REASON_CODES.NO_VALID_INCREMENT);
        assert.equal(actual.shouldPersist, false);
        return actual;
      },
    },
    {
      name: "already evaluated context skips deterministically",
      input: "orchestrator says this source session already has a decision",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            existingRecommendationContext: {
              alreadyEvaluated: true,
            },
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.SKIP);
        assert.equal(actual.reasonCode, REASON_CODES.ALREADY_EVALUATED);
        return actual;
      },
    },
    {
      name: "invalid analysis precedence beats already evaluated",
      input: "manual-review rule precedes skip rule",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              dataQualityFlags: ["missing_prescribed_rep_high"],
            }),
            existingRecommendationContext: {
              alreadyEvaluated: true,
            },
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MANUAL_REVIEW);
        assert.equal(actual.reasonCode, REASON_CODES.INVALID_ANALYSIS);
        return actual;
      },
    },
    {
      name: "repeated failure precedence beats partial hold",
      input: "deload threshold wins before partial completion hold",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              observedPerformance: {
                loggedSetCount: 2,
                completedSetCount: 2,
                successfulSetCount: 1,
                failedSetCount: 1,
                totalReps: 17,
                totalVolumeKg: 720,
                averageWeightKg: 41.25,
                maximumWeightKg: 42.5,
                minimumWeightKg: 40,
                bestSet: { setNumber: 2, reps: 7, weightKg: 42.5 },
                finalSet: { setNumber: 2, reps: 7, weightKg: 42.5 },
                prescribedSetCompletionRate: 0.6667,
                targetRepHitRate: 0.5,
              },
              historyFacts: {
                previousSessionWeightKg: 45,
                weightDeltaKg: -2.5,
                weightDeltaPercent: -5.5556,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: -0.3333,
                consecutiveSuccessfulSessions: 0,
                consecutiveFailedSessions: 2,
              },
            }),
          })
        );
        assertExactDecisionPayload(actual, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.DELOAD,
          loadAdjustmentSteps: -1,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.REPEATED_FAILURE,
          secondaryReasonCodes: [REASON_CODES.PERFORMANCE_REGRESSED],
          confidence: 0.6,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });
        return actual;
      },
    },
    {
      name: "candidate priority prefers repeated success over performance improved",
      input: "both increase candidates exist and higher-priority repeated success wins",
      fn: () => {
        const actual = decideProgression(buildInput());
        assert.equal(actual.decisionType, DECISION_TYPES.INCREASE_LOAD);
        assert.equal(actual.reasonCode, REASON_CODES.REPEATED_SUCCESS);
        return actual;
      },
    },
    {
      name: "secondary reason codes are deduplicated",
      input: "multiple improvement signals do not duplicate codes",
      fn: () => {
        const actual = decideProgression(buildInput());
        assert.deepEqual(actual.secondaryReasonCodes, [REASON_CODES.TARGETS_FULLY_MET]);
        return actual;
      },
    },
    {
      name: "secondary reason codes are ordered deterministically",
      input: "recovery override keeps a stable sorted secondary list",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            recoveryConstraint: {
              recoveryModifier: "caution",
              confidence: 0.7,
              signalStrength: "strong",
              reasonCode: "recovery_caution",
            },
          })
        );
        assert.deepEqual(actual.secondaryReasonCodes, [
          REASON_CODES.REPEATED_SUCCESS,
          REASON_CODES.TARGETS_FULLY_MET,
        ]);
        return actual;
      },
    },
    {
      name: "increase adjustment semantics are abstract only",
      input: "engine emits steps not concrete target weights",
      fn: () => {
        const actual = decideProgression(buildInput());
        assert.equal(actual.loadAdjustmentSteps, 1);
        assert.equal(actual.durationAdjustmentSteps, 0);
        assert.equal("targetWeightKg" in actual, false);
        assert.equal("targetSets" in actual, false);
        assert.equal("targetRepLow" in actual, false);
        assert.equal("targetRepHigh" in actual, false);
        assert.equal("targetDurationSeconds" in actual, false);
        return actual;
      },
    },
    {
      name: "deload adjustment semantics are abstract only",
      input: "deload emits negative step without concrete load",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              historyFacts: {
                previousSessionWeightKg: 47.5,
                weightDeltaKg: -2.5,
                weightDeltaPercent: -5.2632,
                previousPrescribedSetCompletionRate: 1,
                prescribedSetCompletionRateDelta: -0.3333,
                consecutiveSuccessfulSessions: 0,
                consecutiveFailedSessions: 3,
              },
            }),
          })
        );
        assertExactDecisionPayload(actual, {
          exerciseId: 15,
          sourceSessionId: 501,
          decisionType: DECISION_TYPES.DELOAD,
          loadAdjustmentSteps: -1,
          setAdjustment: 0,
          repAdjustment: 0,
          durationAdjustmentSteps: 0,
          reasonCode: REASON_CODES.REPEATED_FAILURE,
          secondaryReasonCodes: [REASON_CODES.PERFORMANCE_REGRESSED],
          confidence: 0.6,
          requiresManualReview: false,
          shouldPersist: true,
          rulesVersion: PROGRESSION_RULES_VERSION,
        });
        return actual;
      },
    },
    {
      name: "skip never persists",
      input: "all skip decisions force shouldPersist false",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            existingRecommendationContext: { alreadyEvaluated: true },
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.SKIP);
        assert.equal(actual.shouldPersist, false);
        return actual;
      },
    },
    {
      name: "manual review never persists",
      input: "manual review is non-persisted metadata-only output",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              dataQualityFlags: ["missing_prescribed_rep_low"],
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MANUAL_REVIEW);
        assert.equal(actual.shouldPersist, false);
        return actual;
      },
    },
    {
      name: "confidence rounds to two decimals and stays within range",
      input: "increase decision with bonuses produces deterministic rounded confidence",
      fn: () => {
        const actual = decideProgression(buildInput());
        assert.equal(actual.confidence, 0.8);
        assert.equal(actual.confidence >= 0 && actual.confidence <= 1, true);
        return actual;
      },
    },
    {
      name: "confidence lower bound clamps at zero",
      input: "insufficient data plus multiple flags cannot go negative",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              hasSufficientData: false,
              dataQualityFlags: [
                "missing_previous_history",
                "missing_weight_data",
                "no_logged_sets",
                "zero_prescribed_sets",
              ],
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.INSUFFICIENT_DATA);
        assert.equal(actual.confidence, 0);
        return actual;
      },
    },
    {
      name: "confidence does not change selected decision",
      input: "repeated success still increases without a confidence threshold gate",
      fn: () => {
        const actual = decideProgression(
          buildTimeInput({
            analysis: buildTimeAnalysis({
              dataQualityFlags: ["missing_weight_data", "nonfatal_flag_a"],
              historyFacts: {
                previousSessionWeightKg: null,
                weightDeltaKg: null,
                weightDeltaPercent: null,
                previousPrescribedSetCompletionRate: 0.6667,
                prescribedSetCompletionRateDelta: 0.3333,
                consecutiveSuccessfulSessions: 2,
                consecutiveFailedSessions: 0,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.INCREASE_DURATION);
        assert.equal(actual.confidence, 0.7);
        return actual;
      },
    },
    {
      name: "output has no undefined fields",
      input: "serialized output must be fully defined",
      fn: () => {
        const actual = decideProgression(buildInput());
        assertNoUndefined(actual);
        return actual;
      },
    },
    {
      name: "input immutability is preserved",
      input: "deep-frozen input remains unchanged",
      fn: () => {
        const input = buildInput();
        const snapshot = JSON.parse(JSON.stringify(input));
        deepFreeze(input);
        const actual = decideProgression(input);
        assert.deepEqual(input, snapshot);
        return actual;
      },
    },
    {
      name: "output is deeply frozen",
      input: "returned decision object must be immutable",
      fn: () => {
        const actual = decideProgression(buildInput());
        assert.equal(Object.isFrozen(actual), true);
        assert.equal(Object.isFrozen(actual.secondaryReasonCodes), true);
        assert.throws(
          () => {
            const mutable = actual;
            mutable.loadAdjustmentSteps = 99;
          },
          TypeError
        );
        return actual;
      },
    },
    {
      name: "determinism returns deep-equal outputs",
      input: "same input evaluated repeatedly",
      fn: () => {
        const input = buildInput();
        const first = decideProgression(input);
        const second = decideProgression(input);
        assert.deepEqual(first, second);
        return first;
      },
    },
    {
      name: "engine does not read real clock",
      input: "Date access is blocked during evaluation",
      fn: () => {
        const OriginalDate = globalThis.Date;
        class ThrowingDate extends OriginalDate {
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
          const actual = decideProgression(buildInput());
          assert.equal(actual.decisionType, DECISION_TYPES.INCREASE_LOAD);
          return actual;
        } finally {
          globalThis.Date = OriginalDate;
        }
      },
    },
    {
      name: "negative counts are rejected",
      input: "structurally impossible analyzer counts",
      fn: () => {
        expectValidationError(
          () =>
            decideProgression(
              buildInput({
                analysis: buildAnalysis({
                  observedPerformance: {
                    loggedSetCount: -1,
                    completedSetCount: 3,
                    successfulSetCount: 3,
                    failedSetCount: 0,
                    totalReps: 30,
                    totalVolumeKg: 1265,
                    averageWeightKg: 42.5,
                    maximumWeightKg: 45,
                    minimumWeightKg: 40,
                    bestSet: { setNumber: 3, reps: 8, weightKg: 45 },
                    finalSet: { setNumber: 3, reps: 8, weightKg: 45 },
                    prescribedSetCompletionRate: 1,
                    targetRepHitRate: 1,
                  },
                }),
              })
            ),
          "loggedSetCount"
        );
        return { error: "validated" };
      },
    },
    {
      name: "nan and infinity rates are rejected",
      input: "malformed analyzer rates are structural validation errors",
      fn: () => {
        expectValidationError(
          () =>
            decideProgression(
              buildInput({
                analysis: buildAnalysis({
                  observedPerformance: {
                    loggedSetCount: 3,
                    completedSetCount: 3,
                    successfulSetCount: 3,
                    failedSetCount: 0,
                    totalReps: 30,
                    totalVolumeKg: 1265,
                    averageWeightKg: 42.5,
                    maximumWeightKg: 45,
                    minimumWeightKg: 40,
                    bestSet: { setNumber: 3, reps: 8, weightKg: 45 },
                    finalSet: { setNumber: 3, reps: 8, weightKg: 45 },
                    prescribedSetCompletionRate: Number.NaN,
                    targetRepHitRate: Infinity,
                  },
                }),
              })
            ),
          "prescribedSetCompletionRate"
        );
        return { error: "validated" };
      },
    },
    {
      name: "missing identity is rejected",
      input: "exercise identity is structurally required",
      fn: () => {
        expectValidationError(
          () =>
            decideProgression(
              buildInput({
                analysis: buildAnalysis({
                  exerciseId: null,
                }),
              })
            ),
          "exerciseId"
        );
        return { error: "validated" };
      },
    },
    {
      name: "unknown recovery constraint is rejected",
      input: "recovery modifier enum must be known",
      fn: () => {
        expectValidationError(
          () =>
            decideProgression(
              buildInput({
                recoveryConstraint: {
                  recoveryModifier: "panic",
                  confidence: 0.5,
                  signalStrength: "moderate",
                  reasonCode: null,
                },
              })
            ),
          "recoveryModifier"
        );
        return { error: "validated" };
      },
    },
    {
      name: "unknown progression mode is rejected",
      input: "policy enum must be validated",
      fn: () => {
        expectValidationError(
          () =>
            decideProgression(
              buildInput({
                progressionPolicy: {
                  progressionMode: "velocity",
                  allowsLoadAdjustment: true,
                  allowsSetAdjustment: false,
                  allowsRepAdjustment: false,
                  validIncrement: true,
                },
              })
            ),
          "progressionMode"
        );
        return { error: "validated" };
      },
    },
    {
      name: "invalid previous decision context is rejected",
      input: "legacy context still requires a valid decision enum",
      fn: () => {
        expectValidationError(
          () =>
            decideProgression(
              buildInput({
                previousDecisionContext: {
                  previousDecisionType: "HOLD",
                  consecutiveFailures: 1,
                },
              })
            ),
          "previousDecisionType"
        );
        return { error: "validated" };
      },
    },
    {
      name: "invalid existing recommendation context is rejected",
      input: "alreadyEvaluated must be boolean when provided",
      fn: () => {
        expectValidationError(
          () =>
            decideProgression(
              buildInput({
                existingRecommendationContext: {
                  alreadyEvaluated: "yes",
                },
              })
            ),
          "alreadyEvaluated"
        );
        return { error: "validated" };
      },
    },
    {
      name: "invalid policy thresholds are rejected",
      input: "deload threshold must be a positive integer",
      fn: () => {
        expectValidationError(
          () =>
            decideProgression(
              buildInput({
                policyThresholds: {
                  deloadFailureStreak: 0,
                },
              })
            ),
          "deloadFailureStreak"
        );
        return { error: "validated" };
      },
    },
    {
      name: "rules catalog remains stable and versioned",
      input: "rule metadata has ids, priorities, and terminal flags",
      fn: () => {
        assert.equal(Array.isArray(RULE_CATALOG), true);
        assert.equal(RULE_CATALOG.length, 15);
        assert.equal(PROGRESSION_RULES_VERSION, "progression_decision_rules_v5");
        for (const rule of RULE_CATALOG) {
          assert.equal(typeof rule.id, "string");
          assert.equal(typeof rule.priority, "number");
          assert.equal(typeof rule.terminal, "boolean");
        }
        assert.deepEqual(
          RULE_CATALOG.find((rule) => rule.id === "R015_HISTORICAL_TREND_CONFLICT_DOWNGRADE"),
          {
            id: "R015_HISTORICAL_TREND_CONFLICT_DOWNGRADE",
            priority: 42,
            terminal: true,
          }
        );
        return RULE_CATALOG;
      },
    },
    {
      name: "same-source skip beats no valid increment",
      input: "already-evaluated context wins before lower-priority policy skip",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            progressionPolicy: {
              progressionMode: "load",
              allowsLoadAdjustment: true,
              allowsSetAdjustment: false,
              allowsRepAdjustment: false,
              validIncrement: false,
            },
            existingRecommendationContext: {
              alreadyEvaluated: true,
            },
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.SKIP);
        assert.equal(actual.reasonCode, REASON_CODES.ALREADY_EVALUATED);
        return actual;
      },
    },
    {
      name: "recovery does not upgrade a maintain decision",
      input: "supportive recovery cannot overcome partial completion",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              observedPerformance: {
                loggedSetCount: 2,
                completedSetCount: 2,
                successfulSetCount: 2,
                failedSetCount: 0,
                totalReps: 20,
                totalVolumeKg: 825,
                averageWeightKg: 41.25,
                maximumWeightKg: 42.5,
                minimumWeightKg: 40,
                bestSet: { setNumber: 2, reps: 10, weightKg: 42.5 },
                finalSet: { setNumber: 2, reps: 10, weightKg: 42.5 },
                prescribedSetCompletionRate: 0.6667,
                targetRepHitRate: 1,
              },
            }),
            recoveryConstraint: {
              recoveryModifier: "supportive",
              confidence: 0.8,
              signalStrength: "strong",
              reasonCode: "recovery_supportive",
            },
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.MAINTAIN);
        assert.equal(actual.reasonCode, REASON_CODES.TARGETS_PARTIALLY_MET);
        return actual;
      },
    },
    {
      name: "conflicting signals reduce confidence without changing rule outcome",
      input: "improved completion and lower load create a mixed-signal increase",
      fn: () => {
        const actual = decideProgression(
          buildInput({
            analysis: buildAnalysis({
              historyFacts: {
                previousSessionWeightKg: 47.5,
                weightDeltaKg: -2.5,
                weightDeltaPercent: -5.2632,
                previousPrescribedSetCompletionRate: 0.6667,
                prescribedSetCompletionRateDelta: 0.3333,
                consecutiveSuccessfulSessions: 1,
                consecutiveFailedSessions: 0,
              },
            }),
          })
        );
        assert.equal(actual.decisionType, DECISION_TYPES.INCREASE_LOAD);
        assert.equal(actual.reasonCode, REASON_CODES.PERFORMANCE_IMPROVED);
        assert.equal(actual.confidence, 0.55);
        return actual;
      },
    },
  ];

  for (const testCase of cases) {
    const ok = await runCase(testCase.name, testCase.input, testCase.fn);
    if (ok) {
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
  console.error(error);
  process.exitCode = 1;
});

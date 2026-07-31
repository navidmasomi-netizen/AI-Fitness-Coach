import assert from "node:assert/strict";

import {
  mapDecisionToProgressionRecommendationData,
} from "./progressionDecisionMapping.js";

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

function buildAnalysis() {
  return {
    exerciseId: 15,
    sourceSessionId: 501,
    prescription: {
      prescribedSets: 3,
      prescribedRepLow: 8,
      prescribedRepHigh: 12,
    },
    historyFacts: {
      previousSessionWeightKg: 42.5,
      consecutiveFailedSessions: 0,
    },
  };
}

function buildExercise() {
  return {
    id: 15,
    progressionType: "load",
  };
}

function buildPrescription() {
  return {
    progressionType: "load",
  };
}

function buildDecision(overrides = {}) {
  return {
    decisionType: "MAINTAIN",
    loadAdjustmentSteps: 0,
    repAdjustment: 0,
    setAdjustment: 0,
    durationAdjustmentSteps: 0,
    confidence: 0.5,
    reasonCode: "RULE_V2_HISTORICAL_TREND_CONFLICT",
    rulesVersion: "progression_decision_rules_v4",
    ...overrides,
  };
}

async function main() {
  let passed = 0;
  let failed = 0;

  const cases = [
    {
      name: "maps historical trend conflict to an explicit compatibility reason",
      input: "maintain decision with RULE_V2_HISTORICAL_TREND_CONFLICT",
      fn: () => {
        const actual = mapDecisionToProgressionRecommendationData({
          userId: 1,
          exerciseId: 15,
          sourceSessionId: 501,
          decision: buildDecision(),
          analysis: buildAnalysis(),
          prescription: buildPrescription(),
          exercise: buildExercise(),
          previousRecommendation: null,
        });

        assert.equal(actual.recommendationType, "maintain");
        assert.equal(actual.reasonCode, "RULE_V2_HISTORICAL_TREND_CONFLICT");
        assert.equal(
          actual.reason,
          "Performance improved, but declining historical trends triggered a conservative hold for the next session."
        );

        return actual;
      },
    },
    {
      name: "preserves existing performance-improved compatibility mapping",
      input: "increase-load decision with RULE_V1_PERFORMANCE_IMPROVED",
      fn: () => {
        const actual = mapDecisionToProgressionRecommendationData({
          userId: 1,
          exerciseId: 15,
          sourceSessionId: 501,
          decision: buildDecision({
            decisionType: "INCREASE_LOAD",
            loadAdjustmentSteps: 1,
            confidence: 0.6,
            reasonCode: "RULE_V1_PERFORMANCE_IMPROVED",
          }),
          analysis: buildAnalysis(),
          prescription: buildPrescription(),
          exercise: buildExercise(),
          previousRecommendation: null,
        });

        assert.equal(actual.recommendationType, "increase");
        assert.equal(
          actual.reason,
          "Performance improved; load can increase in the next session."
        );

        return actual;
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

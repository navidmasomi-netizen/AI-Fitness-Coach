import assert from "node:assert/strict";
import { GENERATOR_VERSION, resolvePrescription } from "./volumeResolver.js";

function summarizeResult(result) {
  return {
    sets: result.sets,
    repRangeLow: result.repRangeLow,
    repRangeHigh: result.repRangeHigh,
    restSeconds: result.restSeconds,
    reason: result.reason,
    adjustmentsApplied: result.adjustmentsApplied,
    generatorVersion: result.generatorVersion,
  };
}

function printCaseResult({ name, input, actual, status, error }) {
  console.log(`CASE: ${name}`);
  console.log(`INPUT: ${JSON.stringify(input)}`);
  if (actual !== undefined) {
    console.log(`ACTUAL: ${JSON.stringify(actual)}`);
  }
  if (error) {
    console.log(`ERROR: ${error}`);
  }
  console.log(`RESULT: ${status}`);
  console.log("---");
}

const cases = [
  {
    name: "1. strength primary standard base rule",
    input: {
      goal: "strength",
      trainingLevel: "intermediate",
      recoveryQuality: "medium",
      sessionDurationMin: 60,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 4);
      assert.equal(result.repRangeLow, 3);
      assert.equal(result.repRangeHigh, 6);
      assert.equal(result.restSeconds, 150);
      assert.equal(result.generatorVersion, GENERATOR_VERSION);
    },
  },
  {
    name: "2. hypertrophy primary standard base rule",
    input: {
      goal: "hypertrophy",
      trainingLevel: "intermediate",
      recoveryQuality: "medium",
      sessionDurationMin: 60,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 4);
      assert.equal(result.repRangeLow, 6);
      assert.equal(result.repRangeHigh, 12);
      assert.equal(result.restSeconds, 105);
    },
  },
  {
    name: "3. fat_loss primary standard base rule",
    input: {
      goal: "fat_loss",
      trainingLevel: "intermediate",
      recoveryQuality: "medium",
      sessionDurationMin: 60,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 3);
      assert.equal(result.repRangeLow, 8);
      assert.equal(result.repRangeHigh, 12);
      assert.equal(result.restSeconds, 75);
    },
  },
  {
    name: "4. recomposition primary standard base rule",
    input: {
      goal: "recomposition",
      trainingLevel: "intermediate",
      recoveryQuality: "medium",
      sessionDurationMin: 60,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 4);
      assert.equal(result.repRangeLow, 5);
      assert.equal(result.repRangeHigh, 10);
      assert.equal(result.restSeconds, 105);
    },
  },
  {
    name: "5. beginner training level starts at low end",
    input: {
      goal: "strength",
      trainingLevel: "beginner",
      recoveryQuality: "medium",
      sessionDurationMin: 60,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 3);
      assert.ok(result.adjustmentsApplied.includes("beginner_low_end"));
    },
  },
  {
    name: "6. intermediate training level starts at midpoint",
    input: {
      goal: "strength",
      trainingLevel: "intermediate",
      recoveryQuality: "medium",
      sessionDurationMin: 60,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 4);
      assert.ok(result.adjustmentsApplied.includes("intermediate_midpoint"));
    },
  },
  {
    name: "7. advanced training level starts at provisional high end",
    input: {
      goal: "strength",
      trainingLevel: "advanced",
      recoveryQuality: "medium",
      sessionDurationMin: 60,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 5);
      assert.ok(result.adjustmentsApplied.includes("advanced_provisional_high_end"));
    },
  },
  {
    name: "8. low recovery reduces sets and adds rest",
    input: {
      goal: "strength",
      trainingLevel: "intermediate",
      recoveryQuality: "low",
      sessionDurationMin: 60,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 3);
      assert.equal(result.restSeconds, 165);
      assert.ok(result.adjustmentsApplied.includes("low_recovery_reduced_sets"));
      assert.ok(result.adjustmentsApplied.includes("low_recovery_plus_15s_rest"));
    },
  },
  {
    name: "9. medium recovery makes no volume change",
    input: {
      goal: "strength",
      trainingLevel: "intermediate",
      recoveryQuality: "medium",
      sessionDurationMin: 75,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 4);
      assert.equal(result.restSeconds, 150);
    },
  },
  {
    name: "10. high recovery unlocks upper range for intermediate at 75+",
    input: {
      goal: "strength",
      trainingLevel: "intermediate",
      recoveryQuality: "high",
      sessionDurationMin: 75,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 5);
      assert.ok(result.adjustmentsApplied.includes("high_recovery_upper_range_unlock"));
      assert.ok(result.adjustmentsApplied.includes("75plus_duration_tier"));
    },
  },
  {
    name: "11. 30-minute tier caps sets at 3",
    input: {
      goal: "strength",
      trainingLevel: "advanced",
      recoveryQuality: "high",
      sessionDurationMin: 30,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 3);
      assert.ok(result.adjustmentsApplied.includes("30min_conservative_sets"));
    },
  },
  {
    name: "12. 45-minute tier caps sets at 4",
    input: {
      goal: "strength",
      trainingLevel: "advanced",
      recoveryQuality: "high",
      sessionDurationMin: 45,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 4);
      assert.ok(result.adjustmentsApplied.includes("45min_cap_4_sets"));
    },
  },
  {
    name: "13. 60-minute tier leaves standard volume unchanged",
    input: {
      goal: "strength",
      trainingLevel: "advanced",
      recoveryQuality: "high",
      sessionDurationMin: 60,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 5);
      assert.ok(!result.adjustmentsApplied.includes("30min_conservative_sets"));
      assert.ok(!result.adjustmentsApplied.includes("45min_cap_4_sets"));
    },
  },
  {
    name: "14. 75-minute tier normalizes 75+ and preserves unlocked volume",
    input: {
      goal: "strength",
      trainingLevel: "intermediate",
      recoveryQuality: "high",
      sessionDurationMin: 90,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 5);
      assert.ok(result.adjustmentsApplied.includes("75plus_duration_tier"));
      assert.match(result.reason, /75\+ minute tier/);
    },
  },
  {
    name: "15. accessory + compound still uses accessory base rule",
    input: {
      goal: "hypertrophy",
      trainingLevel: "intermediate",
      recoveryQuality: "medium",
      sessionDurationMin: 60,
      slotType: "accessory",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.repRangeLow, 8);
      assert.equal(result.repRangeHigh, 15);
      assert.equal(result.restSeconds, 75);
      assert.equal(result.sets, 3);
    },
  },
  {
    name: "16. primary + isolation still uses primary base rule",
    input: {
      goal: "hypertrophy",
      trainingLevel: "intermediate",
      recoveryQuality: "medium",
      sessionDurationMin: 60,
      slotType: "primary",
      exerciseComplexity: "isolation",
    },
    assertResult: (result) => {
      assert.equal(result.repRangeLow, 6);
      assert.equal(result.repRangeHigh, 12);
      assert.equal(result.restSeconds, 105);
      assert.equal(result.sets, 4);
    },
  },
  {
    name: "17. advanced + low recovery pulls back from high-end start",
    input: {
      goal: "strength",
      trainingLevel: "advanced",
      recoveryQuality: "low",
      sessionDurationMin: 60,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 3);
      assert.ok(result.adjustmentsApplied.includes("advanced_provisional_high_end"));
      assert.ok(result.adjustmentsApplied.includes("low_recovery_reduced_sets"));
    },
  },
  {
    name: "18. beginner + high recovery stays at low end",
    input: {
      goal: "strength",
      trainingLevel: "beginner",
      recoveryQuality: "high",
      sessionDurationMin: 75,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(result.sets, 3);
      assert.ok(result.adjustmentsApplied.includes("beginner_low_end"));
      assert.ok(!result.adjustmentsApplied.includes("high_recovery_upper_range_unlock"));
    },
  },
  {
    name: "19. repeated identical input returns byte-identical output",
    input: {
      goal: "recomposition",
      trainingLevel: "intermediate",
      recoveryQuality: "medium",
      sessionDurationMin: 60,
      slotType: "accessory",
      exerciseComplexity: "compound",
    },
    assertResult: (result) => {
      assert.equal(JSON.stringify(result.first), JSON.stringify(result.second));
    },
    run: (input) => {
      const first = resolvePrescription(input);
      const second = resolvePrescription(input);
      return { first, second };
    },
    summarize: (result) => ({ first: summarizeResult(result.first), second: summarizeResult(result.second) }),
  },
  {
    name: "20. invalid goal throws",
    input: {
      goal: "cutting",
      trainingLevel: "intermediate",
      recoveryQuality: "medium",
      sessionDurationMin: 60,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertThrows: /Invalid goal/,
  },
  {
    name: "21. invalid trainingLevel throws",
    input: {
      goal: "strength",
      trainingLevel: "elite",
      recoveryQuality: "medium",
      sessionDurationMin: 60,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertThrows: /Invalid trainingLevel/,
  },
  {
    name: "22. invalid recoveryQuality throws",
    input: {
      goal: "strength",
      trainingLevel: "intermediate",
      recoveryQuality: "extreme",
      sessionDurationMin: 60,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertThrows: /Invalid recoveryQuality/,
  },
  {
    name: "23. invalid slotType throws",
    input: {
      goal: "strength",
      trainingLevel: "intermediate",
      recoveryQuality: "medium",
      sessionDurationMin: 60,
      slotType: "main",
      exerciseComplexity: "compound",
    },
    assertThrows: /Invalid slotType/,
  },
  {
    name: "24. invalid sessionDurationMin throws",
    input: {
      goal: "strength",
      trainingLevel: "intermediate",
      recoveryQuality: "medium",
      sessionDurationMin: 74,
      slotType: "primary",
      exerciseComplexity: "compound",
    },
    assertThrows: /Invalid sessionDurationMin/,
  },
];

let passed = 0;
let failed = 0;

for (const testCase of cases) {
  try {
    if (testCase.assertThrows) {
      assert.throws(() => resolvePrescription(testCase.input), testCase.assertThrows);
      passed += 1;
      printCaseResult({
        name: testCase.name,
        input: testCase.input,
        actual: { throws: testCase.assertThrows.source },
        status: "PASS",
      });
      continue;
    }

    const actual = testCase.run ? testCase.run(testCase.input) : resolvePrescription(testCase.input);
    testCase.assertResult(actual);
    passed += 1;
    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      actual: testCase.summarize ? testCase.summarize(actual) : summarizeResult(actual),
      status: "PASS",
    });
  } catch (error) {
    failed += 1;
    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      status: "FAIL",
      error: error instanceof Error ? error.stack : String(error),
    });
  }
}

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${passed + failed} total`);

if (failed > 0) {
  process.exitCode = 1;
}

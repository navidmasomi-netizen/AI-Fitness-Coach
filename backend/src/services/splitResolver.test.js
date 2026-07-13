import assert from "node:assert/strict";
import { GENERATOR_VERSION, resolveSplit } from "./splitResolver.js";

const validCases = [
  {
    name: "1 day => full body",
    input: {
      trainingDaysPerWeek: 1,
      goal: "hypertrophy",
      trainingLevel: "beginner",
      recoveryQuality: "medium",
    },
    expected: {
      splitFamily: "full_body",
      splitName: "Full Body",
      numberOfTrainingDays: 1,
      dayTypes: ["full_body"],
      recoveryOrCardioDay: false,
      recoveryAdjusted: false,
      generatorVersion: "1.0",
    },
  },
  {
    name: "2 days => full body A/B",
    input: {
      trainingDaysPerWeek: 2,
      goal: "fat_loss",
      trainingLevel: "beginner",
      recoveryQuality: "medium",
    },
    expected: {
      splitFamily: "full_body",
      splitName: "Full Body A/B",
      numberOfTrainingDays: 2,
      dayTypes: ["full_body_a", "full_body_b"],
      recoveryOrCardioDay: false,
      recoveryAdjusted: false,
      generatorVersion: "1.0",
    },
  },
  {
    name: "3 days + strength => strength split",
    input: {
      trainingDaysPerWeek: 3,
      goal: "strength",
      trainingLevel: "intermediate",
      recoveryQuality: "high",
    },
    expected: {
      splitFamily: "strength_split",
      splitName: "Full Body Strength",
      numberOfTrainingDays: 3,
      dayTypes: ["full_body_strength_a", "full_body_strength_b", "full_body_strength_c"],
      recoveryOrCardioDay: false,
      recoveryAdjusted: false,
      generatorVersion: "1.0",
    },
  },
  {
    name: "3 days + non-strength => full body A/B/C",
    input: {
      trainingDaysPerWeek: 3,
      goal: "hypertrophy",
      trainingLevel: "intermediate",
      recoveryQuality: "high",
    },
    expected: {
      splitFamily: "full_body",
      splitName: "Full Body A/B/C",
      numberOfTrainingDays: 3,
      dayTypes: ["full_body_a", "full_body_b", "full_body_c"],
      recoveryOrCardioDay: false,
      recoveryAdjusted: false,
      generatorVersion: "1.0",
    },
  },
  {
    name: "4 days => upper/lower",
    input: {
      trainingDaysPerWeek: 4,
      goal: "recomposition",
      trainingLevel: "beginner",
      recoveryQuality: "medium",
    },
    expected: {
      splitFamily: "upper_lower",
      splitName: "Upper/Lower",
      numberOfTrainingDays: 4,
      dayTypes: ["upper_a", "lower_a", "upper_b", "lower_b"],
      recoveryOrCardioDay: false,
      recoveryAdjusted: false,
      generatorVersion: "1.0",
    },
  },
  {
    name: "5 days + advanced => upper/lower + weak point",
    input: {
      trainingDaysPerWeek: 5,
      goal: "hypertrophy",
      trainingLevel: "advanced",
      recoveryQuality: "high",
    },
    expected: {
      splitFamily: "upper_lower",
      splitName: "Upper/Lower + Weak Point/Conditioning",
      numberOfTrainingDays: 5,
      dayTypes: ["upper_a", "lower_a", "upper_b", "lower_b", "weak_point_or_conditioning"],
      recoveryOrCardioDay: false,
      recoveryAdjusted: false,
      generatorVersion: "1.0",
    },
  },
  {
    name: "5 days + non-advanced => upper/lower + full body",
    input: {
      trainingDaysPerWeek: 5,
      goal: "fat_loss",
      trainingLevel: "intermediate",
      recoveryQuality: "high",
    },
    expected: {
      splitFamily: "upper_lower",
      splitName: "Upper/Lower + Full Body",
      numberOfTrainingDays: 5,
      dayTypes: ["upper_a", "lower_a", "upper_b", "lower_b", "full_body"],
      recoveryOrCardioDay: false,
      recoveryAdjusted: false,
      generatorVersion: "1.0",
    },
  },
  {
    name: "6 days + beginner => reduced volume upper/lower x3",
    input: {
      trainingDaysPerWeek: 6,
      goal: "hypertrophy",
      trainingLevel: "beginner",
      recoveryQuality: "high",
    },
    expected: {
      splitFamily: "upper_lower",
      splitName: "Upper/Lower (Reduced Volume x3)",
      numberOfTrainingDays: 6,
      dayTypes: [
        "upper_a_light",
        "lower_a_light",
        "upper_b_light",
        "lower_b_light",
        "upper_c_light",
        "lower_c_light",
      ],
      recoveryOrCardioDay: false,
      recoveryAdjusted: false,
      generatorVersion: "1.0",
    },
  },
  {
    name: "6 days + intermediate + medium recovery => PPL",
    input: {
      trainingDaysPerWeek: 6,
      goal: "hypertrophy",
      trainingLevel: "intermediate",
      recoveryQuality: "medium",
    },
    expected: {
      splitFamily: "ppl",
      splitName: "Push/Pull/Legs",
      numberOfTrainingDays: 6,
      dayTypes: ["push_a", "pull_a", "legs_a", "push_b", "pull_b", "legs_b"],
      recoveryOrCardioDay: false,
      recoveryAdjusted: false,
      generatorVersion: "1.0",
    },
  },
  {
    name: "6 days + intermediate + low recovery => downgraded upper/lower x3",
    input: {
      trainingDaysPerWeek: 6,
      goal: "hypertrophy",
      trainingLevel: "intermediate",
      recoveryQuality: "low",
    },
    expected: {
      splitFamily: "upper_lower",
      splitName: "Upper/Lower (Reduced Volume x3)",
      numberOfTrainingDays: 6,
      dayTypes: [
        "upper_a_light",
        "lower_a_light",
        "upper_b_light",
        "lower_b_light",
        "upper_c_light",
        "lower_c_light",
      ],
      recoveryOrCardioDay: false,
      recoveryAdjusted: true,
      generatorVersion: "1.0",
    },
  },
  {
    name: "6 days + advanced + high recovery => PPL",
    input: {
      trainingDaysPerWeek: 6,
      goal: "strength",
      trainingLevel: "advanced",
      recoveryQuality: "high",
    },
    expected: {
      splitFamily: "ppl",
      splitName: "Push/Pull/Legs",
      numberOfTrainingDays: 6,
      dayTypes: ["push_a", "pull_a", "legs_a", "push_b", "pull_b", "legs_b"],
      recoveryOrCardioDay: false,
      recoveryAdjusted: false,
      generatorVersion: "1.0",
    },
  },
  {
    name: "6 days + advanced + low recovery => downgraded upper/lower x3",
    input: {
      trainingDaysPerWeek: 6,
      goal: "strength",
      trainingLevel: "advanced",
      recoveryQuality: "low",
    },
    expected: {
      splitFamily: "upper_lower",
      splitName: "Upper/Lower (Reduced Volume x3)",
      numberOfTrainingDays: 6,
      dayTypes: [
        "upper_a_light",
        "lower_a_light",
        "upper_b_light",
        "lower_b_light",
        "upper_c_light",
        "lower_c_light",
      ],
      recoveryOrCardioDay: false,
      recoveryAdjusted: true,
      generatorVersion: "1.0",
    },
  },
  {
    name: "7 days + beginner => reduced volume upper/lower x3 + recovery",
    input: {
      trainingDaysPerWeek: 7,
      goal: "recomposition",
      trainingLevel: "beginner",
      recoveryQuality: "medium",
    },
    expected: {
      splitFamily: "upper_lower",
      splitName: "Upper/Lower (Reduced Volume x3)",
      numberOfTrainingDays: 6,
      dayTypes: [
        "upper_a_light",
        "lower_a_light",
        "upper_b_light",
        "lower_b_light",
        "upper_c_light",
        "lower_c_light",
        "recovery_or_cardio",
      ],
      recoveryOrCardioDay: true,
      recoveryAdjusted: false,
      generatorVersion: "1.0",
    },
  },
  {
    name: "7 days + intermediate => PPL + recovery",
    input: {
      trainingDaysPerWeek: 7,
      goal: "hypertrophy",
      trainingLevel: "intermediate",
      recoveryQuality: "high",
    },
    expected: {
      splitFamily: "ppl",
      splitName: "Push/Pull/Legs",
      numberOfTrainingDays: 6,
      dayTypes: ["push_a", "pull_a", "legs_a", "push_b", "pull_b", "legs_b", "recovery_or_cardio"],
      recoveryOrCardioDay: true,
      recoveryAdjusted: false,
      generatorVersion: "1.0",
    },
  },
  {
    name: "7 days + advanced + low recovery => downgraded upper/lower x3 + recovery",
    input: {
      trainingDaysPerWeek: 7,
      goal: "fat_loss",
      trainingLevel: "advanced",
      recoveryQuality: "low",
    },
    expected: {
      splitFamily: "upper_lower",
      splitName: "Upper/Lower (Reduced Volume x3)",
      numberOfTrainingDays: 6,
      dayTypes: [
        "upper_a_light",
        "lower_a_light",
        "upper_b_light",
        "lower_b_light",
        "upper_c_light",
        "lower_c_light",
        "recovery_or_cardio",
      ],
      recoveryOrCardioDay: true,
      recoveryAdjusted: true,
      generatorVersion: "1.0",
    },
  },
];

const invalidCases = [
  {
    name: "invalid trainingDaysPerWeek throws",
    input: {
      trainingDaysPerWeek: 8,
      goal: "hypertrophy",
      trainingLevel: "beginner",
      recoveryQuality: "medium",
    },
    expectedMessage: "Invalid trainingDaysPerWeek",
  },
  {
    name: "invalid goal throws",
    input: {
      trainingDaysPerWeek: 3,
      goal: "cutting",
      trainingLevel: "beginner",
      recoveryQuality: "medium",
    },
    expectedMessage: "Invalid goal",
  },
];

let passed = 0;
let failed = 0;

function printCaseResult({ name, input, expected, actual, status, error }) {
  console.log(`CASE: ${name}`);
  console.log(`INPUT: ${JSON.stringify(input)}`);
  if (expected !== undefined) {
    console.log(`EXPECTED: ${JSON.stringify(expected)}`);
  }
  if (actual !== undefined) {
    console.log(`ACTUAL: ${JSON.stringify(actual)}`);
  }
  if (error) {
    console.log(`ERROR: ${error}`);
  }
  console.log(`RESULT: ${status}`);
  console.log("---");
}

for (const testCase of validCases) {
  try {
    const actual = resolveSplit(testCase.input);
    assert.equal(actual.generatorVersion, GENERATOR_VERSION);
    assert.deepEqual(actual, testCase.expected);
    passed += 1;
    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      expected: testCase.expected,
      actual,
      status: "PASS",
    });
  } catch (error) {
    failed += 1;
    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      expected: testCase.expected,
      actual: error.actual,
      status: "FAIL",
      error: error instanceof Error ? error.stack : String(error),
    });
  }
}

for (const testCase of invalidCases) {
  try {
    assert.throws(() => resolveSplit(testCase.input), (error) => {
      assert.equal(error instanceof Error, true);
      assert.match(error.message, new RegExp(testCase.expectedMessage));
      return true;
    });
    passed += 1;
    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      expected: { throws: testCase.expectedMessage },
      status: "PASS",
    });
  } catch (error) {
    failed += 1;
    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      expected: { throws: testCase.expectedMessage },
      status: "FAIL",
      error: error instanceof Error ? error.stack : String(error),
    });
  }
}

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${passed + failed} total`);

if (failed > 0) {
  process.exitCode = 1;
}

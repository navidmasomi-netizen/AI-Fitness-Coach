import assert from "node:assert/strict";
import { getExercises } from "./exercises.js";

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function printCaseResult({ name, expected, actual, status, error }) {
  console.log(`CASE: ${name}`);
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

const cases = [
  {
    name: "1. exercise API response shape remains unchanged and excludes passive catalog fields",
    run: async () => {
      const res = createMockResponse();
      await getExercises({}, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data));
      assert.ok(res.body.data.length > 0);

      const first = res.body.data[0];
      return {
        topLevelKeys: Object.keys(res.body).sort(),
        exerciseKeys: Object.keys(first).sort(),
        hasPassiveFields:
          "slug" in first ||
          "dnaMovementPattern" in first ||
          "requiredEquipment" in first ||
          "stabilityDemand" in first ||
          "axialLoading" in first ||
          "catalogLifecycle" in first ||
          "catalogSource" in first ||
          "catalogCurationVersion" in first,
      };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.topLevelKeys, ["data", "success"]);
      assert.deepEqual(actual.exerciseKeys, [
        "complexity",
        "defaultRepRangeHigh",
        "defaultRepRangeLow",
        "defaultRestSecondsHigh",
        "defaultRestSecondsLow",
        "description",
        "difficulty",
        "equipment",
        "icon",
        "id",
        "jointStressFlags",
        "movementPattern",
        "nameEn",
        "nameFa",
        "primaryMuscles",
        "progressionType",
        "secondaryMuscles",
        "substitutionNames",
        "suitableGoals",
      ]);
      assert.equal(actual.hasPassiveFields, false);
    },
  },
];

let passed = 0;
let failed = 0;

for (const testCase of cases) {
  try {
    const actual = await testCase.run();
    testCase.assertResult(actual);
    printCaseResult({
      name: testCase.name,
      actual,
      status: "PASS",
    });
    passed += 1;
  } catch (error) {
    printCaseResult({
      name: testCase.name,
      error: error.message,
      status: "FAIL",
    });
    failed += 1;
  }
}

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);

if (failed > 0) {
  process.exitCode = 1;
}

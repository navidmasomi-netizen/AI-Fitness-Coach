import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildReplacementIntentV1,
  REPLACEMENT_INTENT_TYPES,
  REPLACEMENT_INTENT_V1_VERSION,
} from "./replacementIntent.js";
import { buildReplacementContextV1 } from "./replacementContext.js";

function printCaseResult({ name, input, actual, error, status }) {
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

const ALL_INTENT_TYPES = Object.values(REPLACEMENT_INTENT_TYPES);

const cases = [
  {
    name: "1. every valid V1 intent normalizes",
    input: { types: ALL_INTENT_TYPES },
    run: () => ALL_INTENT_TYPES.map((type) => buildReplacementIntentV1({ version: REPLACEMENT_INTENT_V1_VERSION, type })),
    assertResult: (actual) => {
      assert.deepEqual(
        actual.map((intent) => intent.type),
        ALL_INTENT_TYPES
      );
    },
  },
  {
    name: "2. explicit UNKNOWN intent object normalizes",
    input: { type: "UNKNOWN" },
    run: () => buildReplacementIntentV1({ version: REPLACEMENT_INTENT_V1_VERSION, type: REPLACEMENT_INTENT_TYPES.UNKNOWN }),
    assertResult: (actual) => {
      assert.deepEqual(actual, {
        version: REPLACEMENT_INTENT_V1_VERSION,
        type: REPLACEMENT_INTENT_TYPES.UNKNOWN,
      });
    },
  },
  {
    name: "3. null ReplacementContext intent remains null",
    input: { replacementIntent: null },
    run: () => buildReplacementContextV1({ version: "replacement-context-v1", replacementIntent: null }),
    assertResult: (actual) => {
      assert.equal(actual.replacementIntent, null);
    },
  },
  {
    name: "4. null and explicit UNKNOWN remain distinct",
    input: { nullIntent: null, explicitUnknown: "UNKNOWN" },
    run: () => ({
      nullIntent: buildReplacementContextV1({ version: "replacement-context-v1" }),
      explicitUnknown: buildReplacementContextV1({
        version: "replacement-context-v1",
        replacementIntent: { version: REPLACEMENT_INTENT_V1_VERSION, type: REPLACEMENT_INTENT_TYPES.UNKNOWN },
      }),
    }),
    assertResult: (actual) => {
      assert.equal(actual.nullIntent.replacementIntent, null);
      assert.deepEqual(actual.explicitUnknown.replacementIntent, {
        version: REPLACEMENT_INTENT_V1_VERSION,
        type: REPLACEMENT_INTENT_TYPES.UNKNOWN,
      });
      assert.notDeepEqual(actual.nullIntent, actual.explicitUnknown);
    },
  },
  {
    name: "5. invalid intent type fails loudly",
    input: { type: "INJURY" },
    run: () => () => buildReplacementIntentV1({ version: REPLACEMENT_INTENT_V1_VERSION, type: "INJURY" }),
    assertResult: (actual) => {
      assert.throws(actual, /not supported/i);
    },
  },
  {
    name: "6. unsupported version fails loudly",
    input: { version: "replacement-intent-v0" },
    run: () => () => buildReplacementIntentV1({ version: "replacement-intent-v0", type: REPLACEMENT_INTENT_TYPES.UNKNOWN }),
    assertResult: (actual) => {
      assert.throws(actual, new RegExp(REPLACEMENT_INTENT_V1_VERSION));
    },
  },
  {
    name: "7. unknown field fails loudly",
    input: { details: "extra" },
    run: () => () =>
      buildReplacementIntentV1({
        version: REPLACEMENT_INTENT_V1_VERSION,
        type: REPLACEMENT_INTENT_TYPES.NO_EQUIPMENT,
        details: "extra",
      }),
    assertResult: (actual) => {
      assert.throws(actual, /unsupported field "details"/);
    },
  },
  {
    name: "8. arbitrary free-text intent is rejected",
    input: { type: "my knee hurts today" },
    run: () => () =>
      buildReplacementIntentV1({
        version: REPLACEMENT_INTENT_V1_VERSION,
        type: "my knee hurts today",
      }),
    assertResult: (actual) => {
      assert.throws(actual, /not supported/i);
    },
  },
  {
    name: "9. DISCOMFORT stores validated context only with no medical side effects",
    input: { type: "DISCOMFORT" },
    run: () => buildReplacementIntentV1({ version: REPLACEMENT_INTENT_V1_VERSION, type: REPLACEMENT_INTENT_TYPES.DISCOMFORT }),
    assertResult: (actual) => {
      assert.deepEqual(actual, {
        version: REPLACEMENT_INTENT_V1_VERSION,
        type: REPLACEMENT_INTENT_TYPES.DISCOMFORT,
      });
      assert.equal("injury" in actual, false);
      assert.equal("diagnosis" in actual, false);
      assert.equal("medicalRecommendation" in actual, false);
    },
  },
  {
    name: "10. no equipment-context inference into NO_EQUIPMENT occurs",
    input: { equipmentContext: { availableEquipment: [] } },
    run: () =>
      buildReplacementContextV1({
        version: "replacement-context-v1",
        equipmentContext: {
          availableEquipment: [],
        },
      }),
    assertResult: (actual) => {
      assert.equal(actual.replacementIntent, null);
    },
  },
  {
    name: "11. ReplacementContext accepts normalized intent",
    input: { type: "PREFER_VARIATION" },
    run: () =>
      buildReplacementContextV1({
        version: "replacement-context-v1",
        replacementIntent: buildReplacementIntentV1({
          version: REPLACEMENT_INTENT_V1_VERSION,
          type: REPLACEMENT_INTENT_TYPES.PREFER_VARIATION,
        }),
      }),
    assertResult: (actual) => {
      assert.deepEqual(actual.replacementIntent, {
        version: REPLACEMENT_INTENT_V1_VERSION,
        type: REPLACEMENT_INTENT_TYPES.PREFER_VARIATION,
      });
    },
  },
  {
    name: "12. ReplacementContext rejects malformed intent",
    input: { type: "UNKNOWN", details: "extra" },
    run: () => () =>
      buildReplacementContextV1({
        version: "replacement-context-v1",
        replacementIntent: {
          version: REPLACEMENT_INTENT_V1_VERSION,
          type: REPLACEMENT_INTENT_TYPES.UNKNOWN,
          details: "extra",
        },
      }),
    assertResult: (actual) => {
      assert.throws(actual, /unsupported field "details"/);
    },
  },
  {
    name: "13. input immutability is preserved",
    input: { immutability: true },
    run: () => {
      const rawIntent = { version: REPLACEMENT_INTENT_V1_VERSION, type: REPLACEMENT_INTENT_TYPES.EQUIPMENT_BUSY };
      const before = structuredClone(rawIntent);
      const actual = buildReplacementIntentV1(rawIntent);
      return { actual, rawIntent, before };
    },
    assertResult: ({ actual, rawIntent, before }) => {
      assert.deepEqual(rawIntent, before);
      assert.deepEqual(actual, before);
    },
  },
  {
    name: "14. deterministic output is preserved",
    input: { deterministic: true },
    run: () => {
      const rawIntent = { version: REPLACEMENT_INTENT_V1_VERSION, type: REPLACEMENT_INTENT_TYPES.EXERCISE_UNAVAILABLE };
      return {
        first: buildReplacementIntentV1(rawIntent),
        second: buildReplacementIntentV1(rawIntent),
      };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.first, actual.second);
    },
  },
  {
    name: "15. module has no Prisma dependency",
    input: { dependency: "Prisma" },
    run: async () => {
      const fileContent = await readFile(new URL("./replacementIntent.js", import.meta.url), "utf8");
      return { fileContent };
    },
    assertResult: (actual) => {
      assert.equal(/prisma/i.test(actual.fileContent), false);
      assert.equal(/@prisma/i.test(actual.fileContent), false);
    },
  },
  {
    name: "16. module imports no Candidate Ranking Integrity or Decision code",
    input: { boundary: "imports" },
    run: async () => {
      const fileContent = await readFile(new URL("./replacementIntent.js", import.meta.url), "utf8");
      return { fileContent };
    },
    assertResult: (actual) => {
      assert.equal(/exerciseCandidates/i.test(actual.fileContent), false);
      assert.equal(/exerciseRanking/i.test(actual.fileContent), false);
      assert.equal(/workoutIntegrity/i.test(actual.fileContent), false);
      assert.equal(/replacementDecision/i.test(actual.fileContent), false);
    },
  },
];

let passed = 0;

for (const testCase of cases) {
  try {
    const actual = await testCase.run();
    testCase.assertResult(actual);
    passed += 1;
    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      actual,
      status: "PASS",
    });
  } catch (error) {
    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      error: error instanceof Error ? error.message : String(error),
      status: "FAIL",
    });
    throw error;
  }
}

console.log(`SUMMARY: ${passed} passed, 0 failed, ${cases.length} total`);

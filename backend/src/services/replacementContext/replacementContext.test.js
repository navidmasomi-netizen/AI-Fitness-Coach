import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildReplacementContextV1,
  REPLACEMENT_CONTEXT_V1_VERSION,
} from "./replacementContext.js";

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

const cases = [
  {
    name: "1. valid unknown v1 context normalizes explicit null unknowns",
    input: { version: REPLACEMENT_CONTEXT_V1_VERSION },
    run: () => buildReplacementContextV1({ version: REPLACEMENT_CONTEXT_V1_VERSION }),
    assertResult: (actual) => {
      assert.deepEqual(actual, {
        version: REPLACEMENT_CONTEXT_V1_VERSION,
        equipmentContext: null,
        replacementIntent: null,
      });
    },
  },
  {
    name: "2. valid equipmentContext normalizes correctly",
    input: { availableEquipment: ["rack", "barbell"] },
    run: () =>
      buildReplacementContextV1({
        version: REPLACEMENT_CONTEXT_V1_VERSION,
        equipmentContext: {
          availableEquipment: ["rack", "barbell"],
        },
      }),
    assertResult: (actual) => {
      assert.deepEqual(actual.equipmentContext, {
        availableEquipment: ["barbell", "rack"],
      });
      assert.equal(actual.replacementIntent, null);
    },
  },
  {
    name: "3. duplicate equipment values normalize deterministically",
    input: { availableEquipment: ["rack", "barbell", "rack"] },
    run: () => ({
      first: buildReplacementContextV1({
        version: REPLACEMENT_CONTEXT_V1_VERSION,
        equipmentContext: {
          availableEquipment: ["rack", "barbell", "rack"],
        },
      }),
      second: buildReplacementContextV1({
        version: REPLACEMENT_CONTEXT_V1_VERSION,
        equipmentContext: {
          availableEquipment: ["barbell", "rack"],
        },
      }),
    }),
    assertResult: (actual) => {
      assert.deepEqual(actual.first, actual.second);
    },
  },
  {
    name: "4. invalid canonical equipment fails loudly",
    input: { availableEquipment: ["smith_machine"] },
    run: () => () =>
      buildReplacementContextV1({
        version: REPLACEMENT_CONTEXT_V1_VERSION,
        equipmentContext: {
          availableEquipment: ["smith_machine"],
        },
      }),
    assertResult: (actual) => {
      assert.throws(actual, /unsupported CatalogEquipment value "smith_machine"/);
    },
  },
  {
    name: "5. unsupported version fails loudly",
    input: { version: "replacement-context-v0" },
    run: () => () => buildReplacementContextV1({ version: "replacement-context-v0" }),
    assertResult: (actual) => {
      assert.throws(actual, new RegExp(REPLACEMENT_CONTEXT_V1_VERSION));
    },
  },
  {
    name: "6. unknown top-level fields fail loudly under strict v1 contract",
    input: { locale: "en-US" },
    run: () => () =>
      buildReplacementContextV1({
        version: REPLACEMENT_CONTEXT_V1_VERSION,
        locale: "en-US",
      }),
    assertResult: (actual) => {
      assert.throws(actual, /unsupported field "locale"/);
    },
  },
  {
    name: "7. missing optional fields preserve unknown semantics as null",
    input: { replacementIntent: undefined, equipmentContext: undefined },
    run: () =>
      buildReplacementContextV1({
        version: REPLACEMENT_CONTEXT_V1_VERSION,
      }),
    assertResult: (actual) => {
      assert.equal(actual.equipmentContext, null);
      assert.equal(actual.replacementIntent, null);
    },
  },
  {
    name: "8. explicit null does not become false or unavailable",
    input: { equipmentContext: null, replacementIntent: null },
    run: () =>
      buildReplacementContextV1({
        version: REPLACEMENT_CONTEXT_V1_VERSION,
        equipmentContext: null,
        replacementIntent: null,
      }),
    assertResult: (actual) => {
      assert.equal(actual.equipmentContext, null);
      assert.equal(actual.replacementIntent, null);
    },
  },
  {
    name: "9. raw context input is not mutated",
    input: { immutability: "rawContext" },
    run: () => {
      const rawContext = {
        version: REPLACEMENT_CONTEXT_V1_VERSION,
        equipmentContext: {
          availableEquipment: ["rack", "barbell"],
        },
      };
      const before = structuredClone(rawContext);
      const actual = buildReplacementContextV1(rawContext);
      return { actual, rawContext, before };
    },
    assertResult: ({ actual, rawContext, before }) => {
      assert.deepEqual(rawContext, before);
      assert.deepEqual(actual.equipmentContext, { availableEquipment: ["barbell", "rack"] });
    },
  },
  {
    name: "10. nested equipment arrays are not mutated",
    input: { availableEquipment: ["rack", "barbell", "rack"] },
    run: () => {
      const rawContext = {
        version: REPLACEMENT_CONTEXT_V1_VERSION,
        equipmentContext: {
          availableEquipment: ["rack", "barbell", "rack"],
        },
      };
      const before = structuredClone(rawContext);
      const actual = buildReplacementContextV1(rawContext);
      return { actual, rawContext, before };
    },
    assertResult: ({ actual, rawContext, before }) => {
      assert.deepEqual(rawContext, before);
      assert.deepEqual(actual.equipmentContext.availableEquipment, ["barbell", "rack"]);
    },
  },
  {
    name: "11. repeated normalization is deterministic",
    input: { deterministic: true },
    run: () => {
      const rawContext = {
        version: REPLACEMENT_CONTEXT_V1_VERSION,
        equipmentContext: {
          availableEquipment: ["bench", "dumbbell", "bench"],
        },
        replacementIntent: null,
      };
      return {
        first: buildReplacementContextV1(rawContext),
        second: buildReplacementContextV1(rawContext),
      };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.first, actual.second);
    },
  },
  {
    name: "12. module has no Prisma dependency",
    input: { dependency: "Prisma" },
    run: async () => {
      const fileContent = await readFile(new URL("./replacementContext.js", import.meta.url), "utf8");
      return { fileContent };
    },
    assertResult: (actual) => {
      assert.equal(/prisma/i.test(actual.fileContent), false);
      assert.equal(/@prisma/i.test(actual.fileContent), false);
    },
  },
  {
    name: "13. context module imports no Candidate Ranking or Decision modules",
    input: { boundary: "imports" },
    run: async () => {
      const fileContent = await readFile(new URL("./replacementContext.js", import.meta.url), "utf8");
      return { fileContent };
    },
    assertResult: (actual) => {
      assert.equal(/exerciseCandidates/i.test(actual.fileContent), false);
      assert.equal(/exerciseRanking/i.test(actual.fileContent), false);
      assert.equal(/replacementDecision/i.test(actual.fileContent), false);
    },
  },
  {
    name: "14. context module does not evaluate equipment availability",
    input: { boundary: "evaluator" },
    run: async () => {
      const fileContent = await readFile(new URL("./replacementContext.js", import.meta.url), "utf8");
      return { fileContent };
    },
    assertResult: (actual) => {
      assert.equal(/evaluateExerciseEquipmentAvailability/.test(actual.fileContent), false);
      assert.equal(/AVAILABLE/.test(actual.fileContent), false);
      assert.equal(/UNAVAILABLE/.test(actual.fileContent), false);
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

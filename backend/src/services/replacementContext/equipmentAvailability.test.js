import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BODYWEIGHT_CATALOG_EQUIPMENT,
  EQUIPMENT_AVAILABILITY_REASON_CODES,
  EQUIPMENT_AVAILABILITY_STATUSES,
  EQUIPMENT_AVAILABILITY_V1_VERSION,
  evaluateEquipmentAvailabilityForExercises,
  evaluateExerciseEquipmentAvailability,
} from "./equipmentAvailability.js";

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

function buildExercise(overrides = {}) {
  return {
    exerciseId: 13,
    slug: "back-squat",
    nameEn: "Back Squat",
    requiredEquipment: ["barbell", "rack"],
    ...overrides,
  };
}

const cases = [
  {
    name: "1. all required items present returns AVAILABLE",
    input: { requiredEquipment: ["barbell", "rack"], availableEquipment: ["barbell", "rack", "bench"] },
    run: () =>
      evaluateExerciseEquipmentAvailability(buildExercise(), {
        availableEquipment: ["barbell", "rack", "bench"],
      }),
    assertResult: (actual) => {
      assert.equal(actual.status, EQUIPMENT_AVAILABILITY_STATUSES.AVAILABLE);
      assert.deepEqual(actual.matchedEquipment, ["barbell", "rack"]);
      assert.deepEqual(actual.missingEquipment, []);
    },
  },
  {
    name: "2. one required item missing returns UNAVAILABLE",
    input: { requiredEquipment: ["barbell", "rack"], availableEquipment: ["barbell"] },
    run: () =>
      evaluateExerciseEquipmentAvailability(buildExercise(), {
        availableEquipment: ["barbell"],
      }),
    assertResult: (actual) => {
      assert.equal(actual.status, EQUIPMENT_AVAILABILITY_STATUSES.UNAVAILABLE);
      assert.deepEqual(actual.missingEquipment, ["rack"]);
      assert.equal(actual.reasons.some((reason) => reason.code === EQUIPMENT_AVAILABILITY_REASON_CODES.REQUIRED_ITEM_MISSING), true);
    },
  },
  {
    name: "3. all listed requirements are mandatory for availability",
    input: { requiredEquipment: ["barbell", "bench", "rack"], availableEquipment: ["barbell", "rack"] },
    run: () =>
      evaluateExerciseEquipmentAvailability(
        buildExercise({ requiredEquipment: ["barbell", "bench", "rack"] }),
        { availableEquipment: ["barbell", "rack"] }
      ),
    assertResult: (actual) => {
      assert.equal(actual.status, EQUIPMENT_AVAILABILITY_STATUSES.UNAVAILABLE);
      assert.deepEqual(actual.missingEquipment, ["bench"]);
    },
  },
  {
    name: "4. extra available equipment does not change availability",
    input: { requiredEquipment: ["dumbbell"], availableEquipment: ["barbell", "bench", "dumbbell", "rack"] },
    run: () =>
      evaluateExerciseEquipmentAvailability(
        buildExercise({ requiredEquipment: ["dumbbell"] }),
        { availableEquipment: ["barbell", "bench", "dumbbell", "rack"] }
      ),
    assertResult: (actual) => {
      assert.equal(actual.status, EQUIPMENT_AVAILABILITY_STATUSES.AVAILABLE);
      assert.deepEqual(actual.matchedEquipment, ["dumbbell"]);
    },
  },
  {
    name: "5. evaluation is order independent",
    input: { requiredEquipment: ["rack", "barbell"], availableEquipment: ["rack", "barbell"] },
    run: () => ({
      first: evaluateExerciseEquipmentAvailability(
        buildExercise({ requiredEquipment: ["rack", "barbell"] }),
        { availableEquipment: ["rack", "barbell"] }
      ),
      second: evaluateExerciseEquipmentAvailability(
        buildExercise({ requiredEquipment: ["barbell", "rack"] }),
        { availableEquipment: ["barbell", "rack"] }
      ),
    }),
    assertResult: (actual) => {
      assert.deepEqual(actual.first, actual.second);
    },
  },
  {
    name: "6. duplicate equipment values are normalized without mutating inputs",
    input: { requiredEquipment: ["rack", "barbell", "rack"], availableEquipment: ["barbell", "barbell", "rack"] },
    run: () => {
      const exercise = buildExercise({ requiredEquipment: ["rack", "barbell", "rack"] });
      const context = { availableEquipment: ["barbell", "barbell", "rack"] };
      const before = {
        exercise: structuredClone(exercise),
        context: structuredClone(context),
      };
      const actual = evaluateExerciseEquipmentAvailability(exercise, context);
      return { actual, exercise, context, before };
    },
    assertResult: ({ actual, exercise, context, before }) => {
      assert.equal(actual.status, EQUIPMENT_AVAILABILITY_STATUSES.AVAILABLE);
      assert.deepEqual(actual.requiredEquipment, ["barbell", "rack"]);
      assert.deepEqual(actual.availableEquipment, ["barbell", "bodyweight", "rack"]);
      assert.deepEqual(exercise, before.exercise);
      assert.deepEqual(context, before.context);
    },
  },
  {
    name: "7. bodyweight-only exercises are AVAILABLE with explicit empty context because bodyweight is implicit",
    input: { requiredEquipment: ["bodyweight"], availableEquipment: [] },
    run: () =>
      evaluateExerciseEquipmentAvailability(
        buildExercise({ requiredEquipment: ["bodyweight"] }),
        { availableEquipment: [] }
      ),
    assertResult: (actual) => {
      assert.equal(actual.status, EQUIPMENT_AVAILABILITY_STATUSES.AVAILABLE);
      assert.deepEqual(actual.availableEquipment, ["bodyweight"]);
      assert.equal(actual.reasons.some((reason) => reason.code === EQUIPMENT_AVAILABILITY_REASON_CODES.BODYWEIGHT_IMPLICIT), true);
    },
  },
  {
    name: "8. bodyweight plus another requirement still requires the non-bodyweight item",
    input: { requiredEquipment: ["bodyweight", "bench"], availableEquipment: ["bench"] },
    run: () =>
      evaluateExerciseEquipmentAvailability(
        buildExercise({ requiredEquipment: ["bodyweight", "bench"] }),
        { availableEquipment: ["bench"] }
      ),
    assertResult: (actual) => {
      assert.equal(actual.status, EQUIPMENT_AVAILABILITY_STATUSES.AVAILABLE);
      assert.deepEqual(actual.matchedEquipment, ["bench", "bodyweight"]);
      assert.deepEqual(actual.missingEquipment, []);
    },
  },
  {
    name: "9. empty requiredEquipment is explicit metadata unavailability",
    input: { requiredEquipment: [] },
    run: () => evaluateExerciseEquipmentAvailability(buildExercise({ requiredEquipment: [] }), { availableEquipment: ["barbell"] }),
    assertResult: (actual) => {
      assert.equal(actual.status, EQUIPMENT_AVAILABILITY_STATUSES.METADATA_UNAVAILABLE);
      assert.equal(actual.availableEquipment, null);
      assert.equal(actual.reasons[0].code, EQUIPMENT_AVAILABILITY_REASON_CODES.METADATA_UNAVAILABLE);
    },
  },
  {
    name: "10. missing context returns CONTEXT_UNKNOWN",
    input: { context: null },
    run: () => evaluateExerciseEquipmentAvailability(buildExercise(), undefined),
    assertResult: (actual) => {
      assert.equal(actual.status, EQUIPMENT_AVAILABILITY_STATUSES.CONTEXT_UNKNOWN);
      assert.equal(actual.availableEquipment, null);
      assert.equal(actual.reasons[0].code, EQUIPMENT_AVAILABILITY_REASON_CODES.CONTEXT_UNKNOWN);
    },
  },
  {
    name: "11. explicit empty context differs from missing context",
    input: { availableEquipment: [] },
    run: () => ({
      emptyExplicit: evaluateExerciseEquipmentAvailability(buildExercise(), { availableEquipment: [] }),
      missingContext: evaluateExerciseEquipmentAvailability(buildExercise(), undefined),
    }),
    assertResult: (actual) => {
      assert.equal(actual.emptyExplicit.status, EQUIPMENT_AVAILABILITY_STATUSES.UNAVAILABLE);
      assert.equal(actual.missingContext.status, EQUIPMENT_AVAILABILITY_STATUSES.CONTEXT_UNKNOWN);
    },
  },
  {
    name: "12. invalid canonical equipment fails loudly",
    input: { invalidExerciseEquipment: "smith_machine", invalidContextEquipment: "sled" },
    run: () => ({
      invalidExercise: () =>
        evaluateExerciseEquipmentAvailability(
          buildExercise({ requiredEquipment: ["smith_machine"] }),
          { availableEquipment: ["barbell"] }
        ),
      invalidContext: () =>
        evaluateExerciseEquipmentAvailability(
          buildExercise(),
          { availableEquipment: ["sled"] }
        ),
    }),
    assertResult: (actual) => {
      assert.throws(actual.invalidExercise, /unsupported CatalogEquipment value "smith_machine"/);
      assert.throws(actual.invalidContext, /unsupported CatalogEquipment value "sled"/);
    },
  },
  {
    name: "13. inputs are not mutated",
    input: { requiredEquipment: ["barbell", "rack"], availableEquipment: ["rack", "barbell"] },
    run: () => {
      const exercise = buildExercise({ requiredEquipment: ["barbell", "rack"] });
      const context = { availableEquipment: ["rack", "barbell"] };
      const before = {
        exercise: structuredClone(exercise),
        context: structuredClone(context),
      };
      const actual = evaluateExerciseEquipmentAvailability(exercise, context);
      return { actual, exercise, context, before };
    },
    assertResult: ({ actual, exercise, context, before }) => {
      assert.equal(actual.status, EQUIPMENT_AVAILABILITY_STATUSES.AVAILABLE);
      assert.deepEqual(exercise, before.exercise);
      assert.deepEqual(context, before.context);
    },
  },
  {
    name: "14. output is deterministic",
    input: { repeatedEvaluation: true },
    run: () => {
      const exercise = buildExercise({ requiredEquipment: ["dumbbell", BODYWEIGHT_CATALOG_EQUIPMENT] });
      const context = { availableEquipment: ["dumbbell"] };
      return {
        first: evaluateExerciseEquipmentAvailability(exercise, context),
        second: evaluateExerciseEquipmentAvailability(exercise, context),
      };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.first, actual.second);
    },
  },
  {
    name: "15. batch evaluation preserves input order",
    input: { exerciseIds: [13, 71, 90] },
    run: () =>
      evaluateEquipmentAvailabilityForExercises(
        [
          buildExercise({ exerciseId: 13, requiredEquipment: ["barbell", "rack"] }),
          buildExercise({ exerciseId: 71, requiredEquipment: ["dumbbell"] }),
          buildExercise({ exerciseId: 90, requiredEquipment: [] }),
        ],
        { availableEquipment: ["barbell", "rack", "dumbbell"] }
      ),
    assertResult: (actual) => {
      assert.equal(actual.version, EQUIPMENT_AVAILABILITY_V1_VERSION);
      assert.deepEqual(
        actual.evaluations.map((evaluation) => evaluation.exerciseId),
        [13, 71, 90]
      );
      assert.equal(actual.evaluations[2].status, EQUIPMENT_AVAILABILITY_STATUSES.METADATA_UNAVAILABLE);
    },
  },
  {
    name: "16. module has no Prisma dependency",
    input: { dependency: "Prisma" },
    run: async () => {
      const fileContent = await readFile(new URL("./equipmentAvailability.js", import.meta.url), "utf8");
      return { fileContent };
    },
    assertResult: (actual) => {
      assert.equal(/prisma/i.test(actual.fileContent), false);
      assert.equal(/@prisma/i.test(actual.fileContent), false);
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

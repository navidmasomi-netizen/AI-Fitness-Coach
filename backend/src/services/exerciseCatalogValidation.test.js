import assert from "node:assert/strict";
import prisma from "../lib/prisma.js";
import { buildCuratedExerciseCatalogFields } from "./exerciseCatalogCuration.js";
import {
  EXERCISE_CATALOG_METADATA_BY_NAME_EN,
  buildUniqueExerciseCatalogSlugs,
  generateExerciseCatalogSlug,
  validateExerciseCatalogMetadataSet,
} from "./exerciseCatalogValidation.js";

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

const cases = [
  {
    name: "1. slug generation is deterministic and normalized",
    input: { nameEn: "Bodyweight Squat (Controlled Range)" },
    run: ({ nameEn }) => generateExerciseCatalogSlug(nameEn),
    assertResult: (actual) => {
      assert.equal(actual, "bodyweight-squat-controlled-range");
    },
  },
  {
    name: "2. slug collision detection fails loudly",
    input: {
      names: ["Bench Press", "bench   press"],
    },
    run: ({ names }) =>
      buildUniqueExerciseCatalogSlugs(names.map((name_en) => ({ name_en }))),
    assertError: (error) => {
      assert.match(error.message, /Duplicate exercise catalog slug/);
    },
  },
  {
    name: "3. metadata validator accepts multiple required equipment values",
    input: {
      record: {
        nameEn: "Bench Press",
        slug: "bench-press",
        dnaMovementPattern: "horizontal_press",
        requiredEquipment: ["barbell", "bench", "rack"],
        stabilityDemand: "MODERATE",
        axialLoading: "NONE",
        catalogLifecycle: "ACTIVE",
      },
    },
    run: ({ record }) => validateExerciseCatalogMetadataSet([record]),
    assertResult: (actual) => {
      assert.deepEqual(actual, []);
    },
  },
  {
    name: "4. seeded exercises carry passive catalog metadata without fabricating ambiguous apparatus",
    input: {
      ambiguousNames: ["Bodyweight Inverted Row", "Dumbbell Row", "Weighted Pull-Up"],
    },
    run: async ({ ambiguousNames }) => {
      const exercises = await prisma.exercise.findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          nameEn: true,
          slug: true,
          dnaMovementPattern: true,
          requiredEquipment: true,
          stabilityDemand: true,
          axialLoading: true,
          catalogLifecycle: true,
        },
      });

      const byName = new Map(exercises.map((exercise) => [exercise.nameEn, exercise]));
      return {
        count: exercises.length,
        activeCount: exercises.filter((exercise) => exercise.catalogLifecycle === "ACTIVE").length,
        curatedCount: exercises.filter((exercise) => exercise.catalogLifecycle === "CURATED").length,
        ambiguous: ambiguousNames.map((name) => byName.get(name)),
        backSquat: byName.get("Back Squat"),
        machineLegCurl: byName.get("Machine Leg Curl"),
        pallof: byName.get("Cable Pallof Press"),
      };
    },
    assertResult: (actual) => {
      assert.equal(actual.count, 42);
      assert.equal(actual.activeCount, 39);
      assert.equal(actual.curatedCount, 3);

      for (const ambiguous of actual.ambiguous) {
        assert.equal(ambiguous.catalogLifecycle, "CURATED");
        assert.equal(ambiguous.requiredEquipment.length, 0);
        assert.equal(ambiguous.stabilityDemand, null);
        assert.equal(ambiguous.axialLoading, null);
        assert.ok(typeof ambiguous.slug === "string" && ambiguous.slug.length > 0);
        assert.ok(typeof ambiguous.dnaMovementPattern === "string" && ambiguous.dnaMovementPattern.length > 0);
      }

      assert.deepEqual(actual.backSquat.requiredEquipment, ["barbell", "rack"]);
      assert.equal(actual.backSquat.catalogLifecycle, "ACTIVE");
      assert.equal(actual.machineLegCurl.dnaMovementPattern, "knee_flexion");
      assert.deepEqual(actual.machineLegCurl.requiredEquipment, ["selectorized_machine"]);
      assert.equal(actual.pallof.dnaMovementPattern, "anti_rotation");
    },
  },
  {
    name: "5. seeded rows match the shared curated catalog source",
    input: {
      nameEn: "Back Squat",
      slug: "back-squat",
    },
    run: async ({ nameEn, slug }) => {
      const row = await prisma.exercise.findFirstOrThrow({
        where: { nameEn },
        select: {
          nameEn: true,
          slug: true,
          dnaMovementPattern: true,
          requiredEquipment: true,
          stabilityDemand: true,
          axialLoading: true,
          catalogLifecycle: true,
          catalogSource: true,
          catalogCurationVersion: true,
        },
      });

      return {
        expected: buildCuratedExerciseCatalogFields({ nameEn, slug }),
        actual: row,
      };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.actual, {
        nameEn: "Back Squat",
        ...actual.expected,
      });
    },
  },
  {
    name: "6. every curated metadata entry has a seeded exercise definition",
    input: {
      metadataKeys: Object.keys(EXERCISE_CATALOG_METADATA_BY_NAME_EN),
    },
    run: async ({ metadataKeys }) => {
      const existingNames = await prisma.exercise.findMany({
        select: { nameEn: true },
        orderBy: { id: "asc" },
      });

      const existingNameSet = new Set(existingNames.map((exercise) => exercise.nameEn));
      return {
        metadataCount: metadataKeys.length,
        missing: metadataKeys.filter((name) => !existingNameSet.has(name)),
      };
    },
    assertResult: (actual) => {
      assert.equal(actual.metadataCount, 42);
      assert.deepEqual(actual.missing, []);
    },
  },
];

let passed = 0;
let failed = 0;

for (const testCase of cases) {
  try {
    const actual = await testCase.run(testCase.input);
    if (testCase.assertError) {
      throw new Error("Expected the case to throw, but it completed successfully.");
    }
    testCase.assertResult(actual);
    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      actual,
      status: "PASS",
    });
    passed += 1;
  } catch (error) {
    if (testCase.assertError) {
      try {
        testCase.assertError(error);
        printCaseResult({
          name: testCase.name,
          input: testCase.input,
          error: error.message,
          status: "PASS",
        });
        passed += 1;
      } catch (assertionError) {
        printCaseResult({
          name: testCase.name,
          input: testCase.input,
          error: assertionError.message,
          status: "FAIL",
        });
        failed += 1;
      }
    } else {
      printCaseResult({
        name: testCase.name,
        input: testCase.input,
        error: error.message,
        status: "FAIL",
      });
      failed += 1;
    }
  }
}

await prisma.$disconnect();

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);

if (failed > 0) {
  process.exitCode = 1;
}

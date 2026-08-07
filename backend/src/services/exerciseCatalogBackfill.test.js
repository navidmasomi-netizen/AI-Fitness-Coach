import assert from "node:assert/strict";
import prisma from "../lib/prisma.js";
import {
  buildCuratedExerciseCatalogFields,
  EXERCISE_CATALOG_METADATA_BY_NAME_EN,
  EXERCISE_CATALOG_PARTIAL_ROW_NAMES,
} from "./exerciseCatalogCuration.js";
import { backfillExistingExerciseCatalog } from "../../scripts/backfillExerciseCatalogFoundation.js";

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

async function readCatalogRows() {
  return prisma.exercise.findMany({
    where: { nameEn: { in: Object.keys(EXERCISE_CATALOG_METADATA_BY_NAME_EN) } },
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
      catalogSource: true,
      catalogCurationVersion: true,
    },
  });
}

async function resetCatalogFieldsToLegacyState() {
  await prisma.exercise.updateMany({
    where: { nameEn: { in: Object.keys(EXERCISE_CATALOG_METADATA_BY_NAME_EN) } },
    data: {
      slug: null,
      dnaMovementPattern: null,
      requiredEquipment: [],
      stabilityDemand: null,
      axialLoading: null,
      catalogLifecycle: "DRAFT",
      catalogSource: null,
      catalogCurationVersion: null,
    },
  });
}

function collectCatalogSummary(rows) {
  const activeCount = rows.filter((row) => row.catalogLifecycle === "ACTIVE").length;
  const curatedCount = rows.filter((row) => row.catalogLifecycle === "CURATED").length;
  const ambiguousRows = rows.filter((row) => EXERCISE_CATALOG_PARTIAL_ROW_NAMES.includes(row.nameEn));

  return {
    count: rows.length,
    ids: rows.map((row) => row.id),
    activeCount,
    curatedCount,
    ambiguousRows,
  };
}

async function restoreCanonicalBackfillState() {
  await resetCatalogFieldsToLegacyState();
  await backfillExistingExerciseCatalog({ prismaClient: prisma, logger: { log() {} } });
}

const cases = [
  {
    name: "1. empty legacy catalog fields are populated without creating rows or changing Exercise.id values",
    input: { scenario: "legacy populated database with catalog fields uninitialized" },
    run: async () => {
      const beforeRows = await readCatalogRows();
      await resetCatalogFieldsToLegacyState();
      const beforeBackfillRows = await readCatalogRows();
      const summary = await backfillExistingExerciseCatalog({
        prismaClient: prisma,
        logger: { log() {} },
      });
      const afterRows = await readCatalogRows();

      return {
        beforeCount: beforeRows.length,
        beforeIds: beforeRows.map((row) => row.id),
        legacyStateSample: beforeBackfillRows.find((row) => row.nameEn === "Back Squat"),
        summary,
        afterSummary: collectCatalogSummary(afterRows),
        rows: afterRows,
      };
    },
    assertResult: (actual) => {
      assert.equal(actual.beforeCount, 42);
      assert.equal(actual.summary.updatedCount, 42);
      assert.equal(actual.summary.unchangedCount, 0);
      assert.equal(actual.afterSummary.count, 42);
      assert.deepEqual(actual.afterSummary.ids, actual.beforeIds);
      assert.equal(actual.summary.activeCount, 39);
      assert.equal(actual.summary.curatedCount, 3);
      assert.equal(actual.legacyStateSample.slug, null);
      assert.equal(actual.legacyStateSample.catalogLifecycle, "DRAFT");

      const byName = new Map(actual.rows.map((row) => [row.nameEn, row]));
      for (const [nameEn] of Object.entries(EXERCISE_CATALOG_METADATA_BY_NAME_EN)) {
        const expected = buildCuratedExerciseCatalogFields({
          nameEn,
          slug: byName.get(nameEn).slug,
        });
        assert.deepEqual(byName.get(nameEn), {
          id: byName.get(nameEn).id,
          nameEn,
          ...expected,
        });
      }

      for (const ambiguousRow of actual.afterSummary.ambiguousRows) {
        assert.equal(ambiguousRow.catalogLifecycle, "CURATED");
        assert.deepEqual(ambiguousRow.requiredEquipment, []);
        assert.equal(ambiguousRow.stabilityDemand, null);
        assert.equal(ambiguousRow.axialLoading, null);
      }
    },
  },
  {
    name: "2. second execution is a no-op",
    input: { scenario: "rerun after successful backfill" },
    run: async () => {
      const beforeRows = await readCatalogRows();
      const summary = await backfillExistingExerciseCatalog({
        prismaClient: prisma,
        logger: { log() {} },
      });
      const afterRows = await readCatalogRows();

      return {
        summary,
        sameRows: JSON.stringify(beforeRows) === JSON.stringify(afterRows),
      };
    },
    assertResult: (actual) => {
      assert.equal(actual.summary.updatedCount, 0);
      assert.equal(actual.summary.unchangedCount, 42);
      assert.equal(actual.sameRows, true);
    },
  },
  {
    name: "3. conflicting existing curated value fails loudly",
    input: { exerciseName: "Back Squat", conflictingSlug: "wrong-back-squat" },
    run: async ({ exerciseName, conflictingSlug }) => {
      const row = await prisma.exercise.findFirstOrThrow({
        where: { nameEn: exerciseName },
        select: { id: true },
      });

      await prisma.exercise.update({
        where: { id: row.id },
        data: { slug: conflictingSlug },
      });

      try {
        await backfillExistingExerciseCatalog({
          prismaClient: prisma,
          logger: { log() {} },
        });
      } finally {
        await prisma.exercise.update({
          where: { id: row.id },
          data: { slug: null },
        });
        await backfillExistingExerciseCatalog({
          prismaClient: prisma,
          logger: { log() {} },
        });
      }
    },
    assertError: (error) => {
      assert.match(error.message, /conflicting catalog field "slug"/);
    },
  },
  {
    name: "4. missing expected Exercise fails loudly",
    input: { exerciseName: "Deadlift", temporaryName: "Deadlift TEMP MISSING" },
    run: async ({ exerciseName, temporaryName }) => {
      const row = await prisma.exercise.findFirstOrThrow({
        where: { nameEn: exerciseName },
        select: { id: true },
      });

      await prisma.exercise.update({
        where: { id: row.id },
        data: { nameEn: temporaryName },
      });

      try {
        await backfillExistingExerciseCatalog({
          prismaClient: prisma,
          logger: { log() {} },
        });
      } finally {
        await prisma.exercise.update({
          where: { id: row.id },
          data: { nameEn: exerciseName },
        });
        await backfillExistingExerciseCatalog({
          prismaClient: prisma,
          logger: { log() {} },
        });
      }
    },
    assertError: (error) => {
      assert.match(error.message, /Expected exactly one existing Exercise row for "Deadlift", but found none/);
    },
  },
  {
    name: "5. duplicate legacy identity fails loudly",
    input: { duplicateNameEn: "Back Squat" },
    run: async ({ duplicateNameEn }) => {
      const duplicate = await prisma.exercise.create({
        data: {
          nameFa: "ردیف تکراری تستی اسکوات",
          nameEn: duplicateNameEn,
          primaryMuscles: [],
          secondaryMuscles: [],
          suitableGoals: [],
          contraindications: [],
          jointStressFlags: [],
          substitutionNames: [],
          requiredEquipment: [],
        },
        select: { id: true },
      });

      try {
        await backfillExistingExerciseCatalog({
          prismaClient: prisma,
          logger: { log() {} },
        });
      } finally {
        await prisma.exercise.delete({ where: { id: duplicate.id } });
        await backfillExistingExerciseCatalog({
          prismaClient: prisma,
          logger: { log() {} },
        });
      }
    },
    assertError: (error) => {
      assert.match(error.message, /Expected exactly one existing Exercise row for "Back Squat", but found 2/);
    },
  },
];

let passed = 0;
let failed = 0;

try {
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
} finally {
  await restoreCanonicalBackfillState();
  await prisma.$disconnect();
}

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);

if (failed > 0) {
  process.exitCode = 1;
}

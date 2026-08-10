import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildSimilarityCalibrationReport,
  buildSimilarityCalibrationReportV1,
  EXERCISE_SIMILARITY_CALIBRATION_DIMENSIONS,
  EXERCISE_SIMILARITY_CALIBRATION_FIXTURE_COUNT,
  EXERCISE_SIMILARITY_GOLD_STANDARD_V1_URL,
  loadSimilarityGoldStandardDataset,
  mapSimilarityResultToValidationCategory,
  runSimilarityCalibration,
  runSimilarityCalibrationV1,
  SIMILARITY_CALIBRATION_FILTER_MODES,
  SIMILARITY_GOLD_STANDARD_CONFIDENCE,
  SIMILARITY_GOLD_STANDARD_SOURCES,
  SIMILARITY_VALIDATION_CATEGORIES,
  SIMILARITY_VALIDATION_THRESHOLDS_V1,
  summarizeSimilarityGoldStandardCoverage,
  validateSimilarityGoldStandardDataset,
} from "./calibration.js";
import { compareExercisesV1, SIMILARITY_RESULT_STATUSES } from "./index.js";
import { resolveExerciseSimilarityCalibrationFixture } from "./calibrationFixtures.js";

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

function buildBaseDataset() {
  return {
    version: "test-dataset-v1",
    createdAt: "2026-08-09",
    updatedAt: "2026-08-09",
    maintainer: "Validation Test Harness",
    categoryDefinitions: {
      VERY_HIGH: "a",
      HIGH: "b",
      MEDIUM: "c",
      LOW: "d",
      VERY_LOW: "e",
      UNAVAILABLE: "f",
    },
    pairs: [],
  };
}

function buildPair(overrides = {}) {
  return {
    id: "pair-001",
    exerciseA: "Back Squat",
    exerciseB: "Front Squat",
    expectedCategory: "VERY_HIGH",
    confidence: "HIGH",
    source: "CATALOG",
    activeForCalibration: true,
    rationale: "Same squat family and class.",
    tags: ["catalog", "same-family"],
    ...overrides,
  };
}

const cases = [
  {
    name: "1. gold standard dataset is valid and stays within the target size band",
    input: { dataset: "gold-standard-v1.json" },
    run: () => {
      const dataset = loadSimilarityGoldStandardDataset();
      const isValid = validateSimilarityGoldStandardDataset(dataset, resolveExerciseSimilarityCalibrationFixture);
      const coverage = summarizeSimilarityGoldStandardCoverage(dataset, resolveExerciseSimilarityCalibrationFixture);
      return {
        isValid,
        size: dataset.pairs.length,
        coverage,
      };
    },
    assertResult: (actual) => {
      assert.equal(actual.isValid, true);
      assert.ok(actual.size >= 100 && actual.size <= 150);
      assert.ok(actual.coverage.categoryCounts.VERY_HIGH > 0);
      assert.ok(actual.coverage.categoryCounts.UNAVAILABLE > 0);
      assert.ok(actual.coverage.activePairs > 0);
      assert.ok(actual.coverage.inactivePairs > 0);
      assert.ok(actual.coverage.pairSourceCounts.CATALOG > 0);
      assert.ok(actual.coverage.pairSourceCounts.MIXED > 0);
      assert.ok(actual.coverage.confidenceCounts.HIGH > 0);
      assert.ok(actual.coverage.confidenceCounts.LOW > 0);
      assert.ok(actual.coverage.sourceCounts.catalog > 0);
      assert.ok(actual.coverage.sourceCounts.synthetic > 0);
      assert.ok(actual.coverage.movementPatterns.includes("squat"));
      assert.ok(actual.coverage.movementPatterns.includes("carry"));
      assert.ok(actual.coverage.equipmentValues.includes("barbell"));
      assert.ok(actual.coverage.equipmentValues.includes("cable"));
      assert.ok(actual.coverage.equipmentValues.includes("selectorized_machine"));
    },
  },
  {
    name: "2. validation category mapping uses the locked threshold boundaries",
    input: { thresholds: SIMILARITY_VALIDATION_THRESHOLDS_V1 },
    run: () => ({
      veryHigh: mapSimilarityResultToValidationCategory({ status: "AVAILABLE", score: 0.85 }),
      high: mapSimilarityResultToValidationCategory({ status: "AVAILABLE", score: 0.7 }),
      medium: mapSimilarityResultToValidationCategory({ status: "AVAILABLE", score: 0.45 }),
      low: mapSimilarityResultToValidationCategory({ status: "AVAILABLE", score: 0.2 }),
      veryLow: mapSimilarityResultToValidationCategory({ status: "AVAILABLE", score: 0.1999 }),
      unavailable: mapSimilarityResultToValidationCategory({ status: "UNAVAILABLE", score: null }),
    }),
    assertResult: (actual) => {
      assert.equal(actual.veryHigh, SIMILARITY_VALIDATION_CATEGORIES.VERY_HIGH);
      assert.equal(actual.high, SIMILARITY_VALIDATION_CATEGORIES.HIGH);
      assert.equal(actual.medium, SIMILARITY_VALIDATION_CATEGORIES.MEDIUM);
      assert.equal(actual.low, SIMILARITY_VALIDATION_CATEGORIES.LOW);
      assert.equal(actual.veryLow, SIMILARITY_VALIDATION_CATEGORIES.VERY_LOW);
      assert.equal(actual.unavailable, SIMILARITY_VALIDATION_CATEGORIES.UNAVAILABLE);
    },
  },
  {
    name: "3. duplicate pair detection is order-insensitive",
    input: { pairA: "Back Squat <> Front Squat", pairB: "Front Squat <> Back Squat" },
    run: () =>
      validateSimilarityGoldStandardDataset(
        {
          ...buildBaseDataset(),
          pairs: [
            buildPair({ id: "pair-001" }),
            buildPair({ id: "pair-002", exerciseA: "Front Squat", exerciseB: "Back Squat" }),
          ],
        },
        resolveExerciseSimilarityCalibrationFixture
      ),
    assertError: (error) => {
      assert.match(error.message, /duplicate pair/);
    },
  },
  {
    name: "4. invalid category fails loudly",
    input: { invalidCategory: "IMPOSSIBLE" },
    run: () =>
      validateSimilarityGoldStandardDataset(
        {
          ...buildBaseDataset(),
          pairs: [buildPair({ expectedCategory: "IMPOSSIBLE" })],
        },
        resolveExerciseSimilarityCalibrationFixture
      ),
    assertError: (error) => {
      assert.match(error.message, /invalid expectedCategory/);
    },
  },
  {
    name: "5. invalid confidence fails loudly",
    input: { invalidConfidence: "UNCERTAIN" },
    run: () =>
      validateSimilarityGoldStandardDataset(
        {
          ...buildBaseDataset(),
          pairs: [buildPair({ confidence: "UNCERTAIN" })],
        },
        resolveExerciseSimilarityCalibrationFixture
      ),
    assertError: (error) => {
      assert.match(error.message, /invalid confidence/);
    },
  },
  {
    name: "6. invalid source fails loudly",
    input: { invalidSource: "UNKNOWN" },
    run: () =>
      validateSimilarityGoldStandardDataset(
        {
          ...buildBaseDataset(),
          pairs: [buildPair({ source: "UNKNOWN" })],
        },
        resolveExerciseSimilarityCalibrationFixture
      ),
    assertError: (error) => {
      assert.match(error.message, /invalid source/);
    },
  },
  {
    name: "7. inactive flag must be boolean",
    input: { activeForCalibration: "yes" },
    run: () =>
      validateSimilarityGoldStandardDataset(
        {
          ...buildBaseDataset(),
          pairs: [buildPair({ activeForCalibration: "yes" })],
        },
        resolveExerciseSimilarityCalibrationFixture
      ),
    assertError: (error) => {
      assert.match(error.message, /boolean activeForCalibration/);
    },
  },
  {
    name: "8. duplicate ids fail loudly",
    input: { duplicateId: "pair-001" },
    run: () =>
      validateSimilarityGoldStandardDataset(
        {
          ...buildBaseDataset(),
          pairs: [
            buildPair({ id: "pair-001" }),
            buildPair({ id: "pair-001", exerciseA: "Bench Press", exerciseB: "Dumbbell Bench Press", expectedCategory: "VERY_HIGH" }),
          ],
        },
        resolveExerciseSimilarityCalibrationFixture
      ),
    assertError: (error) => {
      assert.match(error.message, /duplicate id/);
    },
  },
  {
    name: "9. invalid metadata fails loudly when rationale or tags are missing",
    input: { rationale: "", tags: [] },
    run: () =>
      validateSimilarityGoldStandardDataset(
        {
          ...buildBaseDataset(),
          pairs: [buildPair({ rationale: "" })],
        },
        resolveExerciseSimilarityCalibrationFixture
      ),
    assertError: (error) => {
      assert.match(error.message, /non-empty rationale/);
    },
  },
  {
    name: "10. runner produces stable pairwise results and preserves comparator breakdowns",
    input: { dataset: "gold-standard-v1.json" },
    run: () => {
      const run = runSimilarityCalibrationV1();
      const sample = run.results.find((result) => result.exerciseA === "Back Squat" && result.exerciseB === "Front Squat");
      return {
        totalPairs: run.totalPairs,
        totalDatasetPairs: run.totalDatasetPairs,
        filterMode: run.filterMode,
        policyVersion: run.policyVersion,
        thresholdVersion: run.thresholdVersion,
        sample,
      };
    },
    assertResult: (actual) => {
      assert.ok(actual.totalPairs >= 100);
      assert.equal(actual.totalDatasetPairs, actual.totalPairs);
      assert.equal(actual.filterMode, SIMILARITY_CALIBRATION_FILTER_MODES.ALL);
      assert.equal(actual.policyVersion, "exercise-similarity-v1");
      assert.equal(actual.thresholdVersion, "validation-thresholds-v1");
      assert.equal(actual.sample.status, SIMILARITY_RESULT_STATUSES.AVAILABLE);
      assert.equal(actual.sample.confidence, SIMILARITY_GOLD_STANDARD_CONFIDENCE.MEDIUM);
      assert.equal(actual.sample.source, SIMILARITY_GOLD_STANDARD_SOURCES.CATALOG);
      assert.ok(
        [
          SIMILARITY_VALIDATION_CATEGORIES.VERY_HIGH,
          SIMILARITY_VALIDATION_CATEGORIES.HIGH,
          SIMILARITY_VALIDATION_CATEGORIES.MEDIUM,
          SIMILARITY_VALIDATION_CATEGORIES.LOW,
          SIMILARITY_VALIDATION_CATEGORIES.VERY_LOW,
        ].includes(actual.sample.observedCategory)
      );
      assert.equal(actual.sample.dimensions.length, EXERCISE_SIMILARITY_CALIBRATION_DIMENSIONS.length);
      assert.ok(Array.isArray(actual.sample.reasons));
      assert.ok(Array.isArray(actual.sample.tags));
    },
  },
  {
    name: "11. report generation supports active-only and high-confidence-only filtering",
    input: { filters: Object.values(SIMILARITY_CALIBRATION_FILTER_MODES) },
    run: () => {
      const allReport = buildSimilarityCalibrationReportV1({
        filterMode: SIMILARITY_CALIBRATION_FILTER_MODES.ALL,
      });
      const activeReport = buildSimilarityCalibrationReportV1({
        filterMode: SIMILARITY_CALIBRATION_FILTER_MODES.ACTIVE_ONLY,
      });
      const highConfidenceReport = buildSimilarityCalibrationReportV1({
        filterMode: SIMILARITY_CALIBRATION_FILTER_MODES.HIGH_CONFIDENCE_ONLY,
      });

      return {
        allReport,
        activeReport,
        highConfidenceReport,
      };
    },
    assertResult: (actual) => {
      assert.equal(actual.allReport.filterMode, SIMILARITY_CALIBRATION_FILTER_MODES.ALL);
      assert.equal(actual.activeReport.filterMode, SIMILARITY_CALIBRATION_FILTER_MODES.ACTIVE_ONLY);
      assert.equal(
        actual.highConfidenceReport.filterMode,
        SIMILARITY_CALIBRATION_FILTER_MODES.HIGH_CONFIDENCE_ONLY
      );
      assert.ok(actual.allReport.summary.totalPairs > actual.activeReport.summary.totalPairs);
      assert.ok(actual.activeReport.summary.totalPairs > actual.highConfidenceReport.summary.totalPairs);
      assert.equal(actual.activeReport.coverage.inactivePairs, 0);
      assert.equal(actual.highConfidenceReport.coverage.inactivePairs, 0);
      assert.equal(actual.highConfidenceReport.coverage.confidenceCounts.MEDIUM, 0);
      assert.equal(actual.highConfidenceReport.coverage.confidenceCounts.LOW, 0);
    },
  },
  {
    name: "12. empty dataset is valid and reports zero counts cleanly",
    input: { pairs: 0 },
    run: () => {
      const dataset = buildBaseDataset();
      validateSimilarityGoldStandardDataset(dataset, resolveExerciseSimilarityCalibrationFixture);
      const run = runSimilarityCalibration({
        dataset,
        fixtureResolver: resolveExerciseSimilarityCalibrationFixture,
        compareExercises: compareExercisesV1,
      });
      const report = buildSimilarityCalibrationReport(run);
      return { run, report };
    },
    assertResult: (actual) => {
      assert.equal(actual.run.totalPairs, 0);
      assert.equal(actual.report.summary.totalPairs, 0);
      assert.equal(actual.report.summary.exactMatches, 0);
      assert.equal(actual.report.summary.mismatches, 0);
      assert.equal(actual.report.summary.matchRate, null);
    },
  },
  {
    name: "13. unavailable cases remain explicit and do not become hidden low scores",
    input: { pair: "Unknown Mobility Drill (Synthetic Partial) vs Crunch" },
    run: () => {
      const run = runSimilarityCalibration({
        dataset: {
          ...buildBaseDataset(),
          pairs: [
            buildPair({
              id: "pair-unavailable",
              exerciseA: "Unknown Mobility Drill (Synthetic Partial)",
              exerciseB: "Crunch",
              expectedCategory: "UNAVAILABLE",
              confidence: "LOW",
              source: "MIXED",
              activeForCalibration: true,
              rationale: "One fixture lacks all comparable DNA.",
              tags: ["mixed", "missing-dna"],
            }),
          ],
        },
        fixtureResolver: resolveExerciseSimilarityCalibrationFixture,
        compareExercises: compareExercisesV1,
      });
      return run.results[0];
    },
    assertResult: (actual) => {
      assert.equal(actual.status, SIMILARITY_RESULT_STATUSES.UNAVAILABLE);
      assert.equal(actual.score, null);
      assert.equal(actual.observedCategory, SIMILARITY_VALIDATION_CATEGORIES.UNAVAILABLE);
    },
  },
  {
    name: "14. calibration module stays backend-internal and does not import Prisma",
    input: { file: "calibration.js" },
    run: async () => readFile(new URL("./calibration.js", import.meta.url), "utf8"),
    assertResult: (actual) => {
      assert.equal(actual.includes("@prisma/client"), false);
      assert.equal(actual.includes("lib/prisma"), false);
    },
  },
  {
    name: "15. fixture registry coverage spans real catalog and synthetic calibration-only cases",
    input: { fixtures: "registry" },
    run: () => ({
      fixtureCount: EXERCISE_SIMILARITY_CALIBRATION_FIXTURE_COUNT,
      backSquat: resolveExerciseSimilarityCalibrationFixture("Back Squat").source,
      carry: resolveExerciseSimilarityCalibrationFixture("Farmer Carry (Synthetic)").source,
    }),
    assertResult: (actual) => {
      assert.ok(actual.fixtureCount >= 45);
      assert.equal(actual.backSquat, "catalog");
      assert.equal(actual.carry, "synthetic");
    },
  },
];

async function runCase(testCase) {
  try {
    const actual = await testCase.run(testCase.input);
    if (testCase.assertResult) {
      await testCase.assertResult(actual);
    }
    printCaseResult({ name: testCase.name, input: testCase.input, actual, status: "PASS" });
    return true;
  } catch (error) {
    if (testCase.assertError) {
      try {
        await testCase.assertError(error);
        printCaseResult({ name: testCase.name, input: testCase.input, error: error.message, status: "PASS" });
        return true;
      } catch (assertionError) {
        printCaseResult({
          name: testCase.name,
          input: testCase.input,
          error: `${error.message}\nAssertion failure: ${assertionError.message}`,
          status: "FAIL",
        });
        return false;
      }
    }

    printCaseResult({ name: testCase.name, input: testCase.input, error: error.message, status: "FAIL" });
    return false;
  }
}

const results = await Promise.all(cases.map(runCase));
const passed = results.filter(Boolean).length;
const failed = results.length - passed;

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${results.length} total`);

if (failed > 0) {
  process.exit(1);
}

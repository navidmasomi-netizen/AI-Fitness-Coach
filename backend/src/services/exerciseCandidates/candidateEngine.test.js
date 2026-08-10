import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildReplacementCandidatesV1,
  CANDIDATE_ELIGIBILITY_REASON_CODES,
  CANDIDATE_ELIGIBILITY_RULE_IDS,
  CANDIDATE_SIMILARITY_STATUSES,
  REPLACEMENT_CANDIDATE_ENGINE_V1_VERSION,
} from "./index.js";
import { compareExercisesV1, SIMILARITY_RESULT_STATUSES } from "../exerciseSimilarity/index.js";

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
    dnaMovementPattern: "squat",
    complexity: "compound",
    primaryMuscles: ["quadriceps", "glutes"],
    secondaryMuscles: ["hamstrings", "core"],
    requiredEquipment: ["barbell", "rack"],
    difficulty: "intermediate",
    stabilityDemand: "HIGH",
    axialLoading: "HIGH",
    catalogLifecycle: "ACTIVE",
    ...overrides,
  };
}

const cases = [
  {
    name: "1. eligible active exercise with complete DNA and available similarity passes all deterministic rules",
    input: { source: "Back Squat", candidate: "Front Squat" },
    run: () =>
      buildReplacementCandidatesV1(buildExercise(), [
        buildExercise({
          exerciseId: 52,
          slug: "front-squat",
          nameEn: "Front Squat",
          primaryMuscles: ["quadriceps"],
          secondaryMuscles: ["glutes", "core"],
        }),
      ]),
    assertResult: (actual) => {
      assert.equal(actual.version, REPLACEMENT_CANDIDATE_ENGINE_V1_VERSION);
      assert.equal(actual.totalEvaluated, 1);
      assert.equal(actual.eligibleCount, 1);
      assert.equal(actual.candidates[0].eligibility, true);
      assert.equal(actual.candidates[0].similarityStatus, SIMILARITY_RESULT_STATUSES.AVAILABLE);
      assert.deepEqual(actual.candidates[0].blockedRules, []);
      assert.deepEqual(actual.candidates[0].passedRules, [
        CANDIDATE_ELIGIBILITY_RULE_IDS.NOT_SOURCE_EXERCISE,
        CANDIDATE_ELIGIBILITY_RULE_IDS.ACTIVE_CATALOG_EXERCISE,
        CANDIDATE_ELIGIBILITY_RULE_IDS.COMPLETE_DNA,
        CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_EXERCISE_CLASS,
        CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_MOVEMENT_PATTERN,
        CANDIDATE_ELIGIBILITY_RULE_IDS.AVAILABLE_SIMILARITY,
      ]);
    },
  },
  {
    name: "2. source exercise identity is explicitly excluded from candidate eligibility",
    input: { source: "Back Squat", candidate: "Back Squat" },
    run: () => buildReplacementCandidatesV1(buildExercise(), [buildExercise()]),
    assertResult: (actual) => {
      assert.equal(actual.candidates[0].eligibility, false);
      assert.deepEqual(actual.candidates[0].blockedRules, [CANDIDATE_ELIGIBILITY_RULE_IDS.NOT_SOURCE_EXERCISE]);
      assert.equal(actual.candidates[0].reasons[0].code, CANDIDATE_ELIGIBILITY_REASON_CODES.SOURCE_EXERCISE_EXCLUDED);
      assert.equal(actual.candidates[0].similarityStatus, CANDIDATE_SIMILARITY_STATUSES.NOT_EVALUATED);
    },
  },
  {
    name: "3. draft exercises are rejected before ranking and remain explainable",
    input: { lifecycle: "DRAFT" },
    run: () =>
      buildReplacementCandidatesV1(buildExercise(), [
        buildExercise({
          exerciseId: 24,
          slug: "leg-press",
          nameEn: "Leg Press",
          requiredEquipment: ["leg_press_machine"],
          stabilityDemand: "LOW",
          axialLoading: "LOW",
          catalogLifecycle: "DRAFT",
        }),
      ]),
    assertResult: (actual) => {
      assert.equal(actual.eligibleCount, 0);
      assert.equal(actual.candidates[0].eligibility, false);
      assert.ok(actual.candidates[0].blockedRules.includes(CANDIDATE_ELIGIBILITY_RULE_IDS.ACTIVE_CATALOG_EXERCISE));
      assert.equal(
        actual.candidates[0].reasons.find((reason) => reason.ruleId === CANDIDATE_ELIGIBILITY_RULE_IDS.ACTIVE_CATALOG_EXERCISE).code,
        CANDIDATE_ELIGIBILITY_REASON_CODES.INACTIVE_CATALOG_EXERCISE
      );
    },
  },
  {
    name: "4. deprecated exercises are rejected as inactive catalog entries",
    input: { lifecycle: "DEPRECATED" },
    run: () =>
      buildReplacementCandidatesV1(buildExercise(), [
        buildExercise({
          exerciseId: 25,
          slug: "deprecated-row",
          nameEn: "Deprecated Row",
          dnaMovementPattern: "horizontal_pull",
          primaryMuscles: ["back"],
          secondaryMuscles: ["biceps"],
          requiredEquipment: ["barbell"],
          stabilityDemand: "HIGH",
          axialLoading: "HIGH",
          catalogLifecycle: "DEPRECATED",
        }),
      ]),
    assertResult: (actual) => {
      assert.equal(actual.candidates[0].eligibility, false);
      assert.ok(actual.candidates[0].blockedRules.includes(CANDIDATE_ELIGIBILITY_RULE_IDS.ACTIVE_CATALOG_EXERCISE));
    },
  },
  {
    name: "5. unresolved DNA blocks candidate eligibility and skips similarity when deterministic gates already fail",
    input: { missingFacts: ["requiredEquipment", "stabilityDemand", "axialLoading"] },
    run: () =>
      buildReplacementCandidatesV1(buildExercise(), [
        buildExercise({
          exerciseId: 18,
          slug: "dumbbell-row",
          nameEn: "Dumbbell Row",
          dnaMovementPattern: "horizontal_pull",
          primaryMuscles: ["back"],
          secondaryMuscles: ["biceps", "lower_back"],
          requiredEquipment: [],
          stabilityDemand: null,
          axialLoading: null,
          catalogLifecycle: "CURATED",
        }),
      ]),
    assertResult: (actual) => {
      assert.equal(actual.candidates[0].eligibility, false);
      assert.ok(actual.candidates[0].blockedRules.includes(CANDIDATE_ELIGIBILITY_RULE_IDS.COMPLETE_DNA));
      assert.ok(actual.candidates[0].blockedRules.includes(CANDIDATE_ELIGIBILITY_RULE_IDS.ACTIVE_CATALOG_EXERCISE));
      assert.ok(actual.candidates[0].blockedRules.includes(CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_MOVEMENT_PATTERN));
      assert.equal(actual.candidates[0].similarityStatus, CANDIDATE_SIMILARITY_STATUSES.NOT_EVALUATED);
      assert.equal(actual.candidates[0].similarityScore, null);
      assert.deepEqual(actual.candidates[0].similarityBreakdown, []);
      assert.equal(
        actual.candidates[0].reasons.find((reason) => reason.ruleId === CANDIDATE_ELIGIBILITY_RULE_IDS.AVAILABLE_SIMILARITY)
          .code,
        CANDIDATE_ELIGIBILITY_REASON_CODES.SIMILARITY_NOT_EVALUATED
      );
      assert.deepEqual(
        actual.candidates[0].reasons.find((reason) => reason.ruleId === CANDIDATE_ELIGIBILITY_RULE_IDS.COMPLETE_DNA).data
          .missingFacts,
        ["requiredEquipment", "stabilityDemand", "axialLoading"]
      );
    },
  },
  {
    name: "6. unavailable similarity blocks eligibility without fabricating a score",
    input: { sourceMissing: "all similarity dimensions" },
    run: () =>
      buildReplacementCandidatesV1(
        buildExercise({
          slug: "weighted-pull-up",
          dnaMovementPattern: null,
          complexity: null,
          primaryMuscles: [],
          secondaryMuscles: [],
          requiredEquipment: [],
          stabilityDemand: null,
          axialLoading: null,
        }),
        [
          buildExercise({
            exerciseId: 29,
            slug: "pull-up",
            nameEn: "Pull-Up",
            dnaMovementPattern: "vertical_pull",
            primaryMuscles: ["back"],
            secondaryMuscles: ["biceps", "core"],
            requiredEquipment: ["pull_up_bar"],
            stabilityDemand: "MODERATE",
            axialLoading: "LOW",
          }),
        ]
      ),
    assertResult: (actual) => {
      assert.equal(actual.candidates[0].eligibility, false);
      assert.equal(actual.candidates[0].similarityStatus, CANDIDATE_SIMILARITY_STATUSES.NOT_EVALUATED);
      assert.equal(actual.candidates[0].similarityScore, null);
      assert.ok(actual.candidates[0].blockedRules.includes(CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_EXERCISE_CLASS));
      assert.ok(actual.candidates[0].blockedRules.includes(CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_MOVEMENT_PATTERN));
      assert.equal(
        actual.candidates[0].reasons.find((reason) => reason.ruleId === CANDIDATE_ELIGIBILITY_RULE_IDS.AVAILABLE_SIMILARITY)
          .code,
        CANDIDATE_ELIGIBILITY_REASON_CODES.SIMILARITY_NOT_EVALUATED
      );
    },
  },
  {
    name: "7. bench press to dumbbell bench press remains eligible despite equipment differences because class and movement match",
    input: { source: "Bench Press", candidate: "Dumbbell Bench Press" },
    run: () =>
      buildReplacementCandidatesV1(buildExercise(), [
        buildExercise({
          exerciseId: 33,
          slug: "dumbbell-bench-press",
          nameEn: "Dumbbell Bench Press",
          dnaMovementPattern: "squat",
          primaryMuscles: ["quadriceps"],
          secondaryMuscles: ["glutes", "core"],
          requiredEquipment: ["dumbbell", "bench"],
          stabilityDemand: "HIGH",
          axialLoading: "HIGH",
        }),
      ]),
    assertResult: (actual) => {
      assert.equal(actual.candidates[0].eligibility, true);
      assert.equal(actual.candidates[0].similarityStatus, SIMILARITY_RESULT_STATUSES.AVAILABLE);
      assert.ok(actual.candidates[0].passedRules.includes(CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_EXERCISE_CLASS));
      assert.ok(actual.candidates[0].passedRules.includes(CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_MOVEMENT_PATTERN));
    },
  },
  {
    name: "8. unrelated exercise with available score 0 still does not become eligible because deterministic gates fail first",
    input: { source: "Back Squat", candidate: "Machine Leg Curl" },
    run: () => {
      let compareCalls = 0;
      const source = buildExercise();
      const catalog = [
        buildExercise({
          exerciseId: 49,
          slug: "machine-leg-curl",
          nameEn: "Machine Leg Curl",
          dnaMovementPattern: "knee_flexion",
          complexity: "isolation",
          primaryMuscles: ["hamstrings"],
          secondaryMuscles: [],
          requiredEquipment: ["selectorized_machine"],
          stabilityDemand: "LOW",
          axialLoading: "NONE",
        }),
      ];
      const result = buildReplacementCandidatesV1(source, catalog, {
        compareExercises: (...args) => {
          compareCalls += 1;
          return compareExercisesV1(...args);
        },
      });
      return { result, compareCalls };
    },
    assertResult: (actual) => {
      assert.equal(actual.compareCalls, 0);
      assert.equal(actual.result.candidates[0].eligibility, false);
      assert.equal(actual.result.candidates[0].similarityStatus, CANDIDATE_SIMILARITY_STATUSES.NOT_EVALUATED);
      assert.ok(actual.result.candidates[0].blockedRules.includes(CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_EXERCISE_CLASS));
      assert.ok(actual.result.candidates[0].blockedRules.includes(CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_MOVEMENT_PATTERN));
    },
  },
  {
    name: "9. candidate output is deterministic and preserves unsorted input order without ranking",
    input: { order: ["Machine Leg Curl", "Front Squat"] },
    run: () => {
      const source = buildExercise();
      const catalog = [
        buildExercise({
          exerciseId: 49,
          slug: "machine-leg-curl",
          nameEn: "Machine Leg Curl",
          dnaMovementPattern: "knee_flexion",
          complexity: "isolation",
          primaryMuscles: ["hamstrings"],
          secondaryMuscles: [],
          requiredEquipment: ["selectorized_machine"],
          stabilityDemand: "LOW",
          axialLoading: "NONE",
        }),
        buildExercise({
          exerciseId: 52,
          slug: "front-squat",
          nameEn: "Front Squat",
          primaryMuscles: ["quadriceps"],
          secondaryMuscles: ["glutes", "core"],
        }),
      ];
      return {
        first: buildReplacementCandidatesV1(source, catalog),
        second: buildReplacementCandidatesV1(source, catalog),
      };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.first, actual.second);
      assert.deepEqual(
        actual.first.candidates.map((candidate) => candidate.exerciseId),
        [49, 52]
      );
      assert.equal(actual.first.eligibleCount, 1);
      assert.equal(actual.first.candidates[0].eligibility, false);
      assert.equal(actual.first.candidates[0].similarityStatus, CANDIDATE_SIMILARITY_STATUSES.NOT_EVALUATED);
      assert.equal(actual.first.candidates[1].eligibility, true);
    },
  },
  {
    name: "10. vertical pull to horizontal pull is blocked in candidate v1 even when broad back overlap exists",
    input: { source: "Pull-Up", candidate: "Barbell Row" },
    run: () =>
      buildReplacementCandidatesV1(
        buildExercise({
          exerciseId: 29,
          slug: "pull-up",
          nameEn: "Pull-Up",
          dnaMovementPattern: "vertical_pull",
          primaryMuscles: ["back"],
          secondaryMuscles: ["biceps", "core"],
          requiredEquipment: ["pull_up_bar"],
          stabilityDemand: "MODERATE",
          axialLoading: "LOW",
        }),
        [
          buildExercise({
            exerciseId: 17,
            slug: "barbell-row",
            nameEn: "Barbell Row",
            dnaMovementPattern: "horizontal_pull",
            primaryMuscles: ["back"],
            secondaryMuscles: ["biceps", "lower_back"],
            requiredEquipment: ["barbell"],
            stabilityDemand: "HIGH",
            axialLoading: "HIGH",
          }),
        ]
      ),
    assertResult: (actual) => {
      assert.equal(actual.candidates[0].eligibility, false);
      assert.ok(actual.candidates[0].blockedRules.includes(CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_MOVEMENT_PATTERN));
      assert.equal(actual.candidates[0].similarityStatus, CANDIDATE_SIMILARITY_STATUSES.NOT_EVALUATED);
    },
  },
  {
    name: "11. same class and movement with available score 0 remains eligible because no similarity threshold exists",
    input: { source: "Synthetic Squat A", candidate: "Synthetic Squat B" },
    run: () => {
      const source = buildExercise();
      const candidate = buildExercise({
        exerciseId: 60,
        slug: "synthetic-squat-b",
        nameEn: "Synthetic Squat B",
      });
      return buildReplacementCandidatesV1(source, [candidate], {
        compareExercises: () => ({
          status: SIMILARITY_RESULT_STATUSES.AVAILABLE,
          score: 0,
          dimensions: [],
          reasons: [],
        }),
      });
    },
    assertResult: (actual) => {
      assert.equal(actual.candidates[0].eligibility, true);
      assert.equal(actual.candidates[0].similarityScore, 0);
      assert.equal(actual.candidates[0].similarityStatus, SIMILARITY_RESULT_STATUSES.AVAILABLE);
    },
  },
  {
    name: "12. output remains explainable with the new rule outcomes and skipped similarity semantics",
    input: { source: "Back Squat", candidate: "Leg Extension" },
    run: () =>
      buildReplacementCandidatesV1(buildExercise(), [
        buildExercise({
          exerciseId: 61,
          slug: "leg-extension-synthetic",
          nameEn: "Leg Extension (Synthetic)",
          dnaMovementPattern: "knee_extension",
          complexity: "isolation",
          primaryMuscles: ["quadriceps"],
          secondaryMuscles: [],
          requiredEquipment: ["selectorized_machine"],
          stabilityDemand: "LOW",
          axialLoading: "NONE",
        }),
      ]),
    assertResult: (actual) => {
      assert.ok(Array.isArray(actual.candidates[0].passedRules));
      assert.ok(Array.isArray(actual.candidates[0].blockedRules));
      assert.deepEqual(
        actual.candidates[0].reasons.map((reason) => reason.ruleId),
        [
          CANDIDATE_ELIGIBILITY_RULE_IDS.NOT_SOURCE_EXERCISE,
          CANDIDATE_ELIGIBILITY_RULE_IDS.ACTIVE_CATALOG_EXERCISE,
          CANDIDATE_ELIGIBILITY_RULE_IDS.COMPLETE_DNA,
          CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_EXERCISE_CLASS,
          CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_MOVEMENT_PATTERN,
          CANDIDATE_ELIGIBILITY_RULE_IDS.AVAILABLE_SIMILARITY,
        ]
      );
      assert.equal(
        actual.candidates[0].reasons.find((reason) => reason.ruleId === CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_EXERCISE_CLASS).code,
        CANDIDATE_ELIGIBILITY_REASON_CODES.DIFFERENT_EXERCISE_CLASS
      );
      assert.equal(
        actual.candidates[0].reasons.find((reason) => reason.ruleId === CANDIDATE_ELIGIBILITY_RULE_IDS.SAME_MOVEMENT_PATTERN).code,
        CANDIDATE_ELIGIBILITY_REASON_CODES.DIFFERENT_MOVEMENT_PATTERN
      );
      assert.equal(
        actual.candidates[0].reasons.find((reason) => reason.ruleId === CANDIDATE_ELIGIBILITY_RULE_IDS.AVAILABLE_SIMILARITY).status,
        "SKIPPED"
      );
    },
  },
  {
    name: "13. candidate engine stays pure and does not import Prisma or similarity comparator internals",
    input: { file: "candidate engine module" },
    run: async () => readFile(new URL("./index.js", import.meta.url), "utf8"),
    assertResult: (actual) => {
      assert.equal(actual.includes("@prisma/client"), false);
      assert.equal(actual.includes("lib/prisma"), false);
      assert.equal(actual.includes("MUSCLE_COMPARATOR_V1"), false);
      assert.equal(actual.includes("DEFAULT_EXERCISE_SIMILARITY_COMPARATORS_V1"), false);
    },
  },
  {
    name: "14. candidate engine treats similarity as a black box and preserves direct engine output",
    input: { pair: "Back Squat vs Front Squat" },
    run: () => {
      const source = buildExercise();
      const candidate = buildExercise({
        exerciseId: 52,
        slug: "front-squat",
        nameEn: "Front Squat",
        primaryMuscles: ["quadriceps"],
        secondaryMuscles: ["glutes", "core"],
      });
      const directSimilarity = compareExercisesV1(source, candidate);
      const engineResult = buildReplacementCandidatesV1(source, [candidate]);
      return {
        directSimilarity,
        candidate: engineResult.candidates[0],
      };
    },
    assertResult: (actual) => {
      assert.equal(actual.candidate.similarityScore, actual.directSimilarity.score);
      assert.deepEqual(actual.candidate.similarityBreakdown, actual.directSimilarity.dimensions);
      assert.equal(actual.candidate.similarityStatus, actual.directSimilarity.status);
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

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildExerciseSimilarityProfile,
  compareExerciseProfiles,
  DEFERRED_SIMILARITY_DIMENSIONS,
  EXERCISE_SIMILARITY_POLICY_VERSION,
  SIMILARITY_DIMENSIONS,
  SIMILARITY_REASON_CODES,
  SIMILARITY_RESULT_STATUSES,
  validateComparatorResult,
  validateSimilarityPolicy,
} from "./index.js";

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

const TEST_POLICY_V1 = Object.freeze({
  version: `${EXERCISE_SIMILARITY_POLICY_VERSION}_test_only`,
  enabledDimensions: [
    SIMILARITY_DIMENSIONS.MOVEMENT,
    SIMILARITY_DIMENSIONS.MUSCLE,
    SIMILARITY_DIMENSIONS.EQUIPMENT,
    SIMILARITY_DIMENSIONS.DEMAND,
  ],
  weights: Object.freeze({
    movement: 4,
    muscle: 3,
    equipment: 2,
    demand: 1,
  }),
});

function buildBaseExercise(overrides = {}) {
  return {
    exerciseId: 13,
    slug: "back-squat",
    dnaMovementPattern: "squat",
    complexity: "compound",
    primaryMuscles: ["glutes", "quadriceps"],
    secondaryMuscles: ["core", "hamstrings"],
    requiredEquipment: ["barbell", "rack"],
    difficulty: "intermediate",
    stabilityDemand: "HIGH",
    axialLoading: "HIGH",
    ...overrides,
  };
}

function buildStubComparators(overrides = {}) {
  return [
    {
      dimension: SIMILARITY_DIMENSIONS.MOVEMENT,
      compare: () => ({
        dimension: SIMILARITY_DIMENSIONS.MOVEMENT,
        status: SIMILARITY_RESULT_STATUSES.AVAILABLE,
        score: 1,
        reasons: [
          {
            code: SIMILARITY_REASON_CODES.MOVEMENT.SAME_MOVEMENT_PATTERN,
            data: { pattern: "squat" },
          },
        ],
      }),
    },
    {
      dimension: SIMILARITY_DIMENSIONS.MUSCLE,
      compare: () => ({
        dimension: SIMILARITY_DIMENSIONS.MUSCLE,
        status: SIMILARITY_RESULT_STATUSES.AVAILABLE,
        score: 0.75,
        reasons: [
          {
            code: SIMILARITY_REASON_CODES.MUSCLE.PRIMARY_MUSCLE_OVERLAP,
            data: { primaryOverlapCount: 2 },
          },
        ],
      }),
    },
    {
      dimension: SIMILARITY_DIMENSIONS.EQUIPMENT,
      compare: () => ({
        dimension: SIMILARITY_DIMENSIONS.EQUIPMENT,
        status: SIMILARITY_RESULT_STATUSES.AVAILABLE,
        score: 0.5,
        reasons: [
          {
            code: SIMILARITY_REASON_CODES.EQUIPMENT.PARTIAL_REQUIRED_EQUIPMENT_OVERLAP,
            data: { sharedEquipment: ["barbell"] },
          },
        ],
      }),
    },
    {
      dimension: SIMILARITY_DIMENSIONS.DEMAND,
      compare: () => ({
        dimension: SIMILARITY_DIMENSIONS.DEMAND,
        status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
        score: null,
        reasons: [
          {
            code: SIMILARITY_REASON_CODES.DEMAND.MISSING_DEMAND_METADATA,
            data: { missingFacts: ["stabilityDemand"] },
          },
        ],
      }),
    },
  ].map((comparator) => overrides[comparator.dimension] ?? comparator);
}

const cases = [
  {
    name: "1. repository conventions remain plain JavaScript ESM and deferred execution stays explicit",
    input: { moduleBoundary: "backend/src/services/exerciseSimilarity/index.js" },
    run: () => ({
      deferredDimensions: DEFERRED_SIMILARITY_DIMENSIONS,
      moduleType: "ESM",
    }),
    assertResult: (actual) => {
      assert.deepEqual(actual.deferredDimensions, ["execution"]);
      assert.equal(actual.moduleType, "ESM");
    },
  },
  {
    name: "2. normalized profile contains only approved intrinsic facts and excludes user or workout fields",
    input: {
      extraFields: ["userId", "programId", "equipmentAccess", "trainingStateSignals"],
    },
    run: ({ extraFields }) => {
      const profile = buildExerciseSimilarityProfile({
        ...buildBaseExercise(),
        userId: 7,
        programId: 99,
        equipmentAccess: ["barbell"],
        trainingStateSignals: { fatigue: {} },
      });

      return {
        keys: Object.keys(profile).sort(),
        missingFacts: profile.missingFacts,
        forbiddenIncluded: extraFields.filter((field) => Object.prototype.hasOwnProperty.call(profile, field)),
      };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.keys, [
        "axialLoading",
        "complexity",
        "difficulty",
        "dnaMovementPattern",
        "exerciseId",
        "missingFacts",
        "primaryMuscles",
        "requiredEquipment",
        "secondaryMuscles",
        "slug",
        "stabilityDemand",
        "version",
      ]);
      assert.deepEqual(actual.missingFacts, []);
      assert.deepEqual(actual.forbiddenIncluded, []);
    },
  },
  {
    name: "3. missing DNA is represented explicitly without fabrication",
    input: { partialExercise: "Weighted Pull-Up style partial DNA" },
    run: () =>
      buildExerciseSimilarityProfile(
        buildBaseExercise({
          slug: "weighted-pull-up",
          dnaMovementPattern: "vertical_pull",
          requiredEquipment: [],
          stabilityDemand: null,
          axialLoading: null,
        })
      ),
    assertResult: (actual) => {
      assert.deepEqual(actual.missingFacts, ["requiredEquipment", "stabilityDemand", "axialLoading"]);
      assert.deepEqual(actual.requiredEquipment, []);
      assert.equal(actual.stabilityDemand, null);
      assert.equal(actual.axialLoading, null);
    },
  },
  {
    name: "4. comparator result enforces score bounds and machine-readable reasons",
    input: { invalidScore: 1.5 },
    run: ({ invalidScore }) =>
      validateComparatorResult({
        dimension: SIMILARITY_DIMENSIONS.MOVEMENT,
        status: SIMILARITY_RESULT_STATUSES.AVAILABLE,
        score: invalidScore,
        reasons: [{ code: SIMILARITY_REASON_CODES.MOVEMENT.SAME_MOVEMENT_PATTERN }],
      }),
    assertError: (error) => {
      assert.match(error.message, /between 0 and 1/);
    },
  },
  {
    name: "5. unavailable dimension requires null score instead of a hidden neutral default",
    input: { status: "UNAVAILABLE", score: 0 },
    run: ({ status, score }) =>
      validateComparatorResult({
        dimension: SIMILARITY_DIMENSIONS.DEMAND,
        status,
        score,
        reasons: [{ code: SIMILARITY_REASON_CODES.DEMAND.MISSING_DEMAND_METADATA }],
      }),
    assertError: (error) => {
      assert.match(error.message, /must be null when the dimension is unavailable/);
    },
  },
  {
    name: "6. invalid policy weights fail loudly and do not decide product weights",
    input: { invalidWeight: 0 },
    run: ({ invalidWeight }) =>
      validateSimilarityPolicy({
        ...TEST_POLICY_V1,
        weights: {
          ...TEST_POLICY_V1.weights,
          movement: invalidWeight,
        },
      }),
    assertError: (error) => {
      assert.match(error.message, /must be a positive finite number/);
    },
  },
  {
    name: "7. engine preserves dimension breakdown and weighted aggregate with test-only policy",
    input: { policy: "test-only" },
    run: () =>
      compareExerciseProfiles(
        buildBaseExercise(),
        buildBaseExercise({ exerciseId: 51, slug: "front-squat" }),
        TEST_POLICY_V1,
        buildStubComparators()
      ),
    assertResult: (actual) => {
      assert.equal(actual.policyVersion, `${EXERCISE_SIMILARITY_POLICY_VERSION}_test_only`);
      assert.equal(actual.status, SIMILARITY_RESULT_STATUSES.AVAILABLE);
      assert.equal(actual.score, 0.8056);
      assert.deepEqual(
        actual.dimensions.map((dimension) => dimension.dimension),
        ["movement", "muscle", "equipment", "demand"]
      );
      assert.equal(actual.dimensions[3].status, SIMILARITY_RESULT_STATUSES.UNAVAILABLE);
      assert.ok(Array.isArray(actual.reasons));
      assert.ok(actual.reasons.every((reason) => typeof reason.code === "string"));
    },
  },
  {
    name: "8. one unavailable dimension is excluded from normalization",
    input: { unavailableDimensions: ["demand"] },
    run: () =>
      compareExerciseProfiles(
        buildBaseExercise(),
        buildBaseExercise({ exerciseId: 51, slug: "front-squat" }),
        TEST_POLICY_V1,
        buildStubComparators()
      ),
    assertResult: (actual) => {
      assert.equal(actual.score, 0.8056);
      assert.equal(actual.dimensions[3].status, SIMILARITY_RESULT_STATUSES.UNAVAILABLE);
    },
  },
  {
    name: "9. multiple unavailable dimensions are excluded from normalization the same way",
    input: { unavailableDimensions: ["equipment", "demand"] },
    run: () =>
      compareExerciseProfiles(
        buildBaseExercise(),
        buildBaseExercise({ exerciseId: 51, slug: "front-squat" }),
        TEST_POLICY_V1,
        buildStubComparators({
          equipment: {
            dimension: SIMILARITY_DIMENSIONS.EQUIPMENT,
            compare: () => ({
              dimension: SIMILARITY_DIMENSIONS.EQUIPMENT,
              status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
              score: null,
              reasons: [
                {
                  code: SIMILARITY_REASON_CODES.EQUIPMENT.MISSING_REQUIRED_EQUIPMENT,
                  data: { missingFacts: ["requiredEquipment"] },
                },
              ],
            }),
          },
        })
      ),
    assertResult: (actual) => {
      assert.equal(actual.status, SIMILARITY_RESULT_STATUSES.AVAILABLE);
      assert.equal(actual.score, 0.8929);
      assert.equal(actual.dimensions[2].status, SIMILARITY_RESULT_STATUSES.UNAVAILABLE);
      assert.equal(actual.dimensions[3].status, SIMILARITY_RESULT_STATUSES.UNAVAILABLE);
    },
  },
  {
    name: "10. all unavailable dimensions return overall unavailable and engine reason code",
    input: { unavailableDimensions: ["movement", "muscle", "equipment", "demand"] },
    run: () =>
      compareExerciseProfiles(
        buildBaseExercise(),
        buildBaseExercise({ exerciseId: 51, slug: "front-squat" }),
        TEST_POLICY_V1,
        buildStubComparators({
          movement: {
            dimension: SIMILARITY_DIMENSIONS.MOVEMENT,
            compare: () => ({
              dimension: SIMILARITY_DIMENSIONS.MOVEMENT,
              status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
              score: null,
              reasons: [
                {
                  code: SIMILARITY_REASON_CODES.MOVEMENT.MISSING_DNA_MOVEMENT_PATTERN,
                  data: { missingFacts: ["dnaMovementPattern"] },
                },
              ],
            }),
          },
          muscle: {
            dimension: SIMILARITY_DIMENSIONS.MUSCLE,
            compare: () => ({
              dimension: SIMILARITY_DIMENSIONS.MUSCLE,
              status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
              score: null,
              reasons: [
                {
                  code: SIMILARITY_REASON_CODES.MUSCLE.MISSING_MUSCLE_METADATA,
                  data: { missingFacts: ["primaryMuscles"] },
                },
              ],
            }),
          },
          equipment: {
            dimension: SIMILARITY_DIMENSIONS.EQUIPMENT,
            compare: () => ({
              dimension: SIMILARITY_DIMENSIONS.EQUIPMENT,
              status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
              score: null,
              reasons: [
                {
                  code: SIMILARITY_REASON_CODES.EQUIPMENT.MISSING_REQUIRED_EQUIPMENT,
                  data: { missingFacts: ["requiredEquipment"] },
                },
              ],
            }),
          },
        })
      ),
    assertResult: (actual) => {
      assert.equal(actual.status, SIMILARITY_RESULT_STATUSES.UNAVAILABLE);
      assert.equal(actual.score, null);
      assert.equal(actual.dimensions.length, 4);
      assert.ok(actual.dimensions.every((dimension) => dimension.status === SIMILARITY_RESULT_STATUSES.UNAVAILABLE));
      assert.deepEqual(actual.reasons, [
        {
          code: SIMILARITY_REASON_CODES.ENGINE.NO_AVAILABLE_DIMENSIONS,
          data: {
            enabledDimensions: ["movement", "muscle", "equipment", "demand"],
          },
        },
      ]);
    },
  },
  {
    name: "11. an available zero score remains a real zero and is not treated as unavailable",
    input: { zeroScore: true },
    run: () =>
      compareExerciseProfiles(
        buildBaseExercise(),
        buildBaseExercise({ exerciseId: 51, slug: "front-squat" }),
        TEST_POLICY_V1,
        buildStubComparators({
          movement: {
            dimension: SIMILARITY_DIMENSIONS.MOVEMENT,
            compare: () => ({
              dimension: SIMILARITY_DIMENSIONS.MOVEMENT,
              status: SIMILARITY_RESULT_STATUSES.AVAILABLE,
              score: 0,
              reasons: [
                {
                  code: SIMILARITY_REASON_CODES.MOVEMENT.DIFFERENT_MOVEMENT_PATTERN,
                  data: { left: "squat", right: "hinge" },
                },
              ],
            }),
          },
          muscle: {
            dimension: SIMILARITY_DIMENSIONS.MUSCLE,
            compare: () => ({
              dimension: SIMILARITY_DIMENSIONS.MUSCLE,
              status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
              score: null,
              reasons: [
                {
                  code: SIMILARITY_REASON_CODES.MUSCLE.MISSING_MUSCLE_METADATA,
                  data: { missingFacts: ["primaryMuscles"] },
                },
              ],
            }),
          },
          equipment: {
            dimension: SIMILARITY_DIMENSIONS.EQUIPMENT,
            compare: () => ({
              dimension: SIMILARITY_DIMENSIONS.EQUIPMENT,
              status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
              score: null,
              reasons: [
                {
                  code: SIMILARITY_REASON_CODES.EQUIPMENT.MISSING_REQUIRED_EQUIPMENT,
                  data: { missingFacts: ["requiredEquipment"] },
                },
              ],
            }),
          },
          demand: {
            dimension: SIMILARITY_DIMENSIONS.DEMAND,
            compare: () => ({
              dimension: SIMILARITY_DIMENSIONS.DEMAND,
              status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
              score: null,
              reasons: [
                {
                  code: SIMILARITY_REASON_CODES.DEMAND.MISSING_DEMAND_METADATA,
                  data: { missingFacts: ["stabilityDemand"] },
                },
              ],
            }),
          },
        })
      ),
    assertResult: (actual) => {
      assert.equal(actual.status, SIMILARITY_RESULT_STATUSES.AVAILABLE);
      assert.equal(actual.score, 0);
      assert.equal(actual.dimensions[0].status, SIMILARITY_RESULT_STATUSES.AVAILABLE);
      assert.equal(actual.dimensions[0].score, 0);
    },
  },
  {
    name: "12. an available one score remains a real one",
    input: { oneScore: true },
    run: () =>
      compareExerciseProfiles(
        buildBaseExercise(),
        buildBaseExercise({ exerciseId: 51, slug: "front-squat" }),
        TEST_POLICY_V1,
        buildStubComparators({
          movement: {
            dimension: SIMILARITY_DIMENSIONS.MOVEMENT,
            compare: () => ({
              dimension: SIMILARITY_DIMENSIONS.MOVEMENT,
              status: SIMILARITY_RESULT_STATUSES.AVAILABLE,
              score: 1,
              reasons: [
                {
                  code: SIMILARITY_REASON_CODES.MOVEMENT.SAME_MOVEMENT_PATTERN,
                  data: { pattern: "squat" },
                },
              ],
            }),
          },
          muscle: {
            dimension: SIMILARITY_DIMENSIONS.MUSCLE,
            compare: () => ({
              dimension: SIMILARITY_DIMENSIONS.MUSCLE,
              status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
              score: null,
              reasons: [
                {
                  code: SIMILARITY_REASON_CODES.MUSCLE.MISSING_MUSCLE_METADATA,
                  data: { missingFacts: ["primaryMuscles"] },
                },
              ],
            }),
          },
          equipment: {
            dimension: SIMILARITY_DIMENSIONS.EQUIPMENT,
            compare: () => ({
              dimension: SIMILARITY_DIMENSIONS.EQUIPMENT,
              status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
              score: null,
              reasons: [
                {
                  code: SIMILARITY_REASON_CODES.EQUIPMENT.MISSING_REQUIRED_EQUIPMENT,
                  data: { missingFacts: ["requiredEquipment"] },
                },
              ],
            }),
          },
          demand: {
            dimension: SIMILARITY_DIMENSIONS.DEMAND,
            compare: () => ({
              dimension: SIMILARITY_DIMENSIONS.DEMAND,
              status: SIMILARITY_RESULT_STATUSES.UNAVAILABLE,
              score: null,
              reasons: [
                {
                  code: SIMILARITY_REASON_CODES.DEMAND.MISSING_DEMAND_METADATA,
                  data: { missingFacts: ["stabilityDemand"] },
                },
              ],
            }),
          },
        })
      ),
    assertResult: (actual) => {
      assert.equal(actual.status, SIMILARITY_RESULT_STATUSES.AVAILABLE);
      assert.equal(actual.score, 1);
      assert.equal(actual.dimensions[0].status, SIMILARITY_RESULT_STATUSES.AVAILABLE);
      assert.equal(actual.dimensions[0].score, 1);
    },
  },
  {
    name: "13. engine is symmetric by contract with symmetric comparators",
    input: { directionA: "A->B", directionB: "B->A" },
    run: () => {
      const profileA = buildBaseExercise();
      const profileB = buildBaseExercise({ exerciseId: 24, slug: "leg-press", dnaMovementPattern: "squat" });
      const comparators = buildStubComparators();

      return {
        forward: compareExerciseProfiles(profileA, profileB, TEST_POLICY_V1, comparators),
        reverse: compareExerciseProfiles(profileB, profileA, TEST_POLICY_V1, comparators),
      };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.forward, actual.reverse);
    },
  },
  {
    name: "14. engine is deterministic for identical inputs and policy",
    input: { repeatCount: 2 },
    run: () => {
      const profileA = buildBaseExercise();
      const profileB = buildBaseExercise({ exerciseId: 24, slug: "leg-press", dnaMovementPattern: "squat" });
      const comparators = buildStubComparators();

      return {
        first: compareExerciseProfiles(profileA, profileB, TEST_POLICY_V1, comparators),
        second: compareExerciseProfiles(profileA, profileB, TEST_POLICY_V1, comparators),
      };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.first, actual.second);
    },
  },
  {
    name: "15. inputs and policy are not mutated",
    input: { immutability: true },
    run: () => {
      const rawA = buildBaseExercise();
      const rawB = buildBaseExercise({ exerciseId: 24, slug: "leg-press", dnaMovementPattern: "squat" });
      const policy = {
        version: TEST_POLICY_V1.version,
        enabledDimensions: [...TEST_POLICY_V1.enabledDimensions],
        weights: { ...TEST_POLICY_V1.weights },
      };
      const before = JSON.stringify({ rawA, rawB, policy });

      compareExerciseProfiles(rawA, rawB, policy, buildStubComparators());

      return {
        before,
        after: JSON.stringify({ rawA, rawB, policy }),
      };
    },
    assertResult: (actual) => {
      assert.equal(actual.after, actual.before);
    },
  },
  {
    name: "16. engine fails loudly on invalid comparator dimension mismatch",
    input: { mismatchedDimension: true },
    run: () =>
      compareExerciseProfiles(
        buildBaseExercise(),
        buildBaseExercise({ exerciseId: 24, slug: "leg-press", dnaMovementPattern: "squat" }),
        TEST_POLICY_V1,
        buildStubComparators({
          movement: {
            dimension: SIMILARITY_DIMENSIONS.MOVEMENT,
            compare: () => ({
              dimension: SIMILARITY_DIMENSIONS.MUSCLE,
              status: SIMILARITY_RESULT_STATUSES.AVAILABLE,
              score: 1,
              reasons: [{ code: SIMILARITY_REASON_CODES.MUSCLE.PRIMARY_MUSCLE_OVERLAP }],
            }),
          },
        })
      ),
    assertError: (error) => {
      assert.match(error.message, /mismatched dimension result/);
    },
  },
  {
    name: "17. module stays backend-internal and imports no Prisma dependency",
    input: { file: "backend/src/services/exerciseSimilarity/index.js" },
    run: async ({ file }) => {
      const source = await readFile(new URL("./index.js", import.meta.url), "utf8");
      return {
        hasPrismaClientImport: source.includes("@prisma/client"),
        hasPrismaLibImport: source.includes("../lib/prisma.js"),
        file,
      };
    },
    assertResult: (actual) => {
      assert.equal(actual.hasPrismaClientImport, false);
      assert.equal(actual.hasPrismaLibImport, false);
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

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);

if (failed > 0) {
  process.exitCode = 1;
}

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AXIAL_LOADING_ORDER,
  buildExerciseSimilarityProfile,
  compareExerciseProfiles,
  compareExercisesV1,
  DEFAULT_EXERCISE_SIMILARITY_COMPARATORS_V1,
  DEFAULT_EXERCISE_SIMILARITY_POLICY_V1,
  DEFERRED_SIMILARITY_DIMENSIONS,
  DEMAND_COMPARATOR_V1,
  ENABLED_SIMILARITY_DIMENSIONS,
  EQUIPMENT_COMPARATOR_V1,
  EXERCISE_CLASS_COMPARATOR_V1,
  EXERCISE_SIMILARITY_SCORE_PRECISION_DECIMALS,
  MOVEMENT_COMPARATOR_V1,
  MUSCLE_COMPARATOR_V1,
  MUSCLE_SIMILARITY_PRIMARY_WEIGHT,
  MUSCLE_SIMILARITY_SECONDARY_WEIGHT,
  SIMILARITY_DIMENSIONS,
  SIMILARITY_REASON_CODES,
  SIMILARITY_RESULT_STATUSES,
  STABILITY_DEMAND_ORDER,
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

function buildExercise(overrides = {}) {
  return {
    exerciseId: 13,
    slug: "back-squat",
    dnaMovementPattern: "squat",
    complexity: "compound",
    primaryMuscles: ["quadriceps", "glutes"],
    secondaryMuscles: ["hamstrings", "core"],
    requiredEquipment: ["barbell", "rack"],
    difficulty: "intermediate",
    stabilityDemand: "HIGH",
    axialLoading: "HIGH",
    ...overrides,
  };
}

function buildCurrentCatalogFixture(name) {
  switch (name) {
    case "Back Squat":
      return buildExercise();
    case "Front Squat":
      return buildExercise({
        exerciseId: 52,
        slug: "front-squat",
        primaryMuscles: ["quadriceps"],
        secondaryMuscles: ["glutes", "core"],
      });
    case "Leg Press":
      return buildExercise({
        exerciseId: 24,
        slug: "leg-press",
        requiredEquipment: ["leg_press_machine"],
        stabilityDemand: "LOW",
        axialLoading: "LOW",
        secondaryMuscles: ["hamstrings"],
      });
    case "Machine Leg Curl":
      return buildExercise({
        exerciseId: 49,
        slug: "machine-leg-curl",
        dnaMovementPattern: "knee_flexion",
        complexity: "isolation",
        primaryMuscles: ["hamstrings"],
        secondaryMuscles: [],
        requiredEquipment: ["selectorized_machine"],
        stabilityDemand: "LOW",
        axialLoading: "NONE",
      });
    case "Bench Press":
      return buildExercise({
        exerciseId: 15,
        slug: "bench-press",
        dnaMovementPattern: "horizontal_press",
        primaryMuscles: ["chest"],
        secondaryMuscles: ["shoulders", "triceps"],
        requiredEquipment: ["barbell", "bench", "rack"],
        stabilityDemand: "MODERATE",
        axialLoading: "NONE",
      });
    case "Dumbbell Bench Press":
      return buildExercise({
        exerciseId: 28,
        slug: "dumbbell-bench-press",
        dnaMovementPattern: "horizontal_press",
        primaryMuscles: ["chest"],
        secondaryMuscles: ["shoulders", "triceps"],
        requiredEquipment: ["dumbbell", "bench"],
        stabilityDemand: "MODERATE",
        axialLoading: "NONE",
      });
    case "Dumbbell Row":
      return buildExercise({
        exerciseId: 18,
        slug: "dumbbell-row",
        dnaMovementPattern: "horizontal_pull",
        primaryMuscles: ["back"],
        secondaryMuscles: ["biceps", "lower_back"],
        requiredEquipment: [],
        stabilityDemand: null,
        axialLoading: null,
      });
    default:
      throw new Error(`Unknown exercise fixture "${name}".`);
  }
}

const cases = [
  {
    name: "1. repository convention remains JavaScript ESM with explicit deferred execution similarity",
    input: { moduleBoundary: "backend/src/services/exerciseSimilarity/index.js" },
    run: () => ({
      enabledDimensions: ENABLED_SIMILARITY_DIMENSIONS,
      deferredDimensions: DEFERRED_SIMILARITY_DIMENSIONS,
      precision: EXERCISE_SIMILARITY_SCORE_PRECISION_DECIMALS,
    }),
    assertResult: (actual) => {
      assert.deepEqual(actual.enabledDimensions, ["movement", "exerciseClass", "muscle", "equipment", "demand"]);
      assert.deepEqual(actual.deferredDimensions, ["execution"]);
      assert.equal(actual.precision, 4);
    },
  },
  {
    name: "2. normalized profile contains only approved intrinsic facts and deduplicates unordered sets",
    input: { duplicates: true },
    run: () =>
      buildExerciseSimilarityProfile(
        buildExercise({
          primaryMuscles: ["glutes", "quadriceps", "quadriceps"],
          secondaryMuscles: ["core", "hamstrings", "core"],
          requiredEquipment: ["rack", "barbell", "rack"],
          userId: 7,
          workoutId: 99,
        })
      ),
    assertResult: (actual) => {
      assert.deepEqual(Object.keys(actual).sort(), [
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
      assert.deepEqual(actual.primaryMuscles, ["glutes", "quadriceps"]);
      assert.deepEqual(actual.secondaryMuscles, ["core", "hamstrings"]);
      assert.deepEqual(actual.requiredEquipment, ["barbell", "rack"]);
      assert.equal(Object.prototype.hasOwnProperty.call(actual, "userId"), false);
      assert.equal(Object.prototype.hasOwnProperty.call(actual, "workoutId"), false);
    },
  },
  {
    name: "3. missing DNA is represented explicitly without fabricating defaults",
    input: { partialExercise: "Weighted Pull-Up style partial DNA" },
    run: () =>
      buildExerciseSimilarityProfile(
        buildExercise({
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
    name: "4. difficulty stays out of Similarity V1 semantics because the repository uses it as training-level programming metadata",
    input: { field: "difficulty" },
    run: () => ({
      includedInPolicy: DEFAULT_EXERCISE_SIMILARITY_POLICY_V1.enabledDimensions.includes("difficulty"),
      includedInDemandReasonNamespace: Object.values(SIMILARITY_REASON_CODES.DEMAND).some((code) =>
        code.includes("DIFFICULTY")
      ),
    }),
    assertResult: (actual) => {
      assert.equal(actual.includedInPolicy, false);
      assert.equal(actual.includedInDemandReasonNamespace, false);
    },
  },
  {
    name: "5. movement comparator is binary in V1: same pattern is 1 and different pattern is 0",
    input: { left: "squat", right: "hinge" },
    run: () => ({
      same: validateComparatorResult(
        MOVEMENT_COMPARATOR_V1.compare(buildExercise(), buildExercise({ exerciseId: 20, slug: "front-squat" }))
      ),
      different: validateComparatorResult(
        MOVEMENT_COMPARATOR_V1.compare(
          buildExercise(),
          buildExercise({ exerciseId: 14, slug: "deadlift", dnaMovementPattern: "hinge" })
        )
      ),
    }),
    assertResult: (actual) => {
      assert.equal(actual.same.score, 1);
      assert.equal(actual.different.score, 0);
      assert.equal(actual.different.reasons[0].code, SIMILARITY_REASON_CODES.MOVEMENT.DIFFERENT_MOVEMENT_PATTERN);
    },
  },
  {
    name: "6. movement comparator becomes UNAVAILABLE when dnaMovementPattern is missing",
    input: { missing: "dnaMovementPattern" },
    run: () =>
      validateComparatorResult(
        MOVEMENT_COMPARATOR_V1.compare(
          buildExercise({ dnaMovementPattern: null }),
          buildExercise({ exerciseId: 14, slug: "deadlift", dnaMovementPattern: "hinge" })
        )
      ),
    assertResult: (actual) => {
      assert.equal(actual.status, SIMILARITY_RESULT_STATUSES.UNAVAILABLE);
      assert.equal(actual.score, null);
      assert.equal(actual.reasons[0].code, SIMILARITY_REASON_CODES.MOVEMENT.MISSING_DNA_MOVEMENT_PATTERN);
    },
  },
  {
    name: "7. exercise class comparator keeps complexity independent from movement semantics",
    input: { left: "compound", right: "isolation" },
    run: () =>
      validateComparatorResult(
        EXERCISE_CLASS_COMPARATOR_V1.compare(
          buildExercise(),
          buildExercise({ exerciseId: 49, slug: "machine-leg-curl", complexity: "isolation" })
        )
      ),
    assertResult: (actual) => {
      assert.equal(actual.dimension, SIMILARITY_DIMENSIONS.EXERCISE_CLASS);
      assert.equal(actual.score, 0);
      assert.equal(actual.reasons[0].code, SIMILARITY_REASON_CODES.EXERCISE_CLASS.DIFFERENT_EXERCISE_CLASS);
    },
  },
  {
    name: "8. muscle comparator uses weighted jaccard with primary stronger than secondary and no double counting",
    input: { primaryWeight: MUSCLE_SIMILARITY_PRIMARY_WEIGHT, secondaryWeight: MUSCLE_SIMILARITY_SECONDARY_WEIGHT },
    run: () =>
      validateComparatorResult(
        MUSCLE_COMPARATOR_V1.compare(
          buildExercise({
            primaryMuscles: ["chest"],
            secondaryMuscles: ["triceps", "triceps"],
          }),
          buildExercise({
            exerciseId: 15,
            slug: "bench-press",
            primaryMuscles: ["chest"],
            secondaryMuscles: ["shoulders"],
          })
        )
      ),
    assertResult: (actual) => {
      assert.equal(actual.score, 0.5);
      assert.equal(actual.reasons[0].code, SIMILARITY_REASON_CODES.MUSCLE.PRIMARY_MUSCLE_OVERLAP);
      assert.deepEqual(actual.evidence.sharedPrimary, ["chest"]);
      assert.equal(actual.evidence.intersectionWeight, 1);
      assert.equal(actual.evidence.unionWeight, 2);
    },
  },
  {
    name: "9. muscle comparator marks one-sided missing metadata unavailable instead of zero",
    input: { missingOn: "B" },
    run: () =>
      validateComparatorResult(
        MUSCLE_COMPARATOR_V1.compare(
          buildExercise(),
          buildExercise({
            exerciseId: 15,
            slug: "blank-exercise",
            primaryMuscles: [],
            secondaryMuscles: [],
          })
        )
      ),
    assertResult: (actual) => {
      assert.equal(actual.status, SIMILARITY_RESULT_STATUSES.UNAVAILABLE);
      assert.equal(actual.score, null);
      assert.equal(actual.reasons[0].code, SIMILARITY_REASON_CODES.MUSCLE.MISSING_MUSCLE_METADATA);
      assert.deepEqual(actual.reasons[0].data.missingOn, ["B"]);
    },
  },
  {
    name: "10. equipment comparator uses jaccard over required equipment sets",
    input: { left: ["barbell", "bench", "rack"], right: ["bench", "dumbbell"] },
    run: () =>
      validateComparatorResult(
        EQUIPMENT_COMPARATOR_V1.compare(
          buildExercise({
            requiredEquipment: ["barbell", "bench", "rack"],
          }),
          buildExercise({
            exerciseId: 28,
            slug: "dumbbell-bench-press",
            requiredEquipment: ["bench", "dumbbell", "bench"],
          })
        )
      ),
    assertResult: (actual) => {
      assert.equal(actual.score, 0.25);
      assert.equal(actual.reasons[0].code, SIMILARITY_REASON_CODES.EQUIPMENT.PARTIAL_REQUIRED_EQUIPMENT_OVERLAP);
      assert.deepEqual(actual.evidence.shared, ["bench"]);
      assert.deepEqual(actual.evidence.onlyA, ["barbell", "rack"]);
      assert.deepEqual(actual.evidence.onlyB, ["dumbbell"]);
    },
  },
  {
    name: "11. demand comparator uses ordinal distance and averages available subcomponents only",
    input: {
      stabilityOrder: STABILITY_DEMAND_ORDER,
      axialOrder: AXIAL_LOADING_ORDER,
    },
    run: () => ({
      bothAvailable: validateComparatorResult(
        DEMAND_COMPARATOR_V1.compare(
          buildExercise({ stabilityDemand: "HIGH", axialLoading: "HIGH" }),
          buildExercise({ exerciseId: 24, slug: "leg-press", stabilityDemand: "LOW", axialLoading: "LOW" })
        )
      ),
      oneMissing: validateComparatorResult(
        DEMAND_COMPARATOR_V1.compare(
          buildExercise({ stabilityDemand: null, axialLoading: "HIGH" }),
          buildExercise({ exerciseId: 24, slug: "leg-press", stabilityDemand: "LOW", axialLoading: "LOW" })
        )
      ),
    }),
    assertResult: (actual) => {
      assert.equal(actual.bothAvailable.score, 0.25);
      assert.equal(actual.bothAvailable.evidence.stability.score, 0);
      assert.equal(actual.bothAvailable.evidence.axialLoading.score, 0.5);
      assert.equal(actual.oneMissing.score, 0.5);
      assert.equal(actual.oneMissing.reasons[0].code, SIMILARITY_REASON_CODES.DEMAND.MISSING_STABILITY_DEMAND);
    },
  },
  {
    name: "12. default Similarity Policy V1 is explicit and sums to 1.0 conceptually",
    input: { version: "exercise-similarity-v1" },
    run: () => validateSimilarityPolicy(DEFAULT_EXERCISE_SIMILARITY_POLICY_V1),
    assertResult: (actual) => {
      assert.equal(actual.version, "exercise-similarity-v1");
      assert.deepEqual(actual.enabledDimensions, ["movement", "exerciseClass", "muscle", "equipment", "demand"]);
      assert.equal(actual.totalWeight, 1);
      assert.deepEqual(actual.weights, {
        movement: 0.35,
        exerciseClass: 0.1,
        muscle: 0.25,
        equipment: 0.15,
        demand: 0.15,
      });
    },
  },
  {
    name: "13. compareExercisesV1 uses the real comparator registry and preserves dimension breakdown",
    input: { pair: "Back Squat vs Front Squat" },
    run: () => compareExercisesV1(buildCurrentCatalogFixture("Back Squat"), buildCurrentCatalogFixture("Front Squat")),
    assertResult: (actual) => {
      assert.equal(actual.policyVersion, "exercise-similarity-v1");
      assert.equal(actual.status, SIMILARITY_RESULT_STATUSES.AVAILABLE);
      assert.equal(actual.dimensions.length, 5);
      assert.deepEqual(
        actual.dimensions.map((dimension) => dimension.dimension),
        ["movement", "exerciseClass", "muscle", "equipment", "demand"]
      );
    },
  },
  {
    name: "14. self similarity with complete DNA returns 1.0 for all enabled dimensions",
    input: { pair: "Back Squat vs Back Squat" },
    run: () => compareExercisesV1(buildCurrentCatalogFixture("Back Squat"), buildCurrentCatalogFixture("Back Squat")),
    assertResult: (actual) => {
      assert.equal(actual.score, 1);
      assert.ok(actual.dimensions.every((dimension) => dimension.status === SIMILARITY_RESULT_STATUSES.AVAILABLE));
      assert.ok(actual.dimensions.every((dimension) => dimension.score === 1));
    },
  },
  {
    name: "15. self similarity with partial DNA stays 1.0 over available dimensions and keeps unavailable breakdown",
    input: { pair: "Dumbbell Row vs Dumbbell Row" },
    run: () => compareExercisesV1(buildCurrentCatalogFixture("Dumbbell Row"), buildCurrentCatalogFixture("Dumbbell Row")),
    assertResult: (actual) => {
      assert.equal(actual.status, SIMILARITY_RESULT_STATUSES.AVAILABLE);
      assert.equal(actual.score, 1);
      assert.equal(actual.dimensions.find((dimension) => dimension.dimension === "equipment").status, "UNAVAILABLE");
      assert.equal(actual.dimensions.find((dimension) => dimension.dimension === "demand").status, "UNAVAILABLE");
      assert.equal(actual.dimensions.find((dimension) => dimension.dimension === "movement").score, 1);
      assert.equal(actual.dimensions.find((dimension) => dimension.dimension === "exerciseClass").score, 1);
      assert.equal(actual.dimensions.find((dimension) => dimension.dimension === "muscle").score, 1);
    },
  },
  {
    name: "16. golden pairs preserve expected ordering across current catalog semantics",
    input: {
      pairs: [
        "Back Squat vs Front Squat",
        "Back Squat vs Leg Press",
        "Back Squat vs Machine Leg Curl",
        "Dumbbell Bench Press vs Bench Press",
        "Dumbbell Bench Press vs Dumbbell Row",
        "Machine Leg Curl vs Leg Extension fixture",
      ],
    },
    run: () => {
      const backVsFront = compareExercisesV1(
        buildCurrentCatalogFixture("Back Squat"),
        buildCurrentCatalogFixture("Front Squat")
      );
      const backVsLegPress = compareExercisesV1(
        buildCurrentCatalogFixture("Back Squat"),
        buildCurrentCatalogFixture("Leg Press")
      );
      const backVsLegCurl = compareExercisesV1(
        buildCurrentCatalogFixture("Back Squat"),
        buildCurrentCatalogFixture("Machine Leg Curl")
      );
      const dumbbellBenchVsBench = compareExercisesV1(
        buildCurrentCatalogFixture("Dumbbell Bench Press"),
        buildCurrentCatalogFixture("Bench Press")
      );
      const dumbbellBenchVsRow = compareExercisesV1(
        buildCurrentCatalogFixture("Dumbbell Bench Press"),
        buildCurrentCatalogFixture("Dumbbell Row")
      );
      const legCurlVsLegExtension = compareExercisesV1(
        buildCurrentCatalogFixture("Machine Leg Curl"),
        buildExercise({
          exerciseId: 99,
          slug: "leg-extension",
          dnaMovementPattern: "knee_extension",
          complexity: "isolation",
          primaryMuscles: ["quadriceps"],
          secondaryMuscles: [],
          requiredEquipment: ["selectorized_machine"],
          stabilityDemand: "LOW",
          axialLoading: "NONE",
        })
      );

      return {
        backVsFront,
        backVsLegPress,
        backVsLegCurl,
        dumbbellBenchVsBench,
        dumbbellBenchVsRow,
        legCurlVsLegExtension,
      };
    },
    assertResult: (actual) => {
      assert.equal(actual.backVsFront.score, 0.9167);
      assert.equal(actual.backVsLegPress.score, 0.6958);
      assert.equal(actual.backVsLegCurl.score, 0.0357);
      assert.equal(actual.dumbbellBenchVsBench.score, 0.8875);
      assert.equal(actual.dumbbellBenchVsRow.score, 0.1429);
      assert.equal(actual.legCurlVsLegExtension.score, 0.4);
      assert.ok(actual.backVsFront.score > actual.backVsLegPress.score);
      assert.ok(actual.backVsLegPress.score > actual.backVsLegCurl.score);
      assert.ok(actual.dumbbellBenchVsBench.score > actual.dumbbellBenchVsRow.score);
      assert.ok(actual.legCurlVsLegExtension.score < 0.5);
    },
  },
  {
    name: "17. aggregation still normalizes over AVAILABLE dimensions only under Rule 24",
    input: { unavailableDimensions: ["equipment", "demand"] },
    run: () =>
      compareExercisesV1(buildCurrentCatalogFixture("Dumbbell Bench Press"), buildCurrentCatalogFixture("Dumbbell Row")),
    assertResult: (actual) => {
      assert.equal(actual.status, SIMILARITY_RESULT_STATUSES.AVAILABLE);
      assert.equal(actual.score, 0.1429);
      assert.equal(actual.dimensions.find((dimension) => dimension.dimension === "equipment").status, "UNAVAILABLE");
      assert.equal(actual.dimensions.find((dimension) => dimension.dimension === "demand").status, "UNAVAILABLE");
    },
  },
  {
    name: "18. invalid comparator result still fails loudly for programmer contract violations",
    input: { invalidScore: Number.NaN },
    run: () =>
      validateComparatorResult({
        dimension: SIMILARITY_DIMENSIONS.MUSCLE,
        status: SIMILARITY_RESULT_STATUSES.AVAILABLE,
        score: Number.NaN,
        reasons: [{ code: SIMILARITY_REASON_CODES.MUSCLE.NO_MUSCLE_OVERLAP }],
      }),
    assertError: (error) => {
      assert.match(error.message, /between 0 and 1/);
    },
  },
  {
    name: "19. compareExerciseProfiles remains symmetric, deterministic, and non-mutating with the default registry",
    input: { pair: "Back Squat vs Leg Press" },
    run: () => {
      const rawA = buildCurrentCatalogFixture("Back Squat");
      const rawB = buildCurrentCatalogFixture("Leg Press");
      const before = JSON.stringify({ rawA, rawB, policy: DEFAULT_EXERCISE_SIMILARITY_POLICY_V1 });

      const forward = compareExerciseProfiles(
        rawA,
        rawB,
        DEFAULT_EXERCISE_SIMILARITY_POLICY_V1,
        DEFAULT_EXERCISE_SIMILARITY_COMPARATORS_V1
      );
      const reverse = compareExerciseProfiles(
        rawB,
        rawA,
        DEFAULT_EXERCISE_SIMILARITY_POLICY_V1,
        DEFAULT_EXERCISE_SIMILARITY_COMPARATORS_V1
      );
      const repeat = compareExerciseProfiles(
        rawA,
        rawB,
        DEFAULT_EXERCISE_SIMILARITY_POLICY_V1,
        DEFAULT_EXERCISE_SIMILARITY_COMPARATORS_V1
      );
      const after = JSON.stringify({ rawA, rawB, policy: DEFAULT_EXERCISE_SIMILARITY_POLICY_V1 });

      return { forward, reverse, repeat, before, after };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.forward, actual.reverse);
      assert.deepEqual(actual.forward, actual.repeat);
      assert.equal(actual.before, actual.after);
    },
  },
  {
    name: "20. module stays backend-internal and imports no Prisma dependency",
    input: { file: "backend/src/services/exerciseSimilarity/index.js" },
    run: async () => {
      const source = await readFile(new URL("./index.js", import.meta.url), "utf8");
      return {
        hasPrismaClientImport: source.includes("@prisma/client"),
        hasPrismaLibImport: source.includes("../lib/prisma.js"),
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

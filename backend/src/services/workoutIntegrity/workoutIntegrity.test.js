import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_WORKOUT_INTEGRITY_POLICY_V1,
  evaluateWorkoutIntegrityV1,
  WORKOUT_INTEGRITY_DIMENSIONS,
  WORKOUT_INTEGRITY_POLICY_DIMENSIONS,
  WORKOUT_INTEGRITY_REASON_CODES,
  WORKOUT_INTEGRITY_STATUSES,
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
    nameEn: "Back Squat",
    dnaMovementPattern: "squat",
    complexity: "compound",
    primaryMuscles: ["quadriceps", "glutes"],
    secondaryMuscles: ["hamstrings", "core"],
    requiredEquipment: ["barbell", "rack"],
    stabilityDemand: "HIGH",
    axialLoading: "HIGH",
    catalogLifecycle: "ACTIVE",
    ...overrides,
  };
}

function buildRankedCandidateResult(overrides = {}) {
  return {
    exerciseId: 52,
    rankingStatus: "AVAILABLE",
    rankingScore: 0.8334,
    rank: 1,
    rankingBreakdown: [
      {
        dimension: "musclePreservation",
        status: "AVAILABLE",
        score: 0.6667,
        reasons: [{ code: "RANKING_MUSCLE_FULL_PRIMARY_PRESERVATION" }],
        evidence: { preservedWeight: 2, totalWeight: 3 },
      },
    ],
    rankingReasons: [{ code: "RANKING_MUSCLE_FULL_PRIMARY_PRESERVATION" }],
    eligibilityEvidence: {
      eligibility: true,
      passedRules: ["CANDIDATE_RULE_ACTIVE_CATALOG_EXERCISE"],
      blockedRules: [],
      reasons: [{ ruleId: "CANDIDATE_RULE_ACTIVE_CATALOG_EXERCISE", status: "PASSED" }],
    },
    similarityEvidence: {
      similarityScore: 0.9167,
      similarityStatus: "AVAILABLE",
      similarityBreakdown: [
        {
          dimension: "movement",
          status: "AVAILABLE",
          score: 1,
          reasons: [{ code: "SIMILARITY_MOVEMENT_SAME_PATTERN" }],
          evidence: { patternA: "squat", patternB: "squat" },
        },
      ],
    },
    ...overrides,
  };
}

function buildRankedCandidateEntry(candidateExerciseOverrides = {}, rankedCandidateResultOverrides = {}) {
  const candidateExercise = buildExercise({
    exerciseId: 52,
    slug: "front-squat",
    nameEn: "Front Squat",
    primaryMuscles: ["quadriceps"],
    secondaryMuscles: ["glutes", "core"],
    ...candidateExerciseOverrides,
  });

  return {
    candidateExercise,
    rankedCandidateResult: buildRankedCandidateResult({
      exerciseId: candidateExercise.exerciseId,
      ...rankedCandidateResultOverrides,
    }),
  };
}

const cases = [
  {
    name: "1. exact duplicate blocks the candidate while preserving ranking evidence and keeping the candidate in output",
    input: { case: "exact duplicate" },
    run: () =>
      evaluateWorkoutIntegrityV1(
        13,
        [
          buildExercise(),
          buildExercise({ exerciseId: 52, slug: "front-squat", nameEn: "Front Squat" }),
          buildExercise({ exerciseId: 30, slug: "romanian-deadlift", nameEn: "Romanian Deadlift", dnaMovementPattern: "hinge", primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["core"], complexity: "compound" }),
        ],
        [buildRankedCandidateEntry()]
      ),
    assertResult: (actual) => {
      const candidate = actual.evaluations[0];
      assert.equal(candidate.integrityStatus, WORKOUT_INTEGRITY_STATUSES.BLOCK);
      assert.equal(candidate.integrityScore, null);
      assert.equal(candidate.integrityBreakdown[0].dimension, WORKOUT_INTEGRITY_DIMENSIONS.EXACT_DUPLICATE);
      assert.equal(candidate.integrityBreakdown[0].status, "BLOCK");
      assert.equal(candidate.integrityReasons[0].code, WORKOUT_INTEGRITY_REASON_CODES.EXACT_DUPLICATE);
      assert.equal(candidate.rankingEvidence.rankingScore, 0.8334);
    },
  },
  {
    name: "2. valid similar replacement passes without blocking",
    input: { case: "valid similar replacement" },
    run: () =>
      evaluateWorkoutIntegrityV1(
        13,
        [
          buildExercise(),
          buildExercise({ exerciseId: 30, slug: "romanian-deadlift", dnaMovementPattern: "hinge", primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["core"], complexity: "compound" }),
          buildExercise({ exerciseId: 31, slug: "leg-curl", dnaMovementPattern: "knee_flexion", complexity: "isolation", primaryMuscles: ["hamstrings"], secondaryMuscles: [] }),
          buildExercise({ exerciseId: 32, slug: "calf-raise", dnaMovementPattern: "ankle_extension", complexity: "isolation", primaryMuscles: ["calves"], secondaryMuscles: [] }),
        ],
        [
          buildRankedCandidateEntry({
            exerciseId: 71,
            slug: "goblet-squat",
            nameEn: "Goblet Squat",
            requiredEquipment: ["dumbbell"],
            stabilityDemand: "MODERATE",
            axialLoading: "LOW",
          }),
        ]
      ),
    assertResult: (actual) => {
      const candidate = actual.evaluations[0];
      assert.equal(candidate.integrityStatus, WORKOUT_INTEGRITY_STATUSES.PASS);
      assert.equal(candidate.integrityScore, 1);
    },
  },
  {
    name: "3. movement pattern concentration warns when the resulting workout contains three exercises with the same pattern",
    input: { case: "movement concentration" },
    run: () =>
      evaluateWorkoutIntegrityV1(
        13,
        [
          buildExercise(),
          buildExercise({ exerciseId: 77, slug: "front-squat", nameEn: "Front Squat" }),
          buildExercise({ exerciseId: 78, slug: "leg-press", dnaMovementPattern: "squat", requiredEquipment: ["leg_press_machine"], stabilityDemand: "LOW", axialLoading: "LOW" }),
          buildExercise({ exerciseId: 32, slug: "calf-raise", dnaMovementPattern: "ankle_extension", complexity: "isolation", primaryMuscles: ["calves"], secondaryMuscles: [] }),
        ],
        [
          buildRankedCandidateEntry({
            exerciseId: 71,
            slug: "goblet-squat",
            nameEn: "Goblet Squat",
            requiredEquipment: ["dumbbell"],
            stabilityDemand: "MODERATE",
            axialLoading: "LOW",
          }),
        ]
      ),
    assertResult: (actual) => {
      const movement = actual.evaluations[0].integrityBreakdown.find(
        (dimension) => dimension.dimension === WORKOUT_INTEGRITY_DIMENSIONS.MOVEMENT_PATTERN_REDUNDANCY
      );
      assert.equal(actual.evaluations[0].integrityStatus, WORKOUT_INTEGRITY_STATUSES.WARN);
      assert.equal(movement.status, "WARN");
      assert.equal(movement.score, 0.75);
      assert.equal(movement.reasons[0].code, WORKOUT_INTEGRITY_REASON_CODES.MOVEMENT_PATTERN_CONCENTRATED);
    },
  },
  {
    name: "4. primary muscle concentration warns when a resulting workout has three occurrences of the same primary muscle",
    input: { case: "primary muscle concentration" },
    run: () =>
      evaluateWorkoutIntegrityV1(
        13,
        [
          buildExercise(),
          buildExercise({ exerciseId: 40, slug: "leg-press", requiredEquipment: ["leg_press_machine"], stabilityDemand: "LOW", axialLoading: "LOW" }),
          buildExercise({ exerciseId: 41, slug: "leg-extension", dnaMovementPattern: "knee_extension", complexity: "isolation", primaryMuscles: ["quadriceps"], secondaryMuscles: [] }),
          buildExercise({ exerciseId: 32, slug: "calf-raise", dnaMovementPattern: "ankle_extension", complexity: "isolation", primaryMuscles: ["calves"], secondaryMuscles: [] }),
        ],
        [
          buildRankedCandidateEntry({
            exerciseId: 71,
            slug: "goblet-squat",
            nameEn: "Goblet Squat",
            requiredEquipment: ["dumbbell"],
            stabilityDemand: "MODERATE",
            axialLoading: "LOW",
          }),
        ]
      ),
    assertResult: (actual) => {
      const primaryMuscle = actual.evaluations[0].integrityBreakdown.find(
        (dimension) => dimension.dimension === WORKOUT_INTEGRITY_DIMENSIONS.PRIMARY_MUSCLE_REDUNDANCY
      );
      assert.equal(actual.evaluations[0].integrityStatus, WORKOUT_INTEGRITY_STATUSES.WARN);
      assert.equal(primaryMuscle.status, "WARN");
      assert.equal(primaryMuscle.reasons[0].code, WORKOUT_INTEGRITY_REASON_CODES.PRIMARY_MUSCLE_CONCENTRATION);
      assert.deepEqual(primaryMuscle.evidence.concentratedPrimaryMuscles, ["quadriceps"]);
    },
  },
  {
    name: "5. exercise class concentration warns when a workout of four exercises collapses to all compound",
    input: { case: "exercise class concentration" },
    run: () =>
      evaluateWorkoutIntegrityV1(
        13,
        [
          buildExercise(),
          buildExercise({ exerciseId: 30, slug: "romanian-deadlift", dnaMovementPattern: "hinge", primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["core"], complexity: "compound" }),
          buildExercise({ exerciseId: 33, slug: "overhead-press", dnaMovementPattern: "vertical_press", primaryMuscles: ["shoulders"], secondaryMuscles: ["triceps", "core"], complexity: "compound" }),
          buildExercise({ exerciseId: 34, slug: "barbell-row", dnaMovementPattern: "horizontal_pull", primaryMuscles: ["back"], secondaryMuscles: ["biceps", "core"], complexity: "compound" }),
        ],
        [
          buildRankedCandidateEntry({
            exerciseId: 79,
            slug: "front-squat",
            nameEn: "Front Squat",
            complexity: "compound",
          }),
        ]
      ),
    assertResult: (actual) => {
      const exerciseClass = actual.evaluations[0].integrityBreakdown.find(
        (dimension) => dimension.dimension === WORKOUT_INTEGRITY_DIMENSIONS.EXERCISE_CLASS_CONCENTRATION
      );
      assert.equal(actual.evaluations[0].integrityStatus, WORKOUT_INTEGRITY_STATUSES.WARN);
      assert.equal(exerciseClass.status, "WARN");
      assert.equal(exerciseClass.score, 0.85);
      assert.equal(exerciseClass.reasons[0].code, WORKOUT_INTEGRITY_REASON_CODES.EXERCISE_CLASS_CONCENTRATION);
    },
  },
  {
    name: "6. missing metadata renormalizes over available dimensions without hidden penalty",
    input: { case: "missing metadata renormalization" },
    run: () =>
      evaluateWorkoutIntegrityV1(
        13,
        [
          buildExercise(),
          buildExercise({ exerciseId: 30, slug: "romanian-deadlift", dnaMovementPattern: "hinge", primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["core"], complexity: "compound" }),
          buildExercise({ exerciseId: 31, slug: "leg-curl", dnaMovementPattern: "knee_flexion", complexity: "isolation", primaryMuscles: ["hamstrings"], secondaryMuscles: [] }),
        ],
        [
          buildRankedCandidateEntry({
            exerciseId: 81,
            slug: "partial-squat",
            nameEn: "Partial Squat",
            primaryMuscles: [],
            secondaryMuscles: [],
            requiredEquipment: ["dumbbell"],
            stabilityDemand: "MODERATE",
            axialLoading: "LOW",
          }),
        ]
      ),
    assertResult: (actual) => {
      const candidate = actual.evaluations[0];
      const unavailable = candidate.integrityBreakdown.find(
        (dimension) => dimension.dimension === WORKOUT_INTEGRITY_DIMENSIONS.PRIMARY_MUSCLE_REDUNDANCY
      );
      assert.equal(candidate.integrityStatus, WORKOUT_INTEGRITY_STATUSES.PASS);
      assert.equal(candidate.integrityScore, 1);
      assert.equal(unavailable.status, "UNAVAILABLE");
    },
  },
  {
    name: "7. all unavailable integrity dimensions return warn with null score and insufficient metadata reason",
    input: { case: "all unavailable" },
    run: () =>
      evaluateWorkoutIntegrityV1(
        13,
        [
          buildExercise({
            primaryMuscles: [],
            secondaryMuscles: [],
            dnaMovementPattern: null,
            complexity: null,
          }),
        ],
        [
          buildRankedCandidateEntry({
            exerciseId: 82,
            slug: "unknown-squat",
            dnaMovementPattern: null,
            complexity: null,
            primaryMuscles: [],
            secondaryMuscles: [],
          }),
        ]
      ),
    assertResult: (actual) => {
      const candidate = actual.evaluations[0];
      assert.equal(candidate.integrityStatus, WORKOUT_INTEGRITY_STATUSES.WARN);
      assert.equal(candidate.integrityScore, null);
      assert.equal(
        candidate.integrityReasons.some((reason) => reason.code === WORKOUT_INTEGRITY_REASON_CODES.INSUFFICIENT_METADATA),
        true
      );
    },
  },
  {
    name: "8. input workout and ranked candidate evidence are not mutated",
    input: { case: "immutability" },
    run: () => {
      const workout = [
        buildExercise(),
        buildExercise({ exerciseId: 30, slug: "romanian-deadlift", dnaMovementPattern: "hinge", primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["core"], complexity: "compound" }),
      ];
      const rankedCandidate = buildRankedCandidateEntry();
      const beforeWorkout = JSON.parse(JSON.stringify(workout));
      const beforeCandidate = JSON.parse(JSON.stringify(rankedCandidate));
      const actual = evaluateWorkoutIntegrityV1(13, workout, [rankedCandidate]);
      return { actual, workout, beforeWorkout, rankedCandidate, beforeCandidate };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.workout, actual.beforeWorkout);
      assert.deepEqual(actual.rankedCandidate, actual.beforeCandidate);
      assert.equal(Object.isFrozen(actual.actual), true);
    },
  },
  {
    name: "9. incoming ranking order is preserved and blocked candidates remain in output",
    input: { case: "preserve ranking order" },
    run: () =>
      evaluateWorkoutIntegrityV1(
        13,
        [
          buildExercise(),
          buildExercise({ exerciseId: 52, slug: "front-squat", nameEn: "Front Squat" }),
          buildExercise({ exerciseId: 30, slug: "romanian-deadlift", dnaMovementPattern: "hinge", primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["core"], complexity: "compound" }),
        ],
        [
          buildRankedCandidateEntry(
            { exerciseId: 71, slug: "goblet-squat", nameEn: "Goblet Squat", requiredEquipment: ["dumbbell"], stabilityDemand: "MODERATE", axialLoading: "LOW" },
            { exerciseId: 71, rank: 1, rankingScore: 0.9 }
          ),
          buildRankedCandidateEntry(
            { exerciseId: 52, slug: "front-squat", nameEn: "Front Squat" },
            { exerciseId: 52, rank: 2, rankingScore: 0.85 }
          ),
        ]
      ),
    assertResult: (actual) => {
      assert.deepEqual(actual.evaluations.map((candidate) => candidate.exerciseId), [71, 52]);
      assert.equal(actual.evaluations[1].integrityStatus, WORKOUT_INTEGRITY_STATUSES.BLOCK);
      assert.equal(actual.evaluations[0].rankingEvidence.rankingScore, 0.9);
      assert.equal(actual.evaluations[1].rankingEvidence.rankingScore, 0.85);
    },
  },
  {
    name: "10. ranking score remains unchanged by workout integrity evaluation",
    input: { case: "ranking score unchanged" },
    run: () =>
      evaluateWorkoutIntegrityV1(
        13,
        [buildExercise(), buildExercise({ exerciseId: 30, slug: "romanian-deadlift", dnaMovementPattern: "hinge", primaryMuscles: ["hamstrings", "glutes"], secondaryMuscles: ["core"], complexity: "compound" })],
        [buildRankedCandidateEntry({}, { rankingScore: 0.8334 })]
      ),
    assertResult: (actual) => {
      assert.equal(actual.evaluations[0].rankingEvidence.rankingScore, 0.8334);
    },
  },
  {
    name: "11. duplicate source exercise occurrences fail loudly",
    input: { case: "duplicate source occurrence" },
    run: () =>
      evaluateWorkoutIntegrityV1(
        13,
        [buildExercise(), buildExercise({ exerciseId: 13, slug: "back-squat-duplicate" })],
        [buildRankedCandidateEntry()]
      ),
    assertError: (error) => {
      assert.match(error.message, /multiple times/i);
    },
  },
  {
    name: "12. module stays pure and imports no prisma or upstream recomputation engines",
    input: { case: "dependency audit" },
    run: async () => readFile(new URL("./index.js", import.meta.url), "utf8"),
    assertResult: (actual) => {
      assert.equal(actual.includes("@prisma/client"), false);
      assert.equal(actual.includes("buildReplacementCandidatesV1"), false);
      assert.equal(actual.includes("rankReplacementCandidatesV1"), false);
      assert.equal(actual.includes("compareExercisesV1"), false);
    },
  },
];

let passed = 0;

for (const testCase of cases) {
  try {
    const actual = await testCase.run();
    if (testCase.assertResult) {
      testCase.assertResult(actual);
    }
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
        continue;
      } catch (assertionError) {
        printCaseResult({
          name: testCase.name,
          input: testCase.input,
          error: assertionError.message,
          status: "FAIL",
        });
        throw assertionError;
      }
    }

    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      error: error.message,
      status: "FAIL",
    });
    throw error;
  }
}

console.log(`SUMMARY: ${passed} passed, 0 failed, ${cases.length} total`);

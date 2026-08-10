import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AXIAL_LOADING_ORDER,
  DEFAULT_REPLACEMENT_RANKING_POLICY_V1,
  evaluateReplacementRankingV1,
  RANKING_MUSCLE_PRIMARY_TO_PRIMARY_CREDIT,
  RANKING_MUSCLE_PRIMARY_TO_SECONDARY_CREDIT,
  RANKING_MUSCLE_SECONDARY_TO_PRIMARY_CREDIT,
  RANKING_MUSCLE_SECONDARY_TO_SECONDARY_CREDIT,
  RANKING_MUSCLE_SOURCE_PRIMARY_WEIGHT,
  RANKING_MUSCLE_SOURCE_SECONDARY_WEIGHT,
  RANKING_POLICY_DIMENSIONS,
  RANKING_REASON_CODES,
  RANKING_RESULT_STATUSES,
  rankEligibleCandidatesV1,
  rankReplacementCandidatesV1,
  REPLACEMENT_RANKING_ENGINE_V1_VERSION,
  REPLACEMENT_RANKING_POLICY_V1_VERSION,
  REPLACEMENT_RANKING_SCORE_PRECISION_DECIMALS,
  STABILITY_DEMAND_ORDER,
  validateReplacementRankingPolicy,
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
    difficulty: "intermediate",
    stabilityDemand: "HIGH",
    axialLoading: "HIGH",
    catalogLifecycle: "ACTIVE",
    ...overrides,
  };
}

function buildEligibleCandidateResult(overrides = {}) {
  return {
    exerciseId: 52,
    similarityScore: 0.8333,
    similarityStatus: RANKING_RESULT_STATUSES.AVAILABLE,
    similarityBreakdown: [
      {
        dimension: "movement",
        status: "AVAILABLE",
        score: 1,
        reasons: [{ code: "SIMILARITY_MOVEMENT_SAME_PATTERN" }],
        evidence: { patternA: "squat", patternB: "squat" },
      },
      {
        dimension: "exerciseClass",
        status: "AVAILABLE",
        score: 1,
        reasons: [{ code: "SIMILARITY_EXERCISE_CLASS_SAME_CLASS" }],
        evidence: { classA: "compound", classB: "compound" },
      },
    ],
    eligibility: true,
    passedRules: [
      "CANDIDATE_RULE_NOT_SOURCE_EXERCISE",
      "CANDIDATE_RULE_ACTIVE_CATALOG_EXERCISE",
      "CANDIDATE_RULE_COMPLETE_DNA",
      "CANDIDATE_RULE_SAME_EXERCISE_CLASS",
      "CANDIDATE_RULE_SAME_MOVEMENT_PATTERN",
      "CANDIDATE_RULE_AVAILABLE_SIMILARITY",
    ],
    blockedRules: [],
    reasons: [{ ruleId: "CANDIDATE_RULE_AVAILABLE_SIMILARITY", status: "PASSED", code: "CANDIDATE_AVAILABLE" }],
    ...overrides,
  };
}

function buildEligibleCandidateEntry(candidateExerciseOverrides = {}, candidateResultOverrides = {}) {
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
    candidateResult: buildEligibleCandidateResult({
      exerciseId: candidateExercise.exerciseId,
      ...candidateResultOverrides,
    }),
  };
}

const cases = [
  {
    name: "1. production policy v1 and scoring precision are explicit and frozen",
    input: { policyVersion: REPLACEMENT_RANKING_POLICY_V1_VERSION },
    run: () => ({
      policy: DEFAULT_REPLACEMENT_RANKING_POLICY_V1,
      precision: REPLACEMENT_RANKING_SCORE_PRECISION_DECIMALS,
      stabilityOrder: STABILITY_DEMAND_ORDER,
      axialOrder: AXIAL_LOADING_ORDER,
    }),
    assertResult: (actual) => {
      assert.equal(actual.policy.version, REPLACEMENT_RANKING_POLICY_V1_VERSION);
      assert.deepEqual(actual.policy.enabledDimensions, [
        "musclePreservation",
        "equipmentPreservation",
        "demandPreservation",
      ]);
      assert.deepEqual(actual.policy.weights, {
        musclePreservation: 0.5,
        equipmentPreservation: 0.25,
        demandPreservation: 0.25,
      });
      assert.equal(actual.precision, 4);
      assert.deepEqual(actual.stabilityOrder, { LOW: 0, MODERATE: 1, HIGH: 2 });
      assert.deepEqual(actual.axialOrder, { NONE: 0, LOW: 1, HIGH: 2 });
    },
  },
  {
    name: "2. ranking policy validation rejects malformed weight contracts while preserving the product policy",
    input: { validation: "policy" },
    run: () => ({
      valid: validateReplacementRankingPolicy(DEFAULT_REPLACEMENT_RANKING_POLICY_V1),
      invalidUnknown: () =>
        validateReplacementRankingPolicy({
          version: "bad-policy",
          enabledDimensions: ["unknown"],
          weights: { unknown: 1 },
        }),
      invalidNegative: () =>
        validateReplacementRankingPolicy({
          version: "bad-policy",
          enabledDimensions: [RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION],
          weights: { [RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION]: -1 },
        }),
      invalidAllZero: () =>
        validateReplacementRankingPolicy({
          version: "bad-policy",
          enabledDimensions: [RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION],
          weights: { [RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION]: 0 },
        }),
      invalidInfinity: () =>
        validateReplacementRankingPolicy({
          version: "bad-policy",
          enabledDimensions: [RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION],
          weights: { [RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION]: Number.POSITIVE_INFINITY },
        }),
    }),
    assertResult: (actual) => {
      assert.equal(actual.valid.version, REPLACEMENT_RANKING_POLICY_V1_VERSION);
      assert.throws(actual.invalidUnknown, /unknown dimension/i);
      assert.throws(actual.invalidNegative, /must not be negative/i);
      assert.throws(actual.invalidAllZero, /at least one positive weight/i);
      assert.throws(actual.invalidInfinity, /must be finite/i);
    },
  },
  {
    name: "3. ranking v1 contains only directional preservation dimensions and keeps similarity as evidence only",
    input: { similarityScoreA: 0.9167, similarityScoreB: 0.2 },
    run: () => {
      const candidateExercise = buildExercise({ exerciseId: 52, slug: "front-squat" });
      const candidateResultA = buildEligibleCandidateResult({ exerciseId: 52, similarityScore: 0.9167 });
      const candidateResultB = buildEligibleCandidateResult({ exerciseId: 52, similarityScore: 0.2 });

      const first = rankEligibleCandidatesV1(
        buildExercise(),
        [{ candidateExercise, candidateResult: candidateResultA }],
        {
          policy: DEFAULT_REPLACEMENT_RANKING_POLICY_V1,
          evaluateCandidateRanking: evaluateReplacementRankingV1,
        }
      );

      const second = rankEligibleCandidatesV1(
        buildExercise(),
        [{ candidateExercise, candidateResult: candidateResultB }],
        {
          policy: DEFAULT_REPLACEMENT_RANKING_POLICY_V1,
          evaluateCandidateRanking: evaluateReplacementRankingV1,
        }
      );

      return { first, second, candidateResultA };
    },
    assertResult: (actual) => {
      const dimensions = actual.first.rankedCandidates[0].rankingBreakdown.map((dimension) => dimension.dimension);
      assert.deepEqual(dimensions, [
        RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION,
        RANKING_POLICY_DIMENSIONS.EQUIPMENT_PRESERVATION,
        RANKING_POLICY_DIMENSIONS.DEMAND_PRESERVATION,
      ]);
      assert.equal(dimensions.includes("semanticPreservation"), false);
      assert.equal(actual.first.rankedCandidates[0].rankingScore, actual.second.rankedCandidates[0].rankingScore);
      assert.deepEqual(
        actual.first.rankedCandidates[0].similarityEvidence,
        {
          similarityScore: 0.9167,
          similarityStatus: "AVAILABLE",
          similarityBreakdown: actual.candidateResultA.similarityBreakdown,
        }
      );
      assert.equal(actual.second.rankedCandidates[0].similarityEvidence.similarityScore, 0.2);
    },
  },
  {
    name: "4. directional muscle preservation uses weighted source-role coverage rather than symmetric overlap",
    input: {
      sourceWeights: {
        primary: RANKING_MUSCLE_SOURCE_PRIMARY_WEIGHT,
        secondary: RANKING_MUSCLE_SOURCE_SECONDARY_WEIGHT,
      },
      candidateCredits: {
        primaryToPrimary: RANKING_MUSCLE_PRIMARY_TO_PRIMARY_CREDIT,
        primaryToSecondary: RANKING_MUSCLE_PRIMARY_TO_SECONDARY_CREDIT,
        secondaryToPrimary: RANKING_MUSCLE_SECONDARY_TO_PRIMARY_CREDIT,
        secondaryToSecondary: RANKING_MUSCLE_SECONDARY_TO_SECONDARY_CREDIT,
      },
    },
    run: () =>
      evaluateReplacementRankingV1({
        sourceExercise: buildExercise({
          primaryMuscles: ["quadriceps", "glutes"],
          secondaryMuscles: ["hamstrings", "core"],
        }),
        candidateExercise: buildExercise({
          exerciseId: 60,
          slug: "partial-muscle-preserver",
          primaryMuscles: ["quadriceps", "core"],
          secondaryMuscles: ["glutes"],
        }),
        candidateResult: buildEligibleCandidateResult({ exerciseId: 60, similarityScore: 0.8 }),
        policy: DEFAULT_REPLACEMENT_RANKING_POLICY_V1,
      }),
    assertResult: (actual) => {
      const muscle = actual.breakdown.find(
        (dimension) => dimension.dimension === RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION
      );
      assert.equal(actual.score, 0.8334);
      assert.equal(muscle.score, 0.6667);
      assert.deepEqual(
        muscle.reasons.map((reason) => reason.code),
        [
          RANKING_REASON_CODES.MUSCLE_FULL_PRIMARY_PRESERVATION,
          RANKING_REASON_CODES.MUSCLE_PARTIAL_PRIMARY_PRESERVATION,
          RANKING_REASON_CODES.MUSCLE_SECONDARY_PRESERVATION,
          RANKING_REASON_CODES.MUSCLE_SOURCE_MUSCLE_MISSING,
        ]
      );
      assert.deepEqual(muscle.evidence.fullPrimary, ["quadriceps"]);
      assert.deepEqual(muscle.evidence.partialPrimary, ["glutes"]);
      assert.deepEqual(muscle.evidence.preservedSecondary, ["core"]);
      assert.deepEqual(muscle.evidence.missingSourceMuscles, ["hamstrings"]);
      assert.equal(muscle.evidence.preservedWeight, 2);
      assert.equal(muscle.evidence.totalWeight, 3);
    },
  },
  {
    name: "5. directional equipment preservation uses recall against source required equipment only",
    input: { sourceRequired: ["barbell", "bench", "rack"], candidateRequired: ["dumbbell", "bench"] },
    run: () =>
      evaluateReplacementRankingV1({
        sourceExercise: buildExercise({
          requiredEquipment: ["barbell", "bench", "rack"],
        }),
        candidateExercise: buildExercise({
          exerciseId: 61,
          slug: "dumbbell-bench-press",
          requiredEquipment: ["dumbbell", "bench"],
        }),
        candidateResult: buildEligibleCandidateResult({ exerciseId: 61, similarityScore: 0.85 }),
        policy: DEFAULT_REPLACEMENT_RANKING_POLICY_V1,
      }),
    assertResult: (actual) => {
      const equipment = actual.breakdown.find(
        (dimension) => dimension.dimension === RANKING_POLICY_DIMENSIONS.EQUIPMENT_PRESERVATION
      );
      assert.equal(actual.score, 0.8333);
      assert.equal(equipment.score, 0.3333);
      assert.equal(equipment.reasons[0].code, RANKING_REASON_CODES.EQUIPMENT_SOURCE_SETUP_PARTIAL);
      assert.deepEqual(equipment.evidence.shared, ["bench"]);
      assert.deepEqual(equipment.evidence.missingFromCandidate, ["barbell", "rack"]);
    },
  },
  {
    name: "6. demand preservation uses source-owned ordinal preservation and averages available components only",
    input: { stability: ["HIGH", "MODERATE"], axial: ["HIGH", "LOW"] },
    run: () =>
      evaluateReplacementRankingV1({
        sourceExercise: buildExercise({
          stabilityDemand: "HIGH",
          axialLoading: "HIGH",
        }),
        candidateExercise: buildExercise({
          exerciseId: 62,
          slug: "lighter-squat",
          stabilityDemand: "MODERATE",
          axialLoading: "LOW",
        }),
        candidateResult: buildEligibleCandidateResult({ exerciseId: 62, similarityScore: 0.8 }),
        policy: DEFAULT_REPLACEMENT_RANKING_POLICY_V1,
      }),
    assertResult: (actual) => {
      const demand = actual.breakdown.find(
        (dimension) => dimension.dimension === RANKING_POLICY_DIMENSIONS.DEMAND_PRESERVATION
      );
      assert.equal(actual.score, 0.875);
      assert.equal(demand.score, 0.5);
      assert.equal(demand.reasons[0].code, RANKING_REASON_CODES.DEMAND_CHANGED);
      assert.equal(demand.evidence.stability.score, 0.5);
      assert.equal(demand.evidence.axialLoading.score, 0.5);
    },
  },
  {
    name: "7. missing ranking dimensions are renormalized over available dimensions only",
    input: { unavailableDimensions: ["equipmentPreservation", "demandPreservation"] },
    run: () =>
      evaluateReplacementRankingV1({
        sourceExercise: buildExercise({
          requiredEquipment: ["barbell", "rack"],
          stabilityDemand: "HIGH",
          axialLoading: "HIGH",
        }),
        candidateExercise: buildExercise({
          exerciseId: 63,
          slug: "partial-dna-candidate",
          primaryMuscles: ["quadriceps"],
          secondaryMuscles: ["glutes", "core"],
          requiredEquipment: [],
          stabilityDemand: null,
          axialLoading: null,
        }),
        candidateResult: buildEligibleCandidateResult({ exerciseId: 63, similarityScore: 0.9 }),
        policy: DEFAULT_REPLACEMENT_RANKING_POLICY_V1,
      }),
    assertResult: (actual) => {
      assert.equal(actual.status, RANKING_RESULT_STATUSES.AVAILABLE);
      assert.equal(actual.score, 0.6667);
      const unavailable = actual.breakdown
        .filter((dimension) => dimension.status === RANKING_RESULT_STATUSES.UNAVAILABLE)
        .map((dimension) => dimension.dimension);
      assert.deepEqual(unavailable, ["equipmentPreservation", "demandPreservation"]);
    },
  },
  {
    name: "8. all unavailable ranking dimensions return unavailable ranking status and null score",
    input: { noAvailableDimensions: true },
    run: () =>
      evaluateReplacementRankingV1({
        sourceExercise: buildExercise({
          primaryMuscles: [],
          secondaryMuscles: [],
          requiredEquipment: [],
          stabilityDemand: null,
          axialLoading: null,
        }),
        candidateExercise: buildExercise({
          exerciseId: 64,
          slug: "empty-candidate",
          primaryMuscles: [],
          secondaryMuscles: [],
          requiredEquipment: [],
          stabilityDemand: null,
          axialLoading: null,
        }),
        candidateResult: buildEligibleCandidateResult({ exerciseId: 64, similarityScore: 0, similarityBreakdown: [] }),
        policy: {
          version: "test-unavailable-policy",
          enabledDimensions: [RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION],
          weights: { [RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION]: 1 },
        },
      }),
    assertResult: (actual) => {
      assert.equal(actual.status, RANKING_RESULT_STATUSES.UNAVAILABLE);
      assert.equal(actual.score, null);
      assert.equal(actual.reasons[0].code, RANKING_REASON_CODES.NO_AVAILABLE_DIMENSIONS);
    },
  },
  {
    name: "9. default production entry point ranks eligible candidates deterministically with the production policy",
    input: { source: "Back Squat" },
    run: () =>
      rankReplacementCandidatesV1(buildExercise(), [
        buildEligibleCandidateEntry(
          {
            exerciseId: 70,
            slug: "front-squat",
            nameEn: "Front Squat",
            primaryMuscles: ["quadriceps"],
            secondaryMuscles: ["glutes", "core"],
          },
          { exerciseId: 70, similarityScore: 0.9167 }
        ),
        buildEligibleCandidateEntry(
          {
            exerciseId: 71,
            slug: "goblet-squat",
            nameEn: "Goblet Squat",
            primaryMuscles: ["quadriceps", "glutes"],
            secondaryMuscles: ["core"],
            requiredEquipment: ["dumbbell"],
            stabilityDemand: "MODERATE",
            axialLoading: "LOW",
          },
          { exerciseId: 71, similarityScore: 0.5964 }
        ),
      ]),
    assertResult: (actual) => {
      assert.equal(actual.version, REPLACEMENT_RANKING_ENGINE_V1_VERSION);
      assert.equal(actual.policyVersion, REPLACEMENT_RANKING_POLICY_V1_VERSION);
      assert.deepEqual(
        actual.rankedCandidates.map((candidate) => candidate.exerciseId),
        [70, 71]
      );
      assert.equal(actual.rankedCandidates[0].rankingScore, 0.8334);
      assert.equal(actual.rankedCandidates[1].rankingScore, 0.5416);
    },
  },
  {
    name: "10. bench press ranking remains directional with equipment differences affecting rank but not blocking eligibility",
    input: { source: "Bench Press" },
    run: () =>
      rankReplacementCandidatesV1(
        buildExercise({
          exerciseId: 15,
          slug: "bench-press",
          nameEn: "Bench Press",
          dnaMovementPattern: "horizontal_press",
          primaryMuscles: ["chest"],
          secondaryMuscles: ["shoulders", "triceps"],
          requiredEquipment: ["barbell", "bench", "rack"],
          stabilityDemand: "MODERATE",
          axialLoading: "NONE",
        }),
        [
          buildEligibleCandidateEntry(
            {
              exerciseId: 72,
              slug: "dumbbell-bench-press",
              nameEn: "Dumbbell Bench Press",
              dnaMovementPattern: "horizontal_press",
              primaryMuscles: ["chest"],
              secondaryMuscles: ["shoulders", "triceps"],
              requiredEquipment: ["dumbbell", "bench"],
              stabilityDemand: "MODERATE",
              axialLoading: "NONE",
            },
            { exerciseId: 72, similarityScore: 0.8875 }
          ),
          buildEligibleCandidateEntry(
            {
              exerciseId: 73,
              slug: "machine-chest-press",
              nameEn: "Machine Chest Press",
              dnaMovementPattern: "horizontal_press",
              primaryMuscles: ["chest"],
              secondaryMuscles: ["shoulders", "triceps"],
              requiredEquipment: ["selectorized_machine"],
              stabilityDemand: "LOW",
              axialLoading: "NONE",
            },
            { exerciseId: 73, similarityScore: 0.8125 }
          ),
        ]
      ),
    assertResult: (actual) => {
      assert.deepEqual(
        actual.rankedCandidates.map((candidate) => candidate.exerciseId),
        [72, 73]
      );
      assert.equal(actual.rankedCandidates[0].rankingScore, 0.8333);
      assert.equal(actual.rankedCandidates[1].rankingScore, 0.6875);
      assert.equal(actual.rankedCandidates[0].eligibilityEvidence.eligibility, true);
      assert.equal(actual.rankedCandidates[1].eligibilityEvidence.eligibility, true);
    },
  },
  {
    name: "11. directional muscle preservation ranks stronger source-primary preservation above weaker overlap",
    input: { directionality: "source muscle preservation" },
    run: () =>
      rankReplacementCandidatesV1(
        buildExercise({
          primaryMuscles: ["quadriceps", "glutes"],
          secondaryMuscles: ["hamstrings", "core"],
        }),
        [
          buildEligibleCandidateEntry(
            {
              exerciseId: 74,
              slug: "quad-glute-squat",
              primaryMuscles: ["quadriceps", "glutes"],
              secondaryMuscles: ["core"],
            },
            { exerciseId: 74, similarityScore: 0.8 }
          ),
          buildEligibleCandidateEntry(
            {
              exerciseId: 75,
              slug: "hamstring-core-squat",
              primaryMuscles: ["hamstrings"],
              secondaryMuscles: ["core", "glutes"],
            },
            { exerciseId: 75, similarityScore: 0.8 }
          ),
        ]
      ),
    assertResult: (actual) => {
      const [stronger, weaker] = actual.rankedCandidates;
      assert.equal(stronger.exerciseId, 74);
      assert.equal(weaker.exerciseId, 75);
      assert.equal(stronger.rankingScore, 0.9166);
      assert.equal(weaker.rankingScore, 0.75);
      assert.equal(
        stronger.rankingBreakdown.find((dimension) => dimension.dimension === "musclePreservation").score,
        0.8333
      );
      assert.equal(
        weaker.rankingBreakdown.find((dimension) => dimension.dimension === "musclePreservation").score,
        0.5
      );
    },
  },
  {
    name: "12. directional equipment preservation proves source-to-candidate rank can differ from the reverse direction",
    input: { directionality: "source required equipment denominator" },
    run: () => {
      const left = evaluateReplacementRankingV1({
        sourceExercise: buildExercise({
          requiredEquipment: ["barbell", "bench", "rack"],
        }),
        candidateExercise: buildExercise({
          exerciseId: 76,
          slug: "dumbbell-bench",
          requiredEquipment: ["dumbbell", "bench"],
        }),
        candidateResult: buildEligibleCandidateResult({ exerciseId: 76, similarityScore: 0.85 }),
        policy: DEFAULT_REPLACEMENT_RANKING_POLICY_V1,
      });

      const right = evaluateReplacementRankingV1({
        sourceExercise: buildExercise({
          exerciseId: 76,
          slug: "dumbbell-bench",
          requiredEquipment: ["dumbbell", "bench"],
        }),
        candidateExercise: buildExercise({
          requiredEquipment: ["barbell", "bench", "rack"],
        }),
        candidateResult: buildEligibleCandidateResult({ similarityScore: 0.85 }),
        policy: DEFAULT_REPLACEMENT_RANKING_POLICY_V1,
      });

      return { left, right };
    },
    assertResult: (actual) => {
      const leftEquipment = actual.left.breakdown.find((dimension) => dimension.dimension === "equipmentPreservation");
      const rightEquipment = actual.right.breakdown.find((dimension) => dimension.dimension === "equipmentPreservation");
      assert.equal(actual.left.score, 0.8333);
      assert.equal(actual.right.score, 0.875);
      assert.equal(leftEquipment.score, 0.3333);
      assert.equal(rightEquipment.score, 0.5);
    },
  },
  {
    name: "13. exact tie-break uses ascending exerciseId and does not depend on input order",
    input: { tieBreak: true },
    run: () => {
      const first = rankReplacementCandidatesV1(buildExercise(), [
        buildEligibleCandidateEntry({ exerciseId: 90, slug: "candidate-z" }, { exerciseId: 90, similarityScore: 0.8 }),
        buildEligibleCandidateEntry({ exerciseId: 80, slug: "candidate-a" }, { exerciseId: 80, similarityScore: 0.8 }),
      ]);
      const second = rankReplacementCandidatesV1(buildExercise(), [
        buildEligibleCandidateEntry({ exerciseId: 80, slug: "candidate-a" }, { exerciseId: 80, similarityScore: 0.8 }),
        buildEligibleCandidateEntry({ exerciseId: 90, slug: "candidate-z" }, { exerciseId: 90, similarityScore: 0.8 }),
      ]);
      return { first, second };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.first.rankedCandidates.map((candidate) => candidate.exerciseId), [80, 90]);
      assert.deepEqual(actual.second.rankedCandidates.map((candidate) => candidate.exerciseId), [80, 90]);
      assert.equal(
        actual.first.rankedCandidates[0].rankingReasons.some(
          (reason) => reason.code === RANKING_REASON_CODES.TIE_BROKEN_BY_EXERCISE_ID
        ),
        true
      );
    },
  },
  {
    name: "14. source exercise, candidates, policy, and similarity evidence are not mutated",
    input: { immutability: true },
    run: () => {
      const source = buildExercise();
      const candidateEntry = buildEligibleCandidateEntry();
      const sourceBefore = JSON.parse(JSON.stringify(source));
      const candidateBefore = JSON.parse(JSON.stringify(candidateEntry));
      const policyBefore = JSON.parse(JSON.stringify(DEFAULT_REPLACEMENT_RANKING_POLICY_V1));

      const actual = rankReplacementCandidatesV1(source, [candidateEntry]);

      return { actual, source, sourceBefore, candidateEntry, candidateBefore, policyBefore };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.source, actual.sourceBefore);
      assert.deepEqual(actual.candidateEntry, actual.candidateBefore);
      assert.deepEqual(JSON.parse(JSON.stringify(DEFAULT_REPLACEMENT_RANKING_POLICY_V1)), actual.policyBefore);
      assert.equal(Object.isFrozen(actual.actual), true);
    },
  },
  {
    name: "15. ranking accepts only eligible candidates and never overrides blocked eligibility",
    input: { blockedCandidate: true },
    run: () =>
      rankReplacementCandidatesV1(buildExercise(), [
        {
          candidateExercise: buildExercise({ exerciseId: 99, slug: "blocked" }),
          candidateResult: buildEligibleCandidateResult({
            exerciseId: 99,
            eligibility: false,
            blockedRules: ["CANDIDATE_RULE_COMPLETE_DNA"],
            passedRules: [],
          }),
        },
      ]),
    assertError: (error) => {
      assert.match(error.message, /must already be marked eligible/i);
    },
  },
  {
    name: "16. no prisma, no candidate eligibility recomputation, and no similarity recomputation are imported by ranking",
    input: { dependencyAudit: true },
    run: async () => readFile(new URL("./index.js", import.meta.url), "utf8"),
    assertResult: (actual) => {
      assert.equal(actual.includes("@prisma/client"), false);
      assert.equal(actual.includes("buildReplacementCandidatesV1"), false);
      assert.equal(actual.includes("compareExercisesV1"), false);
      assert.equal(actual.includes("SIMILARITY_REASON_CODES"), false);
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
    if (testCase.assertError && error instanceof Error) {
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
          error: assertionError instanceof Error ? assertionError.message : String(assertionError),
          status: "FAIL",
        });
        throw assertionError;
      }
    }

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

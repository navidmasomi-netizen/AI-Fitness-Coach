import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  RANKING_POLICY_DIMENSIONS,
  RANKING_REASON_CODES,
  RANKING_RESULT_STATUSES,
  REPLACEMENT_RANKING_ENGINE_V1_VERSION,
  rankEligibleCandidatesV1,
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

function buildEligibleCandidateEntry(overrides = {}) {
  const candidateExercise = buildExercise({
    exerciseId: 52,
    slug: "front-squat",
    nameEn: "Front Squat",
  });

  return {
    candidateExercise,
    candidateResult: buildEligibleCandidateResult({
      exerciseId: candidateExercise.exerciseId,
    }),
    ...overrides,
  };
}

const TEST_ONLY_POLICY_V1 = Object.freeze({
  version: "test-only-replacement-ranking-policy-v1",
  enabledDimensions: Object.freeze([
    RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY,
    RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION,
    RANKING_POLICY_DIMENSIONS.EQUIPMENT_DELTA,
    RANKING_POLICY_DIMENSIONS.DEMAND_DELTA,
  ]),
  weights: Object.freeze({
    [RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY]: 1,
    [RANKING_POLICY_DIMENSIONS.MUSCLE_PRESERVATION]: 1,
    [RANKING_POLICY_DIMENSIONS.EQUIPMENT_DELTA]: 1,
    [RANKING_POLICY_DIMENSIONS.DEMAND_DELTA]: 1,
  }),
});

const TEST_ONLY_AVAILABLE_EVALUATION = Object.freeze({
  status: RANKING_RESULT_STATUSES.AVAILABLE,
  score: 0.8,
  breakdown: [
    {
      dimension: RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY,
      status: RANKING_RESULT_STATUSES.AVAILABLE,
      score: 0.8,
      reasons: [{ code: RANKING_REASON_CODES.EVALUATED }],
      evidence: { similarityScore: 0.8333 },
    },
  ],
  reasons: [{ code: RANKING_REASON_CODES.EVALUATED }],
});

const cases = [
  {
    name: "1. only eligible candidates are accepted into ranking input",
    input: { candidateCount: 1 },
    run: () =>
      rankEligibleCandidatesV1(buildExercise(), [buildEligibleCandidateEntry()], {
        policy: TEST_ONLY_POLICY_V1,
        evaluateCandidateRanking: () => TEST_ONLY_AVAILABLE_EVALUATION,
      }),
    assertResult: (actual) => {
      assert.equal(actual.version, REPLACEMENT_RANKING_ENGINE_V1_VERSION);
      assert.equal(actual.policyVersion, TEST_ONLY_POLICY_V1.version);
      assert.equal(actual.totalRanked, 1);
      assert.equal(actual.rankedCandidates[0].exerciseId, 52);
      assert.equal(actual.rankedCandidates[0].rankingStatus, RANKING_RESULT_STATUSES.AVAILABLE);
    },
  },
  {
    name: "2. blocked candidates fail loudly instead of being silently filtered",
    input: { blockedRules: ["CANDIDATE_RULE_COMPLETE_DNA"] },
    run: () =>
      rankEligibleCandidatesV1(
        buildExercise(),
        [
          buildEligibleCandidateEntry({
            candidateResult: buildEligibleCandidateResult({
              eligibility: false,
              blockedRules: ["CANDIDATE_RULE_COMPLETE_DNA"],
              passedRules: [],
            }),
          }),
        ],
        {
          policy: TEST_ONLY_POLICY_V1,
          evaluateCandidateRanking: () => TEST_ONLY_AVAILABLE_EVALUATION,
        }
      ),
    assertError: (error) => {
      assert.match(error.message, /must already be marked eligible/i);
    },
  },
  {
    name: "3. missing eligibility fails loudly",
    input: { eligibility: "missing" },
    run: () =>
      rankEligibleCandidatesV1(
        buildExercise(),
        [
          buildEligibleCandidateEntry({
            candidateResult: {
              ...buildEligibleCandidateResult(),
              eligibility: undefined,
            },
          }),
        ],
        {
          policy: TEST_ONLY_POLICY_V1,
          evaluateCandidateRanking: () => TEST_ONLY_AVAILABLE_EVALUATION,
        }
      ),
    assertError: (error) => {
      assert.match(error.message, /must already be marked eligible/i);
    },
  },
  {
    name: "4. deterministic ordering is higher score first",
    input: { scores: [0.6, 0.9, 0.7] },
    run: () => {
      const entries = [
        buildEligibleCandidateEntry({
          candidateExercise: buildExercise({ exerciseId: 70, slug: "front-squat-a" }),
          candidateResult: buildEligibleCandidateResult({ exerciseId: 70 }),
        }),
        buildEligibleCandidateEntry({
          candidateExercise: buildExercise({ exerciseId: 71, slug: "front-squat-b" }),
          candidateResult: buildEligibleCandidateResult({ exerciseId: 71 }),
        }),
        buildEligibleCandidateEntry({
          candidateExercise: buildExercise({ exerciseId: 72, slug: "front-squat-c" }),
          candidateResult: buildEligibleCandidateResult({ exerciseId: 72 }),
        }),
      ];
      const scores = new Map([
        [70, 0.6],
        [71, 0.9],
        [72, 0.7],
      ]);

      return rankEligibleCandidatesV1(buildExercise(), entries, {
        policy: TEST_ONLY_POLICY_V1,
        evaluateCandidateRanking: ({ candidateExercise }) => ({
          ...TEST_ONLY_AVAILABLE_EVALUATION,
          score: scores.get(candidateExercise.exerciseId),
          breakdown: [
            {
              dimension: RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY,
              status: RANKING_RESULT_STATUSES.AVAILABLE,
              score: scores.get(candidateExercise.exerciseId),
              reasons: [{ code: RANKING_REASON_CODES.EVALUATED }],
            },
          ],
        }),
      });
    },
    assertResult: (actual) => {
      assert.deepEqual(
        actual.rankedCandidates.map((candidate) => candidate.exerciseId),
        [71, 72, 70]
      );
      assert.deepEqual(
        actual.rankedCandidates.map((candidate) => candidate.rank),
        [1, 2, 3]
      );
    },
  },
  {
    name: "5. deterministic tie-break uses exerciseId and does not depend on input order",
    input: { sameScore: true },
    run: () => {
      const leftToRight = rankEligibleCandidatesV1(
        buildExercise(),
        [
          buildEligibleCandidateEntry({
            candidateExercise: buildExercise({ exerciseId: 90, slug: "candidate-z" }),
            candidateResult: buildEligibleCandidateResult({ exerciseId: 90 }),
          }),
          buildEligibleCandidateEntry({
            candidateExercise: buildExercise({ exerciseId: 80, slug: "candidate-a" }),
            candidateResult: buildEligibleCandidateResult({ exerciseId: 80 }),
          }),
        ],
        {
          policy: TEST_ONLY_POLICY_V1,
          evaluateCandidateRanking: () => TEST_ONLY_AVAILABLE_EVALUATION,
        }
      );

      const rightToLeft = rankEligibleCandidatesV1(
        buildExercise(),
        [
          buildEligibleCandidateEntry({
            candidateExercise: buildExercise({ exerciseId: 80, slug: "candidate-a" }),
            candidateResult: buildEligibleCandidateResult({ exerciseId: 80 }),
          }),
          buildEligibleCandidateEntry({
            candidateExercise: buildExercise({ exerciseId: 90, slug: "candidate-z" }),
            candidateResult: buildEligibleCandidateResult({ exerciseId: 90 }),
          }),
        ],
        {
          policy: TEST_ONLY_POLICY_V1,
          evaluateCandidateRanking: () => TEST_ONLY_AVAILABLE_EVALUATION,
        }
      );

      return { leftToRight, rightToLeft };
    },
    assertResult: (actual) => {
      assert.deepEqual(
        actual.leftToRight.rankedCandidates.map((candidate) => candidate.exerciseId),
        [80, 90]
      );
      assert.deepEqual(
        actual.rightToLeft.rankedCandidates.map((candidate) => candidate.exerciseId),
        [80, 90]
      );
      assert.equal(
        actual.leftToRight.rankedCandidates[0].rankingReasons.some(
          (reason) => reason.code === RANKING_REASON_CODES.TIE_BROKEN_BY_EXERCISE_ID
        ),
        true
      );
    },
  },
  {
    name: "6. policy validation rejects unknown, negative, non-finite, and all-zero weights",
    input: { validation: "policy" },
    run: () => ({
      valid: validateReplacementRankingPolicy(TEST_ONLY_POLICY_V1),
      invalidUnknown: () =>
        validateReplacementRankingPolicy({
          version: "bad-policy",
          enabledDimensions: ["unknown_dimension"],
          weights: { unknown_dimension: 1 },
        }),
      invalidNegative: () =>
        validateReplacementRankingPolicy({
          version: "bad-policy",
          enabledDimensions: [RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY],
          weights: { [RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY]: -1 },
        }),
      invalidAllZero: () =>
        validateReplacementRankingPolicy({
          version: "bad-policy",
          enabledDimensions: [RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY],
          weights: { [RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY]: 0 },
        }),
      invalidMissingVersion: () =>
        validateReplacementRankingPolicy({
          enabledDimensions: [RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY],
          weights: { [RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY]: 1 },
        }),
      invalidInfinity: () =>
        validateReplacementRankingPolicy({
          version: "bad-policy",
          enabledDimensions: [RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY],
          weights: { [RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY]: Number.POSITIVE_INFINITY },
        }),
    }),
    assertResult: (actual) => {
      assert.equal(actual.valid.version, TEST_ONLY_POLICY_V1.version);
      assert.throws(actual.invalidUnknown, /unknown dimension/i);
      assert.throws(actual.invalidNegative, /must not be negative/i);
      assert.throws(actual.invalidAllZero, /at least one positive weight/i);
      assert.throws(actual.invalidMissingVersion, /version must be a non-empty string/i);
      assert.throws(actual.invalidInfinity, /must be finite/i);
    },
  },
  {
    name: "7. invalid ranking scores fail loudly instead of becoming silent zeros",
    input: { score: 1.2 },
    run: () =>
      rankEligibleCandidatesV1(buildExercise(), [buildEligibleCandidateEntry()], {
        policy: TEST_ONLY_POLICY_V1,
        evaluateCandidateRanking: () => ({
          ...TEST_ONLY_AVAILABLE_EVALUATION,
          score: 1.2,
          breakdown: [
            {
              dimension: RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY,
              status: RANKING_RESULT_STATUSES.AVAILABLE,
              score: 1.2,
              reasons: [{ code: RANKING_REASON_CODES.EVALUATED }],
            },
          ],
        }),
      }),
    assertError: (error) => {
      assert.match(error.message, /must be between 0 and 1/i);
    },
  },
  {
    name: "8. ranking output preserves eligibility evidence separately from ranking reasons",
    input: { separateExplainability: true },
    run: () =>
      rankEligibleCandidatesV1(buildExercise(), [buildEligibleCandidateEntry()], {
        policy: TEST_ONLY_POLICY_V1,
        evaluateCandidateRanking: () => TEST_ONLY_AVAILABLE_EVALUATION,
      }),
    assertResult: (actual) => {
      const candidate = actual.rankedCandidates[0];
      assert.equal(candidate.eligibilityEvidence.eligibility, true);
      assert.equal(Array.isArray(candidate.eligibilityEvidence.reasons), true);
      assert.equal(candidate.rankingReasons[0].code, RANKING_REASON_CODES.EVALUATED);
      assert.notDeepEqual(candidate.eligibilityEvidence.reasons, candidate.rankingReasons);
    },
  },
  {
    name: "9. ranking output preserves similarity breakdown without recomputing it",
    input: { preserveSimilarity: true },
    run: () => {
      const candidateEntry = buildEligibleCandidateEntry({
        candidateResult: buildEligibleCandidateResult({
          similarityBreakdown: [
            {
              dimension: "movement",
              status: "AVAILABLE",
              score: 1,
              reasons: [{ code: "SIMILARITY_MOVEMENT_SAME_PATTERN" }],
              evidence: { patternA: "squat", patternB: "squat" },
            },
            {
              dimension: "equipment",
              status: "AVAILABLE",
              score: 0.3333,
              reasons: [{ code: "SIMILARITY_EQUIPMENT_PARTIAL_REQUIRED_EQUIPMENT_OVERLAP" }],
              evidence: { shared: ["rack"], onlyA: ["barbell"], onlyB: ["dumbbell"] },
            },
          ],
        }),
      });

      return rankEligibleCandidatesV1(buildExercise(), [candidateEntry], {
        policy: TEST_ONLY_POLICY_V1,
        evaluateCandidateRanking: () => TEST_ONLY_AVAILABLE_EVALUATION,
      });
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.rankedCandidates[0].similarityEvidence.similarityBreakdown, [
        {
          dimension: "movement",
          status: "AVAILABLE",
          score: 1,
          reasons: [{ code: "SIMILARITY_MOVEMENT_SAME_PATTERN" }],
          evidence: { patternA: "squat", patternB: "squat" },
        },
        {
          dimension: "equipment",
          status: "AVAILABLE",
          score: 0.3333,
          reasons: [{ code: "SIMILARITY_EQUIPMENT_PARTIAL_REQUIRED_EQUIPMENT_OVERLAP" }],
          evidence: { shared: ["rack"], onlyA: ["barbell"], onlyB: ["dumbbell"] },
        },
      ]);
    },
  },
  {
    name: "10. source exercise, candidate input, and policy remain unmutated",
    input: { immutability: true },
    run: () => {
      const source = buildExercise();
      const candidateEntry = buildEligibleCandidateEntry();
      const sourceBefore = JSON.parse(JSON.stringify(source));
      const candidateBefore = JSON.parse(JSON.stringify(candidateEntry));
      const policyBefore = JSON.parse(JSON.stringify(TEST_ONLY_POLICY_V1));

      const actual = rankEligibleCandidatesV1(source, [candidateEntry], {
        policy: TEST_ONLY_POLICY_V1,
        evaluateCandidateRanking: () => TEST_ONLY_AVAILABLE_EVALUATION,
      });

      return {
        actual,
        source,
        sourceBefore,
        candidateEntry,
        candidateBefore,
        policyBefore,
      };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.source, actual.sourceBefore);
      assert.deepEqual(actual.candidateEntry, actual.candidateBefore);
      assert.deepEqual(JSON.parse(JSON.stringify(TEST_ONLY_POLICY_V1)), actual.policyBefore);
      assert.equal(Object.isFrozen(actual.actual), true);
    },
  },
  {
    name: "11. module has no Prisma dependency and no Candidate Engine ownership",
    input: { dependencyAudit: true },
    run: async () => readFile(new URL("./index.js", import.meta.url), "utf8"),
    assertResult: (actual) => {
      assert.equal(actual.includes("@prisma/client"), false);
      assert.equal(actual.includes("exerciseCandidates"), false);
      assert.equal(actual.includes("buildReplacementCandidatesV1"), false);
    },
  },
  {
    name: "12. ranking returns all eligible candidates and has no top-n behavior",
    input: { candidateCount: 4 },
    run: () => {
      const entries = [61, 62, 63, 64].map((exerciseId) =>
        buildEligibleCandidateEntry({
          candidateExercise: buildExercise({ exerciseId, slug: `candidate-${exerciseId}` }),
          candidateResult: buildEligibleCandidateResult({ exerciseId }),
        })
      );

      return rankEligibleCandidatesV1(buildExercise(), entries, {
        policy: TEST_ONLY_POLICY_V1,
        evaluateCandidateRanking: ({ candidateExercise }) => ({
          ...TEST_ONLY_AVAILABLE_EVALUATION,
          score: Number(`0.${candidateExercise.exerciseId - 60}`),
          breakdown: [
            {
              dimension: RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY,
              status: RANKING_RESULT_STATUSES.AVAILABLE,
              score: Number(`0.${candidateExercise.exerciseId - 60}`),
              reasons: [{ code: RANKING_REASON_CODES.EVALUATED }],
            },
          ],
        }),
      });
    },
    assertResult: (actual) => {
      assert.equal(actual.totalRanked, 4);
      assert.deepEqual(
        actual.rankedCandidates.map((candidate) => candidate.exerciseId),
        [64, 63, 62, 61]
      );
    },
  },
  {
    name: "13. ranking scores are bounded semantic ordering values, not probabilities",
    input: { scoreDomain: [0, 1] },
    run: () =>
      rankEligibleCandidatesV1(
        buildExercise(),
        [
          buildEligibleCandidateEntry({
            candidateExercise: buildExercise({ exerciseId: 75, slug: "low-score" }),
            candidateResult: buildEligibleCandidateResult({ exerciseId: 75 }),
          }),
          buildEligibleCandidateEntry({
            candidateExercise: buildExercise({ exerciseId: 76, slug: "high-score" }),
            candidateResult: buildEligibleCandidateResult({ exerciseId: 76 }),
          }),
        ],
        {
          policy: TEST_ONLY_POLICY_V1,
          evaluateCandidateRanking: ({ candidateExercise }) => ({
            ...TEST_ONLY_AVAILABLE_EVALUATION,
            score: candidateExercise.exerciseId === 75 ? 0 : 1,
            breakdown: [
              {
                dimension: RANKING_POLICY_DIMENSIONS.SEMANTIC_SIMILARITY,
                status: RANKING_RESULT_STATUSES.AVAILABLE,
                score: candidateExercise.exerciseId === 75 ? 0 : 1,
                reasons: [{ code: RANKING_REASON_CODES.EVALUATED }],
              },
            ],
          }),
        }
      ),
    assertResult: (actual) => {
      assert.deepEqual(
        actual.rankedCandidates.map((candidate) => candidate.rankingScore),
        [1, 0]
      );
      assert.equal(Object.prototype.hasOwnProperty.call(actual.rankedCandidates[0], "probability"), false);
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

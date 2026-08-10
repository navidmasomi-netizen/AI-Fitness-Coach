import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  decideReplacementV1,
  REPLACEMENT_DECISION_ENGINE_V1_VERSION,
  REPLACEMENT_DECISION_REASON_CODES,
  REPLACEMENT_DECISION_STATUSES,
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

function buildIntegrityEvaluation(overrides = {}) {
  return {
    exerciseId: 52,
    integrityStatus: "PASS",
    integrityScore: 1,
    integrityBreakdown: [
      {
        dimension: "movementPatternRedundancy",
        status: "PASS",
        score: 1,
        reasons: [{ code: "WORKOUT_INTEGRITY_MOVEMENT_PATTERN_BALANCED" }],
        evidence: { counts: { squat: 1 } },
      },
    ],
    integrityReasons: [{ code: "WORKOUT_INTEGRITY_MOVEMENT_PATTERN_BALANCED" }],
    rankingEvidence: {
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
    },
    resultingWorkoutSummary: {
      totalExercises: 4,
      exerciseIds: [52, 30, 31, 32],
      movementPatternCounts: { squat: 1, hinge: 1 },
      exerciseClassCounts: { compound: 2, isolation: 2 },
      primaryMuscleCounts: { quadriceps: 1, glutes: 1 },
      unavailableDimensions: [],
    },
    ...overrides,
  };
}

const cases = [
  {
    name: "1. rank 1 PASS becomes RECOMMENDED and preserves ranking authority",
    input: { ranks: ["PASS", "PASS"] },
    run: () =>
      decideReplacementV1(13, [
        buildIntegrityEvaluation(),
        buildIntegrityEvaluation({
          exerciseId: 71,
          rankingEvidence: {
            ...buildIntegrityEvaluation().rankingEvidence,
            rankingScore: 0.75,
            rank: 2,
          },
        }),
      ]),
    assertResult: (actual) => {
      assert.equal(actual.version, REPLACEMENT_DECISION_ENGINE_V1_VERSION);
      assert.equal(actual.decisionStatus, REPLACEMENT_DECISION_STATUSES.RECOMMENDED);
      assert.equal(actual.recommendedCandidate.exerciseId, 52);
      assert.equal(actual.alternatives[0].exerciseId, 71);
      assert.equal(actual.decisionReasons[0].code, REPLACEMENT_DECISION_REASON_CODES.TOP_RANKED_PASS);
    },
  },
  {
    name: "2. rank 1 WARN still becomes RECOMMENDED_WITH_WARNING ahead of lower-ranked PASS",
    input: { ranks: ["WARN", "PASS"] },
    run: () =>
      decideReplacementV1(13, [
        buildIntegrityEvaluation({
          integrityStatus: "WARN",
          integrityScore: 0.8,
          rankingEvidence: {
            ...buildIntegrityEvaluation().rankingEvidence,
            rankingScore: 0.9,
            rank: 1,
          },
        }),
        buildIntegrityEvaluation({
          exerciseId: 71,
          rankingEvidence: {
            ...buildIntegrityEvaluation().rankingEvidence,
            rankingScore: 0.8,
            rank: 2,
          },
        }),
      ]),
    assertResult: (actual) => {
      assert.equal(actual.decisionStatus, REPLACEMENT_DECISION_STATUSES.RECOMMENDED_WITH_WARNING);
      assert.equal(actual.recommendedCandidate.exerciseId, 52);
      assert.equal(actual.recommendedCandidate.integrityStatus, "WARN");
      assert.equal(actual.decisionReasons[0].code, REPLACEMENT_DECISION_REASON_CODES.TOP_RANKED_WARN);
    },
  },
  {
    name: "3. rank 1 BLOCK is skipped and retained in rejectedCandidates while rank 2 PASS is recommended",
    input: { ranks: ["BLOCK", "PASS"] },
    run: () =>
      decideReplacementV1(13, [
        buildIntegrityEvaluation({
          integrityStatus: "BLOCK",
          integrityScore: null,
        }),
        buildIntegrityEvaluation({
          exerciseId: 71,
          rankingEvidence: {
            ...buildIntegrityEvaluation().rankingEvidence,
            rankingScore: 0.8,
            rank: 2,
          },
        }),
      ]),
    assertResult: (actual) => {
      assert.equal(actual.decisionStatus, REPLACEMENT_DECISION_STATUSES.RECOMMENDED);
      assert.equal(actual.recommendedCandidate.exerciseId, 71);
      assert.equal(actual.rejectedCandidates[0].exerciseId, 52);
      assert.equal(actual.rejectedCandidates[0].rank, 1);
      assert.equal(
        actual.decisionReasons.some((reason) => reason.code === REPLACEMENT_DECISION_REASON_CODES.BLOCKED_BY_INTEGRITY),
        true
      );
    },
  },
  {
    name: "4. rank 1 BLOCK and rank 2 WARN yields RECOMMENDED_WITH_WARNING",
    input: { ranks: ["BLOCK", "WARN"] },
    run: () =>
      decideReplacementV1(13, [
        buildIntegrityEvaluation({
          integrityStatus: "BLOCK",
          integrityScore: null,
        }),
        buildIntegrityEvaluation({
          exerciseId: 71,
          integrityStatus: "WARN",
          integrityScore: 0.8,
          rankingEvidence: {
            ...buildIntegrityEvaluation().rankingEvidence,
            rankingScore: 0.8,
            rank: 2,
          },
        }),
      ]),
    assertResult: (actual) => {
      assert.equal(actual.decisionStatus, REPLACEMENT_DECISION_STATUSES.RECOMMENDED_WITH_WARNING);
      assert.equal(actual.recommendedCandidate.exerciseId, 71);
      assert.equal(actual.recommendedCandidate.integrityStatus, "WARN");
    },
  },
  {
    name: "5. all BLOCK yields NO_SAFE_REPLACEMENT with all candidates rejected",
    input: { ranks: ["BLOCK", "BLOCK"] },
    run: () =>
      decideReplacementV1(13, [
        buildIntegrityEvaluation({
          integrityStatus: "BLOCK",
          integrityScore: null,
        }),
        buildIntegrityEvaluation({
          exerciseId: 71,
          integrityStatus: "BLOCK",
          integrityScore: null,
          rankingEvidence: {
            ...buildIntegrityEvaluation().rankingEvidence,
            rankingScore: 0.8,
            rank: 2,
          },
        }),
      ]),
    assertResult: (actual) => {
      assert.equal(actual.decisionStatus, REPLACEMENT_DECISION_STATUSES.NO_SAFE_REPLACEMENT);
      assert.equal(actual.recommendedCandidate, null);
      assert.deepEqual(actual.alternatives, []);
      assert.deepEqual(
        actual.rejectedCandidates.map((candidate) => candidate.exerciseId),
        [52, 71]
      );
      assert.equal(actual.decisionReasons.at(-1).code, REPLACEMENT_DECISION_REASON_CODES.NO_SAFE_REPLACEMENT);
    },
  },
  {
    name: "6. empty candidate list yields NO_SAFE_REPLACEMENT without fabrication",
    input: { ranks: [] },
    run: () => decideReplacementV1(13, []),
    assertResult: (actual) => {
      assert.equal(actual.decisionStatus, REPLACEMENT_DECISION_STATUSES.NO_SAFE_REPLACEMENT);
      assert.equal(actual.recommendedCandidate, null);
      assert.deepEqual(actual.alternatives, []);
      assert.deepEqual(actual.rejectedCandidates, []);
    },
  },
  {
    name: "7. alternatives preserve upstream rank order exactly",
    input: { ranks: [1, 2, 3] },
    run: () =>
      decideReplacementV1(13, [
        buildIntegrityEvaluation(),
        buildIntegrityEvaluation({
          exerciseId: 71,
          rankingEvidence: {
            ...buildIntegrityEvaluation().rankingEvidence,
            rank: 2,
            rankingScore: 0.8,
          },
        }),
        buildIntegrityEvaluation({
          exerciseId: 72,
          rankingEvidence: {
            ...buildIntegrityEvaluation().rankingEvidence,
            rank: 3,
            rankingScore: 0.7,
          },
        }),
      ]),
    assertResult: (actual) => {
      assert.deepEqual(
        actual.alternatives.map((candidate) => candidate.rank),
        [2, 3]
      );
    },
  },
  {
    name: "8. malformed upstream rank order fails loudly instead of reranking",
    input: { malformedRanks: true },
    run: () =>
      decideReplacementV1(13, [
        buildIntegrityEvaluation({
          rankingEvidence: {
            ...buildIntegrityEvaluation().rankingEvidence,
            rank: 2,
          },
        }),
      ]),
    assertError: (error) => {
      assert.match(error.message, /preserve upstream ranking order exactly/i);
    },
  },
  {
    name: "9. malformed eligibility evidence fails loudly",
    input: { malformedEligibility: true },
    run: () =>
      decideReplacementV1(13, [
        buildIntegrityEvaluation({
          rankingEvidence: {
            ...buildIntegrityEvaluation().rankingEvidence,
            eligibilityEvidence: { eligibility: false },
          },
        }),
      ]),
    assertError: (error) => {
      assert.match(error.message, /eligible candidate evidence only/i);
    },
  },
  {
    name: "10. input integrity evaluations are not mutated and no combined score is introduced",
    input: { immutability: true },
    run: () => {
      const evaluations = [buildIntegrityEvaluation()];
      const before = JSON.parse(JSON.stringify(evaluations));
      const actual = decideReplacementV1(13, evaluations);
      return { actual, evaluations, before };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.evaluations, actual.before);
      assert.equal("decisionScore" in actual.actual, false);
      assert.equal("combinedScore" in actual.actual, false);
      assert.equal(actual.actual.recommendedCandidate.integrityEvidence.integrityBreakdown.length > 0, true);
      assert.equal(Object.isFrozen(actual.actual), true);
    },
  },
  {
    name: "11. traceability preserves candidate, similarity, ranking, and integrity evidence for the recommendation",
    input: { traceability: true },
    run: () => decideReplacementV1(13, [buildIntegrityEvaluation()]),
    assertResult: (actual) => {
      const candidate = actual.recommendedCandidate;
      assert.equal(candidate.eligibilityEvidence.eligibility, true);
      assert.equal(candidate.similarityEvidence.similarityScore, 0.9167);
      assert.equal(candidate.rankingEvidence.rank, 1);
      assert.equal(candidate.integrityEvidence.integrityBreakdown.length > 0, true);
    },
  },
  {
    name: "12. module stays pure and does not import upstream recomputation engines or prisma",
    input: { dependencyAudit: true },
    run: async () => readFile(new URL("./index.js", import.meta.url), "utf8"),
    assertResult: (actual) => {
      assert.equal(actual.includes("@prisma/client"), false);
      assert.equal(actual.includes("compareExercisesV1"), false);
      assert.equal(actual.includes("buildReplacementCandidatesV1"), false);
      assert.equal(actual.includes("rankReplacementCandidatesV1"), false);
      assert.equal(actual.includes("evaluateWorkoutIntegrityV1"), false);
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

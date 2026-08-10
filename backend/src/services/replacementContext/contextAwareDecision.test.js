import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyReplacementContextV1,
  CONTEXTUAL_DECISION_REASON_CODES,
  CONTEXTUAL_DECISION_STATUSES,
  CONTEXT_AWARE_DECISION_V1_VERSION,
} from "./contextAwareDecision.js";
import { REPLACEMENT_CONTEXT_V1_VERSION } from "./replacementContext.js";
import { REPLACEMENT_INTENT_TYPES, REPLACEMENT_INTENT_V1_VERSION } from "./replacementIntent.js";

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

function buildReplacementContext(overrides = {}) {
  return {
    version: REPLACEMENT_CONTEXT_V1_VERSION,
    equipmentContext: null,
    replacementIntent: null,
    ...overrides,
  };
}

function buildIntent(type) {
  return {
    version: REPLACEMENT_INTENT_V1_VERSION,
    type,
  };
}

function buildContextCandidate({
  exerciseId = 52,
  rank = 1,
  rankingScore = 0.8334,
  integrityStatus = "PASS",
  integrityScore = 1,
} = {}) {
  return {
    exerciseId,
    rankingScore,
    rank,
    integrityStatus,
    integrityScore,
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
    eligibilityEvidence: {
      eligibility: true,
      passedRules: ["CANDIDATE_RULE_ACTIVE_CATALOG_EXERCISE"],
      blockedRules: [],
      reasons: [{ ruleId: "CANDIDATE_RULE_ACTIVE_CATALOG_EXERCISE", status: "PASSED" }],
    },
    rankingEvidence: {
      rankingStatus: "AVAILABLE",
      rankingScore,
      rank,
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
    integrityEvidence: {
      integrityBreakdown: [
        {
          dimension: "movementPatternRedundancy",
          status: integrityStatus,
          score: integrityStatus === "WARN" ? 0.75 : 1,
          reasons: [{ code: "WORKOUT_INTEGRITY_MOVEMENT_PATTERN_BALANCED" }],
          evidence: { counts: { squat: 1 } },
        },
      ],
      integrityReasons: [{ code: "WORKOUT_INTEGRITY_MOVEMENT_PATTERN_BALANCED" }],
      resultingWorkoutSummary: {
        totalExercises: 4,
        exerciseIds: [exerciseId, 30, 31, 32],
        movementPatternCounts: { squat: 1, hinge: 1 },
        exerciseClassCounts: { compound: 2, isolation: 2 },
        primaryMuscleCounts: { quadriceps: 1, glutes: 1 },
        unavailableDimensions: [],
      },
    },
  };
}

function buildCoreRejectedCandidate({ exerciseId = 91, rank = 3 } = {}) {
  return {
    exerciseId,
    rank,
    integrityStatus: "BLOCK",
    integrityReasons: [{ code: "WORKOUT_INTEGRITY_EXACT_DUPLICATE" }],
    rankingEvidence: {
      rankingStatus: "AVAILABLE",
      rankingScore: 0.5,
      rank,
      rankingBreakdown: [],
      rankingReasons: [],
      eligibilityEvidence: {
        eligibility: true,
        passedRules: ["CANDIDATE_RULE_ACTIVE_CATALOG_EXERCISE"],
        blockedRules: [],
        reasons: [{ ruleId: "CANDIDATE_RULE_ACTIVE_CATALOG_EXERCISE", status: "PASSED" }],
      },
      similarityEvidence: {
        similarityScore: 0.5,
        similarityStatus: "AVAILABLE",
        similarityBreakdown: [],
      },
    },
    eligibilityEvidence: {
      eligibility: true,
      passedRules: ["CANDIDATE_RULE_ACTIVE_CATALOG_EXERCISE"],
      blockedRules: [],
      reasons: [{ ruleId: "CANDIDATE_RULE_ACTIVE_CATALOG_EXERCISE", status: "PASSED" }],
    },
    similarityEvidence: {
      similarityScore: 0.5,
      similarityStatus: "AVAILABLE",
      similarityBreakdown: [],
    },
  };
}

function buildCoreDecision({
  decisionStatus = "RECOMMENDED",
  recommendedCandidate = buildContextCandidate(),
  alternatives = [],
  rejectedCandidates = [],
} = {}) {
  return {
    version: "replacement-decision-v1",
    sourceExerciseId: 13,
    decisionStatus,
    recommendedCandidate,
    alternatives,
    rejectedCandidates,
    decisionReasons: [],
  };
}

function buildCandidateExercise({ exerciseId, requiredEquipment, nameEn = "Exercise" }) {
  return {
    exerciseId,
    slug: `exercise-${exerciseId}`,
    nameEn,
    requiredEquipment,
  };
}

const cases = [
  {
    name: "1. no context preserves the core recommendation exactly while wrapping context evidence",
    input: { equipmentContext: null, replacementIntent: null },
    run: () =>
      applyReplacementContextV1(
        buildCoreDecision(),
        buildReplacementContext(),
        [buildCandidateExercise({ exerciseId: 52, requiredEquipment: ["barbell", "rack"] })]
      ),
    assertResult: (actual) => {
      assert.equal(actual.version, CONTEXT_AWARE_DECISION_V1_VERSION);
      assert.equal(actual.contextualDecisionStatus, CONTEXTUAL_DECISION_STATUSES.RECOMMENDED);
      assert.equal(actual.recommendedCandidate.exerciseId, 52);
      assert.equal(actual.recommendedCandidate.equipmentAvailabilityEvidence.status, "CONTEXT_UNKNOWN");
      assert.equal(actual.contextReasons[0].code, CONTEXTUAL_DECISION_REASON_CODES.CORE_PRESERVED);
    },
  },
  {
    name: "2. unavailable equipment rejects the top core recommendation and falls back to the next ranked candidate without reranking",
    input: { fallback: true },
    run: () =>
      applyReplacementContextV1(
        buildCoreDecision({
          recommendedCandidate: buildContextCandidate({ exerciseId: 52, rank: 1, rankingScore: 0.9 }),
          alternatives: [buildContextCandidate({ exerciseId: 71, rank: 2, rankingScore: 0.8 })],
          rejectedCandidates: [buildCoreRejectedCandidate()],
        }),
        buildReplacementContext({
          equipmentContext: { availableEquipment: ["dumbbell"] },
        }),
        [
          buildCandidateExercise({ exerciseId: 52, requiredEquipment: ["barbell", "rack"], nameEn: "Front Squat" }),
          buildCandidateExercise({ exerciseId: 71, requiredEquipment: ["dumbbell"], nameEn: "Goblet Squat" }),
        ]
      ),
    assertResult: (actual) => {
      assert.equal(actual.recommendedCandidate.exerciseId, 71);
      assert.deepEqual(actual.alternatives, []);
      assert.deepEqual(actual.contextRejectedCandidates.map((candidate) => candidate.exerciseId), [52]);
      assert.equal(actual.contextRejectedCandidates[0].contextReasons[1].code, CONTEXTUAL_DECISION_REASON_CODES.EQUIPMENT_UNAVAILABLE);
      assert.equal(actual.coreRejectedCandidates[0].exerciseId, 91);
    },
  },
  {
    name: "3. all non-blocked candidates equipment-unavailable yields NO_CONTEXTUAL_REPLACEMENT",
    input: { allUnavailable: true },
    run: () =>
      applyReplacementContextV1(
        buildCoreDecision({
          recommendedCandidate: buildContextCandidate({ exerciseId: 52, rank: 1 }),
          alternatives: [buildContextCandidate({ exerciseId: 71, rank: 2, rankingScore: 0.8 })],
        }),
        buildReplacementContext({
          equipmentContext: { availableEquipment: ["cable"] },
        }),
        [
          buildCandidateExercise({ exerciseId: 52, requiredEquipment: ["barbell", "rack"] }),
          buildCandidateExercise({ exerciseId: 71, requiredEquipment: ["bench", "dumbbell"] }),
        ]
      ),
    assertResult: (actual) => {
      assert.equal(actual.contextualDecisionStatus, CONTEXTUAL_DECISION_STATUSES.NO_CONTEXTUAL_REPLACEMENT);
      assert.equal(actual.recommendedCandidate, null);
      assert.deepEqual(
        actual.contextRejectedCandidates.map((candidate) => candidate.exerciseId),
        [52, 71]
      );
      assert.equal(actual.contextReasons.at(-1).code, CONTEXTUAL_DECISION_REASON_CODES.NO_CONTEXTUAL_REPLACEMENT);
    },
  },
  {
    name: "4. unknown equipment context preserves core behavior",
    input: { equipmentContext: null },
    run: () =>
      applyReplacementContextV1(
        buildCoreDecision(),
        buildReplacementContext({
          replacementIntent: buildIntent(REPLACEMENT_INTENT_TYPES.NO_EQUIPMENT),
        }),
        [buildCandidateExercise({ exerciseId: 52, requiredEquipment: ["barbell", "rack"] })]
      ),
    assertResult: (actual) => {
      assert.equal(actual.recommendedCandidate.exerciseId, 52);
      assert.equal(actual.recommendedCandidate.equipmentAvailabilityEvidence.status, "CONTEXT_UNKNOWN");
      assert.equal(actual.contextualDecisionStatus, CONTEXTUAL_DECISION_STATUSES.RECOMMENDED);
    },
  },
  {
    name: "5. metadata unavailable does not auto-reject and preserves uncertainty evidence",
    input: { metadataUnavailable: true },
    run: () =>
      applyReplacementContextV1(
        buildCoreDecision(),
        buildReplacementContext({
          equipmentContext: { availableEquipment: ["barbell", "rack"] },
        }),
        [buildCandidateExercise({ exerciseId: 52, requiredEquipment: [] })]
      ),
    assertResult: (actual) => {
      assert.equal(actual.recommendedCandidate.exerciseId, 52);
      assert.equal(actual.recommendedCandidate.equipmentAvailabilityEvidence.status, "METADATA_UNAVAILABLE");
      assert.equal(
        actual.recommendedCandidate.contextReasons.some(
          (reason) => reason.code === CONTEXTUAL_DECISION_REASON_CODES.EQUIPMENT_METADATA_UNAVAILABLE
        ),
        true
      );
    },
  },
  {
    name: "6. PREFER_VARIATION is policy-neutral in v1 when equipment is feasible",
    input: { intent: "PREFER_VARIATION" },
    run: () =>
      applyReplacementContextV1(
        buildCoreDecision(),
        buildReplacementContext({
          equipmentContext: { availableEquipment: ["barbell", "rack"] },
          replacementIntent: buildIntent(REPLACEMENT_INTENT_TYPES.PREFER_VARIATION),
        }),
        [buildCandidateExercise({ exerciseId: 52, requiredEquipment: ["barbell", "rack"] })]
      ),
    assertResult: (actual) => {
      assert.equal(actual.recommendedCandidate.exerciseId, 52);
      assert.equal(actual.recommendedCandidate.contextReasons[0].data.replacementIntentType, "PREFER_VARIATION");
    },
  },
  {
    name: "7. NO_EQUIPMENT uses explicit equipment context without inferring availability from intent alone",
    input: { intent: "NO_EQUIPMENT" },
    run: () =>
      applyReplacementContextV1(
        buildCoreDecision({
          alternatives: [buildContextCandidate({ exerciseId: 71, rank: 2, rankingScore: 0.8 })],
        }),
        buildReplacementContext({
          equipmentContext: { availableEquipment: ["dumbbell"] },
          replacementIntent: buildIntent(REPLACEMENT_INTENT_TYPES.NO_EQUIPMENT),
        }),
        [
          buildCandidateExercise({ exerciseId: 52, requiredEquipment: ["barbell", "rack"] }),
          buildCandidateExercise({ exerciseId: 71, requiredEquipment: ["dumbbell"] }),
        ]
      ),
    assertResult: (actual) => {
      assert.equal(actual.recommendedCandidate.exerciseId, 71);
      assert.equal(actual.contextRejectedCandidates[0].exerciseId, 52);
    },
  },
  {
    name: "8. EQUIPMENT_BUSY does not invent busy-state semantics beyond current equipment facts",
    input: { intent: "EQUIPMENT_BUSY" },
    run: () =>
      applyReplacementContextV1(
        buildCoreDecision(),
        buildReplacementContext({
          replacementIntent: buildIntent(REPLACEMENT_INTENT_TYPES.EQUIPMENT_BUSY),
        }),
        [buildCandidateExercise({ exerciseId: 52, requiredEquipment: ["barbell", "rack"] })]
      ),
    assertResult: (actual) => {
      assert.equal(actual.recommendedCandidate.exerciseId, 52);
      assert.equal(actual.recommendedCandidate.equipmentAvailabilityEvidence.status, "CONTEXT_UNKNOWN");
      assert.equal(actual.recommendedCandidate.contextReasons[0].data.replacementIntentType, "EQUIPMENT_BUSY");
    },
  },
  {
    name: "9. DISCOMFORT remains non-medical and does not trigger automatic filtering",
    input: { intent: "DISCOMFORT" },
    run: () =>
      applyReplacementContextV1(
        buildCoreDecision(),
        buildReplacementContext({
          replacementIntent: buildIntent(REPLACEMENT_INTENT_TYPES.DISCOMFORT),
        }),
        [buildCandidateExercise({ exerciseId: 52, requiredEquipment: ["barbell", "rack"] })]
      ),
    assertResult: (actual) => {
      const serialized = JSON.stringify(actual);
      assert.equal(actual.recommendedCandidate.exerciseId, 52);
      assert.equal(/injury|diagnosis|contraindication|medical/i.test(serialized), false);
    },
  },
  {
    name: "10. core WARN recommendation stays RECOMMENDED_WITH_WARNING when contextually feasible",
    input: { integrity: "WARN" },
    run: () =>
      applyReplacementContextV1(
        buildCoreDecision({
          decisionStatus: "RECOMMENDED_WITH_WARNING",
          recommendedCandidate: buildContextCandidate({ integrityStatus: "WARN", integrityScore: 0.8 }),
        }),
        buildReplacementContext({
          equipmentContext: { availableEquipment: ["barbell", "rack"] },
        }),
        [buildCandidateExercise({ exerciseId: 52, requiredEquipment: ["barbell", "rack"] })]
      ),
    assertResult: (actual) => {
      assert.equal(actual.contextualDecisionStatus, CONTEXTUAL_DECISION_STATUSES.RECOMMENDED_WITH_WARNING);
      assert.equal(actual.recommendedCandidate.integrityStatus, "WARN");
    },
  },
  {
    name: "11. core NO_SAFE_REPLACEMENT becomes NO_CONTEXTUAL_REPLACEMENT without fabrication",
    input: { coreStatus: "NO_SAFE_REPLACEMENT" },
    run: () =>
      applyReplacementContextV1(
        buildCoreDecision({
          decisionStatus: "NO_SAFE_REPLACEMENT",
          recommendedCandidate: null,
        }),
        buildReplacementContext(),
        []
      ),
    assertResult: (actual) => {
      assert.equal(actual.contextualDecisionStatus, CONTEXTUAL_DECISION_STATUSES.NO_CONTEXTUAL_REPLACEMENT);
      assert.equal(actual.recommendedCandidate, null);
      assert.deepEqual(actual.alternatives, []);
    },
  },
  {
    name: "12. no reranking and no new score are introduced",
    input: { noNewScore: true },
    run: () =>
      applyReplacementContextV1(
        buildCoreDecision({
          recommendedCandidate: buildContextCandidate({ exerciseId: 52, rank: 1, rankingScore: 0.95 }),
          alternatives: [buildContextCandidate({ exerciseId: 71, rank: 2, rankingScore: 0.8 })],
        }),
        buildReplacementContext({
          equipmentContext: { availableEquipment: ["dumbbell"] },
        }),
        [
          buildCandidateExercise({ exerciseId: 52, requiredEquipment: ["barbell", "rack"] }),
          buildCandidateExercise({ exerciseId: 71, requiredEquipment: ["dumbbell"] }),
        ]
      ),
    assertResult: (actual) => {
      assert.equal(actual.recommendedCandidate.exerciseId, 71);
      assert.equal("contextScore" in actual, false);
      assert.equal("finalScore" in actual, false);
      assert.equal("decisionScore" in actual, false);
      assert.equal(actual.recommendedCandidate.rankingScore, 0.8);
    },
  },
  {
    name: "13. intrinsic eligibility evidence remains unchanged and separate from contextual rejection evidence",
    input: { evidenceDomains: true },
    run: () =>
      applyReplacementContextV1(
        buildCoreDecision({
          alternatives: [buildContextCandidate({ exerciseId: 71, rank: 2, rankingScore: 0.8 })],
        }),
        buildReplacementContext({
          equipmentContext: { availableEquipment: ["dumbbell"] },
        }),
        [
          buildCandidateExercise({ exerciseId: 52, requiredEquipment: ["barbell", "rack"] }),
          buildCandidateExercise({ exerciseId: 71, requiredEquipment: ["dumbbell"] }),
        ]
      ),
    assertResult: (actual) => {
      const rejected = actual.contextRejectedCandidates[0];
      assert.equal(rejected.eligibilityEvidence.eligibility, true);
      assert.equal(rejected.rejectionDomain, "contextual_equipment_availability");
      assert.equal(
        rejected.contextReasons.some((reason) => reason.code === CONTEXTUAL_DECISION_REASON_CODES.EQUIPMENT_UNAVAILABLE),
        true
      );
    },
  },
  {
    name: "14. identity mismatch fails loudly",
    input: { identityMismatch: true },
    run: () => () =>
      applyReplacementContextV1(
        buildCoreDecision(),
        buildReplacementContext(),
        [buildCandidateExercise({ exerciseId: 71, requiredEquipment: ["barbell", "rack"] })]
      ),
    assertResult: (actual) => {
      assert.throws(actual, /missing exerciseId 52/i);
    },
  },
  {
    name: "15. inputs are not mutated and output remains deterministic",
    input: { immutability: true },
    run: () => {
      const coreDecision = buildCoreDecision();
      const replacementContext = buildReplacementContext({
        equipmentContext: { availableEquipment: ["barbell", "rack"] },
        replacementIntent: buildIntent(REPLACEMENT_INTENT_TYPES.UNKNOWN),
      });
      const candidateExercises = [buildCandidateExercise({ exerciseId: 52, requiredEquipment: ["barbell", "rack"] })];
      const before = JSON.parse(JSON.stringify({ coreDecision, replacementContext, candidateExercises }));
      const first = applyReplacementContextV1(coreDecision, replacementContext, candidateExercises);
      const second = applyReplacementContextV1(coreDecision, replacementContext, candidateExercises);
      return { first, second, coreDecision, replacementContext, candidateExercises, before };
    },
    assertResult: (actual) => {
      assert.deepEqual(actual.first, actual.second);
      assert.deepEqual(
        { coreDecision: actual.coreDecision, replacementContext: actual.replacementContext, candidateExercises: actual.candidateExercises },
        actual.before
      );
      assert.equal(Object.isFrozen(actual.first), true);
    },
  },
  {
    name: "16. module has no Prisma dependency and does not import core engines beyond evidence consumption",
    input: { dependency: "Prisma" },
    run: async () => {
      const fileContent = await readFile(new URL("./contextAwareDecision.js", import.meta.url), "utf8");
      return { fileContent };
    },
    assertResult: (actual) => {
      assert.equal(/prisma/i.test(actual.fileContent), false);
      assert.equal(/exerciseSimilarity/i.test(actual.fileContent), false);
      assert.equal(/exerciseCandidates/i.test(actual.fileContent), false);
      assert.equal(/exerciseRanking/i.test(actual.fileContent), false);
      assert.equal(/workoutIntegrity/i.test(actual.fileContent), false);
    },
  },
];

let passed = 0;

for (const testCase of cases) {
  try {
    const actual = await testCase.run();
    testCase.assertResult(actual);
    passed += 1;
    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      actual,
      status: "PASS",
    });
  } catch (error) {
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

import assert from "node:assert/strict";

import prisma from "../lib/prisma.js";
import {
  REPLACEMENT_API_REASON_CODES,
  REPLACEMENT_API_V1_VERSION,
  ReplacementRecommendationError,
  getWorkoutExerciseReplacementsV1,
} from "./replacementRecommendationService.js";

const TEST_EMAIL_DOMAIN = "@example.com";
const TEST_RUN_NONCE = `${process.pid}-${Date.now()}`;
const DNA_PATTERNS = [
  "squat",
  "hinge",
  "lunge",
  "single_leg",
  "horizontal_press",
  "vertical_press",
  "horizontal_pull",
  "vertical_pull",
  "knee_extension",
  "knee_flexion",
  "hip_extension",
  "shoulder_abduction",
  "elbow_flexion",
  "elbow_extension",
  "trunk_flexion",
  "anti_extension",
  "anti_rotation",
];
const COMPLEXITIES = ["compound", "isolation"];

function printCaseResult({ name, input, actual, error, status }) {
  console.log(`CASE: ${name}`);
  console.log(`INPUT: ${JSON.stringify(input)}`);
  if (actual !== undefined) {
    console.log(`ACTUAL: ${JSON.stringify(actual)}`);
  }
  if (error) {
    console.log(`ERROR: ${error.stack || error.message}`);
  }
  console.log(`RESULT: ${status}`);
  console.log("---");
}

function buildContext(overrides = {}) {
  return {
    version: "replacement-context-v1",
    equipmentContext: null,
    replacementIntent: null,
    ...overrides,
  };
}

async function createTestUser(suffix) {
  return prisma.user.create({
    data: {
      email: `replacement-api-${suffix}-${TEST_RUN_NONCE}${TEST_EMAIL_DOMAIN}`,
      name: `Replacement API ${suffix}`,
      password: "hashed-password",
    },
  });
}

async function cleanupFixture(fixture) {
  if (!fixture) {
    return;
  }

  const userId = fixture.user?.id ?? null;
  const sessionId = fixture.session?.id ?? null;
  const programId = fixture.program?.id ?? null;
  const programDayId = fixture.programDay?.id ?? null;
  const programDayExerciseIds = fixture.programDayExercises?.map((entry) => entry.id) ?? [];
  const customExerciseIds = fixture.customExercises?.map((entry) => entry.id) ?? [];

  if (sessionId) {
    await prisma.recommendationApplication.deleteMany({ where: { workoutSessionId: sessionId } });
    await prisma.workoutSessionExerciseTarget.deleteMany({ where: { sessionId } });
    await prisma.setLog.deleteMany({ where: { sessionId } });
    await prisma.workoutSession.deleteMany({ where: { id: sessionId } });
  }

  if (programDayExerciseIds.length > 0) {
    await prisma.programDayExercise.deleteMany({ where: { id: { in: programDayExerciseIds } } });
  }

  if (programDayId) {
    await prisma.programDay.deleteMany({ where: { id: programDayId } });
  }

  if (programId) {
    await prisma.program.deleteMany({ where: { id: programId } });
  }

  if (customExerciseIds.length > 0) {
    await prisma.exercise.deleteMany({ where: { id: { in: customExerciseIds } } });
  }

  if (userId) {
    await prisma.user.deleteMany({ where: { id: userId } });
  }
}

async function loadExercisesByName(names) {
  const rows = await prisma.exercise.findMany({
    where: {
      nameEn: { in: names },
    },
    orderBy: [{ id: "asc" }],
  });

  const byName = new Map(rows.map((row) => [row.nameEn, row]));
  for (const name of names) {
    if (!byName.has(name)) {
      throw new Error(`Expected seeded exercise "${name}" to exist.`);
    }
  }

  return byName;
}

async function createSessionFixture({
  suffix,
  exerciseNames,
  sourceExerciseName,
  customSourceExercise = null,
} = {}) {
  const user = await createTestUser(suffix);
  const namedExercises = await loadExercisesByName(exerciseNames);
  const exercises = customSourceExercise
    ? [customSourceExercise, ...exerciseNames.map((name) => namedExercises.get(name))]
    : exerciseNames.map((name) => namedExercises.get(name));

  const program = await prisma.program.create({
    data: {
      name: `Replacement API Test Program ${suffix}`,
      splitFamily: "upper_lower",
      goal: "hypertrophy",
      isStatic: false,
    },
  });

  const programDay = await prisma.programDay.create({
    data: {
      programId: program.id,
      dayIndex: 1,
      name: "Test Day",
    },
  });

  const programDayExercises = [];
  for (const [index, exercise] of exercises.entries()) {
    const programDayExercise = await prisma.programDayExercise.create({
      data: {
        programDayId: programDay.id,
        exerciseId: exercise.id,
        order: index + 1,
        sets: 3,
        repRangeLow: 8,
        repRangeHigh: 10,
        restSeconds: 90,
        progressionType: "load",
      },
    });
    programDayExercises.push(programDayExercise);
  }

  const session = await prisma.workoutSession.create({
    data: {
      userId: user.id,
      programId: program.id,
      programDayId: programDay.id,
      status: "active",
    },
  });

  const targets = [];
  for (const [index, exercise] of exercises.entries()) {
    const target = await prisma.workoutSessionExerciseTarget.create({
      data: {
        sessionId: session.id,
        programDayExerciseId: programDayExercises[index].id,
        exerciseId: exercise.id,
        targetSets: 3,
        targetRepRangeLow: 8,
        targetRepRangeHigh: 10,
        exactRepTarget: 8,
        targetLoadKg: null,
        targetDurationSeconds: null,
        progressionType: "load",
      },
      include: {
        exercise: true,
      },
    });
    targets.push(target);
  }

  const sourceTarget = targets.find((target) => target.exercise.nameEn === sourceExerciseName) ?? null;
  if (!sourceTarget) {
    throw new Error(`Source target "${sourceExerciseName}" not found in fixture.`);
  }

  return {
    user,
    session,
    program,
    programDay,
    programDayExercises,
    sourceTarget,
    targets,
    customExercises: customSourceExercise ? [customSourceExercise] : [],
  };
}

async function createUniqueNoCandidateSource(suffix) {
  const activeCatalog = await prisma.exercise.findMany({
    where: { catalogLifecycle: "ACTIVE" },
    select: {
      dnaMovementPattern: true,
      complexity: true,
    },
  });
  const usedCombos = new Set(
    activeCatalog
      .filter((entry) => entry.dnaMovementPattern && entry.complexity)
      .map((entry) => `${entry.dnaMovementPattern}:${entry.complexity}`)
  );

  let selectedPattern = null;
  let selectedComplexity = null;
  for (const pattern of DNA_PATTERNS) {
    for (const complexity of COMPLEXITIES) {
      if (!usedCombos.has(`${pattern}:${complexity}`)) {
        selectedPattern = pattern;
        selectedComplexity = complexity;
        break;
      }
    }
    if (selectedPattern) {
      break;
    }
  }

  if (!selectedPattern || !selectedComplexity) {
    throw new Error("Could not find an unused movement-pattern/exercise-class combo for no-candidate fixture.");
  }

  return prisma.exercise.create({
    data: {
      nameFa: `تمرین تستی بدون جایگزین ${suffix}`,
      nameEn: `No Candidate Source ${suffix}`,
      slug: `no-candidate-source-${suffix}-${TEST_RUN_NONCE}`,
      primaryMuscles: ["obliques"],
      secondaryMuscles: ["abs"],
      movementPattern: ["squat", "hinge", "lunge", "single_leg", "horizontal_press", "vertical_press", "horizontal_pull", "vertical_pull", "elbow_flexion", "elbow_extension", "trunk_flexion", "anti_extension"].includes(selectedPattern)
        ? selectedPattern
        : "anti_extension",
      dnaMovementPattern: selectedPattern,
      equipment: "cable",
      requiredEquipment: ["cable"],
      difficulty: "intermediate",
      complexity: selectedComplexity,
      stabilityDemand: "MODERATE",
      axialLoading: "NONE",
      suitableGoals: ["hypertrophy"],
      contraindications: [],
      jointStressFlags: [],
      substitutionNames: [],
      progressionType: "load",
      catalogLifecycle: "ACTIVE",
      catalogSource: "test",
      catalogCurationVersion: 1,
    },
  });
}

const cases = [
  {
    name: "1. happy path returns a contextual recommendation with controlled public projection",
    input: { source: "Back Squat", context: null },
    run: async () => {
      const fixture = await createSessionFixture({
        suffix: "happy-path",
        exerciseNames: ["Back Squat", "Romanian Deadlift", "Machine Leg Curl", "Bench Press"],
        sourceExerciseName: "Back Squat",
      });

      try {
        const beforeCounts = {
          targets: await prisma.workoutSessionExerciseTarget.count({ where: { sessionId: fixture.session.id } }),
          recommendationApplications: await prisma.recommendationApplication.count({
            where: { workoutSessionId: fixture.session.id },
          }),
        };

        const actual = await getWorkoutExerciseReplacementsV1({
          userId: fixture.user.id,
          sessionId: fixture.session.id,
          targetId: fixture.sourceTarget.id,
          rawContext: buildContext(),
        });

        const afterCounts = {
          targets: await prisma.workoutSessionExerciseTarget.count({ where: { sessionId: fixture.session.id } }),
          recommendationApplications: await prisma.recommendationApplication.count({
            where: { workoutSessionId: fixture.session.id },
          }),
        };

        return { actual, beforeCounts, afterCounts };
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: ({ actual, beforeCounts, afterCounts }) => {
      assert.equal(actual.version, REPLACEMENT_API_V1_VERSION);
      assert.equal(actual.source.exercise.nameEn, "Back Squat");
      assert.equal(actual.contextualDecisionStatus, "RECOMMENDED");
      assert.equal(actual.recommendedReplacement?.nameEn, "Front Squat");
      assert.ok(Array.isArray(actual.alternatives));
      assert.ok(!("similarityEvidence" in actual.recommendedReplacement));
      assert.ok(!("rankingBreakdown" in actual.recommendedReplacement));
      assert.ok(!("integrityBreakdown" in actual.recommendedReplacement));
      assert.deepEqual(beforeCounts, afterCounts);
    },
  },
  {
    name: "2. top core candidate equipment-unavailable falls back to the next feasible candidate without reranking",
    input: { availableEquipment: [] },
    run: async () => {
      const fixture = await createSessionFixture({
        suffix: "equipment-fallback",
        exerciseNames: ["Back Squat", "Romanian Deadlift", "Machine Leg Curl", "Bench Press"],
        sourceExerciseName: "Back Squat",
      });

      try {
        return await getWorkoutExerciseReplacementsV1({
          userId: fixture.user.id,
          sessionId: fixture.session.id,
          targetId: fixture.sourceTarget.id,
          rawContext: buildContext({
            equipmentContext: { availableEquipment: [] },
            replacementIntent: {
              version: "replacement-intent-v1",
              type: "NO_EQUIPMENT",
            },
          }),
        });
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: (actual) => {
      assert.equal(actual.contextualDecisionStatus, "RECOMMENDED");
      assert.equal(actual.recommendedReplacement?.nameEn, "Bodyweight Squat (Controlled Range)");
      assert.equal(
        actual.contextRejectedCandidates.some((candidate) =>
          candidate.rejectionReasonCodes.includes(REPLACEMENT_API_REASON_CODES.EQUIPMENT_UNAVAILABLE)
        ),
        true
      );
    },
  },
  {
    name: "3. all contextually unavailable candidates return a successful NO_CONTEXTUAL_REPLACEMENT outcome",
    input: { source: "Cable Curl", availableEquipment: [] },
    run: async () => {
      const fixture = await createSessionFixture({
        suffix: "all-context-unavailable",
        exerciseNames: ["Cable Curl", "Bench Press", "Romanian Deadlift", "Front Squat"],
        sourceExerciseName: "Cable Curl",
      });

      try {
        return await getWorkoutExerciseReplacementsV1({
          userId: fixture.user.id,
          sessionId: fixture.session.id,
          targetId: fixture.sourceTarget.id,
          rawContext: buildContext({
            equipmentContext: { availableEquipment: [] },
            replacementIntent: {
              version: "replacement-intent-v1",
              type: "NO_EQUIPMENT",
            },
          }),
        });
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: (actual) => {
      assert.equal(actual.contextualDecisionStatus, "NO_CONTEXTUAL_REPLACEMENT");
      assert.equal(actual.recommendedReplacement, null);
      assert.equal(actual.reasonCodes.includes(REPLACEMENT_API_REASON_CODES.NO_CONTEXTUAL_REPLACEMENT), true);
    },
  },
  {
    name: "4. no intrinsic candidates remains a successful no-replacement product outcome",
    input: { source: "synthetic unique source" },
    run: async () => {
      const suffix = "no-intrinsic";
      const customSourceExercise = await createUniqueNoCandidateSource(suffix);
      const fixture = await createSessionFixture({
        suffix,
        exerciseNames: ["Bench Press", "Romanian Deadlift", "Front Squat"],
        sourceExerciseName: customSourceExercise.nameEn,
        customSourceExercise,
      });

      try {
        return await getWorkoutExerciseReplacementsV1({
          userId: fixture.user.id,
          sessionId: fixture.session.id,
          targetId: fixture.sourceTarget.id,
          rawContext: buildContext(),
        });
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: (actual) => {
      assert.equal(actual.contextualDecisionStatus, "NO_CONTEXTUAL_REPLACEMENT");
      assert.equal(actual.recommendedReplacement, null);
      assert.deepEqual(actual.alternatives, []);
    },
  },
  {
    name: "5. unknown equipment context preserves the core recommendation and explicit intent is normalized through the response",
    input: { replacementIntent: "PREFER_VARIATION" },
    run: async () => {
      const fixture = await createSessionFixture({
        suffix: "unknown-context",
        exerciseNames: ["Back Squat", "Romanian Deadlift", "Machine Leg Curl", "Bench Press"],
        sourceExerciseName: "Back Squat",
      });

      try {
        return await getWorkoutExerciseReplacementsV1({
          userId: fixture.user.id,
          sessionId: fixture.session.id,
          targetId: fixture.sourceTarget.id,
          rawContext: buildContext({
            replacementIntent: {
              version: "replacement-intent-v1",
              type: "PREFER_VARIATION",
            },
          }),
        });
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: (actual) => {
      assert.equal(actual.recommendedReplacement?.nameEn, "Front Squat");
      assert.equal(actual.context.replacementIntent.type, "PREFER_VARIATION");
      assert.equal(actual.recommendedReplacement.reasonCodes.includes(REPLACEMENT_API_REASON_CODES.EQUIPMENT_CONTEXT_UNKNOWN), true);
    },
  },
  {
    name: "6. malformed context fails loudly with mapped application error",
    input: { version: "wrong" },
    run: async () => {
      const fixture = await createSessionFixture({
        suffix: "bad-context",
        exerciseNames: ["Back Squat", "Romanian Deadlift", "Machine Leg Curl", "Bench Press"],
        sourceExerciseName: "Back Squat",
      });

      try {
        await getWorkoutExerciseReplacementsV1({
          userId: fixture.user.id,
          sessionId: fixture.session.id,
          targetId: fixture.sourceTarget.id,
          rawContext: { version: "wrong" },
        });
      } finally {
        await cleanupFixture(fixture);
      }
    },
    assertResult: (actual) => {
      assert.fail(`Expected ReplacementRecommendationError, received ${JSON.stringify(actual)}`);
    },
    expectError: (error) => {
      assert.equal(error instanceof ReplacementRecommendationError, true);
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "REPLACEMENT_CONTEXT_INVALID");
    },
  },
];

let passed = 0;
let failed = 0;

for (const testCase of cases) {
  try {
    const actual = await testCase.run();
    testCase.assertResult(actual);
    printCaseResult({ name: testCase.name, input: testCase.input, actual, status: "PASS" });
    passed += 1;
  } catch (error) {
    if (typeof testCase.expectError === "function") {
      try {
        testCase.expectError(error);
        printCaseResult({ name: testCase.name, input: testCase.input, actual: { error: error.code }, status: "PASS" });
        passed += 1;
        continue;
      } catch (assertionError) {
        printCaseResult({
          name: testCase.name,
          input: testCase.input,
          error: assertionError,
          status: "FAIL",
        });
        failed += 1;
        continue;
      }
    }

    printCaseResult({ name: testCase.name, input: testCase.input, error, status: "FAIL" });
    failed += 1;
  }
}

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);

if (failed > 0) {
  process.exitCode = 1;
}

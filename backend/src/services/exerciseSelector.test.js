import assert from "node:assert/strict";
import prisma from "../lib/prisma.js";
import {
  INJURY_TO_JOINT_STRESS_MAP,
  selectExercise,
  selectExerciseForUser,
} from "./exerciseSelector.js";

const MINIMUM_EXPECTED_EXERCISE_COUNT = 42;

function summarizeResult(result) {
  return {
    selectedExercise: result.selectedExercise ? result.selectedExercise.nameEn : null,
    fallbackLevelUsed: result.fallbackLevelUsed,
    rankedCandidates: result.rankedCandidates.map((candidate) => candidate.exercise.nameEn),
    reason: result.reason,
    noCandidateDetails: result.noCandidateDetails,
  };
}

function printCaseResult({ name, input, expected, actual, status, error }) {
  console.log(`CASE: ${name}`);
  console.log(`INPUT: ${JSON.stringify(input)}`);
  if (expected !== undefined) {
    console.log(`EXPECTED: ${JSON.stringify(expected)}`);
  }
  if (actual !== undefined) {
    console.log(`ACTUAL: ${JSON.stringify(actual)}`);
  }
  if (error) {
    console.log(`ERROR: ${error}`);
  }
  console.log(`RESULT: ${status}`);
  console.log("---");
}

const exercises = await prisma.exercise.findMany({
  orderBy: { id: "asc" },
});

assert.ok(
  exercises.length >= MINIMUM_EXPECTED_EXERCISE_COUNT,
  `Expected at least ${MINIMUM_EXPECTED_EXERCISE_COUNT} exercises, found ${exercises.length}`
);

const distinctStressFlags = Array.from(new Set(exercises.flatMap((exercise) => exercise.jointStressFlags))).sort();
const mappedStressFlags = Object.values(INJURY_TO_JOINT_STRESS_MAP).sort();
for (const flag of mappedStressFlags) {
  assert.ok(
    distinctStressFlags.includes(flag),
    `Expected mapped stress flag ${flag} to exist in the real dataset.`
  );
}

const cases = [
  {
    name: "1. bodyweight-only beginner with hinge coverage",
    input: {
      requiredMovementPattern: "hinge",
      equipmentAccess: ["bodyweight"],
      goal: "hypertrophy",
      trainingLevel: "beginner",
      injuryFlags: ["none"],
    },
    run: (input) => selectExercise({ ...input, exercises }),
    assertResult: (result) => {
      assert.equal(result.selectedExercise.nameEn, "Glute Bridge");
      assert.equal(result.fallbackLevelUsed, 0);
    },
  },
  {
    name: "2. dumbbell-only beginner with hinge coverage",
    input: {
      requiredMovementPattern: "hinge",
      equipmentAccess: ["dumbbell"],
      goal: "hypertrophy",
      trainingLevel: "beginner",
      injuryFlags: ["none"],
    },
    run: (input) => selectExercise({ ...input, exercises }),
    assertResult: (result) => {
      assert.equal(result.selectedExercise.nameEn, "Dumbbell Romanian Deadlift");
      assert.equal(result.fallbackLevelUsed, 0);
    },
  },
  {
    name: "3. barbell intermediate horizontal_pull uses Level 1 adjacent difficulty fallback",
    input: {
      requiredMovementPattern: "horizontal_pull",
      equipmentAccess: ["barbell"],
      goal: "hypertrophy",
      trainingLevel: "intermediate",
      injuryFlags: ["none"],
    },
    run: (input) => selectExercise({ ...input, exercises }),
    assertResult: (result) => {
      assert.equal(result.selectedExercise.nameEn, "Barbell Row");
      assert.equal(result.fallbackLevelUsed, 1);
      assert.equal(
        result.reason,
        "Selected Barbell Row at fallback level 1 after relaxing exact difficulty to adjacent difficulty while keeping goal match, equipment, and injury safety constraints."
      );
    },
  },
  {
    name: "4. machine/cable beginner vertical_pull uses real tie-break",
    input: {
      requiredMovementPattern: "vertical_pull",
      equipmentAccess: ["machine", "cable"],
      goal: "hypertrophy",
      trainingLevel: "beginner",
      injuryFlags: ["none"],
    },
    run: (input) => selectExerciseForUser(input),
    assertResult: (result) => {
      assert.equal(result.selectedExercise.nameEn, "Cable Pulldown");
      assert.equal(result.fallbackLevelUsed, 0);
      assert.deepEqual(
        result.rankedCandidates.map((candidate) => candidate.exercise.nameEn),
        ["Cable Pulldown", "Lat Pulldown"]
      );
    },
  },
  {
    name: "5. knee limitation excludes unsafe lunge and falls back to Level 2 safe option",
    input: {
      requiredMovementPattern: "lunge",
      equipmentAccess: ["bodyweight", "dumbbell"],
      goal: "hypertrophy",
      trainingLevel: "beginner",
      injuryFlags: ["knee"],
    },
    run: (input) => selectExercise({ ...input, exercises }),
    assertResult: (result) => {
      assert.equal(result.selectedExercise.nameEn, "Bodyweight Reverse Lunge");
      assert.equal(result.fallbackLevelUsed, 2);
      assert.ok(!result.rankedCandidates.some((candidate) => candidate.exercise.nameEn === "Dumbbell Reverse Lunge"));
    },
  },
  {
    name: "6. shoulder limitation excludes shoulder-stress vertical presses",
    input: {
      requiredMovementPattern: "vertical_press",
      equipmentAccess: ["barbell", "dumbbell", "machine", "bodyweight"],
      goal: "hypertrophy",
      trainingLevel: "beginner",
      injuryFlags: ["shoulder"],
    },
    run: (input) => selectExercise({ ...input, exercises }),
    assertResult: (result) => {
      assert.equal(result.selectedExercise.nameEn, "Machine Shoulder Press");
      assert.ok(!result.rankedCandidates.some((candidate) =>
        ["Overhead Press", "Dumbbell Shoulder Press", "Pike Push-Up"].includes(candidate.exercise.nameEn)
      ));
    },
  },
  {
    name: "7. wrist limitation excludes wrist-stress horizontal presses",
    input: {
      requiredMovementPattern: "horizontal_press",
      equipmentAccess: ["barbell", "dumbbell", "machine", "bodyweight"],
      goal: "hypertrophy",
      trainingLevel: "beginner",
      injuryFlags: ["wrist"],
    },
    run: (input) => selectExercise({ ...input, exercises }),
    assertResult: (result) => {
      assert.equal(result.selectedExercise.nameEn, "Dumbbell Bench Press");
      assert.ok(!result.rankedCandidates.some((candidate) =>
        ["Bench Press", "Push-Up"].includes(candidate.exercise.nameEn)
      ));
    },
  },
  {
    name: "8. lower_back limitation excludes unsafe horizontal pulls",
    input: {
      requiredMovementPattern: "horizontal_pull",
      equipmentAccess: ["barbell", "dumbbell", "cable", "bodyweight"],
      goal: "hypertrophy",
      trainingLevel: "beginner",
      injuryFlags: ["lower_back"],
    },
    run: (input) => selectExercise({ ...input, exercises }),
    assertResult: (result) => {
      assert.equal(result.selectedExercise.nameEn, "Bodyweight Inverted Row");
      assert.ok(!result.rankedCandidates.some((candidate) =>
        ["Barbell Row", "Dumbbell Row"].includes(candidate.exercise.nameEn)
      ));
    },
  },
  {
    name: "9. multiple injury flags apply together",
    input: {
      requiredMovementPattern: "horizontal_press",
      equipmentAccess: ["barbell", "dumbbell", "machine", "bodyweight"],
      goal: "hypertrophy",
      trainingLevel: "beginner",
      injuryFlags: ["shoulder", "wrist"],
    },
    run: (input) => selectExercise({ ...input, exercises }),
    assertResult: (result) => {
      assert.equal(result.selectedExercise.nameEn, "Machine Chest Press");
      assert.ok(!result.rankedCandidates.some((candidate) =>
        ["Bench Press", "Dumbbell Bench Press", "Push-Up"].includes(candidate.exercise.nameEn)
      ));
    },
  },
  {
    name: "10. unsupported equipment/pattern combination returns no candidate instead of crashing",
    input: {
      requiredMovementPattern: "vertical_pull",
      equipmentAccess: ["barbell"],
      goal: "hypertrophy",
      trainingLevel: "beginner",
      injuryFlags: ["none"],
    },
    run: (input) => selectExercise({ ...input, exercises }),
    assertResult: (result) => {
      assert.equal(result.selectedExercise, null);
      assert.equal(result.fallbackLevelUsed, 3);
    },
  },
  {
    name: "11. deterministic tie-breaking resolves alphabetical order consistently",
    input: {
      requiredMovementPattern: "vertical_pull",
      equipmentAccess: ["machine", "cable"],
      goal: "hypertrophy",
      trainingLevel: "beginner",
      injuryFlags: ["none"],
    },
    run: (input) => selectExercise({ ...input, exercises }),
    assertResult: (result) => {
      assert.equal(result.selectedExercise.nameEn, "Cable Pulldown");
      assert.deepEqual(
        result.rankedCandidates.map((candidate) => [candidate.exercise.nameEn, candidate.score]),
        [
          ["Cable Pulldown", 75],
          ["Lat Pulldown", 75],
        ]
      );
    },
  },
  {
    name: "12. repeated identical input returns identical output",
    input: {
      requiredMovementPattern: "vertical_pull",
      equipmentAccess: ["machine", "cable"],
      goal: "hypertrophy",
      trainingLevel: "beginner",
      injuryFlags: ["none"],
    },
    run: async (input) => {
      const first = await selectExerciseForUser(input);
      const second = await selectExerciseForUser(input);
      return { first, second };
    },
    assertResult: (result) => {
      assert.equal(JSON.stringify(result.first), JSON.stringify(result.second));
    },
    summarize: (result) => ({
      first: summarizeResult(result.first),
      second: summarizeResult(result.second),
    }),
  },
  {
    name: "13. explicit no-candidate result has full Level 3 shape",
    input: {
      requiredMovementPattern: "vertical_pull",
      equipmentAccess: ["barbell"],
      goal: "hypertrophy",
      trainingLevel: "beginner",
      injuryFlags: ["none"],
    },
    run: (input) => selectExercise({ ...input, exercises }),
    assertResult: (result) => {
      assert.equal(result.selectedExercise, null);
      assert.deepEqual(result.rankedCandidates, []);
      assert.equal(result.fallbackLevelUsed, 3);
      assert.equal(result.noCandidateDetails.movementPattern, "vertical_pull");
      assert.deepEqual(result.noCandidateDetails.attemptedFallbackLevels, [0, 1, 2, 3]);
      assert.deepEqual(result.noCandidateDetails.userConstraints, {
        equipmentAccess: ["barbell"],
        goal: "hypertrophy",
        trainingLevel: "beginner",
        injuryFlags: ["none"],
      });
    },
  },
];

let passed = 0;
let failed = 0;

for (const testCase of cases) {
  try {
    const actual = await testCase.run(testCase.input);
    testCase.assertResult(actual);
    passed += 1;
    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      expected: testCase.expected,
      actual: testCase.summarize ? testCase.summarize(actual) : summarizeResult(actual),
      status: "PASS",
    });
  } catch (error) {
    failed += 1;
    printCaseResult({
      name: testCase.name,
      input: testCase.input,
      expected: testCase.expected,
      actual: error?.actual,
      status: "FAIL",
      error: error instanceof Error ? error.stack : String(error),
    });
  }
}

console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${passed + failed} total`);

await prisma.$disconnect();

if (failed > 0) {
  process.exitCode = 1;
}

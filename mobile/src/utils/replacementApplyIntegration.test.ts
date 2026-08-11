function fail(message: string): never {
  throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    fail(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

function printCaseResult({
  name,
  input,
  actual,
  error,
  status,
}: {
  name: string;
  input: unknown;
  actual?: unknown;
  error?: unknown;
  status: "PASS" | "FAIL";
}) {
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

async function main() {
  const {
    groupLoggedSetsByExercise,
    mergeWorkoutExercisesWithTargets,
  } = (await (0, eval)('import("./replacementDiscovery.ts")')) as typeof import("./replacementDiscovery");

  const frontSquat = {
    id: 51,
    nameFa: "فرانت اسکوات",
    nameEn: "Front Squat",
    description: null,
    icon: null,
    primaryMuscles: ["quadriceps"],
    secondaryMuscles: ["glutes"],
    movementPattern: "squat",
    equipment: "barbell",
    difficulty: "intermediate",
    complexity: "compound",
    suitableGoals: ["strength"],
    contraindications: [],
    jointStressFlags: [],
    substitutionNames: [],
    defaultRepRangeLow: 4,
    defaultRepRangeHigh: 8,
    defaultRestSecondsLow: 90,
    defaultRestSecondsHigh: 180,
    progressionType: "load",
  } as const;

  const backSquat = {
    ...frontSquat,
    id: 13,
    nameFa: "بک اسکوات",
    nameEn: "Back Squat",
  } as const;

  const cases = [
    {
      name: "1. apply refresh overlays the backend-mutated target exercise onto the workout row",
      input: {
        exercises: [{ id: 101, exercise: backSquat }],
        targets: [{ id: 7001, exerciseId: 51, programDayExerciseId: 101, exercise: frontSquat }],
      },
      run: () =>
        mergeWorkoutExercisesWithTargets(
          [{ id: 101, exercise: backSquat }],
          [{ id: 7001, exerciseId: 51, programDayExerciseId: 101, exercise: frontSquat }]
        ),
      assertResult: (actual: Array<{ exercise: { id: number; nameFa: string }; targetId: number | null }>) => {
        assertEqual(actual[0].targetId, 7001, "Target id should remain attached to the workout row");
        assertEqual(actual[0].exercise.id, 51, "Visible exercise should refresh to the applied replacement");
        assertEqual(actual[0].exercise.nameFa, "فرانت اسکوات", "Visible exercise label should refresh");
      },
    },
    {
      name: "2. grouped set logs follow the backend-rewritten replacement exercise id",
      input: {
        setLogs: [
          { id: 2, exerciseId: 51, setNumber: 2, reps: 5, weightKg: 62.5 },
          { id: 1, exerciseId: 51, setNumber: 1, reps: 5, weightKg: 60 },
        ],
      },
      run: () =>
        groupLoggedSetsByExercise([
          { id: 2, exerciseId: 51, setNumber: 2, reps: 5, weightKg: 62.5 },
          { id: 1, exerciseId: 51, setNumber: 1, reps: 5, weightKg: 60 },
        ]),
      assertResult: (actual: Record<number, Array<{ setNumber: number }>>) => {
        assertDeepEqual(
          actual[51].map((entry) => entry.setNumber),
          [1, 2],
          "Set logs should be grouped under the applied replacement and sorted by set number"
        );
      },
    },
    {
      name: "3. helper functions do not mutate workout rows or target inputs",
      input: {
        exercises: [{ id: 101, exercise: backSquat }],
        targets: [{ id: 7001, exerciseId: 51, programDayExerciseId: 101, exercise: frontSquat }],
      },
      run: () => {
        const exercises = [{ id: 101, exercise: backSquat }];
        const targets = [{ id: 7001, exerciseId: 51, programDayExerciseId: 101, exercise: frontSquat }];
        const exercisesBefore = JSON.stringify(exercises);
        const targetsBefore = JSON.stringify(targets);
        mergeWorkoutExercisesWithTargets(exercises, targets);
        return {
          exercisesBefore,
          exercisesAfter: JSON.stringify(exercises),
          targetsBefore,
          targetsAfter: JSON.stringify(targets),
        };
      },
      assertResult: (actual: {
        exercisesBefore: string;
        exercisesAfter: string;
        targetsBefore: string;
        targetsAfter: string;
      }) => {
        assertEqual(actual.exercisesAfter, actual.exercisesBefore, "Exercises input must remain immutable");
        assertEqual(actual.targetsAfter, actual.targetsBefore, "Target input must remain immutable");
      },
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of cases) {
    try {
      const actual = testCase.run();
      testCase.assertResult(actual as never);
      printCaseResult({ name: testCase.name, input: testCase.input, actual, status: "PASS" });
      passed += 1;
    } catch (error) {
      printCaseResult({ name: testCase.name, input: testCase.input, error, status: "FAIL" });
      failed += 1;
    }
  }

  console.log(`SUMMARY: ${passed} passed, ${failed} failed, ${cases.length} total`);

  if (failed > 0) {
    throw new Error(`${failed} replacement apply integration test case(s) failed`);
  }
}

void main();

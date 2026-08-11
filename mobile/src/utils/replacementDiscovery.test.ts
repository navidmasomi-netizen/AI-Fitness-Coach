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
    buildReplacementContextInput,
    getNoReplacementMessage,
    getReplacementUnavailableMessage,
    getReplacementWarningMessage,
    mergeWorkoutExercisesWithTargets,
  } = (await (0, eval)('import("./replacementDiscovery.ts")')) as typeof import("./replacementDiscovery");

  const cases = [
    {
      name: "1. PREFER_VARIATION maps to intent-only context with no equipment inference",
      input: { intentType: "PREFER_VARIATION", availableEquipment: ["bench", "dumbbell"] },
      run: () => buildReplacementContextInput("PREFER_VARIATION", ["bench", "dumbbell"]),
      assertResult: (actual: ReturnType<typeof buildReplacementContextInput>) => {
        assertDeepEqual(
          actual,
          {
            version: "replacement-context-v1",
            equipmentContext: null,
            replacementIntent: {
              version: "replacement-intent-v1",
              type: "PREFER_VARIATION",
            },
          },
          "PREFER_VARIATION should map to an intent-only context"
        );
      },
    },
    {
      name: "2. DISCOMFORT stays non-medical and does not add equipment context",
      input: { intentType: "DISCOMFORT", availableEquipment: [] },
      run: () => buildReplacementContextInput("DISCOMFORT", []),
      assertResult: (actual: ReturnType<typeof buildReplacementContextInput>) => {
        assertEqual(
          actual.replacementIntent?.type,
          "DISCOMFORT",
          "DISCOMFORT intent should be preserved"
        );
        assertEqual(
          actual.equipmentContext,
          null,
          "DISCOMFORT should not infer equipment context"
        );
      },
    },
    {
      name: "3. NO_EQUIPMENT keeps only explicit canonical available equipment and removes duplicates",
      input: { intentType: "NO_EQUIPMENT", availableEquipment: ["bench", "dumbbell", "bench"] },
      run: () => buildReplacementContextInput("NO_EQUIPMENT", ["bench", "dumbbell", "bench"]),
      assertResult: (actual: ReturnType<typeof buildReplacementContextInput>) => {
        assertDeepEqual(
          actual.equipmentContext,
          {
            availableEquipment: ["bench", "dumbbell"],
          },
          "NO_EQUIPMENT should preserve only explicit canonical equipment"
        );
      },
    },
    {
      name: "4. workout exercises merge with exact target ids by programDayExercise id and never infer missing targets",
      input: {
        exercises: [
          { id: 101, exercise: { id: 13 } },
          { id: 102, exercise: { id: 23 } },
        ],
        targets: [{ id: 7001, exerciseId: 13, programDayExerciseId: 101 }],
      },
      run: () =>
        mergeWorkoutExercisesWithTargets(
          [
            { id: 101, exercise: { id: 13 } },
            { id: 102, exercise: { id: 23 } },
          ],
          [{ id: 7001, exerciseId: 13, programDayExerciseId: 101 }]
        ),
      assertResult: (actual: Array<{ targetId: number | null }>) => {
        assertDeepEqual(
          actual.map((entry) => entry.targetId),
          [7001, null],
          "Exercises should merge with exact target ids without inferring missing targets"
        );
      },
    },
    {
      name: "5. generic warning, no-replacement, and unavailable messages remain explicit first-class product states",
      input: {},
      run: () => ({
        warning: getReplacementWarningMessage(),
        noReplacement: getNoReplacementMessage(),
        unavailable: getReplacementUnavailableMessage(),
      }),
      assertResult: (actual: { warning: string; noReplacement: string; unavailable: string }) => {
        assertEqual(
          actual.warning.includes("training balance"),
          true,
          "Warning message should remain explicit"
        );
        assertEqual(
          actual.noReplacement.length > 0,
          true,
          "No-replacement message should be present"
        );
        assertEqual(
          actual.unavailable.length > 0,
          true,
          "Unavailable message should be present"
        );
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
    throw new Error(`${failed} replacement discovery test case(s) failed`);
  }
}

void main();

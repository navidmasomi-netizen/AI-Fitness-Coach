function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

async function main() {
  const { validateWorkoutSetInput } = (await (0, eval)(
    'import("./workoutSetValidation.ts")'
  )) as typeof import("./workoutSetValidation");

  assertEqual(validateWorkoutSetInput("10", "42.5", false), null, "Valid integer reps and decimal weight should pass");
  assertEqual(validateWorkoutSetInput("10", "0", false), null, "Zero weight remains valid");
  assertEqual(validateWorkoutSetInput("10", "", true), null, "Bodyweight exercises keep their optional weight");
  assertEqual(validateWorkoutSetInput("", "40", false), "Reps is required", "Missing reps should be rejected");
  assertEqual(validateWorkoutSetInput("NaN", "40", false), "Reps must be a positive whole number", "NaN reps should be rejected");
  assertEqual(validateWorkoutSetInput("Infinity", "40", false), "Reps must be a positive whole number", "Infinite reps should be rejected");
  assertEqual(validateWorkoutSetInput("-Infinity", "40", false), "Reps must be a positive whole number", "Negative infinite reps should be rejected");
  assertEqual(validateWorkoutSetInput("10", "Infinity", false), "Weight must be a non-negative number", "Infinite weight should be rejected");
  assertEqual(validateWorkoutSetInput("10", "-Infinity", false), "Weight must be a non-negative number", "Negative infinite weight should be rejected");
  assertEqual(validateWorkoutSetInput("10", "not-a-number", false), "Weight must be a non-negative number", "Malformed weight should be rejected");

  console.log("Workout set numeric validation: 10 passed");
}

void main();

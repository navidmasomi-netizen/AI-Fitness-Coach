import type { ProgramDay } from "../types/program";

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

async function main() {
  const { getOrderedProgramDays } = (await (0, eval)(
    'import("./programOrdering.ts")'
  )) as typeof import("./programOrdering");
  const days = [
    {
      id: 2,
      dayIndex: 2,
      name: "Day two",
      exercises: [
        { id: 22, order: 2, exercise: {} },
        { id: 21, order: 1, exercise: {} },
      ],
    },
    {
      id: 1,
      dayIndex: 1,
      name: "Day one",
      exercises: [{ id: 11, order: 1, exercise: {} }],
    },
  ] as unknown as ProgramDay[];
  const originalDayOrder = days.map((day) => day.id);
  const originalExerciseOrder = days[0].exercises.map((exercise) => exercise.id);

  const orderedDays = getOrderedProgramDays(days);

  assertEqual(orderedDays.map((day) => day.id).join(","), "1,2", "Days should retain their existing display order");
  assertEqual(
    orderedDays[1].exercises.map((exercise) => exercise.id).join(","),
    "21,22",
    "Exercises should retain their existing display order"
  );
  assertEqual(days.map((day) => day.id).join(","), originalDayOrder.join(","), "Source days must not be reordered");
  assertEqual(
    days[0].exercises.map((exercise) => exercise.id).join(","),
    originalExerciseOrder.join(","),
    "Source exercises must not be reordered"
  );
  assertEqual(orderedDays[1] === days[0], false, "Derived days must not reuse mutable query-owned day objects");
  assertEqual(
    orderedDays[1].exercises === days[0].exercises,
    false,
    "Derived exercises must not reuse mutable query-owned arrays"
  );

  console.log("Program ordering immutability: 6 passed");
}

void main();

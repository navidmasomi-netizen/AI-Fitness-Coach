export function validateWorkoutSetInput(
  repsValue: string,
  weightValue: string,
  isBodyweight: boolean
): string | null {
  if (repsValue.trim() === "") return "Reps is required";

  const reps = Number(repsValue);
  if (!Number.isFinite(reps) || !Number.isInteger(reps) || reps <= 0) {
    return "Reps must be a positive whole number";
  }

  if (!isBodyweight && weightValue.trim() === "") {
    return "Weight is required for this exercise";
  }

  if (weightValue.trim() !== "") {
    const weight = Number(weightValue);
    if (!Number.isFinite(weight) || weight < 0) return "Weight must be a non-negative number";
  }

  return null;
}

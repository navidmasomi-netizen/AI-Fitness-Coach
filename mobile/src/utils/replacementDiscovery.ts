export type CatalogEquipment =
  | "bodyweight"
  | "dumbbell"
  | "barbell"
  | "bench"
  | "rack"
  | "cable"
  | "selectorized_machine"
  | "leg_press_machine"
  | "pull_up_bar"
  | "step_platform";

export type ReplacementIntentType =
  | "UNKNOWN"
  | "NO_EQUIPMENT"
  | "EQUIPMENT_BUSY"
  | "EXERCISE_UNAVAILABLE"
  | "PREFER_VARIATION"
  | "DISCOMFORT";

export type ReplacementDiscoveryStatus =
  | "IDLE"
  | "COLLECTING_CONTEXT"
  | "LOADING_RECOMMENDATIONS"
  | "RESULTS"
  | "NO_REPLACEMENT"
  | "ERROR";

export interface ReplacementContextInput {
  version: "replacement-context-v1";
  equipmentContext: { availableEquipment: CatalogEquipment[] } | null;
  replacementIntent: {
    version: "replacement-intent-v1";
    type: ReplacementIntentType;
  } | null;
}

export interface WorkoutExerciseIdentity {
  id: number;
  exercise: { id: number };
}

export interface WorkoutExerciseTargetIdentity {
  id: number;
  exerciseId: number;
  programDayExerciseId: number;
}

export interface DiscoveryReasonOption {
  intentType: ReplacementIntentType;
  label: string;
  helperText: string;
  requiresEquipmentContext: boolean;
}

export const REPLACEMENT_DISCOVERY_REASON_OPTIONS: readonly DiscoveryReasonOption[] = Object.freeze([
  Object.freeze({
    intentType: "PREFER_VARIATION",
    label: "I want a different exercise",
    helperText: "Get a different variation without changing the workout yet.",
    requiresEquipmentContext: false,
  }),
  Object.freeze({
    intentType: "NO_EQUIPMENT",
    label: "I don't have the equipment",
    helperText: "Tell us what equipment is available right now.",
    requiresEquipmentContext: true,
  }),
  Object.freeze({
    intentType: "EQUIPMENT_BUSY",
    label: "Equipment is busy",
    helperText: "Keep the reason, without inventing temporary equipment rules.",
    requiresEquipmentContext: false,
  }),
  Object.freeze({
    intentType: "EXERCISE_UNAVAILABLE",
    label: "I can't do this exercise right now",
    helperText: "Keep the current session unchanged and find another option.",
    requiresEquipmentContext: false,
  }),
  Object.freeze({
    intentType: "DISCOMFORT",
    label: "This exercise feels uncomfortable",
    helperText: "Non-medical reason only. This does not change workout safety rules.",
    requiresEquipmentContext: false,
  }),
  Object.freeze({
    intentType: "UNKNOWN",
    label: "Skip reason",
    helperText: "Continue without a specific replacement reason.",
    requiresEquipmentContext: false,
  }),
]);

export const REPLACEMENT_DISCOVERY_EQUIPMENT_OPTIONS: readonly {
  value: CatalogEquipment;
  label: string;
}[] = Object.freeze([
  Object.freeze({ value: "dumbbell", label: "Dumbbell" }),
  Object.freeze({ value: "barbell", label: "Barbell" }),
  Object.freeze({ value: "bench", label: "Bench" }),
  Object.freeze({ value: "rack", label: "Rack" }),
  Object.freeze({ value: "cable", label: "Cable" }),
  Object.freeze({ value: "selectorized_machine", label: "Selectorized machine" }),
  Object.freeze({ value: "leg_press_machine", label: "Leg press machine" }),
  Object.freeze({ value: "pull_up_bar", label: "Pull-up bar" }),
  Object.freeze({ value: "step_platform", label: "Step platform" }),
]);

export function buildReplacementContextInput(
  intentType: ReplacementIntentType,
  availableEquipment: CatalogEquipment[]
): ReplacementContextInput {
  const dedupedEquipment = [...new Set(availableEquipment)].sort();

  return {
    version: "replacement-context-v1",
    equipmentContext:
      intentType === "NO_EQUIPMENT"
        ? {
            availableEquipment: dedupedEquipment,
          }
        : null,
    replacementIntent: {
      version: "replacement-intent-v1",
      type: intentType,
    },
  };
}

export function mergeWorkoutExercisesWithTargets<T extends WorkoutExerciseIdentity>(
  exercises: readonly T[],
  targets: readonly WorkoutExerciseTargetIdentity[]
): Array<T & { targetId: number | null }> {
  return exercises.map((exercise) => {
    const matchingTarget =
      targets.find(
        (target) =>
          target.programDayExerciseId === exercise.id &&
          target.exerciseId === exercise.exercise.id
      ) ?? null;

    return {
      ...exercise,
      targetId: matchingTarget?.id ?? null,
    };
  });
}

export function getReplacementWarningMessage(): string {
  return "This replacement may change the training balance of this workout.";
}

export function getNoReplacementMessage(): string {
  return "No suitable replacement is available with the current options.";
}

export function getReplacementUnavailableMessage(): string {
  return "Replacement suggestions are not available for this session view yet.";
}

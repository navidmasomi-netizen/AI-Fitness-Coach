export { EXERCISE_CATALOG_METADATA_BY_NAME_EN } from "./exerciseCatalogCuration.js";

export const DNA_MOVEMENT_PATTERN_VALUES = Object.freeze([
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
]);

export const CATALOG_EQUIPMENT_VALUES = Object.freeze([
  "bodyweight",
  "dumbbell",
  "barbell",
  "bench",
  "rack",
  "cable",
  "selectorized_machine",
  "leg_press_machine",
  "pull_up_bar",
  "step_platform",
]);

export const STABILITY_DEMAND_VALUES = Object.freeze(["LOW", "MODERATE", "HIGH"]);
export const AXIAL_LOADING_VALUES = Object.freeze(["NONE", "LOW", "HIGH"]);
export const EXERCISE_CATALOG_LIFECYCLE_VALUES = Object.freeze([
  "DRAFT",
  "CURATED",
  "APPROVED",
  "ACTIVE",
  "DEPRECATED",
  "REJECTED",
]);

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertKnownValue({ field, value, allowedValues, exerciseName, errors }) {
  if (value !== null && value !== undefined && !allowedValues.includes(value)) {
    errors.push(`${exerciseName}: ${field} "${value}" is not a supported catalog value.`);
  }
}

export function generateExerciseCatalogSlug(nameEn) {
  if (typeof nameEn !== "string" || nameEn.trim().length === 0) {
    throw new Error("Exercise catalog slug generation requires a non-empty English name.");
  }

  const normalized = nameEn
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!SLUG_PATTERN.test(normalized)) {
    throw new Error(`Generated invalid exercise catalog slug "${normalized}" from "${nameEn}".`);
  }

  return normalized;
}

export function buildUniqueExerciseCatalogSlugs(exercises) {
  const slugToExerciseName = new Map();
  const exerciseNameToSlug = new Map();

  for (const exercise of exercises) {
    const slug = generateExerciseCatalogSlug(exercise.name_en);
    const existingExerciseName = slugToExerciseName.get(slug);
    if (existingExerciseName) {
      throw new Error(
        `Duplicate exercise catalog slug "${slug}" generated for "${existingExerciseName}" and "${exercise.name_en}".`
      );
    }

    slugToExerciseName.set(slug, exercise.name_en);
    exerciseNameToSlug.set(exercise.name_en, slug);
  }

  return exerciseNameToSlug;
}

export function validateExerciseCatalogRecord(record) {
  const errors = [];
  const exerciseName = record.nameEn || record.name_en || "<unknown>";

  if (record.slug !== null && record.slug !== undefined && !SLUG_PATTERN.test(record.slug)) {
    errors.push(`${exerciseName}: slug "${record.slug}" does not match the required catalog slug format.`);
  }

  assertKnownValue({
    field: "dnaMovementPattern",
    value: record.dnaMovementPattern,
    allowedValues: DNA_MOVEMENT_PATTERN_VALUES,
    exerciseName,
    errors,
  });
  assertKnownValue({
    field: "stabilityDemand",
    value: record.stabilityDemand,
    allowedValues: STABILITY_DEMAND_VALUES,
    exerciseName,
    errors,
  });
  assertKnownValue({
    field: "axialLoading",
    value: record.axialLoading,
    allowedValues: AXIAL_LOADING_VALUES,
    exerciseName,
    errors,
  });
  assertKnownValue({
    field: "catalogLifecycle",
    value: record.catalogLifecycle,
    allowedValues: EXERCISE_CATALOG_LIFECYCLE_VALUES,
    exerciseName,
    errors,
  });

  if (!Array.isArray(record.requiredEquipment)) {
    errors.push(`${exerciseName}: requiredEquipment must be an array of catalog equipment values.`);
  } else {
    for (const equipment of record.requiredEquipment) {
      assertKnownValue({
        field: "requiredEquipment",
        value: equipment,
        allowedValues: CATALOG_EQUIPMENT_VALUES,
        exerciseName,
        errors,
      });
    }
  }

  if (record.catalogLifecycle === "ACTIVE") {
    if (!record.dnaMovementPattern) {
      errors.push(`${exerciseName}: ACTIVE catalog metadata requires dnaMovementPattern.`);
    }
    if (!record.stabilityDemand) {
      errors.push(`${exerciseName}: ACTIVE catalog metadata requires stabilityDemand.`);
    }
    if (!record.axialLoading) {
      errors.push(`${exerciseName}: ACTIVE catalog metadata requires axialLoading.`);
    }
    if (!Array.isArray(record.requiredEquipment) || record.requiredEquipment.length === 0) {
      errors.push(`${exerciseName}: ACTIVE catalog metadata requires non-empty requiredEquipment.`);
    }
  }

  return errors;
}

export function validateExerciseCatalogMetadataSet(records) {
  const errors = [];
  const slugOwnerBySlug = new Map();

  for (const record of records) {
    for (const error of validateExerciseCatalogRecord(record)) {
      errors.push(error);
    }

    if (!record.slug) {
      continue;
    }

    const existingOwner = slugOwnerBySlug.get(record.slug);
    if (existingOwner) {
      errors.push(`Duplicate exercise catalog slug "${record.slug}" found for "${existingOwner}" and "${record.nameEn}".`);
      continue;
    }

    slugOwnerBySlug.set(record.slug, record.nameEn);
  }

  return errors;
}

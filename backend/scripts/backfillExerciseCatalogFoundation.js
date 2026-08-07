import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  buildCuratedExerciseCatalogFields,
  EXERCISE_CATALOG_METADATA_BY_NAME_EN,
} from "../src/services/exerciseCatalogCuration.js";
import {
  buildUniqueExerciseCatalogSlugs,
  validateExerciseCatalogMetadataSet,
} from "../src/services/exerciseCatalogValidation.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function arraysEqual(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function isNil(value) {
  return value === null || value === undefined;
}

function resolveFieldUpdate({ exerciseName, field, currentValue, approvedValue }) {
  if (Array.isArray(approvedValue)) {
    if (arraysEqual(currentValue, approvedValue)) {
      return undefined;
    }
    if (!Array.isArray(currentValue) || currentValue.length === 0) {
      return approvedValue;
    }
    throw new Error(
      `Exercise "${exerciseName}" has conflicting catalog field "${field}". Current value ${JSON.stringify(
        currentValue
      )} does not match approved value ${JSON.stringify(approvedValue)}.`
    );
  }

  if (currentValue === approvedValue) {
    return undefined;
  }

  if (isNil(currentValue) || currentValue === "DRAFT") {
    return approvedValue;
  }

  throw new Error(
    `Exercise "${exerciseName}" has conflicting catalog field "${field}". Current value ${JSON.stringify(
      currentValue
    )} does not match approved value ${JSON.stringify(approvedValue)}.`
  );
}

function buildBackfillUpdate({ exercise, approvedCatalogFields }) {
  const update = {};

  const fieldEntries = [
    ["slug", exercise.slug, approvedCatalogFields.slug],
    ["dnaMovementPattern", exercise.dnaMovementPattern, approvedCatalogFields.dnaMovementPattern],
    ["requiredEquipment", exercise.requiredEquipment, approvedCatalogFields.requiredEquipment],
    ["stabilityDemand", exercise.stabilityDemand, approvedCatalogFields.stabilityDemand],
    ["axialLoading", exercise.axialLoading, approvedCatalogFields.axialLoading],
    ["catalogLifecycle", exercise.catalogLifecycle, approvedCatalogFields.catalogLifecycle],
    ["catalogSource", exercise.catalogSource, approvedCatalogFields.catalogSource],
    ["catalogCurationVersion", exercise.catalogCurationVersion, approvedCatalogFields.catalogCurationVersion],
  ];

  for (const [field, currentValue, approvedValue] of fieldEntries) {
    const nextValue = resolveFieldUpdate({
      exerciseName: exercise.nameEn,
      field,
      currentValue,
      approvedValue,
    });

    if (nextValue !== undefined) {
      update[field] = nextValue;
    }
  }

  return update;
}

export async function backfillExistingExerciseCatalog({ prismaClient = prisma, logger = console } = {}) {
  const curatedNames = Object.keys(EXERCISE_CATALOG_METADATA_BY_NAME_EN);
  const slugByNameEn = buildUniqueExerciseCatalogSlugs(
    curatedNames.map((name_en) => ({ name_en }))
  );

  const existingExercises = await prismaClient.exercise.findMany({
    where: {
      nameEn: { in: curatedNames },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      nameEn: true,
      slug: true,
      dnaMovementPattern: true,
      requiredEquipment: true,
      stabilityDemand: true,
      axialLoading: true,
      catalogLifecycle: true,
      catalogSource: true,
      catalogCurationVersion: true,
    },
  });

  const matchesByName = new Map();
  for (const exercise of existingExercises) {
    const matches = matchesByName.get(exercise.nameEn) ?? [];
    matches.push(exercise);
    matchesByName.set(exercise.nameEn, matches);
  }

  const updates = [];
  for (const nameEn of curatedNames) {
    const matches = matchesByName.get(nameEn) ?? [];
    if (matches.length === 0) {
      throw new Error(`Expected exactly one existing Exercise row for "${nameEn}", but found none.`);
    }
    if (matches.length > 1) {
      throw new Error(`Expected exactly one existing Exercise row for "${nameEn}", but found ${matches.length}.`);
    }

    const exercise = matches[0];
    const approvedCatalogFields = buildCuratedExerciseCatalogFields({
      nameEn,
      slug: slugByNameEn.get(nameEn),
    });
    const update = buildBackfillUpdate({ exercise, approvedCatalogFields });

    if (Object.keys(update).length > 0) {
      updates.push({ id: exercise.id, nameEn, data: update });
    }
  }

  for (const update of updates) {
    await prismaClient.exercise.update({
      where: { id: update.id },
      data: update.data,
    });
  }

  const finalRows = await prismaClient.exercise.findMany({
    where: {
      nameEn: { in: curatedNames },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      nameEn: true,
      slug: true,
      dnaMovementPattern: true,
      requiredEquipment: true,
      stabilityDemand: true,
      axialLoading: true,
      catalogLifecycle: true,
    },
  });

  const validationErrors = validateExerciseCatalogMetadataSet(finalRows);
  if (validationErrors.length > 0) {
    throw new Error(
      `Exercise catalog backfill validation failed:\n${validationErrors
        .map((error) => ` - ${error}`)
        .join("\n")}`
    );
  }

  const activeCount = finalRows.filter((row) => row.catalogLifecycle === "ACTIVE").length;
  const curatedCount = finalRows.filter((row) => row.catalogLifecycle === "CURATED").length;

  const summary = {
    matchedCount: curatedNames.length,
    updatedCount: updates.length,
    unchangedCount: curatedNames.length - updates.length,
    activeCount,
    curatedCount,
  };

  logger.log(
    `Exercise catalog backfill completed: matched=${summary.matchedCount}, updated=${summary.updatedCount}, unchanged=${summary.unchangedCount}, active=${summary.activeCount}, curated=${summary.curatedCount}`
  );

  return summary;
}

async function main() {
  try {
    await backfillExistingExerciseCatalog();
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

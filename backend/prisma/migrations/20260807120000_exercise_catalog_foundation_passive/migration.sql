-- CreateEnum
CREATE TYPE "DnaMovementPattern" AS ENUM (
  'squat',
  'hinge',
  'lunge',
  'single_leg',
  'horizontal_press',
  'vertical_press',
  'horizontal_pull',
  'vertical_pull',
  'knee_extension',
  'knee_flexion',
  'hip_extension',
  'shoulder_abduction',
  'elbow_flexion',
  'elbow_extension',
  'trunk_flexion',
  'anti_extension',
  'anti_rotation'
);

-- CreateEnum
CREATE TYPE "CatalogEquipment" AS ENUM (
  'bodyweight',
  'dumbbell',
  'barbell',
  'bench',
  'rack',
  'cable',
  'selectorized_machine',
  'leg_press_machine',
  'pull_up_bar',
  'step_platform'
);

-- CreateEnum
CREATE TYPE "StabilityDemand" AS ENUM (
  'LOW',
  'MODERATE',
  'HIGH'
);

-- CreateEnum
CREATE TYPE "AxialLoading" AS ENUM (
  'NONE',
  'LOW',
  'HIGH'
);

-- CreateEnum
CREATE TYPE "ExerciseCatalogLifecycle" AS ENUM (
  'DRAFT',
  'CURATED',
  'APPROVED',
  'ACTIVE',
  'DEPRECATED',
  'REJECTED'
);

-- AlterTable
ALTER TABLE "Exercise"
ADD COLUMN "slug" TEXT,
ADD COLUMN "dnaMovementPattern" "DnaMovementPattern",
ADD COLUMN "requiredEquipment" "CatalogEquipment"[] NOT NULL DEFAULT ARRAY[]::"CatalogEquipment"[],
ADD COLUMN "stabilityDemand" "StabilityDemand",
ADD COLUMN "axialLoading" "AxialLoading",
ADD COLUMN "catalogLifecycle" "ExerciseCatalogLifecycle" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "catalogSource" TEXT,
ADD COLUMN "catalogCurationVersion" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_slug_key" ON "Exercise"("slug");

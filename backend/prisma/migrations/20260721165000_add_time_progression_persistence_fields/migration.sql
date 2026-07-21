-- AlterTable
ALTER TABLE "ProgramDayExercise"
ADD COLUMN     "durationIncrementSeconds" INTEGER;

-- AlterTable
ALTER TABLE "ProgressionRecommendation"
ADD COLUMN     "durationAdjustmentSteps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "rulesVersion" TEXT;

-- AlterTable
ALTER TABLE "ProgressionRecommendation"
ADD COLUMN     "decisionType" TEXT,
ADD COLUMN     "loadAdjustmentSteps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "repAdjustment" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "setAdjustment" INTEGER NOT NULL DEFAULT 0;

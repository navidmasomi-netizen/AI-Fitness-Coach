-- AlterTable
ALTER TABLE "ProgressionRecommendation" ADD COLUMN     "targetSets" INTEGER,
ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "reasonCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProgressionRecommendation_userId_exerciseId_sourceSessionId_key" ON "ProgressionRecommendation"("userId", "exerciseId", "sourceSessionId");

-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('increase', 'maintain', 'deload');

-- CreateTable
CREATE TABLE "ProgressionRecommendation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "exerciseId" INTEGER NOT NULL,
    "sourceSessionId" INTEGER NOT NULL,
    "recommendationType" "RecommendationType" NOT NULL,
    "previousWeightKg" DOUBLE PRECISION,
    "recommendedWeightKg" DOUBLE PRECISION,
    "previousTargetLow" INTEGER,
    "previousTargetHigh" INTEGER,
    "recommendedTargetLow" INTEGER,
    "recommendedTargetHigh" INTEGER,
    "progressionType" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressionRecommendation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ProgressionRecommendation" ADD CONSTRAINT "ProgressionRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionRecommendation" ADD CONSTRAINT "ProgressionRecommendation_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressionRecommendation" ADD CONSTRAINT "ProgressionRecommendation_sourceSessionId_fkey" FOREIGN KEY ("sourceSessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "RecommendationLifecycleStatus" AS ENUM (
    'PENDING',
    'APPLIED',
    'SUPERSEDED',
    'INVALID',
    'LEGACY_UNRESOLVABLE',
    'IGNORED'
);

-- AlterTable
ALTER TABLE "ProgramDayExercise"
ADD COLUMN     "loadIncrementKg" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "ProgressionRecommendation"
ADD COLUMN     "lifecycleStatus" "RecommendationLifecycleStatus";

-- CreateTable
CREATE TABLE "WorkoutSessionExerciseTarget" (
    "id" SERIAL NOT NULL,
    "sessionId" INTEGER NOT NULL,
    "programDayExerciseId" INTEGER NOT NULL,
    "exerciseId" INTEGER NOT NULL,
    "priorTargetId" INTEGER,
    "sourceRecommendationId" INTEGER,
    "targetSets" INTEGER NOT NULL,
    "targetRepRangeLow" INTEGER,
    "targetRepRangeHigh" INTEGER,
    "exactRepTarget" INTEGER,
    "targetLoadKg" DOUBLE PRECISION,
    "targetDurationSeconds" INTEGER,
    "progressionType" TEXT NOT NULL,
    "sourceDecisionType" TEXT,
    "sourceRulesVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutSessionExerciseTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationApplication" (
    "id" SERIAL NOT NULL,
    "recommendationId" INTEGER NOT NULL,
    "workoutSessionId" INTEGER NOT NULL,
    "workoutTargetId" INTEGER NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecommendationApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_status_completedAt_id_idx" ON "WorkoutSession"("userId", "status", "completedAt", "id");

-- CreateIndex
CREATE INDEX "ProgressionRecommendation_userId_exerciseId_lifecycleStatus_createdAt_idx" ON "ProgressionRecommendation"("userId", "exerciseId", "lifecycleStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSessionExerciseTarget_sourceRecommendationId_key" ON "WorkoutSessionExerciseTarget"("sourceRecommendationId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSessionExerciseTarget_sessionId_programDayExerciseId_key" ON "WorkoutSessionExerciseTarget"("sessionId", "programDayExerciseId");

-- CreateIndex
CREATE INDEX "WorkoutSessionExerciseTarget_sessionId_idx" ON "WorkoutSessionExerciseTarget"("sessionId");

-- CreateIndex
CREATE INDEX "WorkoutSessionExerciseTarget_exerciseId_sessionId_idx" ON "WorkoutSessionExerciseTarget"("exerciseId", "sessionId");

-- CreateIndex
CREATE INDEX "WorkoutSessionExerciseTarget_programDayExerciseId_sessionId_idx" ON "WorkoutSessionExerciseTarget"("programDayExerciseId", "sessionId");

-- CreateIndex
CREATE INDEX "WorkoutSessionExerciseTarget_priorTargetId_idx" ON "WorkoutSessionExerciseTarget"("priorTargetId");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationApplication_recommendationId_key" ON "RecommendationApplication"("recommendationId");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationApplication_workoutTargetId_key" ON "RecommendationApplication"("workoutTargetId");

-- CreateIndex
CREATE INDEX "RecommendationApplication_workoutSessionId_idx" ON "RecommendationApplication"("workoutSessionId");

-- AddForeignKey
ALTER TABLE "WorkoutSessionExerciseTarget" ADD CONSTRAINT "WorkoutSessionExerciseTarget_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSessionExerciseTarget" ADD CONSTRAINT "WorkoutSessionExerciseTarget_programDayExerciseId_fkey" FOREIGN KEY ("programDayExerciseId") REFERENCES "ProgramDayExercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSessionExerciseTarget" ADD CONSTRAINT "WorkoutSessionExerciseTarget_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSessionExerciseTarget" ADD CONSTRAINT "WorkoutSessionExerciseTarget_priorTargetId_fkey" FOREIGN KEY ("priorTargetId") REFERENCES "WorkoutSessionExerciseTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutSessionExerciseTarget" ADD CONSTRAINT "WorkoutSessionExerciseTarget_sourceRecommendationId_fkey" FOREIGN KEY ("sourceRecommendationId") REFERENCES "ProgressionRecommendation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationApplication" ADD CONSTRAINT "RecommendationApplication_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ProgressionRecommendation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationApplication" ADD CONSTRAINT "RecommendationApplication_workoutSessionId_fkey" FOREIGN KEY ("workoutSessionId") REFERENCES "WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationApplication" ADD CONSTRAINT "RecommendationApplication_workoutTargetId_fkey" FOREIGN KEY ("workoutTargetId") REFERENCES "WorkoutSessionExerciseTarget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

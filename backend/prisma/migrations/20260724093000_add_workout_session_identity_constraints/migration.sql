-- AlterTable
ALTER TABLE "WorkoutSession"
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "userProgramId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutSession_userId_idempotencyKey_key"
ON "WorkoutSession"("userId", "idempotencyKey");

-- Enforce at most one active workout session per user program
CREATE UNIQUE INDEX "WorkoutSession_userProgramId_active_unique"
ON "WorkoutSession"("userProgramId")
WHERE "userProgramId" IS NOT NULL AND "status" = 'active';

-- AddForeignKey
ALTER TABLE "WorkoutSession"
ADD CONSTRAINT "WorkoutSession_userProgramId_fkey"
FOREIGN KEY ("userProgramId") REFERENCES "UserProgram"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

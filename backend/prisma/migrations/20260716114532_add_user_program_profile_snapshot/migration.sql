-- CreateTable
CREATE TABLE "UserProgramProfileSnapshot" (
    "id" SERIAL NOT NULL,
    "userProgramId" INTEGER NOT NULL,
    "goal" TEXT NOT NULL,
    "equipmentAccess" TEXT[],
    "injuryFlags" TEXT[],
    "trainingDaysPerWeek" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProgramProfileSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserProgramProfileSnapshot_userProgramId_key" ON "UserProgramProfileSnapshot"("userProgramId");

-- AddForeignKey
ALTER TABLE "UserProgramProfileSnapshot" ADD CONSTRAINT "UserProgramProfileSnapshot_userProgramId_fkey" FOREIGN KEY ("userProgramId") REFERENCES "UserProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

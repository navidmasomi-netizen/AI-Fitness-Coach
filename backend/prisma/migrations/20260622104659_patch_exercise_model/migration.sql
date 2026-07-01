/*
  Warnings:

  - You are about to drop the column `defaultRestSeconds` on the `Exercise` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Exercise" DROP COLUMN "defaultRestSeconds",
ADD COLUMN     "defaultRestSecondsHigh" INTEGER,
ADD COLUMN     "defaultRestSecondsLow" INTEGER,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "icon" TEXT,
ADD COLUMN     "jointStressFlags" TEXT[],
ADD COLUMN     "progressionType" TEXT,
ADD COLUMN     "substitutionNames" TEXT[],
ADD COLUMN     "suitableGoals" "Goal"[];

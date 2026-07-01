/*
  Warnings:

  - You are about to drop the column `onboarded` on the `UserProfile` table. All the data in the column will be lost.
  - You are about to drop the column `sessionDurationMinutes` on the `UserProfile` table. All the data in the column will be lost.
  - The `equipmentAccess` column on the `UserProfile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `cardioPreference` to the `UserProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mealFrequency` to the `UserProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nutritionHabits` to the `UserProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `occupationType` to the `UserProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `preferredLanguage` to the `UserProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sessionDurationMin` to the `UserProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timezone` to the `UserProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `units` to the `UserProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `goal` to the `UserProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `trainingLevel` to the `UserProfile` table without a default value. This is not possible if the table is not empty.
  - Made the column `age` on table `UserProfile` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `sex` to the `UserProfile` table without a default value. This is not possible if the table is not empty.
  - Made the column `weightKg` on table `UserProfile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `heightCm` on table `UserProfile` required. This step will fail if there are existing NULL values in that column.
  - Made the column `trainingDaysPerWeek` on table `UserProfile` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `recoveryQuality` to the `UserProfile` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "UserProfile" DROP CONSTRAINT "UserProfile_userId_fkey";

-- AlterTable
ALTER TABLE "UserProfile" DROP COLUMN "onboarded",
DROP COLUMN "sessionDurationMinutes",
ADD COLUMN     "cardioPreference" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "injuryNotes" TEXT,
ADD COLUMN     "lastCompletedStep" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "mealFrequency" INTEGER NOT NULL,
ADD COLUMN     "nutritionHabits" TEXT NOT NULL,
ADD COLUMN     "occupationType" TEXT NOT NULL,
ADD COLUMN     "preferredLanguage" TEXT NOT NULL,
ADD COLUMN     "sessionDurationMin" INTEGER NOT NULL,
ADD COLUMN     "supplementUse" TEXT[],
ADD COLUMN     "timezone" TEXT NOT NULL,
ADD COLUMN     "units" TEXT NOT NULL,
ADD COLUMN     "wizardCompleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wizardCompletedAt" TIMESTAMP(3),
DROP COLUMN "goal",
ADD COLUMN     "goal" TEXT NOT NULL,
DROP COLUMN "trainingLevel",
ADD COLUMN     "trainingLevel" TEXT NOT NULL,
ALTER COLUMN "age" SET NOT NULL,
DROP COLUMN "sex",
ADD COLUMN     "sex" TEXT NOT NULL,
ALTER COLUMN "weightKg" SET NOT NULL,
ALTER COLUMN "heightCm" SET NOT NULL,
ALTER COLUMN "trainingDaysPerWeek" SET NOT NULL,
DROP COLUMN "equipmentAccess",
ADD COLUMN     "equipmentAccess" TEXT[],
DROP COLUMN "recoveryQuality",
ADD COLUMN     "recoveryQuality" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

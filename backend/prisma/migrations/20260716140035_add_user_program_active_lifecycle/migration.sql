-- DropIndex
DROP INDEX "UserProgram_userId_key";

-- AlterTable
ALTER TABLE "UserProgram" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Enforce at most one active UserProgram per user
CREATE UNIQUE INDEX "UserProgram_userId_active_unique"
ON "UserProgram" ("userId")
WHERE "isActive" = true;

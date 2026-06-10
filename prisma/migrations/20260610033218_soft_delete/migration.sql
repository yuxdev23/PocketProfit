-- AlterTable
ALTER TABLE "Entry" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN "deletedAt" DATETIME;

-- AlterTable
ALTER TABLE "RecurringRule" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Entry_userId_deletedAt_idx" ON "Entry"("userId", "deletedAt");

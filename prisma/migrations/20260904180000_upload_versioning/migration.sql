-- File versioning: replacing a file's content keeps the old row (and its
-- bytes) and links it via `supersedesId`; `isCurrent` marks the live version
-- so lists show one row per file.

-- AlterTable
ALTER TABLE "uploads" ADD COLUMN     "isCurrent" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "supersedesId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE INDEX "uploads_workspaceId_isCurrent_createdAt_idx" ON "uploads"("workspaceId", "isCurrent", "createdAt");

-- CreateIndex
CREATE INDEX "uploads_supersedesId_idx" ON "uploads"("supersedesId");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "uploads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

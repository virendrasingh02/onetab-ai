-- Generalise where an upload is "filed": WORKSPACE (unfiled) is the default,
-- CHANNEL keeps the legacy `channelId` populated alongside the new context
-- columns, and DIRECT/PROJECT/AGENT/APP are new surfaces.

-- CreateEnum
CREATE TYPE "UploadContextType" AS ENUM ('WORKSPACE', 'CHANNEL', 'DIRECT', 'PROJECT', 'AGENT', 'APP');

-- AlterTable
ALTER TABLE "uploads" ADD COLUMN     "contextId" TEXT,
ADD COLUMN     "contextType" "UploadContextType" NOT NULL DEFAULT 'WORKSPACE',
ADD COLUMN     "projectId" TEXT;

-- Backfill existing channel uploads into the new context columns.
UPDATE "uploads"
SET "contextType" = 'CHANNEL', "contextId" = "channelId"
WHERE "channelId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "uploads_workspaceId_contextType_contextId_createdAt_idx" ON "uploads"("workspaceId", "contextType", "contextId", "createdAt");

-- CreateIndex
CREATE INDEX "uploads_projectId_createdAt_idx" ON "uploads"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

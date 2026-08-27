-- Soft delete for user-deletable work items. A delete sets `deletedAt` instead
-- of removing the row (and cascading its children); reads filter it out; a
-- restore clears it. Indexed by (workspaceId, deletedAt) so the "not deleted"
-- filter stays cheap.
--
-- NOTE: `prisma migrate dev` also emits `ALTER COLUMN "searchVector" DROP
-- DEFAULT` lines here because it cannot read the GENERATED expression on the
-- tsvector columns — those are invalid (42601) and have been removed by hand.

-- AlterTable
ALTER TABLE "projects" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "work_documents" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whiteboards" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "calendar_events" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "projects_workspaceId_deletedAt_idx" ON "projects"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "tasks_workspaceId_deletedAt_idx" ON "tasks"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "work_documents_workspaceId_deletedAt_idx" ON "work_documents"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "whiteboards_workspaceId_deletedAt_idx" ON "whiteboards"("workspaceId", "deletedAt");

-- CreateIndex
CREATE INDEX "calendar_events_workspaceId_deletedAt_idx" ON "calendar_events"("workspaceId", "deletedAt");

-- Matrix space backing each workspace. `workspaces.matrixSpaceId` is the
-- `m.space` room id on the homeserver whose `m.space.child` state nests every
-- channel room in the workspace. Null until the first channel is linked to a
-- room; provisioned lazily from `MatrixSpaceService.ensureWorkspaceSpace` and
-- converged by the membership reconciler. The workspace row stays authoritative
-- for name, members and roles — the space is a mirror.

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN "matrixSpaceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_matrixSpaceId_key" ON "workspaces"("matrixSpaceId");

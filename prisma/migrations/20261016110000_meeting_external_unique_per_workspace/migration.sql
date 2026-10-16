-- A personal calendar can sync into several workspaces, so the key is per workspace.
DROP INDEX "meetings_organizerId_externalSource_externalId_key";
CREATE UNIQUE INDEX "meetings_workspaceId_organizerId_externalSource_externalId_key" ON "meetings"("workspaceId", "organizerId", "externalSource", "externalId");

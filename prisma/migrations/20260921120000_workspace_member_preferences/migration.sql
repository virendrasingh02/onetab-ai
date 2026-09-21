-- Settings-page tabs (automations, schedule, pulse, documents, files, and
-- several `general` fields) were `useWorkspacePreference`-only: a per-device
-- localStorage value with no server backing at all. `workspace_member_preferences`
-- gives each (workspace, user) pair one JSONB blob to round-trip those fields
-- through, the same shape `workspace_theme_preferences` already uses for
-- per-workspace appearance overrides — additive, no existing data touched.

-- CreateTable
CREATE TABLE "workspace_member_preferences" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_member_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_member_preferences_workspaceId_userId_key" ON "workspace_member_preferences"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "workspace_member_preferences_userId_idx" ON "workspace_member_preferences"("userId");

-- AddForeignKey
ALTER TABLE "workspace_member_preferences" ADD CONSTRAINT "workspace_member_preferences_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_member_preferences" ADD CONSTRAINT "workspace_member_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

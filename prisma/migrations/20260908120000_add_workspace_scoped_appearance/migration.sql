-- Workspace-scoped appearance. Theme / accent / branding was stored once per
-- user (`theme_settings`) and applied globally, so a change in one workspace
-- leaked into every other. Two additive tables make appearance a per-workspace
-- boundary:
--   * `workspace_settings.theme` — the workspace's appearance/branding default
--     (admins, MANAGE_SETTINGS).
--   * `workspace_theme_preferences.data` — a member's personal override for one
--     workspace, merged over that default.
-- `theme_settings` is untouched and becomes the user-global fallback, so every
-- existing user keeps their current look after this migration.

-- CreateTable
CREATE TABLE "workspace_settings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "theme" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_theme_preferences" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_theme_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_settings_workspaceId_key" ON "workspace_settings"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_theme_preferences_workspaceId_userId_key" ON "workspace_theme_preferences"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "workspace_theme_preferences_userId_idx" ON "workspace_theme_preferences"("userId");

-- AddForeignKey
ALTER TABLE "workspace_settings" ADD CONSTRAINT "workspace_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_theme_preferences" ADD CONSTRAINT "workspace_theme_preferences_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_theme_preferences" ADD CONSTRAINT "workspace_theme_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: seed each workspace's appearance default from the legacy
-- `workspaces.accentColor` column when it already holds a valid accent token,
-- so a workspace that had picked an accent keeps it under the new model.
INSERT INTO "workspace_settings" ("id", "workspaceId", "theme", "updatedAt")
SELECT
    gen_random_uuid()::text,
    w."id",
    jsonb_build_object('accent', w."accentColor"),
    CURRENT_TIMESTAMP
FROM "workspaces" w
WHERE w."accentColor" IN (
    'mint', 'violet', 'blue', 'green', 'amber', 'pink',
    'cyan', 'orange', 'indigo', 'teal', 'rose'
);

-- AlterTable
-- Settings unification, Phase B: "Default Join Channel" (Settings → Channels
-- & DMs). Soft reference (no FK) — validated at the application layer
-- against `Channel`, same pattern as this schema's other id-reference
-- columns. Null = today's behavior (no auto-add on join).
ALTER TABLE "workspace_settings"
  ADD COLUMN IF NOT EXISTS "defaultChannelId" TEXT;

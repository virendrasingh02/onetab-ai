-- Per-workspace avatar colour: a slot of the design-system avatar palette
-- (0..15). Left NULL here; the member service assigns the least-used slot on
-- the next roster read, so existing teammates get distinct colours.
ALTER TABLE "workspace_members" ADD COLUMN "avatarColor" INTEGER;

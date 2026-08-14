-- Workspace icons.
--
-- `icon` holds a Lucide registry name, an emoji, or an image URL; `iconColor`
-- tints the registry case. Both are independent of `avatarUrl`/`avatarKey`: an
-- uploaded logo takes precedence when both are set, and the icon stays behind
-- as the fallback if the logo is removed.
ALTER TABLE "workspaces" ADD COLUMN "icon" TEXT;
ALTER TABLE "workspaces" ADD COLUMN "iconColor" TEXT;

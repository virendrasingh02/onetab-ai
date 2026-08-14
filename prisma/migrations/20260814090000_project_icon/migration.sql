-- Project icons.
--
-- Same contract as `workspaces.icon`: `icon` holds a Lucide registry name, an
-- emoji, or an image URL, and `iconColor` tints the registry case. Both are
-- independent of `color`, which keeps tinting the board, the progress bars and
-- the task badges — the icon only replaces the plain swatch where one is drawn.
ALTER TABLE "projects" ADD COLUMN "icon" TEXT;
ALTER TABLE "projects" ADD COLUMN "iconColor" TEXT;
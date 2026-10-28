-- Workspace tile colour: a slot of the design-system avatar palette (0..15),
-- the same for every member. Existing workspaces are spread across the
-- palette in creation order so neighbours on the rail start out distinct.
ALTER TABLE "workspaces" ADD COLUMN "avatarColor" INTEGER;

UPDATE "workspaces" AS w
SET "avatarColor" = ranked.slot
FROM (
  SELECT "id", ((ROW_NUMBER() OVER (ORDER BY "createdAt", "id") - 1) % 16)::INTEGER AS slot
  FROM "workspaces"
) AS ranked
WHERE w."id" = ranked."id";

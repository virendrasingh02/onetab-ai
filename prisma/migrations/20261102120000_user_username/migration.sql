-- Public @handle per user, unique platform-wide.
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- Backfill from the email local part: lowercase, only [a-z0-9._], no edge
-- or doubled dots, at least 3 chars; collisions get a suffix from the id.
WITH base AS (
  SELECT
    id,
    "createdAt",
    CASE
      WHEN length(b) >= 3 THEN rtrim(left(b, 26), '.')
      ELSE left(b || 'user', 26)
    END AS handle
  FROM (
    SELECT
      id,
      "createdAt",
      trim(BOTH '.' FROM regexp_replace(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._]', '', 'g'), '\.{2,}', '.', 'g')) AS b
    FROM "users"
  ) raw
),
ranked AS (
  SELECT id, handle, row_number() OVER (PARTITION BY handle ORDER BY "createdAt", id) AS n
  FROM base
)
UPDATE "users" u
SET "username" = CASE WHEN r.n = 1 THEN r.handle ELSE r.handle || '_' || right(r.id, 4) END
FROM ranked r
WHERE u.id = r.id;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

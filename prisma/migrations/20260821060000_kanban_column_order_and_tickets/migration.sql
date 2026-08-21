-- Board column order, and ticket ids that come from the project.
--
-- Three things the board could not previously keep:
--
--  * the order of its columns, which was the `TaskStatus` enum's declaration
--    order and therefore the same for everyone;
--  * a stable ticket id, which the web app was hashing out of the task's cuid
--    into 900 slots and keeping in the browser's local storage — so it
--    collided, and no two people saw the same id for the same card;
--  * a sane `orderIndex`, because new tasks were filed at `first - 1` and
--    walked steadily negative, below the floor the move endpoint accepts.

-- --- columns ---------------------------------------------------------------

ALTER TABLE "projects"
  ADD COLUMN "columnOrder" "TaskStatus"[] NOT NULL DEFAULT ARRAY[]::"TaskStatus"[];

-- Existing boards keep the order they have always been drawn in. New ones get
-- it from the API, which writes the same list on create.
UPDATE "projects"
SET "columnOrder" = ARRAY['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']::"TaskStatus"[]
WHERE cardinality("columnOrder") = 0;

-- --- ticket ids ------------------------------------------------------------

ALTER TABLE "projects" ADD COLUMN "ticketPrefix" TEXT;
ALTER TABLE "projects" ADD COLUMN "ticketSeq" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "tasks" ADD COLUMN "ticketNumber" INTEGER;

/*
 * A prefix per project, from its name: initials for a multi-word name, the
 * first three letters for a single-word one, and a counter appended when the
 * workspace already has that stem. The API derives new prefixes the same way.
 */
DO $$
DECLARE
  project RECORD;
  words TEXT[];
  stem TEXT;
  candidate TEXT;
  suffix INTEGER;
  word_at INTEGER;
BEGIN
  FOR project IN SELECT "id", "workspaceId", "name" FROM "projects" ORDER BY "createdAt", "id" LOOP
    words := ARRAY(
      SELECT word
      FROM unnest(
        regexp_split_to_array(regexp_replace(project."name", '[^A-Za-z0-9]+', ' ', 'g'), ' ')
      ) AS word
      WHERE word <> ''
    );

    IF array_length(words, 1) IS NULL THEN
      stem := 'PRJ';
    ELSIF array_length(words, 1) = 1 THEN
      stem := upper(substr(words[1], 1, 3));
    ELSE
      stem := '';
      FOR word_at IN 1..least(array_length(words, 1), 4) LOOP
        stem := stem || upper(substr(words[word_at], 1, 1));
      END LOOP;
    END IF;

    IF stem = '' THEN
      stem := 'PRJ';
    END IF;

    candidate := stem;
    suffix := 1;
    WHILE EXISTS (
      SELECT 1 FROM "projects" taken
      WHERE taken."workspaceId" = project."workspaceId"
        AND taken."ticketPrefix" = candidate
    ) LOOP
      suffix := suffix + 1;
      candidate := stem || suffix::TEXT;
    END LOOP;

    UPDATE "projects" SET "ticketPrefix" = candidate WHERE "id" = project."id";
  END LOOP;
END $$;

-- Number the tasks a project already has, oldest first, so the ids read as the
-- order the work was filed in.
WITH numbered AS (
  SELECT
    "id",
    row_number() OVER (PARTITION BY "projectId" ORDER BY "createdAt", "id") AS seq
  FROM "tasks"
  WHERE "projectId" IS NOT NULL
)
UPDATE "tasks"
SET "ticketNumber" = numbered.seq
FROM numbered
WHERE "tasks"."id" = numbered."id";

UPDATE "projects"
SET "ticketSeq" = COALESCE(
  (SELECT max("ticketNumber") FROM "tasks" WHERE "tasks"."projectId" = "projects"."id"),
  0
);

-- --- positions -------------------------------------------------------------

/*
 * Respace any column that drifted below zero, leaving the gaps the board's
 * midpoint arithmetic needs between neighbours. Columns that are already sound
 * are left exactly as they are.
 */
WITH broken AS (
  SELECT DISTINCT "projectId", "status"
  FROM "tasks"
  WHERE "orderIndex" < 0
),
ranked AS (
  SELECT
    "tasks"."id",
    row_number() OVER (
      PARTITION BY "tasks"."projectId", "tasks"."status"
      ORDER BY "tasks"."orderIndex", "tasks"."createdAt", "tasks"."id"
    ) AS seat
  FROM "tasks"
  JOIN broken
    ON "tasks"."status" = broken."status"
   AND "tasks"."projectId" IS NOT DISTINCT FROM broken."projectId"
)
UPDATE "tasks"
SET "orderIndex" = ranked.seat * 1024
FROM ranked
WHERE "tasks"."id" = ranked."id";

-- --- constraints -----------------------------------------------------------

-- Both are partial by nature rather than by declaration: Postgres treats NULLs
-- as distinct, so unnumbered tasks and prefix-less projects never collide.
CREATE UNIQUE INDEX "projects_workspaceId_ticketPrefix_key" ON "projects"("workspaceId", "ticketPrefix");
CREATE UNIQUE INDEX "tasks_projectId_ticketNumber_key" ON "tasks"("projectId", "ticketNumber");

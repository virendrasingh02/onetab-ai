-- Promote multi-assignee from a `customFields.assigneeIds` JSON stash to a
-- first-class array column, so it can be indexed and queried ("assigned to
-- me") and every assignee — not just the primary — is reachable.
--
-- Written by hand rather than via `prisma migrate dev`: the dev database has
-- pre-existing drift (an unrelated `InvitationStatus.DECLINED` variant and a
-- dropped `invitations(workspaceId, email)` unique index) that would make
-- `migrate dev` demand a reset. This file is the DDL that change needs; run
-- `prisma migrate resolve --applied 20260901120000_task_multi_assignee` after
-- applying it, or fold it into the next clean `migrate dev` once the
-- invitations drift is captured in its own migration.

-- AddColumn
ALTER TABLE "tasks" ADD COLUMN "assigneeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Backfill: prefer the JSON stash the app has been writing, then fall back to
-- the single-assignee column for rows that predate multi-assignee.
UPDATE "tasks"
SET "assigneeIds" = ARRAY(
  SELECT jsonb_array_elements_text("customFields"->'assigneeIds')
)
WHERE jsonb_typeof("customFields"->'assigneeIds') = 'array'
  AND jsonb_array_length("customFields"->'assigneeIds') > 0;

UPDATE "tasks"
SET "assigneeIds" = ARRAY["assigneeId"]
WHERE "assigneeId" IS NOT NULL
  AND COALESCE(array_length("assigneeIds", 1), 0) = 0;

-- Keep the primary column consistent with position 0 of the array where the
-- stash disagreed with it.
UPDATE "tasks"
SET "assigneeId" = "assigneeIds"[1]
WHERE COALESCE(array_length("assigneeIds", 1), 0) > 0
  AND ("assigneeId" IS DISTINCT FROM "assigneeIds"[1]);

-- Drop the now-redundant JSON key so there is one source of truth.
UPDATE "tasks"
SET "customFields" = "customFields" - 'assigneeIds'
WHERE "customFields" ? 'assigneeIds';

-- CreateIndex
CREATE INDEX "tasks_assigneeIds_idx" ON "tasks" USING GIN ("assigneeIds");

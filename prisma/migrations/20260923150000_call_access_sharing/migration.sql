-- Explicit sharing for call notes / summaries. Visibility defaults to the
-- call's participants and its channel audience; these widen it on "Share".
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "sharedWithWorkspace" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "sharedWithUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- At most one live call per conversation: two members pressing "call" at the
-- same moment must converge on one session instead of splitting the notes.
-- Older duplicates (if any) are ended first so the index can be created.
UPDATE "calls" c
SET "status" = 'ENDED', "endedAt" = COALESCE(c."endedAt", c."updatedAt")
WHERE c."status" = 'ACTIVE'
  AND EXISTS (
    SELECT 1 FROM "calls" newer
    WHERE newer."conversationId" = c."conversationId"
      AND newer."status" = 'ACTIVE'
      AND newer."startedAt" > c."startedAt"
  );

CREATE UNIQUE INDEX IF NOT EXISTS "calls_one_active_per_conversation"
  ON "calls" ("conversationId")
  WHERE "status" = 'ACTIVE';

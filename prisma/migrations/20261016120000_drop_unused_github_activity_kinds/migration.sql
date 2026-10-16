-- Postgres cannot drop enum values, so the type is rebuilt without the two unused ones.
-- (Guarded: fails loudly rather than rewriting rows if any exist.)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "recent_activity" WHERE "kind"::text IN ('GITHUB_COMMIT', 'GITHUB_PULL_REQUEST')) THEN
    RAISE EXCEPTION 'recent_activity still has GITHUB_* rows';
  END IF;
END $$;

ALTER TYPE "ActivityKind" RENAME TO "ActivityKind_old";
CREATE TYPE "ActivityKind" AS ENUM ('MESSAGE', 'MEMBER_JOINED', 'MEMBER_LEFT', 'CHANNEL_CREATED', 'FILE_SHARED', 'TASK_CREATED', 'TASK_ASSIGNED', 'TASK_COMPLETED', 'PROJECT_CREATED', 'DOCUMENT_CREATED', 'MEETING_SCHEDULED', 'MEETING_CANCELLED', 'MEETING_ENDED');
ALTER TABLE "recent_activity" ALTER COLUMN "kind" TYPE "ActivityKind" USING "kind"::text::"ActivityKind";
DROP TYPE "ActivityKind_old";

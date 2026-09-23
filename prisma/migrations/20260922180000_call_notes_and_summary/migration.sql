-- Call Notes and AI Call Summary migration

DO $$ BEGIN
  CREATE TYPE "CallKind" AS ENUM ('AUDIO', 'VIDEO');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CallSessionStatus" AS ENUM ('ACTIVE', 'ENDED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "CallSummaryStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED', 'EDITED', 'APPROVED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationKind" ADD VALUE 'CALL_SUMMARY_READY';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TYPE "NotificationKind" ADD VALUE 'CALL_ACTION_ITEM_ASSIGNED';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "calls" (
  "id"             TEXT NOT NULL,
  "workspaceId"    TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "channelId"      TEXT,
  "meetingId"      TEXT,
  "title"          TEXT NOT NULL,
  "kind"           "CallKind" NOT NULL DEFAULT 'AUDIO',
  "status"         "CallSessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedById"    TEXT NOT NULL,
  "startedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"        TIMESTAMP(3),
  "recordingUrl"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "call_participants" (
  "id"        TEXT NOT NULL,
  "callId"    TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "joinedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt"    TIMESTAMP(3),
  CONSTRAINT "call_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "call_notes" (
  "id"          TEXT NOT NULL,
  "callId"      TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "authorId"    TEXT NOT NULL,
  "content"     TEXT NOT NULL DEFAULT '',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "call_summaries" (
  "id"             TEXT NOT NULL,
  "callId"         TEXT NOT NULL,
  "workspaceId"    TEXT NOT NULL,
  "status"         "CallSummaryStatus" NOT NULL DEFAULT 'PROCESSING',
  "overview"       TEXT,
  "keyPoints"      JSONB DEFAULT '[]',
  "openQuestions"  JSONB DEFAULT '[]',
  "followUps"      JSONB DEFAULT '[]',
  "importantLinks" JSONB DEFAULT '[]',
  "rawContent"     TEXT,
  "version"        INTEGER NOT NULL DEFAULT 1,
  "failureReason"  TEXT,
  "generatedById"  TEXT,
  "generatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_summaries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "call_action_items" (
  "id"              TEXT NOT NULL,
  "callId"          TEXT NOT NULL,
  "summaryId"       TEXT,
  "workspaceId"     TEXT NOT NULL,
  "title"           TEXT NOT NULL,
  "description"     TEXT,
  "assigneeId"      TEXT,
  "dueDate"         TIMESTAMP(3),
  "status"          TEXT NOT NULL DEFAULT 'TODO',
  "priority"        "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "sourceTimestamp" INTEGER,
  "taskId"          TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_action_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "call_decisions" (
  "id"              TEXT NOT NULL,
  "callId"          TEXT NOT NULL,
  "summaryId"       TEXT,
  "workspaceId"     TEXT NOT NULL,
  "content"         TEXT NOT NULL,
  "sourceTimestamp" INTEGER,
  "madeById"        TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_decisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "call_transcript_items" (
  "id"          TEXT NOT NULL,
  "callId"      TEXT NOT NULL,
  "speakerId"   TEXT,
  "speakerName" TEXT NOT NULL,
  "text"        TEXT NOT NULL,
  "timestamp"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_transcript_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "call_summary_feedbacks" (
  "id"        TEXT NOT NULL,
  "summaryId" TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "rating"    TEXT NOT NULL,
  "feedback"  TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_summary_feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "calls_workspaceId_status_idx" ON "calls" ("workspaceId", "status");
CREATE INDEX IF NOT EXISTS "calls_conversationId_status_idx" ON "calls" ("conversationId", "status");
CREATE INDEX IF NOT EXISTS "calls_meetingId_idx" ON "calls" ("meetingId");

CREATE UNIQUE INDEX IF NOT EXISTS "call_participants_callId_userId_key" ON "call_participants" ("callId", "userId");
CREATE INDEX IF NOT EXISTS "call_participants_userId_idx" ON "call_participants" ("userId");

CREATE INDEX IF NOT EXISTS "call_notes_callId_createdAt_idx" ON "call_notes" ("callId", "createdAt");
CREATE INDEX IF NOT EXISTS "call_notes_workspaceId_idx" ON "call_notes" ("workspaceId");

CREATE UNIQUE INDEX IF NOT EXISTS "call_summaries_callId_key" ON "call_summaries" ("callId");
CREATE INDEX IF NOT EXISTS "call_summaries_workspaceId_status_idx" ON "call_summaries" ("workspaceId", "status");

CREATE INDEX IF NOT EXISTS "call_action_items_callId_idx" ON "call_action_items" ("callId");
CREATE INDEX IF NOT EXISTS "call_action_items_workspaceId_idx" ON "call_action_items" ("workspaceId");
CREATE INDEX IF NOT EXISTS "call_action_items_taskId_idx" ON "call_action_items" ("taskId");

CREATE INDEX IF NOT EXISTS "call_decisions_callId_idx" ON "call_decisions" ("callId");
CREATE INDEX IF NOT EXISTS "call_decisions_workspaceId_idx" ON "call_decisions" ("workspaceId");

CREATE INDEX IF NOT EXISTS "call_transcript_items_callId_timestamp_idx" ON "call_transcript_items" ("callId", "timestamp");

CREATE INDEX IF NOT EXISTS "call_summary_feedbacks_summaryId_idx" ON "call_summary_feedbacks" ("summaryId");

DO $$ BEGIN
  ALTER TABLE "calls" ADD CONSTRAINT "calls_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "calls" ADD CONSTRAINT "calls_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "calls" ADD CONSTRAINT "calls_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "calls" ADD CONSTRAINT "calls_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

  ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "call_participants" ADD CONSTRAINT "call_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

  ALTER TABLE "call_notes" ADD CONSTRAINT "call_notes_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "call_notes" ADD CONSTRAINT "call_notes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "call_notes" ADD CONSTRAINT "call_notes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

  ALTER TABLE "call_summaries" ADD CONSTRAINT "call_summaries_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "call_summaries" ADD CONSTRAINT "call_summaries_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

  ALTER TABLE "call_action_items" ADD CONSTRAINT "call_action_items_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "call_action_items" ADD CONSTRAINT "call_action_items_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "call_summaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "call_action_items" ADD CONSTRAINT "call_action_items_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "call_action_items" ADD CONSTRAINT "call_action_items_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "call_action_items" ADD CONSTRAINT "call_action_items_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

  ALTER TABLE "call_decisions" ADD CONSTRAINT "call_decisions_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "call_decisions" ADD CONSTRAINT "call_decisions_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "call_summaries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "call_decisions" ADD CONSTRAINT "call_decisions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "call_decisions" ADD CONSTRAINT "call_decisions_madeById_fkey" FOREIGN KEY ("madeById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

  ALTER TABLE "call_transcript_items" ADD CONSTRAINT "call_transcript_items_callId_fkey" FOREIGN KEY ("callId") REFERENCES "calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

  ALTER TABLE "call_summary_feedbacks" ADD CONSTRAINT "call_summary_feedbacks_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "call_summaries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "call_summary_feedbacks" ADD CONSTRAINT "call_summary_feedbacks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

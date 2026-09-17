-- Real scheduled message send: a ScheduledMessage row delivered server-side
-- by a per-minute sweep, replacing the previous localStorage-only stub.
--
-- Hand-written (see 20260908101946, 20260908150000): `prisma migrate dev`
-- still folds in the un-migrated compliance drift + an invalid
-- `searchVector DROP DEFAULT`. Every statement here is guarded so a
-- re-apply is a no-op.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ScheduledMessageStatus" AS ENUM ('PENDING', 'SENT', 'CANCELLED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "scheduled_messages" (
  "id"             TEXT NOT NULL,
  "workspaceId"    TEXT NOT NULL,
  "authorId"       TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "channelName"    TEXT,
  "body"           TEXT NOT NULL,
  "scheduledFor"   TIMESTAMP(3) NOT NULL,
  "status"         "ScheduledMessageStatus" NOT NULL DEFAULT 'PENDING',
  "sentAt"         TIMESTAMP(3),
  "errorMessage"   TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "scheduled_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scheduled_messages_status_scheduledFor_idx" ON "scheduled_messages" ("status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "scheduled_messages_workspaceId_authorId_idx" ON "scheduled_messages" ("workspaceId", "authorId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "scheduled_messages"
    ADD CONSTRAINT "scheduled_messages_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "scheduled_messages"
    ADD CONSTRAINT "scheduled_messages_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

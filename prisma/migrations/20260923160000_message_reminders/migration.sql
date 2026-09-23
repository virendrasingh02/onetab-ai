-- "Remind me about this" on chat messages.
DO $$ BEGIN
  ALTER TYPE "NotificationKind" ADD VALUE 'MESSAGE_REMINDER' BEFORE 'SYSTEM';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "message_reminders" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "roomId"      TEXT NOT NULL,
  "eventId"     TEXT NOT NULL,
  "deepLink"    TEXT NOT NULL,
  "snippet"     TEXT NOT NULL DEFAULT '',
  "remindAt"    TIMESTAMP(3) NOT NULL,
  "firedAt"     TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_reminders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "message_reminders_firedAt_remindAt_idx" ON "message_reminders" ("firedAt", "remindAt");
CREATE INDEX IF NOT EXISTS "message_reminders_userId_workspaceId_idx" ON "message_reminders" ("userId", "workspaceId");

DO $$ BEGIN
  ALTER TABLE "message_reminders" ADD CONSTRAINT "message_reminders_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "message_reminders" ADD CONSTRAINT "message_reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

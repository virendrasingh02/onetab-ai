-- Slice G — Anonymous messaging (brief §2). Hand-written (see 20260908101946).
-- Guarded so a re-apply is a no-op.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AnonymousModerationKind" AS ENUM ('REPORT', 'REVEAL_AUTHOR', 'REMOVE_MESSAGE');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "channel_anonymous_settings" (
  "id"           TEXT NOT NULL,
  "channelId"    TEXT NOT NULL,
  "workspaceId"  TEXT NOT NULL,
  "isEnabled"    BOOLEAN NOT NULL DEFAULT false,
  "allowedRoles" "WorkspaceRole"[] DEFAULT ARRAY[]::"WorkspaceRole"[],
  "allowReplies" BOOLEAN NOT NULL DEFAULT true,
  "matrixUserId" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_anonymous_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "anonymous_messages" (
  "id"            TEXT NOT NULL,
  "channelId"     TEXT NOT NULL,
  "workspaceId"   TEXT NOT NULL,
  "matrixEventId" TEXT NOT NULL,
  "authorId"      TEXT NOT NULL,
  "isReply"       BOOLEAN NOT NULL DEFAULT false,
  "removedAt"     TIMESTAMP(3),
  "removedById"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anonymous_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "anonymous_moderation_events" (
  "id"                 TEXT NOT NULL,
  "workspaceId"        TEXT NOT NULL,
  "anonymousMessageId" TEXT NOT NULL,
  "actorId"            TEXT NOT NULL,
  "kind"               "AnonymousModerationKind" NOT NULL,
  "reason"             TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "anonymous_moderation_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "channel_anonymous_settings_channelId_key" ON "channel_anonymous_settings" ("channelId");
CREATE INDEX IF NOT EXISTS "channel_anonymous_settings_workspaceId_idx" ON "channel_anonymous_settings" ("workspaceId");
CREATE UNIQUE INDEX IF NOT EXISTS "anonymous_messages_matrixEventId_key" ON "anonymous_messages" ("matrixEventId");
CREATE INDEX IF NOT EXISTS "anonymous_messages_channelId_createdAt_idx" ON "anonymous_messages" ("channelId", "createdAt");
CREATE INDEX IF NOT EXISTS "anonymous_messages_workspaceId_removedAt_idx" ON "anonymous_messages" ("workspaceId", "removedAt");
CREATE INDEX IF NOT EXISTS "anonymous_moderation_events_workspaceId_createdAt_idx" ON "anonymous_moderation_events" ("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "anonymous_moderation_events_anonymousMessageId_idx" ON "anonymous_moderation_events" ("anonymousMessageId");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "channel_anonymous_settings" ADD CONSTRAINT "channel_anonymous_settings_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "channel_anonymous_settings" ADD CONSTRAINT "channel_anonymous_settings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "anonymous_messages" ADD CONSTRAINT "anonymous_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "anonymous_messages" ADD CONSTRAINT "anonymous_messages_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "anonymous_messages" ADD CONSTRAINT "anonymous_messages_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "anonymous_moderation_events" ADD CONSTRAINT "anonymous_moderation_events_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "anonymous_moderation_events" ADD CONSTRAINT "anonymous_moderation_events_anonymousMessageId_fkey" FOREIGN KEY ("anonymousMessageId") REFERENCES "anonymous_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "anonymous_moderation_events" ADD CONSTRAINT "anonymous_moderation_events_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Slice H — Universal email integration (brief §5). Hand-written (see 20260908101946).

CREATE TABLE IF NOT EXISTS "channel_email_addresses" (
  "id"               TEXT NOT NULL,
  "channelId"        TEXT NOT NULL,
  "workspaceId"      TEXT NOT NULL,
  "localpart"        TEXT NOT NULL,
  "isEnabled"        BOOLEAN NOT NULL DEFAULT true,
  "threadPerSubject" BOOLEAN NOT NULL DEFAULT true,
  "matrixUserId"     TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "channel_email_addresses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "email_messages" (
  "id"                    TEXT NOT NULL,
  "channelEmailAddressId" TEXT NOT NULL,
  "channelId"             TEXT NOT NULL,
  "workspaceId"           TEXT NOT NULL,
  "messageId"             TEXT NOT NULL,
  "inReplyTo"             TEXT,
  "references"            TEXT,
  "fromAddress"           TEXT NOT NULL,
  "fromName"              TEXT,
  "toAddress"             TEXT NOT NULL,
  "subject"               TEXT,
  "matrixEventId"         TEXT,
  "matrixThreadRootId"    TEXT,
  "attachmentCount"       INTEGER NOT NULL DEFAULT 0,
  "createdAt"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "channel_email_addresses_channelId_key" ON "channel_email_addresses" ("channelId");
CREATE UNIQUE INDEX IF NOT EXISTS "channel_email_addresses_localpart_key" ON "channel_email_addresses" ("localpart");
CREATE INDEX IF NOT EXISTS "channel_email_addresses_workspaceId_idx" ON "channel_email_addresses" ("workspaceId");
CREATE UNIQUE INDEX IF NOT EXISTS "email_messages_messageId_key" ON "email_messages" ("messageId");
CREATE INDEX IF NOT EXISTS "email_messages_channelId_createdAt_idx" ON "email_messages" ("channelId", "createdAt");
CREATE INDEX IF NOT EXISTS "email_messages_subject_idx" ON "email_messages" ("subject");

DO $$ BEGIN
  ALTER TABLE "channel_email_addresses" ADD CONSTRAINT "channel_email_addresses_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "channel_email_addresses" ADD CONSTRAINT "channel_email_addresses_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_channelEmailAddressId_fkey" FOREIGN KEY ("channelEmailAddressId") REFERENCES "channel_email_addresses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

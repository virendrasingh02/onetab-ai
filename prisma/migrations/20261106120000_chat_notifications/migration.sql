-- Chat messages in the notification centre, and the event each row last announced.
ALTER TYPE "NotificationKind" ADD VALUE 'CHAT_MESSAGE';

ALTER TABLE "notifications" ADD COLUMN "sourceEventId" TEXT;

CREATE UNIQUE INDEX "notifications_recipientId_sourceEventId_key" ON "notifications"("recipientId", "sourceEventId");

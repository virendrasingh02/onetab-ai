-- User status updates (Slack style).
--
-- statusText: custom status text message (e.g. "In a meeting", "Working remotely")
-- statusEmoji: emoji representing the status (e.g. "💬", "🎯")
-- statusExpiresAt: when the status should automatically expire/clear
ALTER TABLE "users" ADD COLUMN "statusText" TEXT;
ALTER TABLE "users" ADD COLUMN "statusEmoji" TEXT;
ALTER TABLE "users" ADD COLUMN "statusExpiresAt" TIMESTAMP(3);

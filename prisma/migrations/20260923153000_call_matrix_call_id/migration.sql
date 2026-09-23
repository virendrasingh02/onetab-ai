-- The Matrix VoIP call id a call session tracks, so both ends converge on one
-- session and an orphaned ACTIVE session can be told apart from a new call.
ALTER TABLE "calls" ADD COLUMN IF NOT EXISTS "matrixCallId" TEXT;
CREATE INDEX IF NOT EXISTS "calls_matrixCallId_idx" ON "calls" ("matrixCallId");

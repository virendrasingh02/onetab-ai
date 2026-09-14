-- AlterTable
-- `ChatSettings.mentionWarningsEnabled` / `.allowDirectMessagesFrom` were
-- added to schema.prisma by the "Universal Composer User-Control" commit
-- (0169596) without a matching migration — every read/write of `ChatSettings`
-- would 500 against a real database until this ran.
ALTER TABLE "chat_settings"
  ADD COLUMN IF NOT EXISTS "mentionWarningsEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allowDirectMessagesFrom" TEXT NOT NULL DEFAULT 'everyone';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "chat_settings_userId_idx" ON "chat_settings"("userId");

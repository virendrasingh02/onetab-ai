-- AlterTable
-- Unified welcome-message system: lets a channel or an AI agent/coworker
-- configure the first message shown in an otherwise-empty conversation
-- (rendered by `ChannelWelcome`). Null = today's generic system default.
ALTER TABLE "channels"
  ADD COLUMN IF NOT EXISTS "welcomeMessage" TEXT;

-- AlterTable
-- `ai_agents` covers both AI Agent and AI Coworker rows (type discriminator),
-- so one column serves both DM kinds.
ALTER TABLE "ai_agents"
  ADD COLUMN IF NOT EXISTS "welcomeMessage" TEXT;

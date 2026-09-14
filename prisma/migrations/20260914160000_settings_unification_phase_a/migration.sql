-- AlterTable
-- Settings unification, Phase A (foundation):
--   * `showTypingIndicators` — the "show other people's typing" half of the
--     typing-indicator setting; `sendTypingNotice` already covered the "send
--     my own" half.
--   * `notificationDisplayPrefs` — closes the round-trip gap where the
--     notification display/sound half of `/users/me/preferences` was always
--     served from a hardcoded default server-side (the `chat.*` half already
--     persisted to this table's other columns).
ALTER TABLE "chat_settings"
  ADD COLUMN IF NOT EXISTS "showTypingIndicators" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "notificationDisplayPrefs" JSONB;

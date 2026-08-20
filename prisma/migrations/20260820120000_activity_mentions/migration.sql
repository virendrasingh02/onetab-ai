-- Who an activity row named.
--
-- The sidebar draws two different dots: a grey one for "this channel or
-- workspace saw activity" and a red one for "someone called you by name". The
-- second needs to know the mentioned users, and the feed row is the only place
-- that knows it — message content itself still lives in Matrix and is never
-- copied here.
ALTER TABLE "recent_activity"
  ADD COLUMN "mentionedUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

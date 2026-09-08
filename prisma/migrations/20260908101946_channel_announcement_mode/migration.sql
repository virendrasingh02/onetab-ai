-- Slice B — Announcement / broadcast channels (brief §3).
--
-- Hand-written to touch ONLY the `channels` table: `prisma migrate dev` wanted
-- to fold in a large pre-existing schema drift (the compliance subgraph, never
-- migrated locally) and also emitted an invalid `ALTER COLUMN "searchVector"
-- DROP DEFAULT` for the generated tsvector column. Neither belongs here.

-- CreateEnum
CREATE TYPE "ChannelMode" AS ENUM ('STANDARD', 'ANNOUNCEMENT');

-- AlterTable — safe defaults so every existing channel stays a STANDARD channel
-- with today's posting behaviour (brief §20).
ALTER TABLE "channels"
  ADD COLUMN "mode" "ChannelMode" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "allowReactions" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allowReplies" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "allowFileUploads" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "announcementPosterIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

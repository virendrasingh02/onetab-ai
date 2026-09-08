-- Slice I — Huddles (brief §6 / §7). Hand-written (see 20260908101946).

DO $$ BEGIN
  CREATE TYPE "HuddleStatus" AS ENUM ('ACTIVE', 'ENDED');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "huddles" (
  "id"           TEXT NOT NULL,
  "workspaceId"  TEXT NOT NULL,
  "channelId"    TEXT,
  "matrixRoomId" TEXT NOT NULL,
  "startedById"  TEXT NOT NULL,
  "status"       "HuddleStatus" NOT NULL DEFAULT 'ACTIVE',
  "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt"      TIMESTAMP(3),
  CONSTRAINT "huddles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "huddle_participants" (
  "id"       TEXT NOT NULL,
  "huddleId" TEXT NOT NULL,
  "userId"   TEXT NOT NULL,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt"   TIMESTAMP(3),
  CONSTRAINT "huddle_participants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "huddles_matrixRoomId_status_idx" ON "huddles" ("matrixRoomId", "status");
CREATE INDEX IF NOT EXISTS "huddles_workspaceId_status_idx" ON "huddles" ("workspaceId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "huddle_participants_huddleId_userId_key" ON "huddle_participants" ("huddleId", "userId");
CREATE INDEX IF NOT EXISTS "huddle_participants_userId_leftAt_idx" ON "huddle_participants" ("userId", "leftAt");

DO $$ BEGIN
  ALTER TABLE "huddles" ADD CONSTRAINT "huddles_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "huddles" ADD CONSTRAINT "huddles_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "huddles" ADD CONSTRAINT "huddles_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "huddle_participants" ADD CONSTRAINT "huddle_participants_huddleId_fkey" FOREIGN KEY ("huddleId") REFERENCES "huddles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "huddle_participants" ADD CONSTRAINT "huddle_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

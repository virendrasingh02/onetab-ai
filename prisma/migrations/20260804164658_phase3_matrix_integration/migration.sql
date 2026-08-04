-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('MESSAGE', 'MEMBER_JOINED', 'MEMBER_LEFT', 'CHANNEL_CREATED', 'FILE_SHARED');

-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "matrixRoomId" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "matrixUserId" TEXT;

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mentionsOnly" BOOLEAN NOT NULL DEFAULT false,
    "mutedChannelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_registrations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pushKey" TEXT NOT NULL,
    "appId" TEXT NOT NULL,
    "deviceDisplayName" TEXT,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "density" TEXT NOT NULL DEFAULT 'comfortable',
    "showReadReceipts" BOOLEAN NOT NULL DEFAULT true,
    "sendTypingNotice" BOOLEAN NOT NULL DEFAULT true,
    "enterToSend" BOOLEAN NOT NULL DEFAULT true,
    "playSounds" BOOLEAN NOT NULL DEFAULT true,
    "autoloadMedia" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recent_activity" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "channelId" TEXT,
    "userId" TEXT,
    "kind" "ActivityKind" NOT NULL,
    "matrixEventId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recent_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_preferences_workspaceId_idx" ON "notification_preferences"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_workspaceId_key" ON "notification_preferences"("userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "push_registrations_pushKey_key" ON "push_registrations"("pushKey");

-- CreateIndex
CREATE INDEX "push_registrations_userId_idx" ON "push_registrations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_settings_userId_key" ON "chat_settings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "recent_activity_matrixEventId_key" ON "recent_activity"("matrixEventId");

-- CreateIndex
CREATE INDEX "recent_activity_workspaceId_occurredAt_idx" ON "recent_activity"("workspaceId", "occurredAt");

-- CreateIndex
CREATE INDEX "recent_activity_channelId_occurredAt_idx" ON "recent_activity"("channelId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "channels_matrixRoomId_key" ON "channels"("matrixRoomId");

-- CreateIndex
CREATE UNIQUE INDEX "users_matrixUserId_key" ON "users"("matrixUserId");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_registrations" ADD CONSTRAINT "push_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_settings" ADD CONSTRAINT "chat_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recent_activity" ADD CONSTRAINT "recent_activity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recent_activity" ADD CONSTRAINT "recent_activity_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recent_activity" ADD CONSTRAINT "recent_activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

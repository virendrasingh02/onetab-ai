-- CreateTable
CREATE TABLE "channel_integrations" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "addedById" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "channel_integrations_channelId_idx" ON "channel_integrations"("channelId");

-- CreateIndex
CREATE INDEX "channel_integrations_integrationId_idx" ON "channel_integrations"("integrationId");

-- CreateIndex
CREATE UNIQUE INDEX "channel_integrations_channelId_integrationId_key" ON "channel_integrations"("channelId", "integrationId");

-- AddForeignKey
ALTER TABLE "channel_integrations" ADD CONSTRAINT "channel_integrations_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_integrations" ADD CONSTRAINT "channel_integrations_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "external_integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_integrations" ADD CONSTRAINT "channel_integrations_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- "Agents added to a channel" — the scoping the channel Agents panel edits.
-- Replaces the browser-localStorage list in use-channel-agents-apps.ts.
CREATE TABLE "channel_agents" (
    "id" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "addedById" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_agents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "channel_agents_channelId_agentId_key" ON "channel_agents"("channelId", "agentId");
CREATE INDEX "channel_agents_channelId_idx" ON "channel_agents"("channelId");
CREATE INDEX "channel_agents_agentId_idx" ON "channel_agents"("agentId");

ALTER TABLE "channel_agents" ADD CONSTRAINT "channel_agents_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_agents" ADD CONSTRAINT "channel_agents_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "ai_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "channel_agents" ADD CONSTRAINT "channel_agents_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

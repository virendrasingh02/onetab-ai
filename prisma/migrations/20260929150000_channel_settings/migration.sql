-- Channel settings (details panel → Settings): per-channel huddle switch, who
-- may manage the tab strip and its layout, and a per-member switch for the
-- "@someone isn't in this channel — add them?" suggestion. Additive only;
-- every default reproduces today's behaviour.

-- CreateEnum
CREATE TYPE "ChannelTabPolicy" AS ENUM ('EVERYONE', 'MANAGERS');

-- AlterTable
ALTER TABLE "channels" ADD COLUMN     "huddlesEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "tabManagePolicy" "ChannelTabPolicy" NOT NULL DEFAULT 'EVERYONE',
ADD COLUMN     "tabOrder" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "hiddenTabs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "channel_members" ADD COLUMN     "memberSuggestions" BOOLEAN NOT NULL DEFAULT true;

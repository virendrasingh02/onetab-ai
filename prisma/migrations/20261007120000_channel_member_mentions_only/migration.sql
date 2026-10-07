-- Per-channel "Just mentions" notification level. Additive with a default, so
-- every existing membership keeps notifying on all new posts.
ALTER TABLE "channel_members" ADD COLUMN "mentionsOnly" BOOLEAN NOT NULL DEFAULT false;

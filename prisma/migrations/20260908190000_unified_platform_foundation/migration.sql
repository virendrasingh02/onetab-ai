-- Unified Platform Foundation: CrossObjectLink, Bookmark, AttentionItemState

CREATE TABLE IF NOT EXISTS "cross_object_links" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "sourceType"  TEXT NOT NULL,
  "sourceId"    TEXT NOT NULL,
  "targetType"  TEXT NOT NULL,
  "targetId"    TEXT NOT NULL,
  "linkType"    TEXT NOT NULL DEFAULT 'RELATED',
  "metadata"    JSONB DEFAULT '{}',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cross_object_links_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bookmarks" (
  "id"          TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "targetType"  TEXT NOT NULL,
  "targetId"    TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "snippet"     TEXT,
  "tags"        TEXT[] DEFAULT ARRAY[]::TEXT[],
  "metadata"    JSONB DEFAULT '{}',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bookmarks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "attention_item_states" (
  "id"           TEXT NOT NULL,
  "workspaceId"  TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "itemKey"      TEXT NOT NULL,
  "dismissedAt"  TIMESTAMP(3),
  "snoozedUntil" TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attention_item_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cross_object_links_workspaceId_sourceType_sourceId_targetType_targetId_linkType_key" 
  ON "cross_object_links"("workspaceId", "sourceType", "sourceId", "targetType", "targetId", "linkType");
CREATE INDEX IF NOT EXISTS "cross_object_links_workspaceId_sourceType_sourceId_idx" 
  ON "cross_object_links"("workspaceId", "sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "cross_object_links_workspaceId_targetType_targetId_idx" 
  ON "cross_object_links"("workspaceId", "targetType", "targetId");

CREATE UNIQUE INDEX IF NOT EXISTS "bookmarks_workspaceId_userId_targetType_targetId_key" 
  ON "bookmarks"("workspaceId", "userId", "targetType", "targetId");
CREATE INDEX IF NOT EXISTS "bookmarks_workspaceId_userId_createdAt_idx" 
  ON "bookmarks"("workspaceId", "userId", "createdAt");
CREATE INDEX IF NOT EXISTS "bookmarks_workspaceId_userId_targetType_idx" 
  ON "bookmarks"("workspaceId", "userId", "targetType");

CREATE UNIQUE INDEX IF NOT EXISTS "attention_item_states_workspaceId_userId_itemKey_key" 
  ON "attention_item_states"("workspaceId", "userId", "itemKey");
CREATE INDEX IF NOT EXISTS "attention_item_states_workspaceId_userId_idx" 
  ON "attention_item_states"("workspaceId", "userId");

DO $$ BEGIN
  ALTER TABLE "cross_object_links" ADD CONSTRAINT "cross_object_links_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "attention_item_states" ADD CONSTRAINT "attention_item_states_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "attention_item_states" ADD CONSTRAINT "attention_item_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

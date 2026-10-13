-- AlterTable
ALTER TABLE "marketplace_listings" ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "ownerWorkspaceId" TEXT,
ADD COLUMN     "sourceAgentId" TEXT;

-- CreateIndex
CREATE INDEX "marketplace_listings_ownerWorkspaceId_idx" ON "marketplace_listings"("ownerWorkspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listings_ownerWorkspaceId_sourceAgentId_key" ON "marketplace_listings"("ownerWorkspaceId", "sourceAgentId");

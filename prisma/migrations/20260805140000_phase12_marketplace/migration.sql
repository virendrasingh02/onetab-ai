-- CreateTable
CREATE TABLE "marketplace_publishers" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "supportEmail" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_publishers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_listings" (
    "id" TEXT NOT NULL,
    "publisherId" TEXT,
    "kind" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "iconUrl" TEXT,
    "previewUrl" TEXT,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "manifestJson" TEXT NOT NULL DEFAULT '{}',
    "payloadJson" TEXT NOT NULL DEFAULT '{}',
    "pricingModel" TEXT NOT NULL DEFAULT 'FREE',
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "installCount" INTEGER NOT NULL DEFAULT 0,
    "ratingSum" INTEGER NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "marketplace_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_installations" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "installedById" TEXT,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "settingsJson" TEXT NOT NULL DEFAULT '{}',
    "grantedScopes" TEXT NOT NULL DEFAULT '[]',
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_reviews" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "marketplace_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plugin_registrations" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "runtime" TEXT NOT NULL DEFAULT 'SANDBOXED_JS',
    "sdkVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "entryPoint" TEXT,
    "webhookUrl" TEXT,
    "apiKeyHash" TEXT,
    "apiKeyPrefix" TEXT,
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "surfaces" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plugin_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_publishers_slug_key" ON "marketplace_publishers"("slug");

-- CreateIndex
CREATE INDEX "marketplace_publishers_userId_idx" ON "marketplace_publishers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_listings_slug_key" ON "marketplace_listings"("slug");

-- CreateIndex
CREATE INDEX "marketplace_listings_kind_status_idx" ON "marketplace_listings"("kind", "status");

-- CreateIndex
CREATE INDEX "marketplace_listings_kind_category_idx" ON "marketplace_listings"("kind", "category");

-- CreateIndex
CREATE INDEX "marketplace_listings_status_isFeatured_idx" ON "marketplace_listings"("status", "isFeatured");

-- CreateIndex
CREATE INDEX "marketplace_installations_workspaceId_status_idx" ON "marketplace_installations"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_installations_listingId_workspaceId_key" ON "marketplace_installations"("listingId", "workspaceId");

-- CreateIndex
CREATE INDEX "marketplace_reviews_listingId_createdAt_idx" ON "marketplace_reviews"("listingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "plugin_registrations_listingId_key" ON "plugin_registrations"("listingId");

-- AddForeignKey
ALTER TABLE "marketplace_publishers" ADD CONSTRAINT "marketplace_publishers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_publisherId_fkey" FOREIGN KEY ("publisherId") REFERENCES "marketplace_publishers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_installations" ADD CONSTRAINT "marketplace_installations_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_installations" ADD CONSTRAINT "marketplace_installations_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_reviews" ADD CONSTRAINT "marketplace_reviews_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plugin_registrations" ADD CONSTRAINT "plugin_registrations_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "marketplace_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

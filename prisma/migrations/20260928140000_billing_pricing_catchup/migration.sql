-- Catch-up for the Pricing & Plans models (d086f60), which were added to
-- schema.prisma without a migration: trial/promotion columns on subscriptions,
-- promotions + redemptions, and the AI credit ledger. Additive only; without it
-- GET /workspaces/:id/billing fails with a missing-column/table error.

-- AlterTable
ALTER TABLE "workspace_subscriptions" ADD COLUMN     "appliedPromotionCode" TEXT,
ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "discountPercent" DOUBLE PRECISION,
ADD COLUMN     "trialEnd" TIMESTAMP(3),
ADD COLUMN     "trialStart" TIMESTAMP(3),
ADD COLUMN     "trialStatus" TEXT,
ADD COLUMN     "trialUsed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 100.0,
    "applicablePlans" TEXT[] DEFAULT ARRAY['starter', 'pro', 'business']::TEXT[],
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3),
    "maxRedemptions" INTEGER,
    "redemptionsCount" INTEGER NOT NULL DEFAULT 0,
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotion_redemptions" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_accounts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_transactions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions"("code");

-- CreateIndex
CREATE INDEX "promotion_redemptions_promotionId_workspaceId_idx" ON "promotion_redemptions"("promotionId", "workspaceId");

-- CreateIndex
CREATE INDEX "promotion_redemptions_promotionId_userId_idx" ON "promotion_redemptions"("promotionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_accounts_workspaceId_key" ON "credit_accounts"("workspaceId");

-- CreateIndex
CREATE INDEX "credit_transactions_accountId_createdAt_idx" ON "credit_transactions"("accountId", "createdAt");

-- AddForeignKey
ALTER TABLE "promotion_redemptions" ADD CONSTRAINT "promotion_redemptions_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_accounts" ADD CONSTRAINT "credit_accounts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "credit_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Plan tier rename: STARTER -> FREE, BUSINESS -> MAX (existing rows preserved).
UPDATE "workspace_subscriptions" SET "planTier" = 'FREE' WHERE UPPER("planTier") = 'STARTER';
UPDATE "workspace_subscriptions" SET "planTier" = 'MAX' WHERE UPPER("planTier") = 'BUSINESS';
UPDATE "organization_subscriptions" SET "planTier" = 'MAX' WHERE UPPER("planTier") = 'BUSINESS';
UPDATE "organization_subscriptions" SET "planTier" = 'FREE' WHERE UPPER("planTier") = 'STARTER';

-- AlterTable: workspace_subscriptions
ALTER TABLE "workspace_subscriptions"
  ALTER COLUMN "planTier" SET DEFAULT 'FREE',
  ADD COLUMN "source" TEXT NOT NULL DEFAULT 'FREE',
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "providerCustomerId" TEXT,
  ADD COLUMN "providerSubscriptionId" TEXT,
  ADD COLUMN "pastDueSince" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "scheduledPlanTier" TEXT,
  ADD COLUMN "scheduledBillingInterval" TEXT,
  ADD COLUMN "scheduledChangeAt" TIMESTAMP(3);

-- Grandfather paid tiers that were granted before payment verification existed.
-- They keep access (source LEGACY) and are surfaced to admins for review; they
-- are NOT auto-expired by the renewal sweep.
UPDATE "workspace_subscriptions" SET "source" = 'LEGACY' WHERE "planTier" <> 'FREE';

CREATE INDEX "workspace_subscriptions_providerSubscriptionId_idx" ON "workspace_subscriptions"("providerSubscriptionId");
CREATE INDEX "workspace_subscriptions_currentPeriodEnd_source_idx" ON "workspace_subscriptions"("currentPeriodEnd", "source");

-- AlterTable: promotions
ALTER TABLE "promotions"
  ADD COLUMN "name" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN "applicableIntervals" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "minPurchaseCents" INTEGER,
  ADD COLUMN "firstTimeCustomerOnly" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "trialExtensionDays" INTEGER,
  ADD COLUMN "freeCheckoutPolicy" TEXT NOT NULL DEFAULT 'DISABLED',
  ALTER COLUMN "discountValue" SET DEFAULT 0,
  ALTER COLUMN "applicablePlans" SET DEFAULT ARRAY['pro', 'max']::TEXT[];

-- Retire the old hardcoded public 100%-off code; it was a client-visible bypass.
UPDATE "promotions" SET "active" = false WHERE LOWER("code") = 's1nu00780';
UPDATE "promotions" SET "applicablePlans" = ARRAY(
  SELECT DISTINCT CASE LOWER(p) WHEN 'business' THEN 'max' WHEN 'starter' THEN 'free' ELSE LOWER(p) END
  FROM unnest("applicablePlans") AS p WHERE LOWER(p) <> 'starter'
);

-- AlterTable: promotion_redemptions
ALTER TABLE "promotion_redemptions"
  ADD COLUMN "checkoutId" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'APPLIED',
  ADD COLUMN "discountCents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'USD';
CREATE UNIQUE INDEX "promotion_redemptions_checkoutId_key" ON "promotion_redemptions"("checkoutId");

-- CreateTable
CREATE TABLE "billing_checkout_sessions" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planTier" TEXT NOT NULL,
    "billingInterval" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotalCents" INTEGER NOT NULL,
    "discountCents" INTEGER NOT NULL DEFAULT 0,
    "taxCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL,
    "promotionCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerSessionId" TEXT,
    "providerUrl" TEXT,
    "idempotencyKey" TEXT,
    "failureReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "billing_checkout_sessions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "billing_checkout_sessions_providerSessionId_key" ON "billing_checkout_sessions"("providerSessionId");
CREATE UNIQUE INDEX "billing_checkout_sessions_idempotencyKey_key" ON "billing_checkout_sessions"("idempotencyKey");
CREATE INDEX "billing_checkout_sessions_workspaceId_status_idx" ON "billing_checkout_sessions"("workspaceId", "status");
ALTER TABLE "billing_checkout_sessions" ADD CONSTRAINT "billing_checkout_sessions_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "billing_invoices" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "providerInvoiceId" TEXT,
    "checkoutId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "hostedUrl" TEXT,
    "pdfUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_invoices_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "billing_invoices_number_key" ON "billing_invoices"("number");
CREATE UNIQUE INDEX "billing_invoices_providerInvoiceId_key" ON "billing_invoices"("providerInvoiceId");
CREATE INDEX "billing_invoices_workspaceId_createdAt_idx" ON "billing_invoices"("workspaceId", "createdAt");
ALTER TABLE "billing_invoices" ADD CONSTRAINT "billing_invoices_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "billing_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "error" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "billing_webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "billing_webhook_events_provider_providerEventId_key" ON "billing_webhook_events"("provider", "providerEventId");

-- CreateTable
CREATE TABLE "billing_audit_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "billing_audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "billing_audit_logs_workspaceId_createdAt_idx" ON "billing_audit_logs"("workspaceId", "createdAt");
CREATE INDEX "billing_audit_logs_targetType_targetId_idx" ON "billing_audit_logs"("targetType", "targetId");

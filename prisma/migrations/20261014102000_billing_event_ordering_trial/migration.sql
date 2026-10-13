-- AlterTable
ALTER TABLE "workspace_subscriptions" ADD COLUMN "providerEventAt" TIMESTAMP(3);
ALTER TABLE "billing_checkout_sessions" ADD COLUMN "trialDays" INTEGER NOT NULL DEFAULT 0;

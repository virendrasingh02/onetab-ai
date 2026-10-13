-- AlterTable
ALTER TABLE "billing_checkout_sessions" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'SUBSCRIPTION';

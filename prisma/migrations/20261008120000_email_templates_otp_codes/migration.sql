-- CreateEnum
CREATE TYPE "EmailTemplateCategory" AS ENUM ('AUTHENTICATION', 'WORKSPACE', 'TEAM', 'PROJECTS', 'TASKS', 'DOCS', 'MESSAGING', 'MEETINGS', 'AI_AGENTS', 'HIRE', 'VOICE', 'BILLING', 'SECURITY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EmailTemplateStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DRAFT');

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "EmailTemplateCategory" NOT NULL DEFAULT 'SYSTEM',
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "previewText" TEXT,
    "htmlBody" TEXT NOT NULL,
    "textBody" TEXT,
    "variablesSchema" JSONB,
    "status" "EmailTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "workspaceId" TEXT,
    "isSystemTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'LOGIN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "usedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_templates_templateKey_idx" ON "email_templates"("templateKey");

-- CreateIndex
CREATE INDEX "email_templates_category_idx" ON "email_templates"("category");

-- CreateIndex
CREATE INDEX "email_templates_workspaceId_idx" ON "email_templates"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_templateKey_workspaceId_key" ON "email_templates"("templateKey", "workspaceId");

-- Postgres treats NULLs as distinct, so the composite key above does not stop
-- two platform-wide (workspaceId IS NULL) overrides of the same template.
CREATE UNIQUE INDEX "email_templates_templateKey_global_key" ON "email_templates"("templateKey") WHERE "workspaceId" IS NULL;

-- CreateIndex
CREATE INDEX "otp_codes_identifier_purpose_idx" ON "otp_codes"("identifier", "purpose");

-- CreateIndex
CREATE INDEX "otp_codes_expiresAt_idx" ON "otp_codes"("expiresAt");

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

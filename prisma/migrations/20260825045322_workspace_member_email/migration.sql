-- AlterTable
ALTER TABLE "workspace_members" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "ai_provider_credentials" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'workspace',
    "scopeId" TEXT NOT NULL,
    "encryptedApiKey" TEXT NOT NULL,
    "maskedKey" TEXT NOT NULL DEFAULT '',
    "baseUrl" TEXT,
    "defaultModel" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT DEFAULT '{}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastTestedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',

    CONSTRAINT "ai_provider_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_model_settings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_model_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_provider_credentials_scopeType_scopeId_idx" ON "ai_provider_credentials"("scopeType", "scopeId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_provider_credentials_provider_scopeType_scopeId_key" ON "ai_provider_credentials"("provider", "scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "ai_model_settings_workspaceId_idx" ON "ai_model_settings"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_model_settings_workspaceId_modelId_key" ON "ai_model_settings"("workspaceId", "modelId");

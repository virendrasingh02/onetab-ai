-- CreateTable
CREATE TABLE "workspace_oauth_apps" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "appKey" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "encryptedClientSecret" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_oauth_apps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_oauth_apps_workspaceId_appKey_key" ON "workspace_oauth_apps"("workspaceId", "appKey");

-- AddForeignKey
ALTER TABLE "workspace_oauth_apps" ADD CONSTRAINT "workspace_oauth_apps_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Organization
ALTER TABLE "organizations" ADD COLUMN "verifiedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "organizations" ADD COLUMN "domainVerificationToken" TEXT;
ALTER TABLE "organizations" ADD COLUMN "domainVerifiedAt" TIMESTAMP(3);

-- AlterTable Workspace
ALTER TABLE "workspaces" ADD COLUMN "organizationId" TEXT;
CREATE INDEX "workspaces_organizationId_idx" ON "workspaces"("organizationId");
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable SSOConfig
ALTER TABLE "sso_configs" ADD COLUMN "idpName" TEXT;
ALTER TABLE "sso_configs" ADD COLUMN "spEntityId" TEXT;
ALTER TABLE "sso_configs" ADD COLUMN "acsUrl" TEXT;
ALTER TABLE "sso_configs" ADD COLUMN "allowIdpInitiated" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "sso_configs" ADD COLUMN "forceAuthn" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sso_configs" ADD COLUMN "oidcIssuer" TEXT;
ALTER TABLE "sso_configs" ADD COLUMN "oidcClientId" TEXT;
ALTER TABLE "sso_configs" ADD COLUMN "oidcClientSecretCipher" TEXT;
ALTER TABLE "sso_configs" ADD COLUMN "oidcAuthorizationEndpoint" TEXT;
ALTER TABLE "sso_configs" ADD COLUMN "oidcTokenEndpoint" TEXT;
ALTER TABLE "sso_configs" ADD COLUMN "oidcJwksUri" TEXT;
ALTER TABLE "sso_configs" ADD COLUMN "oidcUserInfoEndpoint" TEXT;
ALTER TABLE "sso_configs" ADD COLUMN "oidcScopes" TEXT[] DEFAULT ARRAY['openid', 'profile', 'email']::TEXT[];
ALTER TABLE "sso_configs" ADD COLUMN "enforceSso" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sso_configs" ADD COLUMN "allowPasswordFallbackForAdmins" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "sso_configs" ADD COLUMN "recoveryCodeHash" TEXT;
ALTER TABLE "sso_configs" ADD COLUMN "scimEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sso_configs" ADD COLUMN "scimTokenHash" TEXT;
ALTER TABLE "sso_configs" ADD COLUMN "scimTokenPrefix" TEXT;
ALTER TABLE "sso_configs" ADD COLUMN "scimTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "sso_configs" ADD COLUMN "scimLastSyncAt" TIMESTAMP(3);
ALTER TABLE "sso_configs" ADD COLUMN "lastConnectionTestAt" TIMESTAMP(3);
ALTER TABLE "sso_configs" ADD COLUMN "lastConnectionTestStatus" TEXT;
ALTER TABLE "sso_configs" ADD COLUMN "lastConnectionTestMessage" TEXT;

CREATE UNIQUE INDEX "sso_configs_organizationId_key" ON "sso_configs"("organizationId");

-- CreateTable SCIMGroup
CREATE TABLE "scim_groups" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scim_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable SCIMGroupMember
CREATE TABLE "scim_group_members" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scim_group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable SSOGroupRoleMapping
CREATE TABLE "sso_group_role_mappings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "groupName" TEXT NOT NULL,
    "groupId" TEXT,
    "targetWorkspaceId" TEXT,
    "targetRole" "WorkspaceRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sso_group_role_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "scim_groups_organizationId_displayName_key" ON "scim_groups"("organizationId", "displayName");
CREATE INDEX "scim_groups_organizationId_idx" ON "scim_groups"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "scim_group_members_groupId_userId_key" ON "scim_group_members"("groupId", "userId");
CREATE INDEX "scim_group_members_userId_idx" ON "scim_group_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sso_group_role_mappings_organizationId_groupName_key" ON "sso_group_role_mappings"("organizationId", "groupName");
CREATE INDEX "sso_group_role_mappings_organizationId_idx" ON "sso_group_role_mappings"("organizationId");

-- AddForeignKey
ALTER TABLE "scim_groups" ADD CONSTRAINT "scim_groups_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scim_group_members" ADD CONSTRAINT "scim_group_members_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "scim_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "scim_group_members" ADD CONSTRAINT "scim_group_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_group_role_mappings" ADD CONSTRAINT "sso_group_role_mappings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sso_group_role_mappings" ADD CONSTRAINT "sso_group_role_mappings_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "scim_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

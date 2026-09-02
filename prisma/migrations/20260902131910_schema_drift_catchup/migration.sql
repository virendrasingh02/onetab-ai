-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "accentColor" TEXT,
ADD COLUMN     "aiProjectRecaps" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "allowExternalSharing" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "defaultLandingView" TEXT NOT NULL DEFAULT 'home',
ADD COLUMN     "supportEmail" TEXT;

-- CreateTable
CREATE TABLE "two_factor_auths" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "backupCodes" TEXT NOT NULL DEFAULT '[]',
    "phoneNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "two_factor_auths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webauthn_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" BIGINT NOT NULL DEFAULT 0,
    "deviceName" TEXT,
    "transports" TEXT NOT NULL DEFAULT '[]',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webauthn_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "two_factor_auths_userId_key" ON "two_factor_auths"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "webauthn_credentials_credentialId_key" ON "webauthn_credentials"("credentialId");

-- CreateIndex
CREATE INDEX "webauthn_credentials_userId_idx" ON "webauthn_credentials"("userId");

-- CreateIndex
CREATE INDEX "users_presence_lastSeenAt_idx" ON "users"("presence", "lastSeenAt");

-- AddForeignKey
ALTER TABLE "two_factor_auths" ADD CONSTRAINT "two_factor_auths_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webauthn_credentials" ADD CONSTRAINT "webauthn_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

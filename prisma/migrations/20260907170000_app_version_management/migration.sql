-- CreateEnum
CREATE TYPE "AppPlatform" AS ENUM ('WEB', 'DESKTOP');

-- CreateEnum
CREATE TYPE "AppOperatingSystem" AS ENUM ('WINDOWS', 'MACOS', 'LINUX');

-- CreateEnum
CREATE TYPE "AppReleaseChannel" AS ENUM ('STABLE', 'BETA', 'ALPHA', 'NIGHTLY');

-- CreateEnum
CREATE TYPE "AppReleaseStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'RELEASED', 'DEPRECATED', 'DISABLED');

-- CreateTable
CREATE TABLE "app_releases" (
    "id" TEXT NOT NULL,
    "platform" "AppPlatform" NOT NULL,
    "operatingSystem" "AppOperatingSystem",
    "version" TEXT NOT NULL,
    "buildNumber" TEXT NOT NULL,
    "releaseChannel" "AppReleaseChannel" NOT NULL DEFAULT 'STABLE',
    "status" "AppReleaseStatus" NOT NULL DEFAULT 'DRAFT',
    "minimumSupportedVersion" TEXT DEFAULT '1.0.0',
    "releaseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolloutPercentage" INTEGER NOT NULL DEFAULT 100,
    "downloadUrl" TEXT,
    "releaseNotes" TEXT,
    "changelog" TEXT,
    "mandatoryUpdate" BOOLEAN NOT NULL DEFAULT false,
    "forceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_release_audit_logs" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT,
    "actorId" TEXT,
    "actorEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "platform" "AppPlatform" NOT NULL,
    "operatingSystem" "AppOperatingSystem",
    "version" TEXT NOT NULL,
    "previousState" TEXT,
    "newState" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_release_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "app_releases_platform_operatingSystem_releaseChannel_version_key" ON "app_releases"("platform", "operatingSystem", "releaseChannel", "version");

-- CreateIndex
CREATE INDEX "app_releases_platform_operatingSystem_status_idx" ON "app_releases"("platform", "operatingSystem", "status");

-- CreateIndex
CREATE INDEX "app_releases_platform_isCurrent_idx" ON "app_releases"("platform", "isCurrent");

-- CreateIndex
CREATE INDEX "app_releases_releaseDate_idx" ON "app_releases"("releaseDate");

-- CreateIndex
CREATE INDEX "app_release_audit_logs_releaseId_idx" ON "app_release_audit_logs"("releaseId");

-- CreateIndex
CREATE INDEX "app_release_audit_logs_platform_createdAt_idx" ON "app_release_audit_logs"("platform", "createdAt");

-- AddForeignKey
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_releases" ADD CONSTRAINT "app_releases_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_release_audit_logs" ADD CONSTRAINT "app_release_audit_logs_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "app_releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

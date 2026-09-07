import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CacheService } from '@org/api-cache';
import {
  AppOperatingSystem,
  AppPlatform,
  AppRelease,
  AppReleaseAuditLog,
  AppReleaseChannel,
  AppReleaseStatus,
  Prisma,
  PrismaService,
} from '@org/database';
import type {
  AppReleaseAuditLogView,
  AppReleaseView,
  AppVersionCheckInput,
  AppVersionCheckResult,
  AppVersionsOverview,
  ClientUpdateState,
  CreateAppReleaseInput,
  PlatformReleaseSummary,
  RolloutAppReleaseInput,
  ScheduleAppReleaseInput,
  UpdateAppReleaseInput,
} from '@org/types';

/**
 * SemVer comparison utility.
 * Returns:
 * -1 if a < b
 *  0 if a == b
 *  1 if a > b
 */
export function compareSemVer(a: string, b: string): number {
  const cleanA = a.trim().replace(/^[vV]/, '');
  const cleanB = b.trim().replace(/^[vV]/, '');

  const partsA = cleanA.split(/[-+]/)[0].split('.').map((p) => parseInt(p, 10) || 0);
  const partsB = cleanB.split(/[-+]/)[0].split('.').map((p) => parseInt(p, 10) || 0);

  const len = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < len; i++) {
    const valA = partsA[i] ?? 0;
    const valB = partsB[i] ?? 0;
    if (valA < valB) return -1;
    if (valA > valB) return 1;
  }
  return 0;
}

export function isValidSemVer(version: string): boolean {
  if (!version || typeof version !== 'string') return false;
  const clean = version.trim().replace(/^[vV]/, '');
  // Supports SemVer like 1.0.0, 2.8.5, 2026.09.1, 1.0.0-beta.1
  return /^(\d+)\.(\d+)(\.(\d+))?(-[\w.-]+)?(\+[\w.-]+)?$/.test(clean);
}

/** Deterministic hash for rollout bucket assignment (0-99). */
export function hashClientIdToBucket(clientId: string): number {
  let hash = 0;
  for (let i = 0; i < clientId.length; i++) {
    const char = clientId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash) % 100;
}

@Injectable()
export class AppVersionsService {
  private readonly logger = new Logger(AppVersionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // ---------------------------------------------------------------------------
  // Cache Helpers
  // ---------------------------------------------------------------------------

  private getUpdateCheckCacheKey(
    platform: string,
    os: string | null,
    channel: string,
  ): string {
    return `app_version:current:${platform.toLowerCase()}:${os?.toLowerCase() ?? 'none'}:${channel.toLowerCase()}`;
  }

  private async invalidateCaches(): Promise<void> {
    try {
      await this.cache.deletePattern?.('app_version:*');
    } catch {
      // Non-critical if cache invalidation falls back
    }
  }

  // ---------------------------------------------------------------------------
  // Overview Dashboard
  // ---------------------------------------------------------------------------

  async getOverview(): Promise<AppVersionsOverview> {
    const [releases, counts] = await Promise.all([
      this.prisma.appRelease.findMany({
        orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.appRelease.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
    ]);

    const buildSummary = (
      platform: AppPlatform,
      os: AppOperatingSystem | null,
    ): PlatformReleaseSummary => {
      const match = releases.filter(
        (r) =>
          r.platform === platform &&
          (os === null ? r.operatingSystem === null : r.operatingSystem === os),
      );

      const currentRelease = match.find(
        (r) => r.isCurrent && r.status === AppReleaseStatus.RELEASED,
      );
      const latestRelease =
        match.find((r) => r.status === AppReleaseStatus.RELEASED) ?? match[0];

      if (!latestRelease && !currentRelease) {
        return {
          currentVersion: null,
          latestVersion: null,
          status: 'NOT_CONFIGURED',
          releaseDate: null,
          minimumSupportedVersion: null,
          rolloutPercentage: 100,
          downloadUrl: null,
          mandatoryUpdate: false,
          activeReleaseCount: 0,
        };
      }

      const active = currentRelease ?? latestRelease;
      return {
        currentVersion: currentRelease?.version ?? null,
        latestVersion: latestRelease?.version ?? null,
        status: active?.status ?? 'NOT_CONFIGURED',
        releaseDate: active?.releaseDate?.toISOString() ?? null,
        minimumSupportedVersion: active?.minimumSupportedVersion ?? null,
        rolloutPercentage: active?.rolloutPercentage ?? 100,
        downloadUrl: active?.downloadUrl ?? null,
        mandatoryUpdate: active?.mandatoryUpdate ?? false,
        activeReleaseCount: match.filter(
          (r) => r.status === AppReleaseStatus.RELEASED,
        ).length,
      };
    };

    const countByStatus = counts.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});

    const totalReleases = releases.length;
    const activeReleases = countByStatus[AppReleaseStatus.RELEASED] ?? 0;
    const scheduledReleases = countByStatus[AppReleaseStatus.SCHEDULED] ?? 0;
    const deprecatedReleases = countByStatus[AppReleaseStatus.DEPRECATED] ?? 0;
    const disabledReleases = countByStatus[AppReleaseStatus.DISABLED] ?? 0;
    const mandatoryReleases = releases.filter(
      (r) => r.mandatoryUpdate && r.status === AppReleaseStatus.RELEASED,
    ).length;

    return {
      web: buildSummary(AppPlatform.WEB, null),
      desktop: {
        windows: buildSummary(AppPlatform.DESKTOP, AppOperatingSystem.WINDOWS),
        macos: buildSummary(AppPlatform.DESKTOP, AppOperatingSystem.MACOS),
        linux: buildSummary(AppPlatform.DESKTOP, AppOperatingSystem.LINUX),
      },
      metrics: {
        totalReleases,
        activeReleases,
        scheduledReleases,
        deprecatedReleases,
        disabledReleases,
        mandatoryReleases,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Releases List & Filter
  // ---------------------------------------------------------------------------

  async listReleases(params: {
    platform?: AppPlatform;
    operatingSystem?: AppOperatingSystem;
    releaseChannel?: AppReleaseChannel;
    status?: AppReleaseStatus;
    query?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: AppReleaseView[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: Prisma.AppReleaseWhereInput = {};

    if (params.platform) where.platform = params.platform;
    if (params.operatingSystem) where.operatingSystem = params.operatingSystem;
    if (params.releaseChannel) where.releaseChannel = params.releaseChannel;
    if (params.status) where.status = params.status;

    if (params.query?.trim()) {
      const q = params.query.trim();
      where.OR = [
        { version: { contains: q, mode: 'insensitive' } },
        { buildNumber: { contains: q, mode: 'insensitive' } },
        { releaseNotes: { contains: q, mode: 'insensitive' } },
        { changelog: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.appRelease.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ releaseDate: 'desc' }, { createdAt: 'desc' }],
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
        },
      }),
      this.prisma.appRelease.count({ where }),
    ]);

    return {
      items: items.map((r) => this.mapReleaseToView(r)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getRelease(id: string): Promise<AppReleaseView> {
    const release = await this.prisma.appRelease.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, name: true } },
        auditLogs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!release) {
      throw new NotFoundException(`Release ${id} not found.`);
    }

    return this.mapReleaseToView(release);
  }

  // ---------------------------------------------------------------------------
  // Create / Edit Version
  // ---------------------------------------------------------------------------

  async createRelease(
    actorId: string,
    actorEmail: string,
    input: CreateAppReleaseInput,
  ): Promise<AppReleaseView> {
    const version = input.version.trim();
    if (!isValidSemVer(version)) {
      throw new BadRequestException(
        `Version "${version}" is not a valid Semantic Version (e.g. 2.8.5).`,
      );
    }

    if (!input.buildNumber?.trim()) {
      throw new BadRequestException('Build number is required.');
    }

    // Platform & OS validation
    let os: AppOperatingSystem | null = null;
    if (input.platform === AppPlatform.DESKTOP) {
      if (!input.operatingSystem) {
        throw new BadRequestException(
          'Operating system (WINDOWS, MACOS, or LINUX) is required for Desktop releases.',
        );
      }
      os = input.operatingSystem;
    } else {
      os = null; // WEB releases do not have an operating system
    }

    // Minimum supported version check
    const minVersion = input.minimumSupportedVersion?.trim() || '1.0.0';
    if (!isValidSemVer(minVersion)) {
      throw new BadRequestException(
        `Minimum supported version "${minVersion}" is not a valid Semantic Version.`,
      );
    }
    if (compareSemVer(minVersion, version) > 0) {
      throw new BadRequestException(
        `Minimum supported version (${minVersion}) cannot be newer than the release version (${version}).`,
      );
    }

    // Rollout percentage validation
    const rollout = input.rolloutPercentage ?? 100;
    if (rollout < 0 || rollout > 100) {
      throw new BadRequestException('Rollout percentage must be between 0 and 100.');
    }

    const channel = input.releaseChannel ?? AppReleaseChannel.STABLE;
    const initialStatus = input.status ?? AppReleaseStatus.DRAFT;

    // Check duplicate
    const duplicate = await this.prisma.appRelease.findFirst({
      where: {
        platform: input.platform,
        operatingSystem: os,
        releaseChannel: channel,
        version,
      },
    });

    if (duplicate) {
      throw new ConflictException(
        `A release with version ${version} already exists for platform ${input.platform} ${os ?? ''} on channel ${channel}.`,
      );
    }

    const shouldBeCurrent = initialStatus === AppReleaseStatus.RELEASED;

    const created = await this.prisma.$transaction(async (tx) => {
      if (shouldBeCurrent) {
        await tx.appRelease.updateMany({
          where: {
            platform: input.platform,
            operatingSystem: os,
            releaseChannel: channel,
            isCurrent: true,
          },
          data: { isCurrent: false },
        });
      }

      const rel = await tx.appRelease.create({
        data: {
          platform: input.platform,
          operatingSystem: os,
          version,
          buildNumber: input.buildNumber.trim(),
          releaseChannel: channel,
          status: initialStatus,
          minimumSupportedVersion: minVersion,
          releaseDate: input.releaseDate ? new Date(input.releaseDate) : new Date(),
          rolloutPercentage: rollout,
          downloadUrl: input.downloadUrl?.trim() || null,
          releaseNotes: input.releaseNotes?.trim() || null,
          changelog: input.changelog?.trim() || null,
          mandatoryUpdate: Boolean(input.mandatoryUpdate),
          forceUpdate: Boolean(input.forceUpdate),
          isCurrent: shouldBeCurrent,
          createdById: actorId,
        },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
        },
      });

      await tx.appReleaseAuditLog.create({
        data: {
          releaseId: rel.id,
          actorId,
          actorEmail,
          action: 'CREATED',
          platform: rel.platform,
          operatingSystem: rel.operatingSystem,
          version: rel.version,
          previousState: null,
          newState: JSON.stringify({
            status: rel.status,
            rolloutPercentage: rel.rolloutPercentage,
            minimumSupportedVersion: rel.minimumSupportedVersion,
            mandatoryUpdate: rel.mandatoryUpdate,
            isCurrent: rel.isCurrent,
          }),
          reason: 'Initial release creation',
        },
      });

      return rel;
    });

    await this.invalidateCaches();
    return this.mapReleaseToView(created);
  }

  async updateRelease(
    actorId: string,
    actorEmail: string,
    id: string,
    input: UpdateAppReleaseInput,
  ): Promise<AppReleaseView> {
    const existing = await this.prisma.appRelease.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Release ${id} not found.`);
    }

    const version = input.version ? input.version.trim() : existing.version;
    if (input.version && !isValidSemVer(version)) {
      throw new BadRequestException(`Version "${version}" is not valid Semantic Version.`);
    }

    const minVersion =
      input.minimumSupportedVersion !== undefined
        ? input.minimumSupportedVersion?.trim() || '1.0.0'
        : existing.minimumSupportedVersion;

    if (minVersion && !isValidSemVer(minVersion)) {
      throw new BadRequestException(
        `Minimum supported version "${minVersion}" is not valid Semantic Version.`,
      );
    }

    if (minVersion && compareSemVer(minVersion, version) > 0) {
      throw new BadRequestException(
        `Minimum supported version (${minVersion}) cannot be newer than the release version (${version}).`,
      );
    }

    const rollout =
      input.rolloutPercentage !== undefined
        ? input.rolloutPercentage
        : existing.rolloutPercentage;
    if (rollout < 0 || rollout > 100) {
      throw new BadRequestException('Rollout percentage must be between 0 and 100.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const rel = await tx.appRelease.update({
        where: { id },
        data: {
          version: input.version ? version : undefined,
          buildNumber: input.buildNumber?.trim() || undefined,
          releaseChannel: input.releaseChannel || undefined,
          status: input.status || undefined,
          minimumSupportedVersion: minVersion,
          releaseDate: input.releaseDate ? new Date(input.releaseDate) : undefined,
          rolloutPercentage: rollout,
          downloadUrl:
            input.downloadUrl !== undefined
              ? input.downloadUrl?.trim() || null
              : undefined,
          releaseNotes:
            input.releaseNotes !== undefined
              ? input.releaseNotes?.trim() || null
              : undefined,
          changelog:
            input.changelog !== undefined
              ? input.changelog?.trim() || null
              : undefined,
          mandatoryUpdate:
            input.mandatoryUpdate !== undefined
              ? Boolean(input.mandatoryUpdate)
              : undefined,
          forceUpdate:
            input.forceUpdate !== undefined
              ? Boolean(input.forceUpdate)
              : undefined,
          updatedById: actorId,
        },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
        },
      });

      await tx.appReleaseAuditLog.create({
        data: {
          releaseId: rel.id,
          actorId,
          actorEmail,
          action: 'UPDATED',
          platform: rel.platform,
          operatingSystem: rel.operatingSystem,
          version: rel.version,
          previousState: JSON.stringify({
            status: existing.status,
            rolloutPercentage: existing.rolloutPercentage,
            minimumSupportedVersion: existing.minimumSupportedVersion,
            mandatoryUpdate: existing.mandatoryUpdate,
          }),
          newState: JSON.stringify({
            status: rel.status,
            rolloutPercentage: rel.rolloutPercentage,
            minimumSupportedVersion: rel.minimumSupportedVersion,
            mandatoryUpdate: rel.mandatoryUpdate,
          }),
          reason: 'Release details updated',
        },
      });

      return rel;
    });

    await this.invalidateCaches();
    return this.mapReleaseToView(updated);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle Transitions: Release, Schedule, Rollout, Deprecate, Disable, Rollback
  // ---------------------------------------------------------------------------

  async releaseNow(
    actorId: string,
    actorEmail: string,
    id: string,
    reason?: string,
  ): Promise<AppReleaseView> {
    const release = await this.prisma.appRelease.findUnique({ where: { id } });
    if (!release) {
      throw new NotFoundException(`Release ${id} not found.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Demote previous current release
      await tx.appRelease.updateMany({
        where: {
          platform: release.platform,
          operatingSystem: release.operatingSystem,
          releaseChannel: release.releaseChannel,
          isCurrent: true,
        },
        data: { isCurrent: false },
      });

      const rel = await tx.appRelease.update({
        where: { id },
        data: {
          status: AppReleaseStatus.RELEASED,
          isCurrent: true,
          releaseDate: new Date(),
          updatedById: actorId,
        },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
        },
      });

      await tx.appReleaseAuditLog.create({
        data: {
          releaseId: rel.id,
          actorId,
          actorEmail,
          action: 'RELEASED',
          platform: rel.platform,
          operatingSystem: rel.operatingSystem,
          version: rel.version,
          previousState: JSON.stringify({
            status: release.status,
            isCurrent: release.isCurrent,
          }),
          newState: JSON.stringify({
            status: rel.status,
            isCurrent: rel.isCurrent,
            releaseDate: rel.releaseDate,
          }),
          reason: reason || 'Immediate release promoted to active production',
        },
      });

      return rel;
    });

    await this.invalidateCaches();
    return this.mapReleaseToView(updated);
  }

  async scheduleRelease(
    actorId: string,
    actorEmail: string,
    id: string,
    input: ScheduleAppReleaseInput,
  ): Promise<AppReleaseView> {
    const release = await this.prisma.appRelease.findUnique({ where: { id } });
    if (!release) {
      throw new NotFoundException(`Release ${id} not found.`);
    }

    const targetDate = new Date(input.releaseDate);
    if (isNaN(targetDate.getTime())) {
      throw new BadRequestException('Invalid release date/time format.');
    }

    const rollout = input.rolloutPercentage ?? release.rolloutPercentage;
    if (rollout < 0 || rollout > 100) {
      throw new BadRequestException('Rollout percentage must be between 0 and 100.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const rel = await tx.appRelease.update({
        where: { id },
        data: {
          status: AppReleaseStatus.SCHEDULED,
          releaseDate: targetDate,
          rolloutPercentage: rollout,
          updatedById: actorId,
        },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
        },
      });

      await tx.appReleaseAuditLog.create({
        data: {
          releaseId: rel.id,
          actorId,
          actorEmail,
          action: 'SCHEDULED',
          platform: rel.platform,
          operatingSystem: rel.operatingSystem,
          version: rel.version,
          previousState: JSON.stringify({
            status: release.status,
            releaseDate: release.releaseDate,
          }),
          newState: JSON.stringify({
            status: rel.status,
            releaseDate: rel.releaseDate,
            rolloutPercentage: rel.rolloutPercentage,
          }),
          reason: input.reason || `Scheduled for ${targetDate.toISOString()}`,
        },
      });

      return rel;
    });

    await this.invalidateCaches();
    return this.mapReleaseToView(updated);
  }

  async updateRollout(
    actorId: string,
    actorEmail: string,
    id: string,
    input: RolloutAppReleaseInput,
  ): Promise<AppReleaseView> {
    const release = await this.prisma.appRelease.findUnique({ where: { id } });
    if (!release) {
      throw new NotFoundException(`Release ${id} not found.`);
    }

    if (input.rolloutPercentage < 0 || input.rolloutPercentage > 100) {
      throw new BadRequestException('Rollout percentage must be between 0 and 100.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const rel = await tx.appRelease.update({
        where: { id },
        data: {
          rolloutPercentage: input.rolloutPercentage,
          updatedById: actorId,
        },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
        },
      });

      await tx.appReleaseAuditLog.create({
        data: {
          releaseId: rel.id,
          actorId,
          actorEmail,
          action: 'ROLLOUT_CHANGED',
          platform: rel.platform,
          operatingSystem: rel.operatingSystem,
          version: rel.version,
          previousState: JSON.stringify({
            rolloutPercentage: release.rolloutPercentage,
          }),
          newState: JSON.stringify({
            rolloutPercentage: rel.rolloutPercentage,
          }),
          reason: input.reason || `Adjusted rollout to ${input.rolloutPercentage}%`,
        },
      });

      return rel;
    });

    await this.invalidateCaches();
    return this.mapReleaseToView(updated);
  }

  async deprecateRelease(
    actorId: string,
    actorEmail: string,
    id: string,
    reason?: string,
  ): Promise<AppReleaseView> {
    const release = await this.prisma.appRelease.findUnique({ where: { id } });
    if (!release) {
      throw new NotFoundException(`Release ${id} not found.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const rel = await tx.appRelease.update({
        where: { id },
        data: {
          status: AppReleaseStatus.DEPRECATED,
          isCurrent: false,
          updatedById: actorId,
        },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
        },
      });

      await tx.appReleaseAuditLog.create({
        data: {
          releaseId: rel.id,
          actorId,
          actorEmail,
          action: 'DEPRECATED',
          platform: rel.platform,
          operatingSystem: rel.operatingSystem,
          version: rel.version,
          previousState: JSON.stringify({
            status: release.status,
            isCurrent: release.isCurrent,
          }),
          newState: JSON.stringify({
            status: rel.status,
            isCurrent: false,
          }),
          reason: reason || 'Version marked as deprecated',
        },
      });

      return rel;
    });

    await this.invalidateCaches();
    return this.mapReleaseToView(updated);
  }

  async disableRelease(
    actorId: string,
    actorEmail: string,
    id: string,
    reason?: string,
  ): Promise<AppReleaseView> {
    const release = await this.prisma.appRelease.findUnique({ where: { id } });
    if (!release) {
      throw new NotFoundException(`Release ${id} not found.`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const rel = await tx.appRelease.update({
        where: { id },
        data: {
          status: AppReleaseStatus.DISABLED,
          isCurrent: false,
          updatedById: actorId,
        },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
        },
      });

      await tx.appReleaseAuditLog.create({
        data: {
          releaseId: rel.id,
          actorId,
          actorEmail,
          action: 'DISABLED',
          platform: rel.platform,
          operatingSystem: rel.operatingSystem,
          version: rel.version,
          previousState: JSON.stringify({
            status: release.status,
            isCurrent: release.isCurrent,
          }),
          newState: JSON.stringify({
            status: rel.status,
            isCurrent: false,
          }),
          reason: reason || 'Version disabled due to critical failure or security rule',
        },
      });

      return rel;
    });

    await this.invalidateCaches();
    return this.mapReleaseToView(updated);
  }

  async rollbackRelease(
    actorId: string,
    actorEmail: string,
    targetReleaseId: string,
    reason: string,
  ): Promise<AppReleaseView> {
    if (!reason?.trim()) {
      throw new BadRequestException('A reason is required for administrative rollback.');
    }

    const target = await this.prisma.appRelease.findUnique({
      where: { id: targetReleaseId },
    });
    if (!target) {
      throw new NotFoundException(`Target rollback release ${targetReleaseId} not found.`);
    }

    // Find currently active release for same platform, OS, channel
    const currentActive = await this.prisma.appRelease.findFirst({
      where: {
        platform: target.platform,
        operatingSystem: target.operatingSystem,
        releaseChannel: target.releaseChannel,
        isCurrent: true,
      },
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Demote current active
      if (currentActive) {
        await tx.appRelease.update({
          where: { id: currentActive.id },
          data: { isCurrent: false },
        });
      }

      // 2. Reactivate target release as current and released
      const rel = await tx.appRelease.update({
        where: { id: target.id },
        data: {
          status: AppReleaseStatus.RELEASED,
          isCurrent: true,
          updatedById: actorId,
        },
        include: {
          createdBy: { select: { id: true, email: true, name: true } },
        },
      });

      // 3. Log audit event
      await tx.appReleaseAuditLog.create({
        data: {
          releaseId: rel.id,
          actorId,
          actorEmail,
          action: 'ROLLED_BACK',
          platform: rel.platform,
          operatingSystem: rel.operatingSystem,
          version: rel.version,
          previousState: JSON.stringify({
            activeReleaseId: currentActive?.id ?? null,
            activeVersion: currentActive?.version ?? null,
          }),
          newState: JSON.stringify({
            activeReleaseId: rel.id,
            activeVersion: rel.version,
            status: rel.status,
            isCurrent: true,
          }),
          reason,
        },
      });

      return rel;
    });

    await this.invalidateCaches();
    return this.mapReleaseToView(updated);
  }

  // ---------------------------------------------------------------------------
  // Audit Logs
  // ---------------------------------------------------------------------------

  async getAuditLogs(params: {
    platform?: AppPlatform;
    releaseId?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    items: AppReleaseAuditLogView[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 30));
    const skip = (page - 1) * pageSize;

    const where: Prisma.AppReleaseAuditLogWhereInput = {};
    if (params.platform) where.platform = params.platform;
    if (params.releaseId) where.releaseId = params.releaseId;

    const [items, total] = await Promise.all([
      this.prisma.appReleaseAuditLog.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.appReleaseAuditLog.count({ where }),
    ]);

    return {
      items: items.map((log) => ({
        id: log.id,
        releaseId: log.releaseId,
        actorId: log.actorId,
        actorEmail: log.actorEmail,
        action: log.action,
        platform: log.platform,
        operatingSystem: log.operatingSystem,
        version: log.version,
        previousState: log.previousState,
        newState: log.newState,
        reason: log.reason,
        createdAt: log.createdAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  // ---------------------------------------------------------------------------
  // Scheduled Release Transition (Background Worker)
  // ---------------------------------------------------------------------------

  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledReleases(): Promise<number> {
    const now = new Date();
    const scheduled = await this.prisma.appRelease.findMany({
      where: {
        status: AppReleaseStatus.SCHEDULED,
        releaseDate: { lte: now },
      },
    });

    if (scheduled.length === 0) return 0;

    this.logger.log(`Processing ${scheduled.length} scheduled release(s) due for launch...`);

    let processed = 0;
    for (const rel of scheduled) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.appRelease.updateMany({
            where: {
              platform: rel.platform,
              operatingSystem: rel.operatingSystem,
              releaseChannel: rel.releaseChannel,
              isCurrent: true,
            },
            data: { isCurrent: false },
          });

          await tx.appRelease.update({
            where: { id: rel.id },
            data: {
              status: AppReleaseStatus.RELEASED,
              isCurrent: true,
            },
          });

          await tx.appReleaseAuditLog.create({
            data: {
              releaseId: rel.id,
              actorEmail: 'system-scheduler@onetab.ai',
              action: 'AUTO_SCHEDULED_RELEASE',
              platform: rel.platform,
              operatingSystem: rel.operatingSystem,
              version: rel.version,
              previousState: JSON.stringify({ status: AppReleaseStatus.SCHEDULED }),
              newState: JSON.stringify({
                status: AppReleaseStatus.RELEASED,
                isCurrent: true,
              }),
              reason: 'Automatic scheduled release transition at target date/time',
            },
          });
        });
        processed++;
      } catch (err) {
        this.logger.error(`Failed to activate scheduled release ${rel.id}:`, err);
      }
    }

    if (processed > 0) {
      await this.invalidateCaches();
    }
    return processed;
  }

  // ---------------------------------------------------------------------------
  // Client Update Engine (Public, High-Performance)
  // ---------------------------------------------------------------------------

  async checkUpdate(input: AppVersionCheckInput): Promise<AppVersionCheckResult> {
    const platform =
      input.platform.toLowerCase() === 'desktop'
        ? AppPlatform.DESKTOP
        : AppPlatform.WEB;

    let os: AppOperatingSystem | null = null;
    if (platform === AppPlatform.DESKTOP) {
      const rawOs = (input.os || '').toLowerCase();
      if (rawOs.includes('win')) os = AppOperatingSystem.WINDOWS;
      else if (rawOs.includes('mac') || rawOs.includes('darwin'))
        os = AppOperatingSystem.MACOS;
      else if (rawOs.includes('linux')) os = AppOperatingSystem.LINUX;
      else os = AppOperatingSystem.WINDOWS; // Default fallback
    }

    const channelRaw = (input.releaseChannel || 'stable').toUpperCase();
    const channel =
      channelRaw in AppReleaseChannel
        ? (channelRaw as AppReleaseChannel)
        : AppReleaseChannel.STABLE;

    const clientVer = (input.currentVersion || '0.0.0').trim();

    // Query active release
    const activeRelease = await this.prisma.appRelease.findFirst({
      where: {
        platform,
        operatingSystem: os,
        releaseChannel: channel,
        status: AppReleaseStatus.RELEASED,
        isCurrent: true,
      },
      orderBy: { releaseDate: 'desc' },
    });

    if (!activeRelease) {
      // Fallback to latest released if isCurrent wasn't set
      const latestReleased = await this.prisma.appRelease.findFirst({
        where: {
          platform,
          operatingSystem: os,
          releaseChannel: channel,
          status: AppReleaseStatus.RELEASED,
        },
        orderBy: { releaseDate: 'desc' },
      });

      if (!latestReleased) {
        return {
          updateAvailable: false,
          status: 'up-to-date',
          currentVersion: clientVer,
          latestVersion: clientVer,
          minimumSupportedVersion: '1.0.0',
          mandatory: false,
          forceUpdate: false,
          downloadUrl: null,
          releaseNotes: null,
          changelog: null,
          releaseDate: null,
          releaseChannel: channel,
          rolloutPercentage: 100,
          rolloutEligible: true,
        };
      }

      return this.evaluateUpdateDecision(latestReleased, clientVer, input.clientId);
    }

    return this.evaluateUpdateDecision(activeRelease, clientVer, input.clientId);
  }

  private evaluateUpdateDecision(
    release: AppRelease,
    clientVer: string,
    clientId?: string,
  ): AppVersionCheckResult {
    const minSupported = release.minimumSupportedVersion || '1.0.0';
    const latestVer = release.version;

    const isBelowMin = compareSemVer(clientVer, minSupported) < 0;
    const isOutdated = compareSemVer(clientVer, latestVer) < 0;

    // Rollout calculation
    let rolloutEligible = true;
    if (release.rolloutPercentage < 100) {
      const bucket = clientId
        ? hashClientIdToBucket(clientId)
        : Math.floor(Math.random() * 100);
      rolloutEligible = bucket < release.rolloutPercentage;
    }

    let status: ClientUpdateState = 'up-to-date';
    let updateAvailable = false;
    let mandatory = false;
    let forceUpdate = false;

    if (isBelowMin) {
      // Below minimum supported version: update is mandatory and forced!
      status = 'update-required';
      updateAvailable = true;
      mandatory = true;
      forceUpdate = true;
    } else if (isOutdated) {
      if (release.mandatoryUpdate || release.forceUpdate) {
        status = 'update-required';
        updateAvailable = true;
        mandatory = true;
        forceUpdate = release.forceUpdate;
      } else if (rolloutEligible) {
        status = 'update-available';
        updateAvailable = true;
      } else {
        // In gradual rollout, user is not in the current wave
        status = 'up-to-date';
        updateAvailable = false;
      }
    } else {
      status = 'up-to-date';
      updateAvailable = false;
    }

    return {
      updateAvailable,
      status,
      currentVersion: clientVer,
      latestVersion: latestVer,
      minimumSupportedVersion: minSupported,
      mandatory,
      forceUpdate,
      downloadUrl: release.downloadUrl,
      releaseNotes: release.releaseNotes,
      changelog: release.changelog,
      releaseDate: release.releaseDate.toISOString(),
      releaseChannel: release.releaseChannel,
      rolloutPercentage: release.rolloutPercentage,
      rolloutEligible,
    };
  }

  async getWebMetadata(): Promise<{
    version: string;
    build: string;
    releaseDate: string;
    minimumSupportedVersion: string;
    environment: string;
  }> {
    const currentWeb = await this.prisma.appRelease.findFirst({
      where: {
        platform: AppPlatform.WEB,
        status: AppReleaseStatus.RELEASED,
        isCurrent: true,
      },
    });

    return {
      version: currentWeb?.version ?? '2.8.5',
      build: currentWeb?.buildNumber ?? '2026.09.1',
      releaseDate:
        currentWeb?.releaseDate.toISOString() ?? new Date().toISOString(),
      minimumSupportedVersion: currentWeb?.minimumSupportedVersion ?? '1.0.0',
      environment: process.env['NODE_ENV'] ?? 'development',
    };
  }

  // ---------------------------------------------------------------------------
  // View Mapper
  // ---------------------------------------------------------------------------

  private mapReleaseToView(
    r: AppRelease & {
      createdBy?: { id: string; email: string; name: string } | null;
    },
  ): AppReleaseView {
    return {
      id: r.id,
      platform: r.platform,
      operatingSystem: r.operatingSystem,
      version: r.version,
      buildNumber: r.buildNumber,
      releaseChannel: r.releaseChannel,
      status: r.status,
      minimumSupportedVersion: r.minimumSupportedVersion,
      releaseDate: r.releaseDate.toISOString(),
      rolloutPercentage: r.rolloutPercentage,
      downloadUrl: r.downloadUrl,
      releaseNotes: r.releaseNotes,
      changelog: r.changelog,
      mandatoryUpdate: r.mandatoryUpdate,
      forceUpdate: r.forceUpdate,
      isCurrent: r.isCurrent,
      createdById: r.createdById,
      createdByEmail: r.createdBy?.email ?? null,
      createdByName: r.createdBy?.name ?? null,
      updatedById: r.updatedById,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }
}

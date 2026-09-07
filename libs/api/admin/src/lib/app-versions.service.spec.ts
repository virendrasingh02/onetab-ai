import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  AppVersionsService,
  compareSemVer,
  isValidSemVer,
  hashClientIdToBucket,
} from './app-versions.service.js';
import {
  AppOperatingSystem,
  AppPlatform,
  AppReleaseChannel,
  AppReleaseStatus,
} from '@org/database';

describe('AppVersionsService', () => {
  let service: AppVersionsService;
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(() => {
    mockPrisma = {
      appRelease: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      appReleaseAuditLog: {
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(mockPrisma)),
    };

    mockCache = {
      deletePattern: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    };

    service = new AppVersionsService(mockPrisma, mockCache);
  });

  describe('SemVer Helpers', () => {
    it('accurately compares standard and prefixed SemVer', () => {
      expect(compareSemVer('1.0.0', '1.0.0')).toBe(0);
      expect(compareSemVer('v2.8.5', '2.8.4')).toBe(1);
      expect(compareSemVer('2.7.0', '2.8.0')).toBe(-1);
      expect(compareSemVer('2.8.5', 'v2.8.5')).toBe(0);
      expect(compareSemVer('2.8.5-beta.1', '2.8.5')).toBe(0);
      expect(compareSemVer('2.10.0', '2.9.9')).toBe(1);
      expect(compareSemVer('1.0.0', '1.0.0.1')).toBe(-1);
    });

    it('validates semantic version formats', () => {
      expect(isValidSemVer('1.0.0')).toBe(true);
      expect(isValidSemVer('v2.8.5')).toBe(true);
      expect(isValidSemVer('2026.09.1')).toBe(true);
      expect(isValidSemVer('invalid-version')).toBe(false);
      expect(isValidSemVer('')).toBe(false);
    });

    it('consistently hashes client IDs into 0-99 range', () => {
      const bucket1 = hashClientIdToBucket('client-uuid-1234');
      const bucket2 = hashClientIdToBucket('client-uuid-1234');
      expect(bucket1).toBe(bucket2);
      expect(bucket1).toBeGreaterThanOrEqual(0);
      expect(bucket1).toBeLessThan(100);
    });
  });

  describe('Version Validation on Creation', () => {
    it('rejects invalid semantic version format', async () => {
      await expect(
        service.createRelease('admin1', 'admin@onetab.ai', {
          platform: AppPlatform.WEB,
          version: 'invalid',
          buildNumber: '1',
        }),
      ).rejects.toThrow('is not a valid Semantic Version');
    });

    it('requires operating system for Desktop releases', async () => {
      await expect(
        service.createRelease('admin1', 'admin@onetab.ai', {
          platform: AppPlatform.DESKTOP,
          version: '2.8.5',
          buildNumber: '1',
        }),
      ).rejects.toThrow('Operating system (WINDOWS, MACOS, or LINUX) is required for Desktop releases');
    });

    it('rejects minimum supported version newer than release version', async () => {
      await expect(
        service.createRelease('admin1', 'admin@onetab.ai', {
          platform: AppPlatform.WEB,
          version: '2.8.0',
          minimumSupportedVersion: '2.8.5',
          buildNumber: '1',
        }),
      ).rejects.toThrow('cannot be newer than the release version');
    });

    it('rejects duplicate releases for the same platform, OS, channel, and version', async () => {
      mockPrisma.appRelease.findFirst.mockResolvedValue({ id: 'existing-123' });

      await expect(
        service.createRelease('admin1', 'admin@onetab.ai', {
          platform: AppPlatform.DESKTOP,
          operatingSystem: AppOperatingSystem.WINDOWS,
          version: '2.8.5',
          buildNumber: '1',
          releaseChannel: AppReleaseChannel.STABLE,
        }),
      ).rejects.toThrow('already exists');
    });

    it('creates draft release successfully and records audit log', async () => {
      mockPrisma.appRelease.findFirst.mockResolvedValue(null);
      const mockCreated = {
        id: 'rel-1',
        platform: AppPlatform.DESKTOP,
        operatingSystem: AppOperatingSystem.WINDOWS,
        version: '2.8.5',
        buildNumber: '2026.09.1',
        releaseChannel: AppReleaseChannel.STABLE,
        status: AppReleaseStatus.DRAFT,
        minimumSupportedVersion: '2.7.0',
        releaseDate: new Date('2026-09-07T00:00:00Z'),
        rolloutPercentage: 100,
        downloadUrl: 'https://download.onetab.ai/desktop/windows/setup.exe',
        releaseNotes: 'Bug fixes and performance upgrades',
        changelog: '- Fix #1\n- Fix #2',
        mandatoryUpdate: false,
        forceUpdate: false,
        isCurrent: false,
        createdById: 'admin1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.appRelease.create.mockResolvedValue(mockCreated);

      const result = await service.createRelease('admin1', 'admin@onetab.ai', {
        platform: AppPlatform.DESKTOP,
        operatingSystem: AppOperatingSystem.WINDOWS,
        version: '2.8.5',
        buildNumber: '2026.09.1',
        minimumSupportedVersion: '2.7.0',
        downloadUrl: 'https://download.onetab.ai/desktop/windows/setup.exe',
        releaseNotes: 'Bug fixes and performance upgrades',
        changelog: '- Fix #1\n- Fix #2',
      });

      expect(result.version).toBe('2.8.5');
      expect(result.status).toBe(AppReleaseStatus.DRAFT);
      expect(mockPrisma.appReleaseAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CREATED',
            version: '2.8.5',
            actorEmail: 'admin@onetab.ai',
          }),
        }),
      );
    });
  });

  describe('Release Lifecycle & Rollback', () => {
    it('promotes draft to released, updates isCurrent, and unsets previous current', async () => {
      const existingDraft = {
        id: 'rel-1',
        platform: AppPlatform.WEB,
        operatingSystem: null,
        releaseChannel: AppReleaseChannel.STABLE,
        version: '2.8.5',
        status: AppReleaseStatus.DRAFT,
        isCurrent: false,
      };
      mockPrisma.appRelease.findUnique.mockResolvedValue(existingDraft);

      const updatedReleased = {
        ...existingDraft,
        status: AppReleaseStatus.RELEASED,
        isCurrent: true,
        releaseDate: new Date(),
        buildNumber: '1',
        minimumSupportedVersion: '1.0.0',
        rolloutPercentage: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.appRelease.update.mockResolvedValue(updatedReleased);

      const result = await service.releaseNow('admin1', 'admin@onetab.ai', 'rel-1', 'Ship v2.8.5 to prod');

      expect(mockPrisma.appRelease.updateMany).toHaveBeenCalledWith({
        where: {
          platform: AppPlatform.WEB,
          operatingSystem: null,
          releaseChannel: AppReleaseChannel.STABLE,
          isCurrent: true,
        },
        data: { isCurrent: false },
      });
      expect(result.status).toBe(AppReleaseStatus.RELEASED);
      expect(result.isCurrent).toBe(true);
      expect(mockPrisma.appReleaseAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'RELEASED',
            reason: 'Ship v2.8.5 to prod',
          }),
        }),
      );
    });

    it('performs administrative rollback cleanly to prior version', async () => {
      const targetPriorRelease = {
        id: 'rel-old',
        platform: AppPlatform.DESKTOP,
        operatingSystem: AppOperatingSystem.WINDOWS,
        releaseChannel: AppReleaseChannel.STABLE,
        version: '2.8.4',
        status: AppReleaseStatus.RELEASED,
        isCurrent: false,
        buildNumber: '2026.08.1',
        minimumSupportedVersion: '2.7.0',
        releaseDate: new Date('2026-08-01'),
        rolloutPercentage: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const currentFaultyRelease = {
        id: 'rel-faulty',
        platform: AppPlatform.DESKTOP,
        operatingSystem: AppOperatingSystem.WINDOWS,
        releaseChannel: AppReleaseChannel.STABLE,
        version: '2.8.5',
        isCurrent: true,
      };

      mockPrisma.appRelease.findUnique.mockResolvedValue(targetPriorRelease);
      mockPrisma.appRelease.findFirst.mockResolvedValue(currentFaultyRelease);
      mockPrisma.appRelease.update.mockResolvedValue({
        ...targetPriorRelease,
        isCurrent: true,
      });

      const result = await service.rollbackRelease(
        'admin1',
        'admin@onetab.ai',
        'rel-old',
        'Critical regression detected in v2.8.5',
      );

      // Faulty release demoted
      expect(mockPrisma.appRelease.update).toHaveBeenCalledWith({
        where: { id: 'rel-faulty' },
        data: { isCurrent: false },
      });
      // Prior release restored
      expect(result.version).toBe('2.8.4');
      expect(result.isCurrent).toBe(true);
      expect(mockPrisma.appReleaseAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'ROLLED_BACK',
            reason: 'Critical regression detected in v2.8.5',
          }),
        }),
      );
    });
  });

  describe('Client Update Engine', () => {
    it('returns status up-to-date when client version matches latest', async () => {
      mockPrisma.appRelease.findFirst.mockResolvedValue({
        id: 'rel-1',
        platform: AppPlatform.DESKTOP,
        operatingSystem: AppOperatingSystem.WINDOWS,
        releaseChannel: AppReleaseChannel.STABLE,
        version: '2.8.5',
        minimumSupportedVersion: '2.7.0',
        rolloutPercentage: 100,
        status: AppReleaseStatus.RELEASED,
        releaseDate: new Date(),
      });

      const result = await service.checkUpdate({
        platform: 'desktop',
        os: 'windows',
        currentVersion: '2.8.5',
      });

      expect(result.updateAvailable).toBe(false);
      expect(result.status).toBe('up-to-date');
    });

    it('enforces update-required when client version is below minimum supported version', async () => {
      mockPrisma.appRelease.findFirst.mockResolvedValue({
        id: 'rel-1',
        platform: AppPlatform.DESKTOP,
        operatingSystem: AppOperatingSystem.WINDOWS,
        releaseChannel: AppReleaseChannel.STABLE,
        version: '2.8.5',
        minimumSupportedVersion: '2.7.0',
        rolloutPercentage: 100,
        status: AppReleaseStatus.RELEASED,
        releaseDate: new Date(),
        downloadUrl: 'https://download.onetab.ai/desktop/windows/setup.exe',
      });

      const result = await service.checkUpdate({
        platform: 'desktop',
        os: 'windows',
        currentVersion: '2.6.9', // Below minimum 2.7.0
      });

      expect(result.updateAvailable).toBe(true);
      expect(result.status).toBe('update-required');
      expect(result.mandatory).toBe(true);
      expect(result.forceUpdate).toBe(true);
      expect(result.downloadUrl).toBe('https://download.onetab.ai/desktop/windows/setup.exe');
    });

    it('returns update-available when client version is older than latest and within minimum threshold', async () => {
      mockPrisma.appRelease.findFirst.mockResolvedValue({
        id: 'rel-1',
        platform: AppPlatform.DESKTOP,
        operatingSystem: AppOperatingSystem.WINDOWS,
        releaseChannel: AppReleaseChannel.STABLE,
        version: '2.8.5',
        minimumSupportedVersion: '2.7.0',
        rolloutPercentage: 100,
        status: AppReleaseStatus.RELEASED,
        releaseDate: new Date(),
      });

      const result = await service.checkUpdate({
        platform: 'desktop',
        os: 'windows',
        currentVersion: '2.8.4',
      });

      expect(result.updateAvailable).toBe(true);
      expect(result.status).toBe('update-available');
      expect(result.mandatory).toBe(false);
    });

    it('respects gradual rollout percentage when client is not in rollout wave', async () => {
      mockPrisma.appRelease.findFirst.mockResolvedValue({
        id: 'rel-1',
        platform: AppPlatform.DESKTOP,
        operatingSystem: AppOperatingSystem.WINDOWS,
        releaseChannel: AppReleaseChannel.STABLE,
        version: '2.8.5',
        minimumSupportedVersion: '2.7.0',
        rolloutPercentage: 0, // 0% rollout
        status: AppReleaseStatus.RELEASED,
        releaseDate: new Date(),
      });

      const result = await service.checkUpdate({
        platform: 'desktop',
        os: 'windows',
        currentVersion: '2.8.4',
        clientId: 'test-client-123',
      });

      expect(result.updateAvailable).toBe(false);
      expect(result.rolloutEligible).toBe(false);
      expect(result.status).toBe('up-to-date');
    });
  });

  describe('Scheduled Releases Processing', () => {
    it('automatically transitions scheduled releases whose releaseDate has arrived', async () => {
      const pastDate = new Date(Date.now() - 60000);
      mockPrisma.appRelease.findMany.mockResolvedValue([
        {
          id: 'rel-sched-1',
          platform: AppPlatform.WEB,
          operatingSystem: null,
          releaseChannel: AppReleaseChannel.STABLE,
          version: '2.9.0',
          status: AppReleaseStatus.SCHEDULED,
          releaseDate: pastDate,
        },
      ]);

      const count = await service.processScheduledReleases();

      expect(count).toBe(1);
      expect(mockPrisma.appRelease.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rel-sched-1' },
          data: {
            status: AppReleaseStatus.RELEASED,
            isCurrent: true,
          },
        }),
      );
      expect(mockPrisma.appReleaseAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'AUTO_SCHEDULED_RELEASE',
            version: '2.9.0',
          }),
        }),
      );
    });
  });
});

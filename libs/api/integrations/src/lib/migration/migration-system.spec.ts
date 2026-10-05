import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@org/database';
import { MigrationAiAdvisorService } from './migration-ai-advisor.service.js';
import { MigrationMappingService } from './migration-mapping.service.js';
import { MigrationReadinessService } from './migration-readiness.service.js';
import { MigrationValidationService } from './migration-validation.service.js';
import { SlackCapabilityChecker } from './slack-capability-checker.service.js';
import type { MigrationProvider } from './migration-provider.interface.js';

describe('Slack → Platform Migration System', () => {
  describe('SlackCapabilityChecker', () => {
    let checker: SlackCapabilityChecker;

    beforeEach(() => {
      checker = new SlackCapabilityChecker();
    });

    it('identifies available capabilities and allows migration when core scopes are granted', async () => {
      const scopes = [
        'team:read',
        'users:read',
        'users:read.email',
        'channels:read',
        'channels:history',
        'groups:read',
        'groups:history',
        'files:read',
      ];

      // With mock token that doesn't reach live network
      const report = await checker.checkCapabilities('xoxp-mock-test-token', scopes);
      expect(report.capabilities.workspace_metadata.status).toBe('available');
      expect(report.capabilities.members.status).toBe('available');
      expect(report.capabilities.public_channels.status).toBe('available');
      expect(report.capabilities.messages.status).toBe('available');
      expect(report.capabilities.files.status).toBe('available');
      expect(report.canMigrate).toBe(true);
      expect(report.blockers.length).toBe(0);
    });

    it('flags permission_required and blockers when essential scopes are missing', async () => {
      // Scopes without users:read or channels:history
      const scopes = ['team:read'];
      const report = await checker.checkCapabilities('xoxp-mock-token', scopes);

      expect(report.capabilities.members.status).toBe('permission_required');
      expect(report.capabilities.public_channels.status).toBe('permission_required');
      expect(report.canMigrate).toBe(false);
      expect(report.blockers.length).toBeGreaterThan(0);
    });

    it('marks canvases and lists as unsupported/export-only rather than silently failing', async () => {
      const report = await checker.checkCapabilities('xoxp-mock-token', ['team:read']);
      expect(report.capabilities.canvases.status).toBe('unsupported');
      expect(report.capabilities.lists.status).toBe('unsupported');
    });
  });

  describe('MigrationMappingService', () => {
    let mappingService: MigrationMappingService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        workspaceMember: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'wm-1',
              workspaceId: 'ws-123',
              userId: 'u-alice',
              email: 'alice@example.com',
              user: {
                id: 'u-alice',
                name: 'Alice Cooper',
                displayName: 'Alice',
                email: 'alice@example.com',
                emailVerifiedAt: new Date(),
              },
            },
          ]),
        },
        channel: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'c-general',
              name: 'general',
              slug: 'general',
              isArchived: false,
            },
          ]),
        },
        externalIntegration: {
          findMany: vi.fn().mockResolvedValue([
            {
              userId: 'u-bob',
              providerAccountId: 'SLACK_U_BOB',
            },
          ]),
        },
        migrationMapping: {
          upsert: vi.fn().mockResolvedValue({ id: 'map-1' }),
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };
      mappingService = new MigrationMappingService(mockPrisma as unknown as PrismaService);
    });

    it('strictly follows the user matching hierarchy', async () => {
      const mockProvider: MigrationProvider = {
        providerId: 'SLACK_API',
        displayName: 'Slack API',
        checkCapabilities: vi.fn(),
        fetchWorkspaceMetadata: vi.fn(),
        fetchUsers: vi.fn().mockResolvedValue({
          items: [
            // User 1: matches by linked Slack identity
            { id: 'SLACK_U_BOB', name: 'bob', email: 'bob@other.com', isAdmin: false, isOwner: false, isBot: false, isDeleted: false },
            // User 2: matches by verified email
            { id: 'SLACK_U_ALICE', name: 'alice_slack', email: 'alice@example.com', isAdmin: true, isOwner: false, isBot: false, isDeleted: false },
            // User 3: unmatched with email -> invite
            { id: 'SLACK_U_CHARLIE', name: 'charlie', email: 'charlie@newco.com', isAdmin: false, isOwner: false, isBot: false, isDeleted: false },
            // User 4: unmatched without email -> placeholder
            { id: 'SLACK_U_DAVE', name: 'dave', email: undefined, isAdmin: false, isOwner: false, isBot: false, isDeleted: false },
          ],
        }),
        fetchChannels: vi.fn().mockResolvedValue({ items: [] }),
        fetchChannelMembers: vi.fn().mockResolvedValue([]),
        fetchMessages: vi.fn().mockResolvedValue({ items: [] }),
        fetchThreadReplies: vi.fn().mockResolvedValue([]),
        fetchFiles: vi.fn().mockResolvedValue({ items: [] }),
      };

      const preview = await mappingService.generateMappingPreview('ws-123', mockProvider, 'mock-token', {
        mode: 'all',
        includePublicChannels: true,
        includePrivateChannels: true,
        includeDms: false,
        includeGroupDms: false,
        includeFiles: true,
        structureOnly: false,
      });

      const bobMatch = preview.users.find((u) => u.sourceId === 'SLACK_U_BOB');
      expect(bobMatch?.matchType).toBe('linked_identity');
      expect(bobMatch?.destinationUserId).toBe('u-bob');

      const aliceMatch = preview.users.find((u) => u.sourceId === 'SLACK_U_ALICE');
      expect(aliceMatch?.matchType).toBe('verified_email');
      expect(aliceMatch?.destinationUserId).toBe('u-alice');

      const charlieMatch = preview.users.find((u) => u.sourceId === 'SLACK_U_CHARLIE');
      expect(charlieMatch?.matchType).toBe('invite');
      expect(charlieMatch?.resolution).toBe('INVITE');

      const daveMatch = preview.users.find((u) => u.sourceId === 'SLACK_U_DAVE');
      expect(daveMatch?.matchType).toBe('unmatched');
      expect(daveMatch?.resolution).toBe('CREATE_PLACEHOLDER');
    });

    it('detects channel name collisions and suggests slug deduplication', async () => {
      const mockProvider: MigrationProvider = {
        providerId: 'SLACK_API',
        displayName: 'Slack API',
        checkCapabilities: vi.fn(),
        fetchWorkspaceMetadata: vi.fn(),
        fetchUsers: vi.fn().mockResolvedValue({ items: [] }),
        fetchChannels: vi.fn().mockResolvedValue({
          items: [
            { id: 'C_GEN', name: 'general', isPrivate: false, isArchived: false, memberCount: 10 },
            { id: 'C_DEV', name: 'engineering', isPrivate: false, isArchived: false, memberCount: 5 },
          ],
        }),
        fetchChannelMembers: vi.fn().mockResolvedValue([]),
        fetchMessages: vi.fn().mockResolvedValue({ items: [] }),
        fetchThreadReplies: vi.fn().mockResolvedValue([]),
        fetchFiles: vi.fn().mockResolvedValue({ items: [] }),
      };

      const preview = await mappingService.generateMappingPreview('ws-123', mockProvider, 'mock-token', {
        mode: 'all',
        includePublicChannels: true,
        includePrivateChannels: true,
        includeDms: false,
        includeGroupDms: false,
        includeFiles: true,
        structureOnly: false,
      });

      const generalChannel = preview.channels.find((c) => c.sourceId === 'C_GEN');
      expect(generalChannel?.conflictType).toBe('name_collision');
      expect(generalChannel?.suggestedSlug).toBe('general-slack');

      const devChannel = preview.channels.find((c) => c.sourceId === 'C_DEV');
      expect(devChannel?.conflictType).toBe('none');
      expect(devChannel?.suggestedSlug).toBe('engineering');
    });
  });

  describe('MigrationValidationService', () => {
    let validationService: MigrationValidationService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        migrationSession: {
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: 'mig-1',
            workspaceId: 'ws-123',
            sourceProvider: 'SLACK_API',
            createdAt: new Date('2026-10-01T10:00:00Z'),
            startedAt: new Date('2026-10-01T10:00:00Z'),
            completedAt: new Date('2026-10-01T10:05:00Z'),
            workspace: { id: 'ws-123', name: 'Acme Corp' },
            errors: [],
            steps: [
              { stage: 'USERS', totalItems: 10, processedItems: 10 },
              { stage: 'CHANNELS', totalItems: 5, processedItems: 5 },
              { stage: 'MESSAGES', totalItems: 1000, processedItems: 1000 },
            ],
            mappings: [
              ...Array.from({ length: 10 }, (_, i) => ({
                entityType: 'USER',
                sourceId: `U_${i}`,
                destinationId: `dest_u_${i}`,
                status: 'MAPPED',
              })),
              ...Array.from({ length: 5 }, (_, i) => ({
                entityType: 'CHANNEL',
                sourceId: `C_${i}`,
                destinationId: `dest_c_${i}`,
                status: 'MAPPED',
              })),
              ...Array.from({ length: 1000 }, (_, i) => ({
                entityType: 'MESSAGE',
                sourceId: `M_${i}`,
                destinationId: `dest_m_${i}`,
                status: 'MAPPED',
              })),
            ],
          }),
        },
        migrationValidation: {
          create: vi.fn().mockResolvedValue({ id: 'val-1' }),
        },
        migrationReport: {
          create: vi.fn().mockResolvedValue({ id: 'rep-1' }),
        },
      };
      validationService = new MigrationValidationService(mockPrisma as unknown as PrismaService);
    });

    it('calculates a 100% reconciliation score when all expected items match', async () => {
      const report = await validationService.validateMigration('mig-1');
      expect(report.score).toBe(100);
      expect(report.passed).toBe(true);
      expect(report.discrepancies.length).toBe(0);
      expect(report.metrics.importedUsers).toBe(10);
      expect(report.metrics.importedChannels).toBe(5);
      expect(report.metrics.importedMessages).toBe(1000);
    });

    it('generates an exportable Final Report with counts and validation score', async () => {
      const finalReport = await validationService.generateFinalReport('mig-1');
      expect(finalReport.validationScore).toBe(100);
      expect(finalReport.counts.members).toBe(10);
      expect(finalReport.counts.channels).toBe(5);
      expect(finalReport.counts.messages).toBe(1000);
      expect(mockPrisma.migrationReport.create).toHaveBeenCalled();
    });
  });

  describe('MigrationAiAdvisorService', () => {
    let advisorService: MigrationAiAdvisorService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        channel: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: 'c-proj',
              name: 'launch-product',
              topic: 'Roadmap and deliverable milestones',
              isArchived: false,
              _count: { members: 8 },
            },
            {
              id: 'c-sched',
              name: 'team-standup',
              topic: 'Meeting coordination and availability',
              isArchived: false,
              _count: { members: 6 },
            },
            {
              id: 'c-kpi',
              name: 'weekly-ops-kpi',
              topic: 'Weekly status reports and metrics',
              isArchived: false,
              _count: { members: 4 },
            },
            {
              id: 'c-inactive',
              name: 'old-random-test',
              topic: '',
              isArchived: true,
              _count: { members: 1 },
            },
            {
              id: 'c-5',
              name: 'general',
              topic: '',
              isArchived: false,
              _count: { members: 10 },
            },
            {
              id: 'c-6',
              name: 'random',
              topic: '',
              isArchived: false,
              _count: { members: 10 },
            },
          ]),
        },
        aIAgent: {
          count: vi.fn().mockResolvedValue(0),
        },
        migrationSession: {
          update: vi.fn().mockResolvedValue({ id: 'mig-1' }),
        },
      };
      advisorService = new MigrationAiAdvisorService(mockPrisma as unknown as PrismaService);
    });

    it('contextually recommends Projects, Scheduler, and Tracker based on channel topics', async () => {
      const recs = await advisorService.generateAdoptionRecommendations('ws-123', 'mig-1');

      const projectRec = recs.find((r) => r.category === 'projects');
      expect(projectRec).toBeDefined();
      expect(projectRec?.channelName).toBe('launch-product');
      expect(projectRec?.actionType).toBe('create_project');

      const schedRec = recs.find((r) => r.category === 'scheduler');
      expect(schedRec).toBeDefined();
      expect(schedRec?.channelName).toBe('team-standup');
      expect(schedRec?.actionType).toBe('setup_scheduler');

      const trackerRec = recs.find((r) => r.category === 'tracker');
      expect(trackerRec).toBeDefined();
      expect(trackerRec?.channelName).toBe('weekly-ops-kpi');
      expect(trackerRec?.actionType).toBe('setup_tracker');
    });
  });
});

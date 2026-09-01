import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BillingService } from './billing.service.js';
import { WorkspaceRole } from '@org/types';

describe('BillingService', () => {
  let service: BillingService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      workspace: {
        findUnique: vi.fn(),
      },
      workspaceMember: {
        count: vi.fn(),
      },
      project: {
        count: vi.fn(),
      },
      upload: {
        aggregate: vi.fn(),
      },
      aIChatSession: {
        count: vi.fn(),
      },
      automationWorkflow: {
        count: vi.fn(),
      },
      externalIntegration: {
        count: vi.fn(),
      },
      workspaceSubscription: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      enterpriseSalesInquiry: {
        create: vi.fn(),
      },
    };

    service = new BillingService(mockPrisma);
  });

  describe('getBillingSummary', () => {
    it('returns Starter defaults when workspace has no subscription row', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws_1',
        name: 'Acme Corp',
        subscription: null,
      });

      mockPrisma.workspaceMember.count.mockResolvedValue(3);
      mockPrisma.project.count.mockResolvedValue(2);
      mockPrisma.upload.aggregate.mockResolvedValue({ _sum: { size: 1024 * 1024 * 100 } });
      mockPrisma.aIChatSession.count.mockResolvedValue(15);
      mockPrisma.automationWorkflow.count.mockResolvedValue(1);
      mockPrisma.externalIntegration.count.mockResolvedValue(1);

      const result = await service.getBillingSummary('ws_1', WorkspaceRole.OWNER);

      expect(result.plan).toBe('starter');
      expect(result.usage.members.used).toBe(3);
      expect(result.usage.members.limit).toBe(5);
      expect(result.usage.members.percentage).toBe(60);
      expect(result.usage.members.isLimitReached).toBe(false);
      expect(result.entitlements.core_workspace).toBe(true);
      expect(result.entitlements.advanced_views).toBe(false);
      expect(result.canManageBilling).toBe(true);
    });

    it('returns Pro limits and entitlements when on Pro plan', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws_1',
        name: 'Acme Corp',
        subscription: {
          id: 'sub_1',
          workspaceId: 'ws_1',
          planTier: 'PRO',
          billingInterval: 'MONTHLY',
          status: 'ACTIVE',
          seatsTotal: 25,
          cancelAtPeriodEnd: false,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          renewAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      mockPrisma.workspaceMember.count.mockResolvedValue(10);
      mockPrisma.project.count.mockResolvedValue(12);
      mockPrisma.upload.aggregate.mockResolvedValue({ _sum: { size: 1024 * 1024 * 1024 } });
      mockPrisma.aIChatSession.count.mockResolvedValue(200);
      mockPrisma.automationWorkflow.count.mockResolvedValue(5);
      mockPrisma.externalIntegration.count.mockResolvedValue(4);

      const result = await service.getBillingSummary('ws_1', WorkspaceRole.MEMBER);

      expect(result.plan).toBe('pro');
      expect(result.usage.members.limit).toBe(25);
      expect(result.usage.projects.limit).toBe(-1); // Unlimited
      expect(result.entitlements.advanced_views).toBe(true);
      expect(result.entitlements.agent_builder).toBe(true);
      expect(result.entitlements.sso_saml).toBe(false);
      expect(result.canManageBilling).toBe(false);
    });
  });

  describe('upgradePlan', () => {
    it('creates or updates subscription to target plan', async () => {
      mockPrisma.workspaceSubscription.upsert.mockResolvedValue({
        id: 'sub_1',
        workspaceId: 'ws_1',
        planTier: 'PRO',
      });

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws_1',
        name: 'Acme Corp',
        subscription: {
          id: 'sub_1',
          workspaceId: 'ws_1',
          planTier: 'PRO',
          billingInterval: 'ANNUAL',
          status: 'ACTIVE',
          seatsTotal: 25,
          cancelAtPeriodEnd: false,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          renewAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      mockPrisma.workspaceMember.count.mockResolvedValue(5);
      mockPrisma.project.count.mockResolvedValue(2);
      mockPrisma.upload.aggregate.mockResolvedValue({ _sum: { size: 0 } });
      mockPrisma.aIChatSession.count.mockResolvedValue(0);
      mockPrisma.automationWorkflow.count.mockResolvedValue(0);
      mockPrisma.externalIntegration.count.mockResolvedValue(0);

      const result = await service.upgradePlan('ws_1', 'user_1', {
        targetPlan: 'pro',
        billingInterval: 'annual',
      });

      expect(mockPrisma.workspaceSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: 'ws_1' },
          create: expect.objectContaining({
            planTier: 'PRO',
            billingInterval: 'ANNUAL',
          }),
        }),
      );
      expect(result.plan).toBe('pro');
    });
  });

  describe('getDowngradeImpact', () => {
    it('returns overage warnings when usage exceeds target limits', async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws_1',
        name: 'Acme Corp',
        subscription: {
          id: 'sub_1',
          workspaceId: 'ws_1',
          planTier: 'BUSINESS',
          billingInterval: 'MONTHLY',
          status: 'ACTIVE',
          seatsTotal: 50,
          cancelAtPeriodEnd: false,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          renewAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      mockPrisma.workspaceMember.count.mockResolvedValue(15);
      mockPrisma.project.count.mockResolvedValue(8);
      mockPrisma.upload.aggregate.mockResolvedValue({ _sum: { size: 0 } });

      mockPrisma.aIChatSession.count.mockResolvedValue(0);
      mockPrisma.automationWorkflow.count.mockResolvedValue(0);
      mockPrisma.externalIntegration.count.mockResolvedValue(0);

      const impact = await service.getDowngradeImpact('ws_1', 'starter');

      expect(impact.warnings.length).toBeGreaterThan(0);
      const memberWarning = impact.warnings.find((w) => w.resource === 'Team Members');
      expect(memberWarning).toBeDefined();
      expect(memberWarning?.currentUsage).toBe(15);
      expect(memberWarning?.targetLimit).toBe(5);
      expect(impact.restrictedFeatures).toContain('sso_saml');
      expect(impact.restrictedFeatures).toContain('audit_logs');
    });
  });

  describe('Enterprise Inquiries', () => {
    it('creates an enterprise sales inquiry', async () => {
      mockPrisma.enterpriseSalesInquiry.create.mockResolvedValue({
        id: 'inq_123',
      });

      const res = await service.submitEnterpriseInquiry('ws_1', 'user_1', {
        name: 'Jane Doe',
        email: 'jane@enterprise.com',
        companyName: 'MegaCorp Inc',
        teamSize: '500+',
        customLlmRequirements: 'Need self-hosted vLLM integration',
      });

      expect(res.success).toBe(true);
      expect(res.inquiryId).toBe('inq_123');
    });
  });
});

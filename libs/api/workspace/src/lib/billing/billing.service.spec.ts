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
        count: vi.fn().mockResolvedValue(1),
      },
      project: {
        count: vi.fn().mockResolvedValue(1),
      },
      upload: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { size: 0 } }),
      },
      aIChatSession: {
        count: vi.fn().mockResolvedValue(0),
      },
      automationWorkflow: {
        count: vi.fn().mockResolvedValue(0),
      },
      externalIntegration: {
        count: vi.fn().mockResolvedValue(0),
      },
      aIAgent: {
        count: vi.fn().mockResolvedValue(1),
      },
      workflowExecution: {
        count: vi.fn().mockResolvedValue(0),
      },
      workspaceSubscription: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      enterpriseSalesInquiry: {
        create: vi.fn(),
      },
    };

    const mockCreditService: any = {
      getOrCreateAccount: vi.fn().mockResolvedValue({
        id: 'c_1',
        workspaceId: 'ws_1',
        balance: 5.0,
        currency: 'USD',
        updatedAt: new Date().toISOString(),
        transactions: [],
      }),
      deductCredits: vi.fn(),
      topUpCredits: vi.fn(),
    };

    const mockPromotionService: any = {
      validatePromotion: vi.fn().mockResolvedValue({
        valid: true,
        code: 's1nu00780',
        discountPercent: 100,
        finalMonthlyPrice: 0,
        finalAnnualPrice: 0,
      }),
      recordRedemption: vi.fn(),
    };

    service = new BillingService(mockPrisma, mockCreditService, mockPromotionService);
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

  describe('Checkout & Promotions', () => {
    it('applies 100% promotion code and activates trial when requested', async () => {
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
          billingInterval: 'MONTHLY',
          status: 'TRIALING',
          seatsTotal: 25,
          trialUsed: true,
          appliedPromotionCode: 's1nu00780',
          discountPercent: 100,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          renewAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      const summary = await service.checkout('ws_1', 'user_1', {
        targetPlan: 'pro',
        billingInterval: 'monthly',
        promotionCode: 's1nu00780',
        startTrial: true,
      });

      expect(mockPrisma.workspaceSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            planTier: 'PRO',
            appliedPromotionCode: 's1nu00780',
            discountPercent: 100,
            trialStatus: 'ACTIVE',
          }),
        }),
      );
      expect(summary.plan).toBe('pro');
    });

    it('cancels subscription at period end', async () => {
      mockPrisma.workspaceSubscription.update.mockResolvedValue({
        id: 'sub_1',
        cancelAtPeriodEnd: true,
      });

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: 'ws_1',
        name: 'Acme Corp',
        subscription: null,
      });

      await service.cancelSubscription('ws_1');
      expect(mockPrisma.workspaceSubscription.update).toHaveBeenCalledWith({
        where: { workspaceId: 'ws_1' },
        data: { cancelAtPeriodEnd: true },
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { AgentDeploymentService, bucketRuns, periodToMs } from './agent-deployment.service.js';
import { AgentSessionService } from './agent-session.service.js';
import { AgentDeploymentWebhookService } from './agent-webhook.service.js';
import { AgentRuntimeBridgeService, publicRunError } from './agent-runtime-bridge.service.js';
import { AgentPublicController } from './agent-public.controller.js';
import { AgentDeploymentController } from './agent-deployment.controller.js';
import { IS_PUBLIC_KEY } from '@org/api-common';

describe('Universal AI Agent Deployment System', () => {
  const workspaceId = 'ws_apple_procurement';
  const _userId = 'usr_sarah_buyer';
  const macAgentId = 'agent_buy_a_mac_system';

  const macAgentRecord = {
    id: macAgentId,
    workspaceId,
    name: 'Buy a Mac System',
    role: 'Hardware Procurement Specialist',
    description: 'Autonomous agent that researches, compares, budgets, and executes Mac system purchases.',
    avatarUrl: 'https://apple.com/avatar.png',
    icon: 'Laptop',
    color: 'blue',
    model: 'gpt-4o',
    temperature: 0.2,
    systemInstructions:
      'You are the authorized Buy a Mac System procurement specialist. Search approved Apple product catalogs, compare specs, check inventory, and request confirmation before placing orders.',
    welcomeMessage: 'Hello! I can help you select and purchase the ideal Mac system within your budget.',
    tools: JSON.stringify([
      { id: 'search_mac_catalog', name: 'search_mac_catalog', description: 'Search Apple hardware catalog' },
      { id: 'compare_specs', name: 'compare_specs', description: 'Compare M3 / M4 chip benchmarks and memory' },
      { id: 'check_inventory', name: 'check_inventory', description: 'Check authorized vendor stock' },
      { id: 'execute_purchase', name: 'execute_purchase', description: 'Submit order for purchase approval' },
    ]),
    configuration: {
      budgetMax: 5000,
      currency: 'USD',
      currentVersion: 1,
      versions: [
        {
          version: 1,
          snapshot: {
            model: 'gpt-4o',
            temperature: 0.2,
            instructions: 'You are the authorized Buy a Mac System procurement specialist.',
            tools: ['search_mac_catalog', 'compare_specs', 'check_inventory', 'execute_purchase'],
          },
        },
      ],
      approvalRules: {
        actionsRequiringApproval: ['execute_purchase'],
      },
    },
    isActive: true,
  };

  const sampleDeployment = {
    id: 'dep_mac_1',
    agentId: macAgentId,
    workspaceId,
    name: 'Buy a Mac System Production Deployment',
    environment: 'PRODUCTION',
    target: 'WIDGET',
    status: 'ACTIVE',
    versionNumber: 1,
    publicKey: 'ot_pub_valid_key',
    allowedOrigins: ['https://shop.company.com'],
    widgetConfig: {
      appearance: {
        title: 'Mac Procurement Assistant',
        subtitle: 'Authorized Apple Enterprise Store',
        primaryColor: '#0071e3',
        theme: 'system',
        position: 'bottom-right',
        avatarUrl: '',
      },
      behavior: {
        greeting: 'How can I assist you with your Mac purchase?',
        suggestedPrompts: [
          'Find MacBook Pro 16" with 64GB RAM',
          'Compare M3 Pro vs M3 Max for Xcode builds',
        ],
        allowAttachments: false,
        enableFeedback: true,
        enableSpeech: false,
      },
    },
    securityConfig: {
      allowedTools: ['search_mac_catalog', 'compare_specs', 'check_inventory', 'execute_purchase'],
      rateLimitPerMinute: 60,
      requireAuthentication: false,
      sensitiveActionsRequireApproval: true,
    },
    agent: macAgentRecord,
    _count: { sessions: 1, webhooks: 1 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const validApiKeySecret = 'ot_live_a1b2c3d4e5f6g7h8i9j0k1l2';
  const validApiKeyHash = createHash('sha256').update(validApiKeySecret).digest('hex');

  let prisma: any;
  let aiRuntime: any;
  let currentDeployment: any;
  let deploymentService: AgentDeploymentService;
  let sessionService: AgentSessionService;
  let webhookService: AgentDeploymentWebhookService;
  let runtimeBridge: AgentRuntimeBridgeService;
  let publicController: AgentPublicController;
  let _deploymentController: AgentDeploymentController;

  beforeEach(() => {
    vi.clearAllMocks();

    currentDeployment = {
      ...sampleDeployment,
      status: 'ACTIVE',
      agent: macAgentRecord,
      _count: { sessions: 1, webhooks: 1 },
    };

    prisma = {
      aIAgent: {
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where.id === macAgentId) return Promise.resolve(macAgentRecord);
          return Promise.resolve(null);
        }),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === macAgentId) return Promise.resolve(macAgentRecord);
          return Promise.resolve(null);
        }),
      },
      agentDeployment: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'dep_mac_1',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          }),
        ),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (
            where?.id === 'dep_mac_1' ||
            where?.agentId === macAgentId ||
            where?.publicKey === 'ot_pub_valid_key'
          ) {
            return Promise.resolve(currentDeployment);
          }
          return Promise.resolve(null);
        }),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where?.id === 'dep_mac_1' || where?.publicKey === 'ot_pub_valid_key') {
            return Promise.resolve(currentDeployment);
          }
          return Promise.resolve(null);
        }),
        findMany: vi.fn().mockResolvedValue([currentDeployment]),
        update: vi.fn().mockImplementation(({ data }) => {
          Object.assign(currentDeployment, data);
          return Promise.resolve({
            ...currentDeployment,
            updatedAt: new Date(),
          });
        }),
        delete: vi.fn().mockResolvedValue({ id: 'dep_mac_1' }),
      },
      agentDeploymentSession: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'sess_mac_100',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          }),
        ),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where.id === 'sess_mac_100') {
            return Promise.resolve({
              id: 'sess_mac_100',
              deploymentId: 'dep_mac_1',
              agentId: macAgentId,
              sessionToken: 'ot_sess_valid_token',
              messages: [
                {
                  id: 'msg_1',
                  role: 'user',
                  content: 'Looking for a MacBook Pro for heavy iOS development',
                  timestamp: new Date().toISOString(),
                },
              ],
              status: 'ACTIVE',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          return Promise.resolve(null);
        }),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.id === 'sess_mac_100') {
            return Promise.resolve({
              id: 'sess_mac_100',
              deploymentId: 'dep_mac_1',
              agentId: macAgentId,
              sessionToken: 'ot_sess_valid_token',
              messages: [
                {
                  id: 'msg_1',
                  role: 'user',
                  content: 'Looking for a MacBook Pro for heavy iOS development',
                  timestamp: new Date().toISOString(),
                },
              ],
              deployment: {
                ...sampleDeployment,
                agent: macAgentRecord,
              },
              status: 'ACTIVE',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          return Promise.resolve(null);
        }),
        update: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'sess_mac_100',
            ...data,
            updatedAt: new Date(),
          }),
        ),
      },
      agentDeploymentWebhook: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'wh_mac_1',
            deploymentId: 'dep_mac_1',
            url: 'https://shop.company.com/webhooks/procurement',
            secret: 'mac_wh_secret_xyz',
            events: ['agent.run.completed', 'agent.approval.requested'],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
        findFirst: vi.fn().mockResolvedValue({
          id: 'wh_mac_1',
          deploymentId: 'dep_mac_1',
          url: 'https://shop.company.com/webhooks/procurement',
          secret: 'mac_wh_secret_xyz',
          events: ['agent.run.completed', 'agent.approval.requested'],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'wh_mac_1',
          deploymentId: 'dep_mac_1',
          url: 'https://shop.company.com/webhooks/procurement',
          secret: 'mac_wh_secret_xyz',
          events: ['agent.run.completed', 'agent.approval.requested'],
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'wh_mac_2',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          }),
        ),
        delete: vi.fn().mockResolvedValue({ id: 'wh_mac_1' }),
      },
      agentWebhookDelivery: {
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'deliv_1',
            createdAt: new Date(),
            ...data,
          }),
        ),
        findMany: vi.fn().mockResolvedValue([]),
      },
      agentApiKey: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockImplementation(({ where }) => {
          if (where.keyHash === validApiKeyHash) {
            return Promise.resolve({
              id: 'key_mac_1',
              agentId: macAgentId,
              workspaceId,
              name: 'E-commerce API Integration Key',
              keyPrefix: 'ot_live_a1b2',
              keyHash: validApiKeyHash,
              scopes: ['execute', 'read'],
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          return Promise.resolve(null);
        }),
        findUnique: vi.fn().mockImplementation(({ where }) => {
          if (where.keyHash === validApiKeyHash) {
            return Promise.resolve({
              id: 'key_mac_1',
              agentId: macAgentId,
              workspaceId,
              name: 'E-commerce API Integration Key',
              keyPrefix: 'ot_live_a1b2',
              keyHash: validApiKeyHash,
              scopes: ['execute', 'read'],
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
          return Promise.resolve(null);
        }),
        create: vi.fn().mockImplementation(({ data }) =>
          Promise.resolve({
            id: 'key_mac_1',
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data,
          }),
        ),
        update: vi.fn().mockResolvedValue({}),
        delete: vi.fn().mockResolvedValue({}),
      },
      aIExecution: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'exec_mac_1',
            status: 'COMPLETED',
            totalTokens: 650,
            durationMs: 420,
            createdAt: new Date(),
          },
        ]),
      },
    };

    aiRuntime = {
      executeTurn: vi.fn().mockResolvedValue({
        result:
          'I found the 16-inch MacBook Pro (M3 Max, 64GB RAM, 1TB SSD) in Space Black for $3,499. Inventory confirmed in 3 regional warehouses.',
        tools: [
          {
            name: 'search_mac_catalog',
            input: { query: 'MacBook Pro 16 M3 Max 64GB' },
            output: { model: 'MacBook Pro 16', chip: 'M3 Max', memory: '64GB', price: 3499 },
            status: 'SUCCESS',
            durationMs: 120,
          },
          {
            name: 'check_inventory',
            input: { sku: 'MBP16-M3MAX-64-1TB' },
            output: { inStock: true, quantity: 42 },
            status: 'SUCCESS',
            durationMs: 85,
          },
        ],
      }),
    };

    deploymentService = new AgentDeploymentService(prisma);
    sessionService = new AgentSessionService(prisma, deploymentService);
    webhookService = new AgentDeploymentWebhookService(prisma);
    runtimeBridge = new AgentRuntimeBridgeService(
      prisma,
      aiRuntime,
      sessionService,
      webhookService,
    );

    publicController = new AgentPublicController(
      deploymentService,
      sessionService,
      runtimeBridge,
    );

    _deploymentController = new AgentDeploymentController(
      deploymentService,
      webhookService,
    );
  });

  describe('1. Agent Publishing and Version Snapshots', () => {
    it('creates an immutable snapshot when publishing "Buy a Mac System" agent', async () => {
      const published = await deploymentService.publishVersion(
        workspaceId,
        'dep_mac_1',
        1,
      );

      expect(published).toBeDefined();
      expect(published.versionNumber).toBe(1);
      expect(published.status).toBe('ACTIVE');
      expect(prisma.agentDeployment.update).toHaveBeenCalled();
    });

    it('rolls back to a previous version snapshot safely', async () => {
      const rolledBack = await deploymentService.rollbackDeployment(
        workspaceId,
        'dep_mac_1',
        1,
        'Rollback requested due to catalog API update',
      );

      expect(rolledBack).toBeDefined();
      expect(rolledBack.versionNumber).toBe(1);
      expect(prisma.agentDeployment.update).toHaveBeenCalled();
    });

    it('suspends and resumes deployment targets cleanly', async () => {
      const suspended = await deploymentService.setDeploymentStatus(
        workspaceId,
        'dep_mac_1',
        'SUSPENDED',
      );
      expect(suspended.status).toBe('SUSPENDED');

      const resumed = await deploymentService.setDeploymentStatus(
        workspaceId,
        'dep_mac_1',
        'ACTIVE',
      );
      expect(resumed.status).toBe('ACTIVE');
    });
  });

  describe('2. Public Session Initialization & Security', () => {
    it('initializes a public session for the website widget with valid public key', async () => {
      const initResult = await sessionService.initSession(
        'ot_pub_valid_key',
        { referrer: 'https://shop.company.com/workstations' },
        'https://shop.company.com',
      );

      expect(initResult.sessionToken).toBeDefined();
      expect(initResult.sessionId).toBe('sess_mac_100');
      expect(initResult.sessionToken).toMatch(/^ot_sess_/);
      expect(initResult.deployment.agentName).toBe('Buy a Mac System');
      expect(initResult.deployment.widgetConfig.appearance.title).toBe('Mac Procurement Assistant');
    });

    it('rejects session initialization when origin is disallowed by securityConfig', async () => {
      await expect(
        sessionService.initSession(
          'ot_pub_valid_key',
          {},
          'https://unauthorized-phishing-site.com',
        ),
      ).rejects.toThrow('Origin "https://unauthorized-phishing-site.com" is not authorized');
    });

    it('appends and caps session message history', async () => {
      const messages = await sessionService.appendMessage('sess_mac_100', {
        id: 'msg_2',
        role: 'user',
        content: 'Need specs for 14-inch vs 16-inch thermal throttling',
        timestamp: new Date().toISOString(),
      });

      expect(messages).toBeDefined();
      expect(prisma.agentDeploymentSession.update).toHaveBeenCalled();
    });
  });

  describe('3. Execution Runtime: Research & Multi-Tool Calls', () => {
    it('executes a product research query using the shared runtime engine', async () => {
      const runResult = await runtimeBridge.execute({
        agentId: macAgentId,
        prompt: 'Find me the top recommended MacBook Pro for iOS development within $4000',
        deploymentId: 'dep_mac_1',
      });

      expect(runResult.status).toBe('COMPLETED');
      expect(runResult.output).toContain('MacBook Pro');
      expect(runResult.toolExecutions).toHaveLength(2);
      expect(runResult.toolExecutions[0].toolName).toBe('search_mac_catalog');
      expect(runResult.toolExecutions[1].toolName).toBe('check_inventory');
      expect(aiRuntime.executeTurn).toHaveBeenCalled();
    });
  });

  describe('4. Human-in-the-Loop Approval Safeguards', () => {
    it('pauses execution and enters WAITING_FOR_APPROVAL when high-impact purchase is requested', async () => {
      aiRuntime.executeTurn.mockResolvedValueOnce({
        result: 'Ready to order 1x MacBook Pro 16" M3 Max 64GB Space Black for $3,499.00.',
        tools: [
          {
            name: 'execute_purchase',
            input: {
              item: 'MacBook Pro 16" M3 Max',
              price: 3499,
              vendor: 'Apple Enterprise Direct',
              poNumber: 'PO-2026-MAC-881',
            },
            status: 'PENDING_APPROVAL',
            durationMs: 15,
          },
        ],
      });

      const runResult = await runtimeBridge.execute({
        agentId: macAgentId,
        prompt: 'Please proceed and place the order for this MacBook Pro with PO-2026-MAC-881',
        deploymentId: 'dep_mac_1',
      });

      expect(runResult.status).toBe('WAITING_FOR_APPROVAL');
      expect(runResult.awaitingApproval).toBeDefined();
      expect(runResult.awaitingApproval?.action).toBe('execute_purchase');
      expect(runResult.awaitingApproval?.parameters).toEqual({
        item: 'MacBook Pro 16" M3 Max',
        price: 3499,
        vendor: 'Apple Enterprise Direct',
        poNumber: 'PO-2026-MAC-881',
      });
    });

    it('does not pretend to resume a paused run: there is no unauthenticated approve endpoint or fake confirmation', () => {
      expect((runtimeBridge as unknown as Record<string, unknown>)['submitApproval']).toBeUndefined();
      expect((publicController as unknown as Record<string, unknown>)['approveAction']).toBeUndefined();
    });
  });

  describe('5. REST API Headless Execution & API Key Validation', () => {
    it('executes headlessly via REST API controller with valid API key', async () => {
      const response = await publicController.executeAgent(
        macAgentId,
        undefined,
        undefined,
        validApiKeySecret,
        {
          input: 'Check Apple store stock for Mac Studio M2 Ultra',
          context: { channel: 'ci-pipeline' },
        },
      );

      expect(response).toBeDefined();
      expect(response.status).toBe('COMPLETED');
      expect(response.output).toBeDefined();
    });

    it('rejects execution when invalid API key is provided', async () => {
      prisma.agentApiKey.findUnique.mockResolvedValueOnce(null);

      await expect(
        publicController.executeAgent(
          macAgentId,
          undefined,
          undefined,
          'ot_live_invalid_bad_key',
          { input: 'Check stock' },
        ),
      ).rejects.toThrow('Invalid or expired API key');
    });
  });

  describe('6. Outbound Webhook Verification & HMAC Signing', () => {
    it('executes manual webhook test delivery and logs delivery', async () => {
      // Mock global fetch for webhook delivery
      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"received":true}'),
      }) as any;

      try {
        const result = await webhookService.testWebhook('wh_mac_1');

        expect(result).toBeDefined();
        expect(prisma.agentWebhookDelivery.create).toHaveBeenCalled();
        const deliveryCall = prisma.agentWebhookDelivery.create.mock.calls[0][0];
        expect(deliveryCall.data.event).toBe('agent.run.completed');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });

  describe('6b. Tenant scoping of webhooks and API keys', () => {
    it('does not reach a webhook through a deployment it does not belong to', async () => {
      prisma.agentDeploymentWebhook.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      await expect(webhookService.testWebhook('wh_mac_1', 'dep_other')).rejects.toThrow('Webhook not found');
      await expect(webhookService.deleteWebhook('wh_mac_1', 'dep_other')).rejects.toThrow('Webhook not found');
      expect(prisma.agentDeploymentWebhook.findFirst).toHaveBeenCalledWith({
        where: { id: 'wh_mac_1', deploymentId: 'dep_other' },
      });
    });

    it('refuses webhook routes for a deployment outside the workspace or agent', async () => {
      prisma.agentDeployment.findFirst.mockResolvedValueOnce(null);

      await expect(
        deploymentService.assertDeployment(workspaceId, macAgentId, 'dep_of_another_tenant'),
      ).rejects.toThrow('Deployment not found');
      expect(prisma.agentDeployment.findFirst).toHaveBeenCalledWith({
        where: { id: 'dep_of_another_tenant', workspaceId, agentId: macAgentId },
        select: { id: true },
      });
    });

    it('lists API keys without any secret material', async () => {
      prisma.agentApiKey.findMany = vi.fn().mockResolvedValue([
        {
          id: 'key_1',
          workspaceId,
          name: 'CI',
          keyPrefix: 'ot_live_abcdef0',
          keyHash: 'must-not-leak',
          scopes: ['agent:execute'],
          lastUsedAt: null,
          expiresAt: null,
          isActive: true,
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ]);

      const keys = await deploymentService.listApiKeys(workspaceId);

      expect(keys).toHaveLength(1);
      expect(JSON.stringify(keys)).not.toContain('must-not-leak');
      expect(keys[0]).toMatchObject({ id: 'key_1', keyPrefix: 'ot_live_abcdef0', isActive: true });
    });

    it('reports an expired key as inactive', async () => {
      prisma.agentApiKey.findMany = vi.fn().mockResolvedValue([
        {
          id: 'key_old',
          workspaceId,
          name: 'Old',
          keyPrefix: 'ot_live_000000',
          scopes: [],
          lastUsedAt: null,
          expiresAt: new Date(Date.now() - 1000),
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const [key] = await deploymentService.listApiKeys(workspaceId);

      expect(key.isActive).toBe(false);
    });

    it('revokes only within the caller workspace, and 404s on a foreign key', async () => {
      prisma.agentApiKey.updateMany = vi.fn().mockResolvedValue({ count: 1 });
      await deploymentService.revokeApiKey(workspaceId, 'key_1');
      expect(prisma.agentApiKey.updateMany).toHaveBeenCalledWith({
        where: { id: 'key_1', workspaceId },
        data: { isActive: false },
      });

      prisma.agentApiKey.updateMany = vi.fn().mockResolvedValue({ count: 0 });
      await expect(deploymentService.revokeApiKey(workspaceId, 'key_of_another_tenant')).rejects.toThrow(
        'API key not found',
      );
    });
  });

  describe('6c. Deployment analytics come from recorded runs', () => {
    const at = (hoursAgo: number) => new Date(Date.now() - hoursAgo * 3_600_000);
    const viaSession = { prompt: 'Where is my order?', deploymentId: 'dep_mac_1', deploymentChannel: 'session' };
    const viaApiKey = { prompt: 'Summarise ticket 42', deploymentChannel: 'api_key' };
    const runs = [
      { id: 'e1', status: 'COMPLETED', startedAt: at(1), latencyMs: 1000, tokensUsed: 100, totalCost: 0.001, toolCalls: [{ name: 'search_docs' }, { name: 'search_docs' }], errorsJson: null, stateJson: viaSession },
      { id: 'e2', status: 'COMPLETED', startedAt: at(2), latencyMs: 3000, tokensUsed: 300, totalCost: 0.003, toolCalls: [{ name: 'create_task' }], errorsJson: null, stateJson: viaSession },
      { id: 'e3', status: 'FAILED', startedAt: at(30), latencyMs: 500, tokensUsed: 0, totalCost: 0, toolCalls: [], errorsJson: { message: 'Request timed out after 30s' }, stateJson: viaApiKey },
      { id: 'e4', status: 'WAITING_APPROVAL', startedAt: at(50), latencyMs: 800, tokensUsed: 50, totalCost: 0.0005, toolCalls: [], errorsJson: null, stateJson: viaSession },
    ];

    beforeEach(() => {
      prisma.agentDeploymentSession.count = vi.fn().mockResolvedValue(2);
      prisma.aIExecution = { findMany: vi.fn().mockResolvedValue(runs) };
      prisma.approvalRequest = {
        findMany: vi.fn().mockResolvedValue([{ state: 'APPROVED' }, { state: 'REJECTED' }, { state: 'PENDING' }]),
        count: vi.fn().mockResolvedValue(1),
      };
    });

    it('counts, averages and costs only what was recorded', async () => {
      const a = await deploymentService.getDeploymentAnalytics(workspaceId, 'dep_mac_1', '7d');

      expect(a).toMatchObject({
        totalRuns: 4,
        successfulRuns: 2,
        failedRuns: 1,
        successRate: 67,
        avgLatencyMs: Math.round((1000 + 3000 + 500 + 800) / 4),
        totalTokens: 450,
        activeSessions: 2,
        approvalsRequested: 3,
        approvalsApproved: 1,
        approvalsRejected: 1,
        toolExecutionsCount: 3,
      });
      expect(a.estimatedCost).toBeCloseTo(0.0045, 4);
      expect(a.topTools[0]).toEqual({ name: 'search_docs', count: 2 });
      expect(a.recentErrorCategories).toEqual([{ category: 'Timeout', count: 1 }]);
      expect(a.approvalsPending).toBe(1);
      expect(a.channels).toEqual([
        { channel: 'session', count: 3 },
        { channel: 'api_key', count: 1 },
      ]);
      expect(a.recentRuns.map((r) => r.id)).toEqual(['e1', 'e2', 'e3', 'e4']);
      expect(a.recentRuns[0]).toMatchObject({ channel: 'session', prompt: 'Where is my order?' });
    });

    it('counts only traffic through the deployment, not Studio test runs', async () => {
      await deploymentService.getDeploymentAnalytics(workspaceId, 'dep_mac_1', '7d');
      const where = prisma.aIExecution.findMany.mock.calls[0][0].where;
      expect(where.OR).toEqual([
        { stateJson: { path: ['deploymentId'], equals: 'dep_mac_1' } },
        { stateJson: { path: ['deploymentChannel'], equals: 'api_key' } },
      ]);
    });

    it('buckets runs hourly for a day and daily for longer periods, keeping quiet buckets', async () => {
      const day = await deploymentService.getDeploymentAnalytics(workspaceId, 'dep_mac_1', '24h');
      expect(day.series).toHaveLength(24);
      expect(day.series.reduce((n, b) => n + b.runs, 0)).toBe(2);

      const week = bucketRuns(runs, '7d', Date.now());
      expect(week).toHaveLength(7);
      expect(week.reduce((n, b) => n + b.runs, 0)).toBe(4);
      expect(week.reduce((n, b) => n + b.failed, 0)).toBe(1);
    });

    it('scopes the run query to this workspace, this agent and the period', async () => {
      await deploymentService.getDeploymentAnalytics(workspaceId, 'dep_mac_1', '24h');
      const where = prisma.aIExecution.findMany.mock.calls[0][0].where;
      expect(where.workspaceId).toBe(workspaceId);
      expect(where.agentId).toBe(macAgentId);
      expect(Date.now() - where.startedAt.gte.getTime()).toBeGreaterThan(23 * 3_600_000);
      expect(Date.now() - where.startedAt.gte.getTime()).toBeLessThan(25 * 3_600_000);
    });

    it('reports zeros, not invented figures, when nothing has run', async () => {
      prisma.aIExecution.findMany = vi.fn().mockResolvedValue([]);
      const a = await deploymentService.getDeploymentAnalytics(workspaceId, 'dep_mac_1');
      expect(a).toMatchObject({ totalRuns: 0, successRate: 0, avgLatencyMs: 0, approvalsRequested: 0, totalTokens: 0, estimatedCost: 0 });
      expect(a.recentErrorCategories).toEqual([]);
      expect(prisma.approvalRequest.findMany).not.toHaveBeenCalled();
    });

    it('falls back to 30 days for an unrecognised period', () => {
      expect(periodToMs('7d')).toBe(7 * 86_400_000);
      expect(periodToMs('24h')).toBe(24 * 3_600_000);
      expect(periodToMs('forever')).toBe(30 * 86_400_000);
    });
  });

  describe('6d. Embed page and SDK safety', () => {
    const send = () => {
      const res: any = { setHeader: vi.fn(), send: vi.fn() };
      return res;
    };

    it('refuses an embed URL whose ids could break out of an HTML attribute', () => {
      expect(() => publicController.getEmbedHtml('a"><script>alert(1)</script>', 'ot_pub_x', 'dark', send())).toThrow(
        'plain identifiers',
      );
      expect(() => publicController.getEmbedHtml('agent_1', 'k" onload="x', 'dark', send())).toThrow('plain identifiers');
      expect(() => publicController.getEmbedHtml(undefined as never, 'ot_pub_x', 'dark', send())).toThrow('plain identifiers');
    });

    it('only ever renders the light or dark theme', () => {
      const res = send();
      publicController.getEmbedHtml('agent_1', 'ot_pub_x', '"><img src=x onerror=1>', res);
      const html = res.send.mock.calls[0][0] as string;
      expect(html).toContain('data-theme="dark"');
      expect(html).not.toContain('onerror');
    });

    it('the SDK applies saved branding and never offers a client-side approve button', () => {
      const res = send();
      publicController.getWidgetSdk(res);
      const sdk = res.send.mock.calls[0][0] as string;
      expect(sdk).toContain('applyBranding');
      expect(sdk).toContain('appearance.suggestedPrompts');
      expect(sdk).toContain('Waiting for approval');
      expect(sdk).not.toContain('ot-approve-btn');
      expect(sdk).not.toContain('Approved by user');
    });
  });

  describe('6e. The public surface authenticates itself', () => {
    it('is exempt from the platform login guard, which embeds and customers\' backends have no account for', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, AgentPublicController)).toBe(true);
    });

    it('does not echo a provider credential error, which can quote part of the key, to an API caller', () => {
      const leaked = publicRunError("Incorrect API key provided: nvapi-xa*********. You can find your API key at https://platform.openai.com");
      expect(leaked).not.toContain('nvapi');
      expect(leaked).toContain('provider credentials');
      expect(publicRunError('The tool call timed out')).toBe('The tool call timed out');
    });

    it('keeps the deployment management routes behind the login guard', () => {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, AgentDeploymentController)).toBeUndefined();
    });

    it('refuses session reads and writes without that session\'s own token', async () => {
      await expect(publicController.getSessionMessages('sess_mac_100')).rejects.toThrow('session token is required');
      await expect(publicController.resetSession('sess_mac_100', undefined, 'Bearer not-a-session-token')).rejects.toThrow(
        'session token is required',
      );
      await expect(publicController.getSession('sess_mac_100')).rejects.toThrow('session token is required');
      await expect(
        publicController.sendSessionMessage('sess_mac_100', undefined, undefined, { message: 'hi', stream: false }),
      ).rejects.toThrow('session token is required');
    });

    const sessionRow = () => ({
      id: 'sess_mac_100',
      deploymentId: 'dep_mac_1',
      agentId: macAgentId,
      sessionToken: 'ot_sess_valid_token',
      status: 'ACTIVE',
      expiresAt: new Date(Date.now() + 3_600_000),
      messages: [{ id: 'm1', role: 'assistant', content: 'Hello', timestamp: new Date().toISOString() }],
      deployment: { ...sampleDeployment, status: 'ACTIVE', agent: macAgentRecord },
    });

    it('refuses a token that belongs to a different session', async () => {
      prisma.agentDeploymentSession.findUnique = vi.fn().mockResolvedValue(sessionRow());
      await expect(publicController.getSessionMessages('sess_other', 'ot_sess_valid_token')).rejects.toThrow('mismatch');
    });

    it('serves a session its own messages, to its own token', async () => {
      prisma.agentDeploymentSession.findUnique = vi
        .fn()
        .mockImplementation(({ where }: { where: { sessionToken?: string; id?: string } }) =>
          Promise.resolve(where.sessionToken === 'ot_sess_valid_token' || where.id === 'sess_mac_100' ? sessionRow() : null),
        );
      const messages = await publicController.getSessionMessages('sess_mac_100', 'ot_sess_valid_token');
      expect(messages).toHaveLength(1);
      expect(messages[0].content).toBe('Hello');
    });

    it('needs a workspace API key to read or cancel a run', async () => {
      await expect(publicController.getRun('run_1')).rejects.toThrow('valid API key');
      await expect(publicController.cancelRun('run_1', 'ot_live_wrong')).rejects.toThrow('valid API key');
    });

    it('never reports a run it does not know about as completed', async () => {
      prisma.agentApiKey.findUnique.mockResolvedValueOnce({
        id: 'key_1',
        workspaceId,
        isActive: true,
        expiresAt: null,
        keyHash: 'x',
      });
      prisma.aIExecution = { findFirst: vi.fn().mockResolvedValue(null) };
      await expect(publicController.getRun('run_does_not_exist', 'ot_live_valid')).rejects.toThrow('Run not found');
    });

    it('lets a run be cancelled only from the workspace that started it', async () => {
      runtimeBridge['activeRuns'].set('run_ws_a', {
        runId: 'run_ws_a',
        workspaceId: 'ws_a',
        status: 'RUNNING',
        listeners: [],
        abortController: new AbortController(),
      });
      expect(await runtimeBridge.cancelRun('run_ws_a', 'ws_b')).toBe(false);
      expect(runtimeBridge.getRunState('run_ws_a', 'ws_b')).toBeNull();
      expect(await runtimeBridge.cancelRun('run_ws_a', 'ws_a')).toBe(true);
    });
  });

  describe('7. Web Component & SDK Distribution', () => {
    it('serves the lightweight isolated Web Component SDK bundle', () => {
      const mockRes: any = {
        setHeader: vi.fn(),
        send: vi.fn(),
      };

      publicController.getWidgetSdk(mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'application/javascript; charset=utf-8',
      );
      expect(mockRes.send).toHaveBeenCalled();
      const scriptBody = mockRes.send.mock.calls[0][0];
      expect(scriptBody).toContain('customElements.define');
      expect(scriptBody).toContain('onetab-agent');
      expect(scriptBody).toContain('attachShadow');
    });

    it('serves the isolated iframe embed page', () => {
      const mockRes: any = {
        setHeader: vi.fn(),
        send: vi.fn(),
      };

      publicController.getEmbedHtml(macAgentId, 'ot_pub_valid_key', 'system', mockRes);

      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
      expect(mockRes.send).toHaveBeenCalled();
      const htmlBody = mockRes.send.mock.calls[0][0];
      expect(htmlBody).toContain('Onetab AI Agent');
      expect(htmlBody).toContain('agent-widget.js');
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { AgentDeploymentService } from './agent-deployment.service.js';
import { AgentSessionService } from './agent-session.service.js';
import { AgentDeploymentWebhookService } from './agent-webhook.service.js';
import { AgentRuntimeBridgeService } from './agent-runtime-bridge.service.js';
import { AgentPublicController } from './agent-public.controller.js';
import { AgentDeploymentController } from './agent-deployment.controller.js';

describe('Universal AI Agent Deployment System', () => {
  const workspaceId = 'ws_apple_procurement';
  const userId = 'usr_sarah_buyer';
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
  let deploymentController: AgentDeploymentController;

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

    deploymentController = new AgentDeploymentController(
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

    it('resumes and completes execution when human approval is submitted', async () => {
      const approvalRunId = 'run_approval_test_42';
      runtimeBridge['activeRuns'].set(approvalRunId, {
        runId: approvalRunId,
        status: 'WAITING_FOR_APPROVAL',
        listeners: [],
        abortController: new AbortController(),
      });

      const decisionResult = await runtimeBridge.submitApproval(approvalRunId, {
        decision: 'APPROVED',
        approvedBy: 'procurement-manager@company.com',
        comments: 'Within Q4 engineering budget allocation',
      });

      expect(decisionResult.status).toBe('COMPLETED');
      expect(decisionResult.output).toContain('Purchase confirmed');
      expect(decisionResult.toolExecutions[0].status).toBe('SUCCESS');
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
      expect(htmlBody).toContain('OneTab AI Agent');
      expect(htmlBody).toContain('agent-widget.js');
    });
  });
});

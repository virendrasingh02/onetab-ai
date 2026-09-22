import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIRuntimeService } from './ai-runtime.service.js';

describe('AIRuntimeService', () => {
  let service: AIRuntimeService;
  let prisma: any;
  let aiService: any;
  let credentialService: any;
  let mcpRegistry: any;
  let integrationTools: any;
  let integrationsService: any;
  let approvals: any;
  let creditService: any;
  let realtime: any;

  beforeEach(() => {
    prisma = {
      aIAgent: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      coworkerAgent: {
        findFirst: vi.fn(),
      },
      agentExecutionLog: {
        create: vi.fn().mockResolvedValue({ id: 'log_1' }),
      },
      channelCoworker: {
        findFirst: vi.fn(),
      },
      projectCoworker: {
        findFirst: vi.fn(),
      },
      creditAccount: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      aIMemory: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    aiService = {
      chat: vi.fn().mockResolvedValue({
        message: { content: 'Executed successfully', toolCalls: [] },
        usage: { totalTokens: 42 },
      }),
    };
    credentialService = {
      resolveCredential: vi.fn().mockResolvedValue({ apiKey: 'key_123', baseUrl: 'https://api.ai' }),
    };
    mcpRegistry = {
      getToolSchemas: vi.fn().mockReturnValue([]),
      getToolSchemasFor: vi.fn().mockReturnValue([]),
      getToolDefinitions: vi.fn().mockReturnValue([]),
      executeTool: vi.fn(),
    };
    integrationTools = {
      getToolsForEntity: vi.fn().mockResolvedValue([]),
    };
    integrationsService = {
      executeAction: vi.fn(),
    };
    approvals = {
      createForEntityAction: vi.fn().mockResolvedValue({ id: 'approval_1' }),
    };
    creditService = {
      deductCredits: vi.fn().mockResolvedValue(undefined),
    };
    realtime = {
      broadcastToWorkspace: vi.fn().mockResolvedValue(undefined),
    };

    service = new AIRuntimeService(
      prisma,
      aiService,
      credentialService,
      mcpRegistry,
      integrationTools,
      integrationsService,
      approvals,
      creditService,
      realtime,
    );
  });

  it('rejects an invalid entity type', async () => {
    prisma.aIAgent.findFirst.mockResolvedValue({
      id: 'e_1',
      name: 'Invalid Entity',
      type: 'invalid_type',
      isActive: true,
      workspace: { name: 'Test WS' },
    });

    await expect(
      service.executeTurn('ws_1', 'e_1', 'Hello'),
    ).rejects.toThrow(/Invalid entity type/);
  });

  it('executes an agent turn cleanly with task-focused system prompt', async () => {
    prisma.aIAgent.findFirst.mockResolvedValue({
      id: 'agent_1',
      name: 'Code Reviewer Agent',
      type: 'agent',
      role: 'Reviewer',
      systemPrompt: 'You review code thoroughly.',
      provider: 'nvidia',
      model: 'test-model',
      isActive: true,
      workspace: { name: 'Test WS' },
    });

    const result = await service.executeTurn('ws_1', 'agent_1', 'Review this PR');

    expect(result.type).toBe('agent');
    expect(result.entityName).toBe('Code Reviewer Agent');
    expect(result.result).toBe('Executed successfully');
    expect(prisma.agentExecutionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentId: 'agent_1',
          status: 'SUCCESS',
        }),
      }),
    );
  });

  it('executes a coworker turn with persona prompt and emits realtime events', async () => {
    prisma.aIAgent.findFirst.mockResolvedValue({
      id: 'coworker_1',
      name: 'Codey',
      type: 'coworker',
      role: 'Engineering Coworker',
      personality: 'Pragmatic and thorough',
      systemPrompt: 'You are Codey.',
      systemInstructions: 'Focus on clean architecture.',
      permissions: { allowActions: ['create_task'] },
      agentLinks: [],
      provider: 'nvidia',
      model: 'test-model',
      isActive: true,
      workspace: { name: 'Test WS' },
    });

    const result = await service.executeTurn('ws_1', 'coworker_1', 'Help me plan the refactor');

    expect(result.type).toBe('coworker');
    expect(result.entityName).toBe('Codey');
    expect(realtime.broadcastToWorkspace).toHaveBeenCalledWith(
      'ws_1',
      expect.objectContaining({ type: 'coworker.status_changed' }),
    );
  });

  it('allows coworker to delegate to linked agent via invokeAIEntity', async () => {
    prisma.aIAgent.findFirst
      .mockResolvedValueOnce({
        id: 'agent_rev',
        name: 'Code Reviewer Agent',
        type: 'agent',
        isActive: true,
      })
      .mockResolvedValueOnce({
        id: 'agent_rev',
        name: 'Code Reviewer Agent',
        type: 'agent',
        role: 'Reviewer',
        systemPrompt: 'Review code',
        provider: 'nvidia',
        isActive: true,
        workspace: { name: 'Test WS' },
      });

    prisma.coworkerAgent.findFirst.mockResolvedValue({
      id: 'link_1',
      coworkerId: 'codey_1',
      agentId: 'agent_rev',
    });

    const delegation = await service.invokeAIEntity({
      entityId: 'agent_rev',
      callerId: 'codey_1',
      workspaceId: 'ws_1',
      request: 'Check this function for null pointers',
    });

    expect(delegation.agentName).toBe('Code Reviewer Agent');
    expect(delegation.result).toBe('Executed successfully');
  });

  it('rejects delegation if target entity is not type agent', async () => {
    prisma.aIAgent.findFirst.mockResolvedValue({
      id: 'nova_1',
      name: 'Nova',
      type: 'coworker',
      isActive: true,
    });

    await expect(
      service.invokeAIEntity({
        entityId: 'nova_1',
        callerId: 'codey_1',
        workspaceId: 'ws_1',
        request: 'Review code',
      }),
    ).rejects.toThrow(/only 'agent' may be delegated to/);
  });

  it('rejects delegation if caller is not authorized/linked', async () => {
    prisma.aIAgent.findFirst.mockResolvedValue({
      id: 'agent_rev',
      name: 'Code Reviewer Agent',
      type: 'agent',
      isActive: true,
    });
    prisma.coworkerAgent.findFirst.mockResolvedValue(null);

    await expect(
      service.invokeAIEntity({
        entityId: 'agent_rev',
        callerId: 'unauthorized_coworker',
        workspaceId: 'ws_1',
        request: 'Review code',
      }),
    ).rejects.toThrow(/not authorized to delegate/);
  });

  it('blocks a run when the shared credit balance is depleted', async () => {
    prisma.creditAccount.findUnique.mockResolvedValue({ balance: 0 });
    prisma.aIAgent.findFirst.mockResolvedValue({
      id: 'agent_1',
      name: 'Code Reviewer Agent',
      type: 'agent',
      isActive: true,
      workspace: { name: 'Test WS' },
    });

    await expect(
      service.executeTurn('ws_1', 'agent_1', 'Review this PR'),
    ).rejects.toThrow(/credit/i);
    expect(aiService.chat).not.toHaveBeenCalled();
  });

  it('deducts credits from the estimated token cost after a successful run', async () => {
    prisma.aIAgent.findFirst.mockResolvedValue({
      id: 'agent_1',
      name: 'Code Reviewer Agent',
      type: 'agent',
      systemPrompt: 'Review code.',
      provider: 'nvidia',
      isActive: true,
      workspace: { name: 'Test WS' },
    });

    await service.executeTurn('ws_1', 'agent_1', 'Review this PR');

    expect(creditService.deductCredits).toHaveBeenCalledWith(
      'ws_1',
      expect.any(Number),
      'AGENT',
      'agent_1',
      expect.any(String),
    );
  });

  it('raises an approval request instead of executing a destructive integration action', async () => {
    prisma.aIAgent.findFirst.mockResolvedValue({
      id: 'agent_1',
      name: 'Ops Agent',
      type: 'agent',
      creatorId: 'user_1',
      systemPrompt: 'You manage infra.',
      provider: 'nvidia',
      isActive: true,
      workspace: { name: 'Test WS' },
    });
    integrationTools.getToolsForEntity.mockResolvedValue([
      {
        name: 'github_delete_repo',
        integrationId: 'integration_1',
        actionId: 'delete_repo',
        definition: {
          id: 'delete_repo',
          label: 'Delete repository',
          description: 'Permanently deletes a GitHub repository.',
          inputSchema: { type: 'object', properties: {} },
          permissionLevel: 'destructive',
          requiresConfirmation: true,
        },
        schema: {
          type: 'function',
          function: { name: 'github_delete_repo', description: 'Delete repository', parameters: {} },
        },
      },
    ]);
    aiService.chat
      .mockResolvedValueOnce({
        message: {
          content: '',
          toolCalls: [
            {
              id: 'call_1',
              function: { name: 'github_delete_repo', arguments: '{}' },
            },
          ],
        },
        usage: { totalTokens: 10 },
      })
      .mockResolvedValueOnce({
        message: { content: 'I have requested approval to delete the repo.', toolCalls: [] },
        usage: { totalTokens: 5 },
      });

    const result = await service.executeTurn('ws_1', 'agent_1', 'Delete the old repo');

    expect(approvals.createForEntityAction).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws_1',
        entityType: 'agent',
        entityId: 'agent_1',
        actionType: 'github_delete_repo',
      }),
    );
    expect(integrationsService.executeAction).not.toHaveBeenCalled();
    expect(result.tools[0]?.output).toEqual(
      expect.objectContaining({ pendingApproval: true, approvalId: 'approval_1' }),
    );
  });

  it('rejects delegation beyond the maximum depth', async () => {
    prisma.aIAgent.findFirst.mockResolvedValue({
      id: 'agent_rev',
      name: 'Code Reviewer Agent',
      type: 'agent',
      isActive: true,
    });
    prisma.coworkerAgent.findFirst.mockResolvedValue({
      id: 'link_1',
      coworkerId: 'codey_1',
      agentId: 'agent_rev',
    });

    await expect(
      service.invokeAIEntity({
        entityId: 'agent_rev',
        callerId: 'codey_1',
        workspaceId: 'ws_1',
        request: 'Check this function',
        delegationDepth: 3,
      }),
    ).rejects.toThrow(/Delegation depth limit/);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIRuntimeService } from './ai-runtime.service.js';

describe('AIRuntimeService', () => {
  let service: AIRuntimeService;
  let prisma: any;
  let aiService: any;
  let credentialService: any;
  let mcpRegistry: any;
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
      executeTool: vi.fn(),
    };
    realtime = {
      broadcastToWorkspace: vi.fn().mockResolvedValue(undefined),
    };

    service = new AIRuntimeService(
      prisma,
      aiService,
      credentialService,
      mcpRegistry,
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
});

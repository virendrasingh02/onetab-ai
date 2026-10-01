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
  let mcpServers: any;
  let knowledge: any;
  let events: any;

  beforeEach(() => {
    prisma = {
      aIAgent: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
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
      aIExecution: {
        create: vi.fn().mockResolvedValue({ id: 'exec_1' }),
        update: vi.fn().mockResolvedValue({}),
      },
      aIExecutionStep: {
        create: vi.fn().mockResolvedValue({}),
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

    mcpServers = {
      getToolBindings: vi.fn().mockResolvedValue([]),
      callTool: vi.fn(),
    };

    knowledge = {
      retrieve: vi.fn().mockResolvedValue([]),
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
      mcpServers,
      knowledge,
      (events = { emit: vi.fn() }),
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

  describe('workspace MCP server tools', () => {
    const binding = (toolName: string, requiresApproval: boolean) => ({
      functionName: `mcp_abc123_${toolName}`,
      connectionId: 'conn_abc123',
      connectionName: 'Docs server',
      toolName,
      requiresApproval,
      schema: { type: 'function', function: { name: `mcp_abc123_${toolName}`, parameters: {} } },
    });
    const agentWithTools = (tools: string[]) => ({
      id: 'agent_1',
      name: 'Research Agent',
      type: 'agent',
      creatorId: 'user_1',
      systemPrompt: 'Research.',
      provider: 'nvidia',
      tools: JSON.stringify(tools),
      isActive: true,
      workspace: { name: 'Test WS' },
    });
    const modelCalls = (name: string) =>
      aiService.chat
        .mockResolvedValueOnce({
          message: { content: '', toolCalls: [{ id: 'call_1', function: { name, arguments: '{"q":"x"}' } }] },
          usage: { totalTokens: 10 },
        })
        .mockResolvedValueOnce({ message: { content: 'Done.', toolCalls: [] }, usage: { totalTokens: 5 } });

    it('never offers MCP tools to an agent that did not opt in', async () => {
      prisma.aIAgent.findFirst.mockResolvedValue(agentWithTools(['search_docs']));
      await service.executeTurn('ws_1', 'agent_1', 'Hi');
      expect(mcpServers.getToolBindings).not.toHaveBeenCalled();
    });

    it('runs a read-only MCP tool directly and feeds its text back', async () => {
      prisma.aIAgent.findFirst.mockResolvedValue(agentWithTools(['mcp:conn_abc123']));
      mcpServers.getToolBindings.mockResolvedValue([binding('lookup', false)]);
      mcpServers.callTool.mockResolvedValue({ isError: false, text: 'found it', content: [] });
      modelCalls('mcp_abc123_lookup');

      const result = await service.executeTurn('ws_1', 'agent_1', 'Look it up');

      expect(mcpServers.callTool).toHaveBeenCalledWith('ws_1', 'conn_abc123', 'lookup', { q: 'x' });
      expect(result.tools[0]).toMatchObject({ status: 'success', output: 'found it' });
      expect(approvals.createForEntityAction).not.toHaveBeenCalled();
    });

    it('queues an approval for an MCP tool not declared read-only', async () => {
      prisma.aIAgent.findFirst.mockResolvedValue(agentWithTools(['mcp_abc123_delete_page']));
      mcpServers.getToolBindings.mockResolvedValue([binding('delete_page', true), binding('other', false)]);
      modelCalls('mcp_abc123_delete_page');

      const result = await service.executeTurn('ws_1', 'agent_1', 'Clean up');

      expect(mcpServers.callTool).not.toHaveBeenCalled();
      expect(approvals.createForEntityAction).toHaveBeenCalledWith(
        expect.objectContaining({
          requesterId: 'user_1',
          proposedPayload: expect.objectContaining({
            mcpConnectionId: 'conn_abc123',
            mcpToolName: 'delete_page',
          }),
        }),
      );
      expect(result.tools[0]?.output).toEqual(expect.objectContaining({ pendingApproval: true }));
      // Only the tool the agent named was offered to the model.
      const offered = aiService.chat.mock.calls[0][0].tools.map((t: any) => t.function.name);
      expect(offered).toEqual(['mcp_abc123_delete_page']);
    });
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

  describe('coworker collaboration and lifecycle', () => {
    const scheduler = {
      id: 'sched_1',
      name: 'Scheduler',
      type: 'coworker',
      role: 'Scheduling',
      systemPrompt: 'You are Scheduler.',
      systemInstructions: '',
      permissions: { allowActions: ['create_task'] },
      configuration: { coworkerType: 'scheduler' },
      agentLinks: [],
      creatorId: null,
      provider: 'nvidia',
      model: 'm',
      isActive: true,
      workspace: { name: 'WS' },
    };
    const tracker = {
      ...scheduler,
      id: 'track_1',
      name: 'Tracker',
      systemPrompt: 'You are Tracker.',
      configuration: { coworkerType: 'tracker' },
    };

    function toolCall(name: string, args: Record<string, unknown>) {
      return {
        message: { content: '', toolCalls: [{ id: 'call_1', function: { name, arguments: JSON.stringify(args) } }] },
        usage: { totalTokens: 1 },
      };
    }

    it('emits coworker.started and coworker.completed around a turn', async () => {
      prisma.aIAgent.findFirst.mockResolvedValue(scheduler);
      await service.executeTurn('ws_1', 'sched_1', 'Plan my week', { requesterId: 'user_1', source: 'chat' });
      const names = events.emit.mock.calls.map(([n]: [string]) => n);
      expect(names).toEqual(['coworker.started', 'coworker.completed']);
      expect(events.emit.mock.calls[1][1]).toEqual(
        expect.objectContaining({ coworkerId: 'sched_1', source: 'chat', result: 'Executed successfully' }),
      );
    });

    it('emits coworker.failed when the turn fails', async () => {
      prisma.aIAgent.findFirst.mockResolvedValue(scheduler);
      aiService.chat.mockRejectedValueOnce(new Error('model down'));
      await expect(service.executeTurn('ws_1', 'sched_1', 'Plan my week')).rejects.toThrow('model down');
      expect(events.emit).toHaveBeenCalledWith('coworker.failed', expect.objectContaining({ error: 'model down' }));
    });

    it('a creator-less coworker acts for the person asking', async () => {
      prisma.aIAgent.findFirst.mockResolvedValue(scheduler);
      mcpRegistry.getToolSchemasFor.mockReturnValue([{ type: 'function', function: { name: 'create_task' } }]);
      mcpRegistry.executeTool.mockResolvedValue({ created: true });
      aiService.chat
        .mockResolvedValueOnce(toolCall('create_task', { title: 'Book venue' }))
        .mockResolvedValue({ message: { content: 'Done', toolCalls: [] }, usage: { totalTokens: 1 } });
      await service.executeTurn('ws_1', 'sched_1', 'Add a task', { requesterId: 'user_1' });
      expect(mcpRegistry.executeTool).toHaveBeenCalledWith(
        'create_task',
        { title: 'Book venue' },
        expect.objectContaining({ actingUserId: 'user_1' }),
      );
    });

    it('offers a handoff only to template collaborators, and runs the other coworker for the same person', async () => {
      prisma.aIAgent.findFirst.mockImplementation((args: any) =>
        Promise.resolve(args.where.id === 'track_1' ? tracker : scheduler),
      );
      prisma.aIAgent.findMany.mockResolvedValue([
        { id: 'sched_1', name: 'Scheduler', configuration: scheduler.configuration },
        { id: 'track_1', name: 'Tracker', configuration: tracker.configuration },
        { id: 'other_1', name: 'Writer', configuration: {} },
      ]);
      aiService.chat
        .mockResolvedValueOnce(toolCall('handoff_to_coworker_track_1', { request: 'Watch launch for overdue tasks' }))
        .mockResolvedValueOnce({ message: { content: 'Monitoring set up', toolCalls: [] }, usage: { totalTokens: 1 } })
        .mockResolvedValue({ message: { content: 'Tracker is on it', toolCalls: [] }, usage: { totalTokens: 1 } });

      const result = await service.executeTurn('ws_1', 'sched_1', 'Keep an eye on the launch', {
        requesterId: 'user_1',
      });

      const offered = aiService.chat.mock.calls[0][0].tools.map((t: any) => t.function.name);
      expect(offered).toContain('handoff_to_coworker_track_1');
      expect(offered).not.toContain('handoff_to_coworker_other_1');
      expect(offered).not.toContain('handoff_to_coworker_sched_1');

      expect(result.tools[0]).toEqual(
        expect.objectContaining({ name: 'handoff_to_coworker_track_1', status: 'success' }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'coworker.handoff',
        expect.objectContaining({ fromCoworkerId: 'sched_1', toCoworkerId: 'track_1' }),
      );
      expect(events.emit).toHaveBeenCalledWith(
        'coworker.started',
        expect.objectContaining({ coworkerId: 'track_1', source: 'handoff', fromCoworkerId: 'sched_1' }),
      );
    });

    it('refuses a handoff to a coworker it was not offered', async () => {
      prisma.aIAgent.findFirst.mockResolvedValue(scheduler);
      aiService.chat
        .mockResolvedValueOnce(toolCall('handoff_to_coworker_other_1', { request: 'Write a post' }))
        .mockResolvedValue({ message: { content: 'ok', toolCalls: [] }, usage: { totalTokens: 1 } });
      const result = await service.executeTurn('ws_1', 'sched_1', 'Write');
      expect(result.tools[0].status).toBe('failed');
      expect(result.tools[0].error).toMatch(/does not work with that coworker/);
    });
  });
});

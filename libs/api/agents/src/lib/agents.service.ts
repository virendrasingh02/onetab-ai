import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { AICredentialService, AIInfrastructureService } from '@org/api-ai';
import type { AgentToolExecution } from '@org/types';
import type { AIChatMessage, AIProvider } from '@org/types';
import { MCPToolRegistryService } from './mcp-tool-registry.service.js';

/** Parses tool-call arguments defensively — a model occasionally emits
 *  truncated or malformed JSON, and a bad parse must fail the one call, not
 *  the whole turn. */
function parseToolArguments(json: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(json);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Agents are workspace property.
 *
 * Every method takes the workspace the guard authorised and filters on it,
 * including those addressing an agent by id — an id from the caller is not
 * evidence they may use it.
 */
@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIInfrastructureService,
    private readonly credentialService: AICredentialService,
    private readonly mcpRegistry: MCPToolRegistryService,
  ) {}

  async getAgents(workspaceId: string) {
    return this.prisma.aIAgent.findMany({
      where: { workspaceId },
      include: { schedules: true, _count: { select: { logs: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createAgent(
    workspaceId: string,
    creatorId: string,
    data: {
      name: string;
      role?: string;
      description?: string;
      avatarUrl?: string | null;
      systemPrompt?: string;
      provider?: string;
      model?: string;
      tools?: string[];
      isMarketplace?: boolean;
    },
  ) {
    return this.prisma.aIAgent.create({
      data: {
        workspaceId,
        creatorId,
        name: data.name,
        role: data.role ?? 'Assistant',
        description: data.description,
        avatarUrl: data.avatarUrl,
        systemPrompt: data.systemPrompt ?? 'You are an autonomous AI employee.',
        provider:
          data.provider ?? (process.env['AI_DEFAULT_PROVIDER'] || 'nvidia'),
        model:
          data.model ??
          (process.env['AI_DEFAULT_MODEL'] ||
            'nvidia/nemotron-3-super-120b-a12b'),
        tools: JSON.stringify(data.tools ?? ['search_docs', 'create_task']),
        // Set when deploying a catalogue template, so the card can tell a
        // pre-built agent from one built by hand.
        isMarketplace: data.isMarketplace ?? false,
      },
    });
  }

  async updateAgent(
    workspaceId: string,
    agentId: string,
    data: {
      name?: string;
      role?: string;
      description?: string;
      avatarUrl?: string | null;
      systemPrompt?: string;
      provider?: string;
      model?: string;
      tools?: string[];
      isActive?: boolean;
    },
  ) {
    await this.assertAgent(workspaceId, agentId);
    return this.prisma.aIAgent.update({
      where: { id: agentId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        ...(data.systemPrompt !== undefined
          ? { systemPrompt: data.systemPrompt }
          : {}),
        ...(data.provider !== undefined ? { provider: data.provider } : {}),
        ...(data.model !== undefined ? { model: data.model } : {}),
        ...(data.tools !== undefined
          ? { tools: JSON.stringify(data.tools) }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async deleteAgent(workspaceId: string, agentId: string): Promise<void> {
    await this.assertAgent(workspaceId, agentId);
    await this.prisma.aIAgent.delete({ where: { id: agentId } });
  }

  /**
   * Runs one agent turn, calling registered MCP tools when the model asks for
   * them, up to `MAX_TOOL_ROUNDS` round-trips.
   *
   * `onToolUpdate` is optional and exists for `AgentMatrixBridgeService`: it's
   * called with the full tool-execution trace so far every time an entry is
   * added or resolves, so a caller posting a live `mie.ai.agent` structured
   * message into a Matrix room can edit `tools[]` in place as each call
   * starts and finishes — this is the only thing that makes the "Tool
   * Execution UI" (`AIAgentMessageContent.tools`, already rendered by
   * `agent-message-card.tsx`) show anything real. A caller that doesn't need
   * live updates (the plain `execute` endpoint) simply omits it.
   */
  async executeAgent(
    workspaceId: string,
    agentId: string,
    promptText: string,
    onToolUpdate?: (tools: AgentToolExecution[]) => void | Promise<void>,
  ) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId },
    });
    if (!agent) throw new NotFoundException('Agent not found.');

    this.logger.log(`Executing AI Agent '${agent.name}' (${agent.id})`);
    const toolSchemas = this.mcpRegistry.getToolSchemas();
    const systemPrompt = `${agent.systemPrompt}\n\nWorkspace ID: ${workspaceId}`;

    const provider = (agent.provider as AIProvider) || 'nvidia';
    const cred = await this.credentialService.resolveCredential(provider, {
      workspaceId,
    });

    const messages: AIChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: promptText },
    ];
    const toolTrace: AgentToolExecution[] = [];
    /* Bounded so a model that keeps requesting tools cannot loop forever —
       four round-trips is generous for the built-in tool set (none of them
       chain into each other) without leaving a runaway turn to burn tokens. */
    const MAX_TOOL_ROUNDS = 4;

    /*
     * `toolCalls: JSON.stringify(availableTools)` used to record every tool
     * the agent *could* call as if it had called them — and `tools:
     * availableTools` was never even passed to `aiService.chat`, so the
     * model had no way to call any of them. `tokensUsed: 140` was a literal.
     * `status: 'SUCCESS'` was written unconditionally after a call that can
     * throw, so a failed run left no execution log at all. This now records
     * what actually happened: the tool calls the model itself requested and
     * their real results, the real token count from the final response, and
     * a `FAILED` row with the real error on failure instead of silently
     * dropping the run.
     */
    try {
      let chatResult = await this.aiService.chat({
        provider,
        model: agent.model || undefined,
        apiKey: cred.apiKey,
        baseUrl: cred.baseUrl,
        messages,
        tools: toolSchemas.length > 0 ? toolSchemas : undefined,
      });

      for (
        let round = 0;
        round < MAX_TOOL_ROUNDS && (chatResult.message.toolCalls?.length ?? 0) > 0;
        round++
      ) {
        messages.push(chatResult.message);

        for (const call of chatResult.message.toolCalls ?? []) {
          const input = parseToolArguments(call.function.arguments);
          const entry: AgentToolExecution = {
            id: call.id,
            name: call.function.name,
            status: 'running',
            input,
          };
          toolTrace.push(entry);
          await onToolUpdate?.([...toolTrace]);

          const startedAt = Date.now();
          try {
            const output = await this.mcpRegistry.executeTool(
              call.function.name,
              input,
              workspaceId,
            );
            entry.status = 'success';
            entry.output = output;
            entry.durationMs = Date.now() - startedAt;
            messages.push({
              role: 'tool',
              toolCallId: call.id,
              name: call.function.name,
              content: JSON.stringify(output ?? null),
            });
          } catch (toolError) {
            const message =
              toolError instanceof Error ? toolError.message : String(toolError);
            entry.status = 'failed';
            entry.error = message;
            entry.durationMs = Date.now() - startedAt;
            messages.push({
              role: 'tool',
              toolCallId: call.id,
              name: call.function.name,
              content: JSON.stringify({ error: message }),
            });
          }
          await onToolUpdate?.([...toolTrace]);
        }

        chatResult = await this.aiService.chat({
          provider,
          model: agent.model || undefined,
          apiKey: cred.apiKey,
          baseUrl: cred.baseUrl,
          messages,
          tools: toolSchemas.length > 0 ? toolSchemas : undefined,
        });
      }

      const executionLog = await this.prisma.agentExecutionLog.create({
        data: {
          agentId: agent.id,
          status: 'SUCCESS',
          promptText,
          outputResult: chatResult.message.content,
          toolCalls: JSON.stringify(toolTrace),
          tokensUsed: chatResult.usage?.totalTokens ?? 0,
        },
      });

      return {
        agentName: agent.name,
        result: chatResult.message.content,
        logId: executionLog.id,
        tools: toolTrace,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Agent '${agent.name}' (${agent.id}) execution failed: ${message}`,
      );
      await this.prisma.agentExecutionLog.create({
        data: {
          agentId: agent.id,
          status: 'FAILED',
          promptText,
          outputResult: message,
          toolCalls: JSON.stringify(toolTrace),
          tokensUsed: 0,
        },
      });
      throw err;
    }
  }

  async getExecutionLogs(workspaceId: string, agentId: string) {
    await this.assertAgent(workspaceId, agentId);
    return this.prisma.agentExecutionLog.findMany({
      where: { agentId },
      orderBy: { executedAt: 'desc' },
      take: 20,
    });
  }

  /**
   * Recent executions across every agent in the workspace.
   *
   * The telemetry screen is workspace-wide, so filtering by the agent's parent
   * workspace is what scopes this — there is no agent id to check.
   */
  async getWorkspaceLogs(workspaceId: string, take = 50) {
    return this.prisma.agentExecutionLog.findMany({
      where: { agent: { workspaceId } },
      include: { agent: { select: { id: true, name: true } } },
      orderBy: { executedAt: 'desc' },
      take,
    });
  }

  private async assertAgent(workspaceId: string, agentId: string) {
    const found = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Agent not found.');
  }
}

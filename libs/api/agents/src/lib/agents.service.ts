import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { AICredentialService, AIInfrastructureService } from '@org/api-ai';
import type { AIProvider } from '@org/types';
import { MCPToolRegistryService } from './mcp-tool-registry.service.js';

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

  async executeAgent(workspaceId: string, agentId: string, promptText: string) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId },
    });
    if (!agent) throw new NotFoundException('Agent not found.');

    this.logger.log(`Executing AI Agent '${agent.name}' (${agent.id})`);
    const availableTools = this.mcpRegistry.getToolDefinitions();
    const systemPrompt = `${agent.systemPrompt}\n\nWorkspace ID: ${workspaceId}\n\nYou have access to the following workspace tools:\n${availableTools.map((t) => `- ${t.name}: ${t.description}`).join('\n')}`;

    const provider = (agent.provider as AIProvider) || 'nvidia';
    const cred = await this.credentialService.resolveCredential(provider, {
      workspaceId,
    });

    /*
     * `toolCalls: JSON.stringify(availableTools)` used to record every tool
     * the agent *could* call as if it had called them — and `tools:
     * availableTools` was never even passed to `aiService.chat`, so the
     * model had no way to call any of them. `tokensUsed: 140` was a literal.
     * `status: 'SUCCESS'` was written unconditionally after a call that can
     * throw, so a failed run left no execution log at all. This now records
     * what actually happened: the tool calls the model itself returned (none
     * yet, since tool execution isn't wired up — see `MCPToolRegistryService`),
     * the real token count from the provider, and a `FAILED` row with the
     * real error on failure instead of silently dropping the run.
     */
    try {
      const chatResult = await this.aiService.chat({
        provider,
        model: agent.model || undefined,
        apiKey: cred.apiKey,
        baseUrl: cred.baseUrl,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: promptText },
        ],
      });

      const executionLog = await this.prisma.agentExecutionLog.create({
        data: {
          agentId: agent.id,
          status: 'SUCCESS',
          promptText,
          outputResult: chatResult.message.content,
          toolCalls: JSON.stringify(chatResult.message.toolCalls ?? []),
          tokensUsed: chatResult.usage?.totalTokens ?? 0,
        },
      });

      return {
        agentName: agent.name,
        result: chatResult.message.content,
        logId: executionLog.id,
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
          toolCalls: '[]',
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

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent } from '@org/api-common';
import { PrismaService } from '@org/database';
import { deriveAgentFromGraph, type AgentToolExecution } from '@org/types';
import { AIEntitiesService } from './ai-entities.service.js';
import { AIRuntimeService } from './ai-runtime.service.js';
import { MCPToolRegistryService } from './mcp-tool-registry.service.js';

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitiesService: AIEntitiesService,
    private readonly runtimeService: AIRuntimeService,
    private readonly mcpRegistry: MCPToolRegistryService,
    private readonly events: EventEmitter2,
  ) {}

  async getAgents(workspaceId: string) {
    return this.entitiesService.getEntities(workspaceId, 'agent');
  }

  async getAgent(workspaceId: string, agentId: string) {
    return this.entitiesService.getEntity(workspaceId, agentId);
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
      graphJson?: string;
      configuration?: Record<string, any>;
    },
  ) {
    return this.entitiesService.createEntity(workspaceId, creatorId, {
      ...data,
      type: 'agent',
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
      welcomeMessage?: string;
      provider?: string;
      model?: string;
      tools?: string[];
      isActive?: boolean;
      graphJson?: string;
      configuration?: Record<string, any>;
    },
  ) {
    return this.entitiesService.updateEntity(workspaceId, agentId, data);
  }

  async deleteAgent(workspaceId: string, agentId: string): Promise<void> {
    return this.entitiesService.deleteEntity(workspaceId, agentId);
  }

  async executeAgent(
    workspaceId: string,
    agentId: string,
    promptText: string,
    onToolUpdate?: (tools: AgentToolExecution[]) => void | Promise<void>,
  ) {
    const run = await this.runtimeService.executeTurn(
      workspaceId,
      agentId,
      promptText,
      {},
      onToolUpdate,
    );
    return {
      agentName: run.entityName,
      result: run.result,
      logId: run.logId,
      tools: run.tools,
    };
  }

  async getExecutionLogs(workspaceId: string, agentId: string) {
    return this.entitiesService.getEntityLogs(workspaceId, agentId);
  }

  async getWorkspaceLogs(workspaceId: string) {
    return this.entitiesService.getWorkspaceLogs(workspaceId, 'agent');
  }

  // -------------------------------------------------------------------------
  // AI Agent Studio: Validation, Versioning, Publishing & Workflow Execution
  // -------------------------------------------------------------------------

  /**
   * Checks a graph before it is published. A builder graph is judged by what
   * it will run with (`deriveAgentFromGraph`) — the same mapping the save path
   * applies. A graph the former Agent Studio wrote is flagged for conversion:
   * it cannot be published as-is, because nothing executes that shape any more.
   */
  validateGraph(graphJson?: string | null): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!graphJson) {
      return { valid: false, errors: ['The canvas is empty.'], warnings: [] };
    }

    const derived = deriveAgentFromGraph(graphJson);
    if (!derived) {
      let parsed = false;
      try {
        JSON.parse(graphJson);
        parsed = true;
      } catch {
        /* reported below */
      }
      return {
        valid: false,
        errors: [
          parsed
            ? 'This graph uses the old Agent Studio format. Open it in the AI Workspace builder to convert it, then publish.'
            : 'The graph is not valid JSON.',
        ],
        warnings: [],
      };
    }

    if (!derived.name) errors.push('Give the agent a name on its Agent core node.');
    if (!derived.systemPrompt) {
      errors.push('Add an Instructions node with a system prompt.');
    }
    if (!derived.model) {
      warnings.push('No Model node — the agent will use the workspace default model.');
    }

    const known = new Set(this.mcpRegistry.getToolDefinitions().map((t: { name: string }) => t.name));
    for (const tool of derived.tools) {
      if (!tool.startsWith('mcp') && !known.has(tool)) {
        errors.push(`Tool '${tool}' does not exist. Pick one from the tool list.`);
      }
    }
    if (derived.tools.length === 0) {
      warnings.push('No tools — the agent can only answer from its instructions and knowledge.');
    }
    if (derived.runtime.outputs.length > 0 && derived.runtime.schedules.length === 0) {
      warnings.push('Outputs only apply to scheduled runs; add a schedule trigger or remove them.');
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async publishAgent(
    workspaceId: string,
    agentId: string,
    summary = 'Published agent version',
  ) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId, type: 'agent' },
    });
    if (!agent) throw new NotFoundException('Agent not found.');

    const validation = this.validateGraph(agent.graphJson);
    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Cannot publish agent: workflow validation failed.',
        errors: validation.errors,
      });
    }

    const currentConfig = (agent.configuration as Record<string, any>) || {};
    const versions: any[] = Array.isArray(currentConfig.versions) ? [...currentConfig.versions] : [];
    const nextVersionNumber = (currentConfig.currentVersion || 0) + 1;

    const newVersion = {
      version: nextVersionNumber,
      versionTag: `v${nextVersionNumber}.0.0`,
      name: agent.name,
      description: agent.description,
      model: agent.model,
      provider: agent.provider,
      graphJson: agent.graphJson,
      tools: agent.tools,
      publishedAt: new Date().toISOString(),
      changeSummary: summary,
      status: 'PUBLISHED',
    };
    versions.unshift(newVersion);

    const updated = await this.prisma.aIAgent.update({
      where: { id: agent.id },
      data: {
        isActive: true,
        configuration: {
          ...currentConfig,
          status: 'published',
          currentVersion: nextVersionNumber,
          publishedAt: new Date().toISOString(),
          versions,
        },
      },
    });

    return {
      success: true,
      agent: updated,
      version: newVersion,
    };
  }

  async unpublishAgent(workspaceId: string, agentId: string) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId, type: 'agent' },
    });
    if (!agent) throw new NotFoundException('Agent not found.');

    const currentConfig = (agent.configuration as Record<string, any>) || {};
    const updated = await this.prisma.aIAgent.update({
      where: { id: agent.id },
      data: {
        configuration: {
          ...currentConfig,
          status: 'draft',
        },
      },
    });

    return { success: true, agent: updated };
  }

  async getAgentVersions(workspaceId: string, agentId: string) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId, type: 'agent' },
    });
    if (!agent) throw new NotFoundException('Agent not found.');

    const config = (agent.configuration as Record<string, any>) || {};
    const versions = Array.isArray(config.versions) ? config.versions : [];

    // Fallback if no versions published yet
    if (versions.length === 0) {
      return [
        {
          version: 1,
          versionTag: 'v1.0.0-draft',
          name: agent.name,
          description: agent.description,
          model: agent.model,
          provider: agent.provider,
          graphJson: agent.graphJson,
          publishedAt: agent.createdAt.toISOString(),
          changeSummary: 'Initial draft version',
          status: 'DRAFT',
        },
      ];
    }

    return versions;
  }

  async createAgentVersion(
    workspaceId: string,
    agentId: string,
    summary = 'Manual version snapshot',
  ) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId, type: 'agent' },
    });
    if (!agent) throw new NotFoundException('Agent not found.');

    const currentConfig = (agent.configuration as Record<string, any>) || {};
    const versions: any[] = Array.isArray(currentConfig.versions) ? [...currentConfig.versions] : [];
    const nextVersionNumber = (currentConfig.currentVersion || 0) + 1;

    const newVersion = {
      version: nextVersionNumber,
      versionTag: `v${nextVersionNumber}.0.0-snapshot`,
      name: agent.name,
      description: agent.description,
      model: agent.model,
      provider: agent.provider,
      graphJson: agent.graphJson,
      tools: agent.tools,
      publishedAt: new Date().toISOString(),
      changeSummary: summary,
      status: 'SNAPSHOT',
    };
    versions.unshift(newVersion);

    await this.prisma.aIAgent.update({
      where: { id: agent.id },
      data: {
        configuration: {
          ...currentConfig,
          currentVersion: nextVersionNumber,
          versions,
        },
      },
    });

    return newVersion;
  }

  async restoreAgentVersion(
    workspaceId: string,
    agentId: string,
    versionNumber: number,
  ) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId, type: 'agent' },
    });
    if (!agent) throw new NotFoundException('Agent not found.');

    const currentConfig = (agent.configuration as Record<string, any>) || {};
    const versions: any[] = Array.isArray(currentConfig.versions) ? currentConfig.versions : [];
    const target = versions.find((v) => v.version === versionNumber);
    if (!target) throw new NotFoundException(`Version ${versionNumber} not found.`);

    // A builder graph is restored through the normal save path so everything
    // derived from it (instructions, tools, runtime settings, schedules) is
    // restored with it, not just the canvas.
    if (target.graphJson) {
      await this.entitiesService.updateEntity(workspaceId, agent.id, {
        graphJson: target.graphJson,
      });
    }
    const fresh = await this.prisma.aIAgent.findUniqueOrThrow({ where: { id: agent.id } });
    const updated = await this.prisma.aIAgent.update({
      where: { id: agent.id },
      data: {
        ...(target.model ? { model: target.model } : {}),
        ...(target.provider ? { provider: target.provider } : {}),
        configuration: {
          ...((fresh.configuration as Record<string, any>) || currentConfig),
          restoredFromVersion: versionNumber,
        },
      },
    });

    return { success: true, agent: updated, restoredVersion: target };
  }

  /**
   * A test run from the builder: one real turn through `AIRuntimeService`, with
   * the agent's saved configuration, recorded like any other run. Returned as
   * a trace (one step per tool call, then the answer) for the test console.
   *
   * This replaces a separate graph interpreter that re-implemented a subset of
   * the workflow engine (and fetched scrape URLs without the SSRF guard): an
   * agent now behaves the same in a test as it does in chat.
   */
  async testRunWorkflow(
    workspaceId: string,
    agentId: string,
    payload: Record<string, unknown> = {},
    _userId?: string,
  ) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId, type: 'agent' },
      select: { id: true, name: true },
    });
    if (!agent) throw new NotFoundException('Agent not found.');

    const prompt =
      [payload['message'], payload['input'], payload['prompt']].find(
        (v): v is string => typeof v === 'string' && v.trim().length > 0,
      ) ?? 'Introduce yourself and describe what you can do.';

    const startedAt = Date.now();
    try {
      const run = await this.runtimeService.executeTurn(workspaceId, agentId, prompt, {});
      const waiting = run.tools.some(
        (t) => (t.output as { pendingApproval?: boolean } | undefined)?.pendingApproval,
      );
      const steps = [
        ...run.tools.map((tool) => ({
          stepId: tool.id,
          nodeType: 'TOOL',
          label: tool.name,
          status:
            (tool.output as { pendingApproval?: boolean } | undefined)?.pendingApproval
              ? 'WAITING'
              : tool.status === 'failed'
                ? 'FAILED'
                : 'SUCCESS',
          output: tool.error ? { error: tool.error } : tool.output,
          latencyMs: tool.durationMs ?? 0,
          tokensUsed: 0,
        })),
        {
          stepId: 'answer',
          nodeType: 'AGENT',
          label: agent.name,
          status: 'SUCCESS',
          output: run.result,
          latencyMs: Date.now() - startedAt,
          tokensUsed: run.tokensUsed,
        },
      ];
      return {
        executionId: run.executionId ?? null,
        status: waiting ? 'WAITING_APPROVAL' : 'SUCCESS',
        steps,
        output: run.result,
        notices: run.notices ?? [],
        duration: Date.now() - startedAt,
        tokensUsed: run.tokensUsed,
        credits: Math.max(1, Math.ceil(run.tokensUsed / 500)),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        executionId: null,
        status: 'FAILED',
        steps: [
          {
            stepId: 'answer',
            nodeType: 'AGENT',
            label: agent.name,
            status: 'FAILED',
            output: { error: message },
            latencyMs: Date.now() - startedAt,
            tokensUsed: 0,
          },
        ],
        output: message,
        notices: [],
        duration: Date.now() - startedAt,
        tokensUsed: 0,
        credits: 0,
      };
    }
  }

  listMcpTools() {
    return this.mcpRegistry.getToolDefinitions();
  }

  async testMcpTool(
    toolName: string,
    params: any,
    workspaceId: string,
    userId?: string,
  ) {
    return this.mcpRegistry.executeTool(toolName, params, {
      workspaceId,
      actingUserId: userId ?? null,
    });
  }

  // -------------------------------------------------------------------------
  // Channel ↔ agent links
  // -------------------------------------------------------------------------

  async listChannelAgents(workspaceId: string, channelId: string) {
    await this.assertChannel(workspaceId, channelId);
    const rows = await this.prisma.channelAgent.findMany({
      where: { channelId },
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            role: true,
            description: true,
            avatarUrl: true,
            model: true,
            provider: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      channelId: row.channelId,
      agentId: row.agentId,
      isEnabled: row.isEnabled,
      addedById: row.addedById,
      createdAt: row.createdAt.toISOString(),
      agent: row.agent,
    }));
  }

  async addChannelAgent(
    workspaceId: string,
    channelId: string,
    agentId: string,
    addedById: string,
  ) {
    await this.assertChannel(workspaceId, channelId);
    await this.assertAgent(workspaceId, agentId);

    // Checked before the upsert so a re-add of an already-enabled link never
    // posts a duplicate `agent_added` system event (brief §30).
    const existing = await this.prisma.channelAgent.findUnique({
      where: { channelId_agentId: { channelId, agentId } },
      select: { isEnabled: true },
    });

    await this.prisma.channelAgent.upsert({
      where: { channelId_agentId: { channelId, agentId } },
      create: { channelId, agentId, addedById },
      update: { isEnabled: true },
    });

    if (!existing) {
      this.events.emit(AppEvent.ChannelAiEntityLinked, {
        workspaceId,
        actorId: addedById,
        channelId,
        entityId: agentId,
        entityType: 'agent',
      });
    } else if (!existing.isEnabled) {
      this.events.emit(AppEvent.ChannelAiEntityEnabledChanged, {
        workspaceId,
        actorId: addedById,
        channelId,
        entityId: agentId,
        entityType: 'agent',
        isEnabled: true,
      });
    }

    return this.listChannelAgents(workspaceId, channelId);
  }

  async setChannelAgentEnabled(
    workspaceId: string,
    channelId: string,
    agentId: string,
    isEnabled: boolean,
    actorId?: string,
  ) {
    await this.assertChannel(workspaceId, channelId);
    const link = await this.prisma.channelAgent.findUnique({
      where: { channelId_agentId: { channelId, agentId } },
      select: { id: true, isEnabled: true },
    });
    if (!link) throw new NotFoundException('Agent is not linked to this channel.');
    await this.prisma.channelAgent.update({
      where: { id: link.id },
      data: { isEnabled },
    });

    if (link.isEnabled !== isEnabled) {
      this.events.emit(AppEvent.ChannelAiEntityEnabledChanged, {
        workspaceId,
        actorId: actorId ?? null,
        channelId,
        entityId: agentId,
        entityType: 'agent',
        isEnabled,
      });
    }

    return this.listChannelAgents(workspaceId, channelId);
  }

  async removeChannelAgent(
    workspaceId: string,
    channelId: string,
    agentId: string,
    actorId?: string,
  ): Promise<void> {
    await this.assertChannel(workspaceId, channelId);
    const { count } = await this.prisma.channelAgent.deleteMany({
      where: { channelId, agentId },
    });

    if (count > 0) {
      this.events.emit(AppEvent.ChannelAiEntityUnlinked, {
        workspaceId,
        actorId: actorId ?? null,
        channelId,
        entityId: agentId,
        entityType: 'agent',
      });
    }
  }

  private async assertAgent(workspaceId: string, agentId: string) {
    const found = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId, type: 'agent' },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Agent not found.');
  }

  private async assertChannel(workspaceId: string, channelId: string) {
    const found = await this.prisma.channel.findFirst({
      where: { id: channelId, workspaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Channel not found.');
  }
}

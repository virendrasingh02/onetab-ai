import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { AppEvent, type AgentChangeAction } from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  appLabel,
  compileStudioGraph,
  deriveAgentFromGraph,
  isStudioGraph,
  type AgentConnectionStatus,
  type AgentToolExecution,
  type InlineAgentSpec,
} from '@org/types';
import { AIEntitiesService } from './ai-entities.service.js';
import { AIRuntimeService } from './ai-runtime.service.js';
import { IntegrationToolBridgeService } from './integration-tool-bridge.service.js';
import { MCPToolRegistryService } from './mcp-tool-registry.service.js';

/** Every app named by an agent on the canvas, sub-agents included. */
function connectorsOf(agents: readonly InlineAgentSpec[]): string[] {
  return agents.flatMap((a) => [...(a.connectors ?? []), ...connectorsOf(a.members ?? [])]);
}

/**
 * Next semver tag after the highest existing one: publish bumps minor
 * (v1.0.0 → v1.1.0 → v1.2.0), snapshots bump patch. First tag is v1.0.0.
 */
function nextSemverTag(
  versions: Array<{ versionTag?: string }>,
  bump: 'minor' | 'patch',
): string {
  let best: [number, number, number] | null = null;
  for (const v of versions) {
    const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.versionTag ?? '');
    if (!m) continue;
    const cur: [number, number, number] = [+m[1], +m[2], +m[3]];
    if (
      !best ||
      cur[0] > best[0] ||
      (cur[0] === best[0] && (cur[1] > best[1] || (cur[1] === best[1] && cur[2] > best[2])))
    ) {
      best = cur;
    }
  }
  if (!best) return 'v1.0.0';
  const [major, minor, patch] = best;
  return bump === 'minor' ? `v${major}.${minor + 1}.0` : `v${major}.${minor}.${patch + 1}`;
}

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitiesService: AIEntitiesService,
    private readonly runtimeService: AIRuntimeService,
    private readonly mcpRegistry: MCPToolRegistryService,
    private readonly events: EventEmitter2,
    private readonly integrationTools: IntegrationToolBridgeService,
  ) {}

  /**
   * The apps this agent acts in and whether `userId` has each connected —
   * what the app asks a person to connect before they use a published agent.
   */
  async getConnections(workspaceId: string, agentId: string, userId: string): Promise<AgentConnectionStatus[]> {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId, type: 'agent' },
      select: { id: true, graphJson: true },
    });
    if (!agent) throw new NotFoundException('Agent not found.');
    let providers: string[] = [];
    if (isStudioGraph(agent.graphJson)) {
      providers = connectorsOf(compileStudioGraph(JSON.parse(agent.graphJson as string)).agents);
    }
    return this.integrationTools.getConnectionStatus(workspaceId, agent.id, userId, providers);
  }

  private emitChange(workspaceId: string, agentId: string, action: AgentChangeAction) {
    this.events.emit(AppEvent.AgentChanged, { workspaceId, agentId, kind: 'entity', action });
  }

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

  // -------------------------------------------------------------------------
  // Conversations: a person's persisted chat with one agent
  // -------------------------------------------------------------------------

  private static readonly HISTORY_TURNS = 20;

  private async ownConversation(workspaceId: string, agentId: string, userId: string, id: string) {
    const convo = await this.prisma.agentConversation.findFirst({
      where: { id, workspaceId, agentId, userId },
    });
    if (!convo) throw new NotFoundException('Conversation not found.');
    return convo;
  }

  async listConversations(
    workspaceId: string,
    agentId: string,
    userId: string,
  ): Promise<Array<{ id: string; title: string; createdAt: Date; updatedAt: Date }>> {
    return this.prisma.agentConversation.findMany({
      where: { workspaceId, agentId, userId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async getConversation(workspaceId: string, agentId: string, userId: string, id: string) {
    return this.ownConversation(workspaceId, agentId, userId, id);
  }

  async deleteConversation(workspaceId: string, agentId: string, userId: string, id: string) {
    await this.ownConversation(workspaceId, agentId, userId, id);
    await this.prisma.agentConversation.delete({ where: { id } });
  }

  /**
   * One chat turn: runs the agent with the conversation so far as history,
   * then stores both sides. A failed run stores nothing, so a retry is clean.
   */
  async chat(
    workspaceId: string,
    agentId: string,
    userId: string,
    input: { conversationId?: string; message: string },
  ) {
    const existing = input.conversationId
      ? await this.ownConversation(workspaceId, agentId, userId, input.conversationId)
      : null;
    const prior = (Array.isArray(existing?.messages) ? existing.messages : []) as Array<Record<string, unknown>>;
    const history = prior
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-AgentsService.HISTORY_TURNS * 2)
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content as string }));

    const run = await this.runtimeService.executeTurn(workspaceId, agentId, input.message, {
      history,
      requesterId: userId,
    });

    const now = new Date().toISOString();
    const userMsg = { id: randomUUID(), role: 'user', content: input.message, at: now };
    const reply = { id: randomUUID(), role: 'assistant', content: run.result, logId: run.logId, tools: run.tools, at: now };
    const messages = [...prior, userMsg, reply];

    const saved = existing
      ? await this.prisma.agentConversation.update({
          where: { id: existing.id },
          data: { messages: messages as object[] },
          select: { id: true, title: true },
        })
      : await this.prisma.agentConversation.create({
          data: {
            workspaceId,
            agentId,
            userId,
            title: input.message.replace(/\s+/g, ' ').slice(0, 60),
            messages: messages as object[],
          },
          select: { id: true, title: true },
        });
    return { conversationId: saved.id, title: saved.title, message: reply };
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

    // A Studio canvas graph runs through the workflow engine; judge it by
    // what the engine will run (the same compile the run endpoint uses).
    if (isStudioGraph(graphJson)) {
      const { issues, agents } = compileStudioGraph(JSON.parse(graphJson) as Record<string, unknown>);
      const errors = issues.filter((i) => i.level === 'error').map((i) => i.message);
      const warnings = issues.filter((i) => i.level === 'warning').map((i) => i.message);
      const apps = [...new Set(connectorsOf(agents).map((p) => appLabel(p)))];
      if (apps.length > 0) {
        warnings.push(`Once published, each member is asked to connect their own ${apps.join(', ')} before the agent can act in it.`);
      }
      return { valid: errors.length === 0, errors, warnings };
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
      versionTag: nextSemverTag(versions, 'minor'),
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

    this.emitChange(workspaceId, agent.id, 'published');
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

    this.emitChange(workspaceId, agent.id, 'unpublished');
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
      versionTag: `${nextSemverTag(versions, 'patch')}-snapshot`,
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

    this.emitChange(workspaceId, agent.id, 'version');
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

    this.emitChange(workspaceId, agent.id, 'updated');
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

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent } from '@org/api-common';
import { PrismaService } from '@org/database';
import type { AgentToolExecution } from '@org/types';
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

  validateGraph(graphJson?: string | null): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!graphJson) {
      return { valid: false, errors: ['Workflow canvas is empty.'], warnings: [] };
    }

    try {
      const parsed = JSON.parse(graphJson);
      const nodes: any[] = Array.isArray(parsed?.nodes)
        ? parsed.nodes
        : Array.isArray(parsed)
        ? parsed
        : [];
      const edges: any[] = Array.isArray(parsed?.edges) ? parsed.edges : [];

      if (nodes.length === 0) {
        errors.push('No nodes present on the workflow canvas.');
        return { valid: false, errors, warnings };
      }

      const hasStart = nodes.some(
        (n) => (n.type || '').toUpperCase() === 'START' || (n.type || '').toUpperCase() === 'TRIGGER',
      );
      if (!hasStart) {
        errors.push('Missing Start node. Every workflow requires a Start entrypoint.');
      }

      const hasEnd = nodes.some(
        (n) => (n.type || '').toUpperCase() === 'END' || (n.type || '').toUpperCase() === 'OUTPUT',
      );
      if (!hasEnd) {
        warnings.push('No explicit End node defined. Workflow will terminate at terminal branch.');
      }

      // Validate node configurations
      for (const node of nodes) {
        const type = (node.type || '').toUpperCase();
        const cfg = node.data?.config || node.data || {};
        const label = node.data?.label || node.id;

        if (type === 'AGENT') {
          if (!cfg.instructions && !cfg.prompt && !cfg.systemPrompt) {
            warnings.push(`Agent node "${label}" has no custom instructions configured.`);
          }
        } else if (type === 'TOOL' || type === 'MCP' || type === 'MCP_TOOL') {
          if (!cfg.toolName && !cfg.tool) {
            errors.push(`Tool node "${label}" does not specify an MCP tool.`);
          }
        } else if (type === 'CONDITION' || type === 'IF_ELSE') {
          if (!cfg.variable && !cfg.path) {
            warnings.push(`Condition node "${label}" missing comparison variable.`);
          }
        }
      }

      // Check for disconnected nodes (if more than 1 node)
      if (nodes.length > 1 && edges.length === 0) {
        warnings.push('Canvas nodes are disconnected. Connect nodes with edges to establish execution flow.');
      }
    } catch {
      errors.push('Invalid workflow JSON graph format.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
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

    const updated = await this.prisma.aIAgent.update({
      where: { id: agent.id },
      data: {
        ...(target.graphJson ? { graphJson: target.graphJson } : {}),
        ...(target.model ? { model: target.model } : {}),
        ...(target.provider ? { provider: target.provider } : {}),
        configuration: {
          ...currentConfig,
          restoredFromVersion: versionNumber,
        },
      },
    });

    return { success: true, agent: updated, restoredVersion: target };
  }

  async testRunWorkflow(
    workspaceId: string,
    agentId: string,
    payload: Record<string, unknown> = {},
    userId?: string,
  ) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId, type: 'agent' },
    });
    if (!agent) throw new NotFoundException('Agent not found.');

    const startTime = Date.now();
    let totalTokens = 0;
    const stepsTrace: any[] = [];
    let overallStatus: 'SUCCESS' | 'WAITING_APPROVAL' | 'FAILED' = 'SUCCESS';
    let outputData: unknown = {};

    // 1. Create AIExecution record
    const aiExecution = await this.prisma.aIExecution.create({
      data: {
        workspaceId,
        userId: userId ?? null,
        entityType: 'AGENT',
        entityId: agent.id,
        agentId: agent.id,
        version: ((agent.configuration as any)?.currentVersion as number) || 1,
        status: 'RUNNING',
        stateJson: payload as any,
        model: agent.model,
      },
    });

    // 2. Parse nodes and edges from agent graph
    let nodes: any[] = [];
    let edges: any[] = [];
    if (agent.graphJson) {
      try {
        const parsed = JSON.parse(agent.graphJson);
        nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : Array.isArray(parsed) ? parsed : [];
        edges = Array.isArray(parsed?.edges) ? parsed.edges : [];
      } catch {
        nodes = [];
      }
    }

    const context: Record<string, unknown> = {
      ...payload,
      workspaceId,
      agentId: agent.id,
      executionId: aiExecution.id,
      input: payload['message'] || payload['input'] || payload['prompt'] || 'Run agent test',
    };

    // If no nodes, execute simple turn
    if (nodes.length === 0) {
      const prompt = String(context['input']);
      const run = await this.runtimeService.executeTurn(workspaceId, agent.id, prompt, {});
      const duration = Date.now() - startTime;
      totalTokens += 250;

      await this.prisma.aIExecutionStep.create({
        data: {
          executionId: aiExecution.id,
          stepId: 'agent-turn',
          nodeType: 'AGENT',
          status: 'SUCCESS',
          inputJson: { prompt } as any,
          outputJson: { result: run.result, tools: run.tools } as any,
          latencyMs: duration,
          tokensUsed: 250,
        },
      });

      await this.prisma.aIExecution.update({
        where: { id: aiExecution.id },
        data: {
          status: 'COMPLETED',
          finishedAt: new Date(),
          latencyMs: duration,
          tokensUsed: 250,
          totalCost: Number((250 * 0.000002).toFixed(5)),
        },
      });

      return {
        executionId: aiExecution.id,
        status: 'SUCCESS',
        steps: [
          {
            stepId: 'agent-turn',
            nodeType: 'AGENT',
            label: agent.name,
            status: 'SUCCESS',
            output: run.result,
            latencyMs: duration,
            tokensUsed: 250,
          },
        ],
        output: run.result,
        duration,
        tokensUsed: 250,
        credits: 1,
      };
    }

    // Graph Execution: find Start node or first node
    const startNode =
      nodes.find(
        (n) => (n.type || '').toUpperCase() === 'START' || (n.type || '').toUpperCase() === 'TRIGGER',
      ) || nodes[0];

    const queue: string[] = [startNode.id];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const node = nodes.find((n) => n.id === currentId);
      if (!node) continue;

      const stepStart = Date.now();
      const nodeType = (node.type || '').toUpperCase();
      const cfg = node.data?.config || node.data || {};
      const label = node.data?.label || node.id;
      let stepStatus: 'SUCCESS' | 'FAILED' | 'WAITING' = 'SUCCESS';
      let stepOutput: unknown = {};
      let tokensUsed = 0;

      try {
        switch (nodeType) {
          case 'START':
          case 'TRIGGER':
            stepOutput = { ...context };
            break;

          case 'AGENT': {
            const agentPrompt = String(cfg['instructions'] || cfg['prompt'] || context['input'] || 'Perform assigned task');
            const run = await this.runtimeService.executeTurn(workspaceId, agent.id, agentPrompt, {});
            tokensUsed = 320;
            stepOutput = { result: run.result, tools: run.tools };
            context['agentOutput'] = run.result;
            outputData = run.result;
            break;
          }

          case 'TOOL':
          case 'MCP':
          case 'MCP_TOOL': {
            const toolName = String(cfg['toolName'] || cfg['tool'] || 'search_docs');
            const toolInput = cfg['input'] || { query: String(context['input'] || '') };
            const toolRes = await this.mcpRegistry.executeTool(toolName, toolInput, {
              workspaceId,
              actingUserId: userId ?? null,
            });
            stepOutput = { toolResult: toolRes };
            context['toolResult'] = toolRes;
            break;
          }

          case 'FIRECRAWL_SEARCH': {
            const query = String(cfg['query'] || context['input'] || 'AI agents');
            const searchRes = await this.mcpRegistry.executeTool('firecrawl_search', { query, limit: Number(cfg['limit']) || 5 }, {
              workspaceId,
              actingUserId: userId ?? null,
            });
            stepOutput = { searchResult: searchRes };
            context['searchResults'] = searchRes;
            break;
          }

          case 'FIRECRAWL_SCRAPE': {
            const url = String(cfg['url'] || 'https://news.ycombinator.com');
            const scrapeRes = await this.mcpRegistry.executeTool('firecrawl_scrape', { url }, {
              workspaceId,
              actingUserId: userId ?? null,
            });
            stepOutput = { scrapeResult: scrapeRes };
            context['scrapedContent'] = scrapeRes;
            break;
          }

          case 'TRANSFORM':
          case 'CODE': {
            const template = String(cfg['template'] || cfg['code'] || 'Transform result');
            stepOutput = { transformed: `${template}: ${JSON.stringify(context['agentOutput'] || context['toolResult'] || 'OK')}` };
            break;
          }

          case 'USER_APPROVAL':
          case 'HUMAN_APPROVAL': {
            await this.prisma.approvalRequest.create({
              data: {
                workspaceId,
                entityType: 'AGENT',
                entityId: agent.id,
                executionId: aiExecution.id,
                stepId: node.id,
                actionType: String(cfg['action'] || 'Human approval required for agent execution'),
                proposedPayload: context as any,
                state: 'PENDING',
              },
            });
            stepStatus = 'WAITING';
            stepOutput = { waitingForApproval: true, message: 'Execution paused awaiting operator approval' };
            overallStatus = 'WAITING_APPROVAL';
            break;
          }

          case 'END':
          case 'OUTPUT':
            stepOutput = { completed: true, finalOutput: outputData || context['agentOutput'] || context };
            break;

          default:
            stepOutput = { executed: true };
            break;
        }
      } catch (err) {
        stepStatus = 'FAILED';
        stepOutput = { error: err instanceof Error ? err.message : String(err) };
        overallStatus = 'FAILED';
      }

      const stepLatency = Date.now() - stepStart;
      totalTokens += tokensUsed;

      // Save step to database
      await this.prisma.aIExecutionStep.create({
        data: {
          executionId: aiExecution.id,
          stepId: node.id,
          nodeType,
          status: stepStatus,
          inputJson: cfg as any,
          outputJson: (stepOutput ?? {}) as any,
          latencyMs: stepLatency,
          tokensUsed,
          errorMessage: (stepOutput as any)?.error,
        },
      });

      stepsTrace.push({
        stepId: node.id,
        nodeType,
        label,
        status: stepStatus,
        output: stepOutput,
        latencyMs: stepLatency,
        tokensUsed,
      });

      if (stepStatus === 'WAITING' || stepStatus === 'FAILED') {
        break;
      }

      // Add downstream targets to queue
      for (const edge of edges) {
        if (edge.source === currentId) {
          queue.push(edge.target);
        }
      }
    }

    const duration = Date.now() - startTime;

    // Update execution status
    await this.prisma.aIExecution.update({
      where: { id: aiExecution.id },
      data: {
        status: overallStatus === 'WAITING_APPROVAL' ? 'WAITING_APPROVAL' : overallStatus === 'SUCCESS' ? 'COMPLETED' : 'FAILED',
        finishedAt: overallStatus === 'WAITING_APPROVAL' ? null : new Date(),
        latencyMs: duration,
        tokensUsed: totalTokens,
        totalCost: Number((totalTokens * 0.000002).toFixed(5)),
      },
    });

    return {
      executionId: aiExecution.id,
      status: overallStatus,
      steps: stepsTrace,
      output: outputData || context['agentOutput'] || 'Execution completed',
      duration,
      tokensUsed: totalTokens,
      credits: Math.max(1, Math.ceil(totalTokens / 500)),
    };
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

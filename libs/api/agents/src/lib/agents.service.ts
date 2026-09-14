import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent } from '@org/api-common';
import { PrismaService } from '@org/database';
import type { AgentToolExecution } from '@org/types';
import { AIEntitiesService } from './ai-entities.service.js';
import { AIRuntimeService } from './ai-runtime.service.js';

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitiesService: AIEntitiesService,
    private readonly runtimeService: AIRuntimeService,
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

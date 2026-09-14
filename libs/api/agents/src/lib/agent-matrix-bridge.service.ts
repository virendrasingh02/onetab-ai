import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  MatrixAdminService,
  MatrixBotMessagingService,
  MatrixInboundRouterService,
  type MatrixTimelineEvent,
} from '@org/api-matrix';
import { PrismaService } from '@org/database';
import type { AgentToolExecution, AIAgentMessageContent } from '@org/types';
import { AIRuntimeService } from './ai-runtime.service.js';

/**
 * Unified Matrix Bridge for all AI Entities (AI Agents and AI Coworkers).
 *
 * Makes an AI entity answer inside its own Matrix DM room, as well as in
 * channels, group DMs, and threads whenever mentioned.
 */
@Injectable()
export class AgentMatrixBridgeService implements OnModuleInit {
  private readonly logger = new Logger(AgentMatrixBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MatrixInboundRouterService,
    private readonly messaging: MatrixBotMessagingService,
    private readonly admin: MatrixAdminService,
    private readonly runtimeService: AIRuntimeService,
  ) {}

  onModuleInit(): void {
    this.router.register((event) => this.tryHandle(event));
  }

  private async tryHandle(event: MatrixTimelineEvent): Promise<boolean> {
    const relatesTo = event.content['m.relates_to'] as
      | { rel_type?: string; event_id?: string }
      | undefined;
    if (relatesTo?.rel_type === 'm.replace') return false;

    const promptText =
      typeof event.content['body'] === 'string' ? event.content['body'] : '';
    if (!promptText.trim()) return false;

    let target = await this.prisma.aIAgent.findFirst({
      where: { matrixRoomId: event.room_id },
      select: {
        id: true,
        type: true,
        workspaceId: true,
        name: true,
        role: true,
        model: true,
        avatarUrl: true,
        matrixUserId: true,
      },
    });

    let cleanPrompt = promptText;
    let threadRootId: string | undefined = undefined;
    let channelId: string | undefined;
    let channelName: string | undefined;

    if (relatesTo?.rel_type === 'm.thread' && typeof relatesTo.event_id === 'string') {
      threadRootId = relatesTo.event_id;
    }

    if (!target) {
      const channel = await this.prisma.channel.findFirst({
        where: { matrixRoomId: event.room_id },
        select: { id: true, name: true, workspaceId: true },
      });

      if (channel) {
        channelId = channel.id;
        channelName = channel.name;

        // Query active entities linked to this channel (both agents and coworkers)
        const entities = await this.prisma.aIAgent.findMany({
          where: {
            workspaceId: channel.workspaceId,
            isActive: true,
            OR: [
              { channelLinks: { some: { channelId: channel.id, isEnabled: true } } },
              { channelCoworkers: { some: { channelId: channel.id, isEnabled: true } } },
            ],
          },
          select: {
            id: true,
            type: true,
            workspaceId: true,
            name: true,
            role: true,
            model: true,
            avatarUrl: true,
            matrixUserId: true,
          },
        });

        const mentions = event.content['m.mentions'] as
          | { user_ids?: unknown }
          | undefined;
        const mentionedUserIds = Array.isArray(mentions?.user_ids)
          ? mentions.user_ids.filter((id): id is string => typeof id === 'string')
          : [];

        for (const e of entities) {
          const nameRegex = new RegExp(`@${e.name}\\b`, 'i');
          const mentionedById =
            !!e.matrixUserId && mentionedUserIds.includes(e.matrixUserId);
          const mentionedByName = nameRegex.test(promptText);

          if (mentionedById || mentionedByName) {
            target = e;
            cleanPrompt = promptText.replace(nameRegex, '').trim();
            if (!threadRootId) {
              threadRootId = event.event_id;
            }
            break;
          }
        }
      }
    }

    if (!target) return false;
    if (event.sender === target.matrixUserId) return false;
    if (!cleanPrompt.trim()) return false;

    void this.runTurn(
      target,
      event.room_id,
      cleanPrompt,
      threadRootId,
      channelId,
      channelName,
    ).catch((error) => {
      this.logger.error(
        `AI Entity turn failed for ${target.id} in ${event.room_id}: ${String(error)}`,
      );
    });

    return true;
  }

  private async runTurn(
    entity: {
      id: string;
      type: string;
      workspaceId: string;
      name: string;
      role: string;
      model: string;
      avatarUrl: string | null;
      matrixUserId: string | null;
    },
    roomId: string,
    promptText: string,
    threadRootId?: string,
    channelId?: string,
    channelName?: string,
  ): Promise<void> {
    if (!entity.matrixUserId) return;

    try {
      await this.admin.joinRoomAs(entity.matrixUserId, roomId);
    } catch {
      // Ignore if already joined
    }

    const startedAt = Date.now();
    const roleBadge = entity.role || (entity.type === 'coworker' ? 'AI Coworker' : 'AI Agent');
    const base: Omit<
      AIAgentMessageContent,
      'status' | 'tools' | 'responseText' | 'errorMessage' | 'completedAt'
    > = {
      type: 'mie.ai.agent',
      agentId: entity.id,
      agentName: entity.name,
      agentRole: roleBadge,
      agentAvatarUrl: entity.avatarUrl ?? undefined,
      workspaceId: entity.workspaceId,
      model: entity.model,
      startedAt,
      title: `${entity.name} · ${roleBadge}`,
    };

    const eventId = await this.messaging.sendStructured(
      roomId,
      entity.matrixUserId,
      { ...base, status: 'queued' },
      { threadRootId },
    );

    await this.messaging.updateStructured(
      roomId,
      entity.matrixUserId,
      eventId,
      { ...base, status: 'running' },
      { threadRootId },
    );

    const postToolUpdate = async (tools: AgentToolExecution[]) => {
      await this.messaging.updateStructured(
        roomId,
        entity.matrixUserId as string,
        eventId,
        { ...base, status: 'running', tools },
        { threadRootId },
      );
    };

    try {
      const result = await this.runtimeService.executeTurn(
        entity.workspaceId,
        entity.id,
        promptText,
        { channelId, channelName },
        postToolUpdate,
      );

      await this.messaging.updateStructured(
        roomId,
        entity.matrixUserId,
        eventId,
        {
          ...base,
          status: 'completed',
          responseText: result.result,
          tools: result.tools,
          durationMs: Date.now() - startedAt,
          completedAt: Date.now(),
        },
        { threadRootId },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.messaging.updateStructured(
        roomId,
        entity.matrixUserId,
        eventId,
        {
          ...base,
          status: 'failed',
          errorMessage: message,
          durationMs: Date.now() - startedAt,
          completedAt: Date.now(),
        },
        { threadRootId },
      );
    }
  }
}

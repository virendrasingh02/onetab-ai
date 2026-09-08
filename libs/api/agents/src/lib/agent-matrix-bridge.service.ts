import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  MatrixAdminService,
  MatrixBotMessagingService,
  MatrixInboundRouterService,
  type MatrixTimelineEvent,
} from '@org/api-matrix';
import { PrismaService } from '@org/database';
import type { AgentToolExecution, AIAgentMessageContent } from '@org/types';
import { AgentsService } from './agents.service.js';

/**
 * Makes an AI agent answer inside its own Matrix DM room, as well as in
 * channels, group DMs, and threads whenever mentioned.
 *
 * This turns an agent into a first-class conversation participant:
 * `MatrixSyncService` hands every inbound room message to `MatrixInboundRouterService`,
 * and this handler claims ones in the agent's DM room or mentioning the agent in a channel/thread.
 * The reply is posted back into the same room and thread context as the agent's bot identity.
 */
@Injectable()
export class AgentMatrixBridgeService implements OnModuleInit {
  private readonly logger = new Logger(AgentMatrixBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MatrixInboundRouterService,
    private readonly messaging: MatrixBotMessagingService,
    private readonly admin: MatrixAdminService,
    private readonly agentsService: AgentsService,
  ) {}

  onModuleInit(): void {
    this.router.register((event) => this.tryHandle(event));
  }

  /**
   * Claims the event if it belongs to an agent's room or mentions an agent in a channel/thread,
   * then runs the turn in the background.
   */
  private async tryHandle(event: MatrixTimelineEvent): Promise<boolean> {
    const relatesTo = event.content['m.relates_to'] as
      | { rel_type?: string; event_id?: string }
      | undefined;
    if (relatesTo?.rel_type === 'm.replace') return false;

    const promptText =
      typeof event.content['body'] === 'string' ? event.content['body'] : '';
    if (!promptText.trim()) return false;

    let targetAgent = await this.prisma.aIAgent.findFirst({
      where: { matrixRoomId: event.room_id },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        model: true,
        avatarUrl: true,
        matrixUserId: true,
      },
    });

    let cleanPrompt = promptText;
    let threadRootId: string | undefined = undefined;

    if (relatesTo?.rel_type === 'm.thread' && typeof relatesTo.event_id === 'string') {
      threadRootId = relatesTo.event_id;
    }

    if (!targetAgent) {
      // Check if room is backed by a channel
      const channel = await this.prisma.channel.findFirst({
        where: { matrixRoomId: event.room_id },
        select: { id: true, workspaceId: true },
      });

      if (channel) {
        // Only agents explicitly added to this channel (and not disabled) may
        // answer here — this is the scoping the channel Agents panel edits.
        const agents = await this.prisma.aIAgent.findMany({
          where: {
            workspaceId: channel.workspaceId,
            channelLinks: { some: { channelId: channel.id, isEnabled: true } },
          },
          select: {
            id: true,
            workspaceId: true,
            name: true,
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

        for (const a of agents) {
          const nameRegex = new RegExp(`@${a.name}\\b`, 'i');
          const mentionedById =
            !!a.matrixUserId && mentionedUserIds.includes(a.matrixUserId);
          const mentionedByName = nameRegex.test(promptText);

          if (mentionedById || mentionedByName) {
            targetAgent = a;
            cleanPrompt = promptText.replace(nameRegex, '').trim();
            if (!threadRootId) {
              threadRootId = event.event_id;
            }
            break;
          }
        }
      }
    }

    if (!targetAgent) return false;
    if (event.sender === targetAgent.matrixUserId) return false;
    if (!cleanPrompt.trim()) return false;

    void this.runTurn(targetAgent, event.room_id, cleanPrompt, threadRootId).catch(
      (error) => {
        this.logger.error(
          `Agent turn failed for ${targetAgent.id} in ${event.room_id}: ${String(error)}`,
        );
      },
    );

    return true;
  }

  private async runTurn(
    agent: {
      id: string;
      workspaceId: string;
      name: string;
      model: string;
      avatarUrl: string | null;
      matrixUserId: string | null;
    },
    roomId: string,
    promptText: string,
    threadRootId?: string,
  ): Promise<void> {
    if (!agent.matrixUserId) return;

    // Ensure bot identity is joined to the room before responding
    try {
      await this.admin.joinRoomAs(agent.matrixUserId, roomId);
    } catch {
      // Ignore if already joined
    }

    const startedAt = Date.now();
    const base: Omit<
      AIAgentMessageContent,
      'status' | 'tools' | 'responseText' | 'errorMessage' | 'completedAt'
    > = {
      type: 'mie.ai.agent',
      agentId: agent.id,
      agentName: agent.name,
      agentAvatarUrl: agent.avatarUrl ?? undefined,
      workspaceId: agent.workspaceId,
      model: agent.model,
      startedAt,
      title: agent.name,
    };

    const eventId = await this.messaging.sendStructured(
      roomId,
      agent.matrixUserId,
      { ...base, status: 'queued' },
      { threadRootId },
    );

    await this.messaging.updateStructured(
      roomId,
      agent.matrixUserId,
      eventId,
      { ...base, status: 'running' },
      { threadRootId },
    );

    const postToolUpdate = async (tools: AgentToolExecution[]) => {
      await this.messaging.updateStructured(
        roomId,
        agent.matrixUserId as string,
        eventId,
        { ...base, status: 'running', tools },
        { threadRootId },
      );
    };

    try {
      const result = await this.agentsService.executeAgent(
        agent.workspaceId,
        agent.id,
        promptText,
        postToolUpdate,
      );

      await this.messaging.updateStructured(
        roomId,
        agent.matrixUserId,
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
        agent.matrixUserId,
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

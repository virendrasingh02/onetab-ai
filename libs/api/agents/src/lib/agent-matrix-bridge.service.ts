import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  MatrixBotMessagingService,
  MatrixInboundRouterService,
  type MatrixTimelineEvent,
} from '@org/api-matrix';
import { PrismaService } from '@org/database';
import type { AgentToolExecution, AIAgentMessageContent } from '@org/types';
import { AgentsService } from './agents.service.js';

/**
 * Makes an AI agent answer inside its own Matrix DM room.
 *
 * This is what turns an agent from a page with a "run" button into a
 * conversation participant: `MatrixSyncService` hands every inbound room
 * message to `MatrixInboundRouterService`, and this handler claims the ones
 * that landed in a room it recognises as an agent's (`AIAgent.matrixRoomId`).
 * The reply is posted back into the same room, as the agent's own bot
 * identity, via `MatrixBotMessagingService` — never through a second UI.
 */
@Injectable()
export class AgentMatrixBridgeService implements OnModuleInit {
  private readonly logger = new Logger(AgentMatrixBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MatrixInboundRouterService,
    private readonly messaging: MatrixBotMessagingService,
    private readonly agentsService: AgentsService,
  ) {}

  onModuleInit(): void {
    this.router.register((event) => this.tryHandle(event));
  }

  /**
   * Claims the event if it belongs to an agent's room and was not sent by
   * the agent itself, then runs the turn in the background.
   *
   * The homeserver expects the appservice transaction endpoint to return
   * quickly (`MatrixAppserviceController.transaction` awaits every handler
   * synchronously, and Synapse retries indefinitely on anything but a fast
   * 200) — so this only ever does the couple of cheap lookups needed to
   * decide whether to claim the event, then fires the actual agent turn
   * (a real LLM call, possibly several tool round-trips) without awaiting it.
   */
  private async tryHandle(event: MatrixTimelineEvent): Promise<boolean> {
    const agent = await this.prisma.aIAgent.findFirst({
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
    if (!agent) return false;

    // The agent's own posts (its queued/running/completed structured
    // messages) arrive back through this same transaction stream — without
    // this check the bridge would answer itself forever.
    if (event.sender === agent.matrixUserId) return false;

    // An edit (`m.replace`) is a correction to an old message, not a new
    // prompt — most commonly the bridge's own status edits echoing back
    // before the sender check above would otherwise catch them via a
    // differently-cased id, but also a human correcting a typo mid-thought.
    const relatesTo = event.content['m.relates_to'] as
      | { rel_type?: string }
      | undefined;
    if (relatesTo?.rel_type === 'm.replace') return false;

    const promptText =
      typeof event.content['body'] === 'string' ? event.content['body'] : '';
    if (!promptText.trim()) return false;

    void this.runTurn(agent, event.room_id, promptText).catch((error) => {
      this.logger.error(
        `Agent turn failed for ${agent.id} in ${event.room_id}: ${String(error)}`,
      );
    });

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
  ): Promise<void> {
    if (!agent.matrixUserId) return; // can't happen: this room only exists once matrixUserId does

    const startedAt = Date.now();
    const base: Omit<AIAgentMessageContent, 'status' | 'tools' | 'responseText' | 'errorMessage' | 'completedAt'> = {
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
    );

    await this.messaging.updateStructured(roomId, agent.matrixUserId, eventId, {
      ...base,
      status: 'running',
    });

    const postToolUpdate = async (tools: AgentToolExecution[]) => {
      await this.messaging.updateStructured(
        roomId,
        agent.matrixUserId as string,
        eventId,
        { ...base, status: 'running', tools },
      );
    };

    try {
      const result = await this.agentsService.executeAgent(
        agent.workspaceId,
        agent.id,
        promptText,
        postToolUpdate,
      );

      await this.messaging.updateStructured(roomId, agent.matrixUserId, eventId, {
        ...base,
        status: 'completed',
        responseText: result.result,
        tools: result.tools,
        durationMs: Date.now() - startedAt,
        completedAt: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.messaging.updateStructured(roomId, agent.matrixUserId, eventId, {
        ...base,
        status: 'failed',
        errorMessage: message,
        durationMs: Date.now() - startedAt,
        completedAt: Date.now(),
      });
    }
  }
}

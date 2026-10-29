import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AppEvent,
  type ChannelAiEntityEnabledChangedEvent,
  type ChannelAiEntityLinkedEvent,
} from '@org/api-common';
import {
  MatrixAdminService,
  MatrixBotMessagingService,
  MatrixInboundRouterService,
  type MatrixTimelineEvent,
} from '@org/api-matrix';
import { PrismaService } from '@org/database';
import type { AgentToolExecution, AIAgentMessageContent } from '@org/types';
import { AIRuntimeService } from './ai-runtime.service.js';
import { FollowUpSuggestionsService } from './follow-up-suggestions.service.js';

const ENTITY_SELECT = {
  id: true,
  type: true,
  workspaceId: true,
  name: true,
  role: true,
  model: true,
  provider: true,
  avatarUrl: true,
  matrixUserId: true,
} as const;

interface EntityTarget {
  id: string;
  type: string;
  workspaceId: string;
  name: string;
  role: string;
  model: string;
  provider?: string | null;
  avatarUrl: string | null;
  matrixUserId: string | null;
}

const DM_CACHE_TTL_MS = 5 * 60_000;
const DM_MISS_TTL_MS = 15_000;

/** A mention sent before the entity joined is replayed only while it is this fresh. */
const REPLAY_WINDOW_MS = 10 * 60_000;
const REPLAY_HISTORY_LIMIT = 15;

const BARE_MENTION_PROMPT =
  'You were mentioned without a message. Greet them briefly and ask how you can help.';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether `promptText` addresses the entity — by Matrix id or `@Name` — and,
 * if so, the text with the mention stripped.
 */
function matchMention(
  entity: { name: string; matrixUserId: string | null },
  promptText: string,
  mentionedUserIds: readonly string[] = [],
): { prompt: string } | null {
  const nameRegex = new RegExp(`@${escapeRegExp(entity.name)}(?![\\w])`, 'i');
  const byId = !!entity.matrixUserId && mentionedUserIds.includes(entity.matrixUserId);
  if (!byId && !nameRegex.test(promptText)) return null;
  return { prompt: promptText.replace(nameRegex, '').trim() };
}

/**
 * Unified Matrix Bridge for all AI Entities (AI Agents and AI Coworkers).
 *
 * Makes an AI entity answer inside its own Matrix DM room, as well as in
 * channels, group DMs, and threads whenever mentioned.
 */
@Injectable()
export class AgentMatrixBridgeService implements OnModuleInit {
  private readonly logger = new Logger(AgentMatrixBridgeService.name);
  private readonly dmCache = new Map<
    string,
    { entityId: string | null; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MatrixInboundRouterService,
    private readonly messaging: MatrixBotMessagingService,
    private readonly admin: MatrixAdminService,
    private readonly runtimeService: AIRuntimeService,
    private readonly followUps: FollowUpSuggestionsService,
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

    let target: EntityTarget | null = await this.prisma.aIAgent.findFirst({
      where: { matrixRoomId: event.room_id },
      select: ENTITY_SELECT,
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
          select: ENTITY_SELECT,
        });

        const mentions = event.content['m.mentions'] as
          | { user_ids?: unknown }
          | undefined;
        const mentionedUserIds = Array.isArray(mentions?.user_ids)
          ? mentions.user_ids.filter((id): id is string => typeof id === 'string')
          : [];

        for (const e of entities) {
          const match = matchMention(e, promptText, mentionedUserIds);
          if (match) {
            target = e;
            cleanPrompt = match.prompt;
            if (!threadRootId) {
              threadRootId = event.event_id;
            }
            break;
          }
        }
      } else {
        // Not a channel: it may be a 1:1 DM with an AI entity. Those rooms are
        // created per user from the browser, so `AIAgent.matrixRoomId` (one
        // value per agent) can never identify them — the room's members do.
        target = await this.resolveDirectMessageEntity(event.room_id, event.sender);
      }
    }

    if (!target) return false;
    if (event.sender === target.matrixUserId) return false;
    // A bare "@Ada" is still a summons — answer it instead of going silent.
    if (!cleanPrompt.trim()) cleanPrompt = BARE_MENTION_PROMPT;

    const requesterId = await this.resolveRequester(event.sender, target.workspaceId);

    void this.runTurn(
      target,
      event.room_id,
      cleanPrompt,
      threadRootId,
      channelId,
      channelName,
      requesterId,
    ).catch((error) => {
      this.logger.error(
        `AI Entity turn failed for ${target.id} in ${event.room_id}: ${String(error)}`,
      );
    });

    return true;
  }

  @OnEvent(AppEvent.ChannelAiEntityLinked)
  async onEntityLinked(event: ChannelAiEntityLinkedEvent): Promise<void> {
    await this.replayPendingMention(event.channelId, event.entityId);
  }

  @OnEvent(AppEvent.ChannelAiEntityEnabledChanged)
  async onEntityEnabled(event: ChannelAiEntityEnabledChangedEvent): Promise<void> {
    if (event.isEnabled) await this.replayPendingMention(event.channelId, event.entityId);
  }

  /**
   * "Add to channel" on a mention notice happens *after* the message was sent,
   * so the entity never saw it. Once it is linked, answer the latest recent
   * message that mentioned it and that it has not already replied to.
   */
  private async replayPendingMention(channelId: string, entityId: string): Promise<void> {
    // Anything newer than the link reaches the entity through the live path.
    const linkedAt = Date.now();
    try {
      const [channel, entity] = await Promise.all([
        this.prisma.channel.findUnique({
          where: { id: channelId },
          select: { id: true, name: true, matrixRoomId: true },
        }),
        this.loadEntity(entityId),
      ]);
      if (!channel?.matrixRoomId || !entity?.matrixUserId) return;

      await this.admin.joinRoomAs(entity.matrixUserId, channel.matrixRoomId).catch(() => undefined);
      const history = await this.admin.getRecentRoomEvents(
        channel.matrixRoomId,
        entity.matrixUserId,
        REPLAY_HISTORY_LIMIT,
      );

      // Newest first: stop at the entity's own reply — everything older was answered.
      const cutoff = Date.now() - REPLAY_WINDOW_MS;
      for (const msg of history) {
        if (msg.type !== 'm.room.message' || msg.origin_server_ts < cutoff) continue;
        if (msg.origin_server_ts > linkedAt) continue;
        if (msg.sender === entity.matrixUserId) return;
        const relatesTo = msg.content['m.relates_to'] as { rel_type?: string } | undefined;
        if (relatesTo?.rel_type === 'm.replace') continue;
        const body = typeof msg.content['body'] === 'string' ? msg.content['body'] : '';
        const mentions = msg.content['m.mentions'] as { user_ids?: unknown } | undefined;
        const ids = Array.isArray(mentions?.user_ids)
          ? mentions.user_ids.filter((id): id is string => typeof id === 'string')
          : [];
        const match = matchMention(entity, body, ids);
        if (!match) continue;

        const requesterId = await this.resolveRequester(msg.sender, entity.workspaceId);
        await this.runTurn(
          entity,
          channel.matrixRoomId,
          match.prompt || BARE_MENTION_PROMPT,
          msg.event_id,
          channel.id,
          channel.name,
          requesterId,
        );
        return;
      }
    } catch (error) {
      this.logger.warn(
        `Could not replay pending mention for ${entityId} in ${channelId}: ${String(error)}`,
      );
    }
  }

  /**
   * The AI entity on the other end of a 1:1 DM room, or `null` when the room is
   * not exactly {sender, one entity}. Group DMs fall through so entities there
   * only answer when mentioned. Results are cached briefly: this runs for every
   * message in every non-channel room, and each miss costs a Synapse admin call.
   */
  private async resolveDirectMessageEntity(
    roomId: string,
    sender: string,
  ): Promise<EntityTarget | null> {
    const cached = this.dmCache.get(roomId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.entityId ? this.loadEntity(cached.entityId) : null;
    }

    let members: string[];
    try {
      members = await this.admin.getRoomMembers(roomId);
    } catch (error) {
      this.logger.warn(`Could not read members of ${roomId}: ${String(error)}`);
      return null;
    }

    const others = members.filter((id) => id !== sender);
    const entity =
      members.length === 2 && others.length === 1
        ? await this.prisma.aIAgent.findFirst({
            where: { matrixUserId: others[0], isActive: true },
            select: ENTITY_SELECT,
          })
        : null;

    // Short negative TTL: a bot's invite is auto-joined asynchronously, so the
    // first message can race it and must be re-checked soon.
    this.dmCache.set(roomId, {
      entityId: entity?.id ?? null,
      expiresAt: Date.now() + (entity ? DM_CACHE_TTL_MS : DM_MISS_TTL_MS),
    });
    if (this.dmCache.size > 2000) {
      const oldest = this.dmCache.keys().next().value;
      if (oldest) this.dmCache.delete(oldest);
    }
    return entity;
  }

  private loadEntity(id: string): Promise<EntityTarget | null> {
    return this.prisma.aIAgent.findFirst({
      where: { id, isActive: true },
      select: ENTITY_SELECT,
    });
  }

  /**
   * The platform user behind a Matrix sender, when they are an active member
   * of the entity's workspace — the person a creator-less coworker acts for.
   */
  private async resolveRequester(sender: string, workspaceId: string): Promise<string | undefined> {
    const user = await this.prisma.user.findUnique({
      where: { matrixUserId: sender },
      select: { id: true },
    });
    if (!user) return undefined;
    const member = await this.prisma.workspaceMember.count({
      where: { workspaceId, userId: user.id, status: 'ACTIVE' },
    });
    return member > 0 ? user.id : undefined;
  }

  private async runTurn(
    entity: {
      id: string;
      type: string;
      workspaceId: string;
      name: string;
      role: string;
      model: string;
      provider?: string | null;
      avatarUrl: string | null;
      matrixUserId: string | null;
    },
    roomId: string,
    promptText: string,
    threadRootId?: string,
    channelId?: string,
    channelName?: string,
    requesterId?: string,
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
        { channelId, channelName, roomId, threadRootId, requesterId, source: 'chat' },
        postToolUpdate,
      );

      const completed: AIAgentMessageContent = {
        ...base,
        status: 'completed',
        responseText: result.result,
        tools: result.tools,
        ...(result.connectionsNeeded ? { connectionsNeeded: result.connectionsNeeded } : {}),
        durationMs: Date.now() - startedAt,
        completedAt: Date.now(),
      };
      await this.messaging.updateStructured(
        roomId,
        entity.matrixUserId,
        eventId,
        completed,
        { threadRootId },
      );

      // The answer is already on screen; follow-ups arrive as a second edit
      // so they never delay it. `matrixUserId` is narrowed by the guard above.
      const matrixUserId = entity.matrixUserId;
      void this.followUps
        .suggest({
          workspaceId: entity.workspaceId,
          provider: entity.provider,
          model: entity.model,
          agentName: entity.name,
          agentRole: roleBadge,
          question: promptText,
          answer: result.result ?? '',
          toolNames: result.tools?.map((t) => t.name),
        })
        .then(async (suggestedActions) => {
          if (suggestedActions.length === 0) return;
          await this.messaging.updateStructured(
            roomId,
            matrixUserId,
            eventId,
            { ...completed, suggestedActions },
            { threadRootId },
          );
        })
        .catch((error: unknown) =>
          this.logger.warn(
            `Could not attach follow-ups: ${error instanceof Error ? error.message : String(error)}`,
          ),
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

import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AppEvent,
  type ChannelAppEnabledChangedEvent,
  type ChannelAppLinkedEvent,
  type IntegrationUpdatedEvent,
} from '@org/api-common';
import {
  MatrixAdminService,
  MatrixBotMessagingService,
  MatrixInboundRouterService,
  type MatrixTimelineEvent,
} from '@org/api-matrix';
import { PrismaService } from '@org/database';
import { getAppDisplayName, splitAppConnectionName } from '@org/types';
import { IntegrationsService } from './integrations.service.js';

const REPLAY_WINDOW_MS = 10 * 60_000;
const REPLAY_HISTORY_LIMIT = 15;

export interface AppChatIntegration {
  id: string;
  matrixUserId: string | null;
  provider: string;
  displayName: string | null;
  workspaceId: string | null;
}

export interface AppChatRequest {
  integration: AppChatIntegration;
  roomId: string;
  userId: string;
  /** What the person asked, in their own words. */
  text: string;
  threadRootId?: string;
  channel?: { id: string; name: string };
}

/**
 * Turns a plain-language request into app actions. Supplied by `@org/api-agents`
 * (it owns the model loop), because `api-agents` already depends on this
 * library and not the other way round.
 */
export type AppChatPlanner = (request: AppChatRequest) => Promise<void>;

/**
 * Makes a connected app answer inside its own Matrix DM room.
 *
 * Unlike an agent, an app has no free-text intelligence of its own — there is
 * no endpoint that turns "email John the invoice" into a Gmail API call. So
 * v1 keeps this deterministic: free text gets a help card listing the app's
 * registered actions (`ProviderAdapter.getActions()`), and `/<actionId>
 * {"json":"input"}` runs one directly through `IntegrationsService.executeAction`
 * — which already enforces permissions, confirmation, and posts the result
 * back into the room. Routing a natural-language request to the right action
 * is later polish, once this deterministic path is proven out.
 */
@Injectable()
export class AppMatrixBridgeService implements OnModuleInit {
  private readonly logger = new Logger(AppMatrixBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly router: MatrixInboundRouterService,
    private readonly messaging: MatrixBotMessagingService,
    private readonly integrationsService: IntegrationsService,
    private readonly admin: MatrixAdminService,
  ) {}

  private planner?: AppChatPlanner;

  onModuleInit(): void {
    this.router.register((event) => this.tryHandle(event));
    // Bots provisioned before names were canonical still read
    // "Asana · balram" in every room; bring them in line once at boot.
    void this.syncAllBotProfiles();
  }

  /** A rename moves the app's Matrix bot name too, so the sender name, the
   * member list and @-mention pills all match the rest of the UI. */
  @OnEvent(AppEvent.IntegrationUpdated)
  async onIntegrationUpdated(event: IntegrationUpdatedEvent): Promise<void> {
    const integration = await this.prisma.externalIntegration.findUnique({
      where: { id: event.integrationId },
      select: { id: true, provider: true, displayName: true, matrixUserId: true },
    });
    if (integration?.matrixUserId) await this.pushBotProfile(integration);
  }

  private async syncAllBotProfiles(): Promise<void> {
    try {
      const bots = await this.prisma.externalIntegration.findMany({
        where: { status: 'CONNECTED', matrixUserId: { not: null } },
        select: { id: true, provider: true, displayName: true, matrixUserId: true },
      });
      for (const bot of bots) await this.pushBotProfile(bot);
    } catch (error) {
      this.logger.warn(`App bot profile sync skipped: ${String(error)}`);
    }
  }

  private async pushBotProfile(integration: {
    id: string;
    provider: string;
    displayName: string | null;
  }): Promise<void> {
    // Best-effort by contract (`pushUserProfile` swallows homeserver errors).
    await this.admin.pushUserProfile({
      userId: `app-${integration.id}`,
      displayName: getAppDisplayName(integration),
    });
  }

  /** Lets "create a task for the launch" run as real app actions. */
  setPlanner(planner: AppChatPlanner): void {
    this.planner = planner;
  }

  @OnEvent(AppEvent.ChannelAppLinked)
  async onAppLinked(event: ChannelAppLinkedEvent): Promise<void> {
    await this.replayPendingRequest(event.channelId, event.integrationId);
  }

  @OnEvent(AppEvent.ChannelAppEnabledChanged)
  async onAppEnabled(event: ChannelAppEnabledChangedEvent): Promise<void> {
    if (event.isEnabled) await this.replayPendingRequest(event.channelId, event.integrationId);
  }

  /**
   * Adding an app from a mention notice happens after the message was sent, so
   * the app never saw it. Once linked, run the newest recent message that
   * addresses it back through the normal routing, stopping at the app's own
   * last reply.
   */
  private async replayPendingRequest(channelId: string, integrationId: string): Promise<void> {
    const linkedAt = Date.now();
    try {
      const [channel, integration] = await Promise.all([
        this.prisma.channel.findUnique({
          where: { id: channelId },
          select: { matrixRoomId: true },
        }),
        this.prisma.externalIntegration.findUnique({
          where: { id: integrationId },
          select: { matrixUserId: true },
        }),
      ]);
      if (!channel?.matrixRoomId || !integration?.matrixUserId) return;

      await this.admin
        .joinRoomAs(integration.matrixUserId, channel.matrixRoomId)
        .catch(() => undefined);
      const history = await this.admin.getRecentRoomEvents(
        channel.matrixRoomId,
        integration.matrixUserId,
        REPLAY_HISTORY_LIMIT,
      );

      const cutoff = Date.now() - REPLAY_WINDOW_MS;
      for (const msg of history) {
        if (msg.type !== 'm.room.message' || msg.origin_server_ts < cutoff) continue;
        if (msg.origin_server_ts > linkedAt) continue;
        if (msg.sender === integration.matrixUserId) return;
        if (await this.tryHandle({ ...msg, room_id: channel.matrixRoomId })) return;
      }
    } catch (error) {
      this.logger.warn(
        `Could not replay pending request for ${integrationId} in ${channelId}: ${String(error)}`,
      );
    }
  }

  private async tryHandle(event: MatrixTimelineEvent): Promise<boolean> {
    const relatesTo = event.content['m.relates_to'] as
      | { rel_type?: string; event_id?: string }
      | undefined;
    if (relatesTo?.rel_type === 'm.replace') return false;

    let threadRootId: string | undefined = undefined;
    if (relatesTo?.rel_type === 'm.thread' && typeof relatesTo.event_id === 'string') {
      threadRootId = relatesTo.event_id;
    }

    const body =
      typeof event.content['body'] === 'string' ? event.content['body'] : '';
    if (!body.trim()) return false;

    let integration = await this.prisma.externalIntegration.findFirst({
      where: { matrixRoomId: event.room_id },
      select: {
        id: true,
        matrixUserId: true,
        provider: true,
        displayName: true,
        workspaceId: true,
      },
    });

    // In a channel the app is addressed by its provider name — `/github
    // create_issue {"title":"…"}` — so the provider token is dropped and what
    // follows is handled exactly like a command typed in the app's own DM.
    let effectiveBody = body;
    let channelInfo: { id: string; name: string } | undefined;

    // `/asana …` or `@Asana · balram …` — the app is named by its provider or,
    // when picked from the composer's @ menu, by its full display name (which
    // carries the connection label, e.g. "Asana · balram"). The mention may sit
    // anywhere in the message; the text around it is the request.
    if (!integration && /[/@]/.test(body)) {
      const channel = await this.prisma.channel.findFirst({
        where: { matrixRoomId: event.room_id },
        select: { id: true, name: true, workspaceId: true },
      });

      if (channel) {
        const connected = await this.prisma.externalIntegration.findMany({
          where: { workspaceId: channel.workspaceId, status: 'CONNECTED' },
          select: {
            id: true,
            matrixUserId: true,
            provider: true,
            displayName: true,
            workspaceId: true,
          },
        });

        const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let match: {
          candidate: (typeof connected)[number];
          start: number;
          end: number;
          slash: boolean;
        } | null = null;

        for (const candidate of connected) {
          // Longest name first so "Asana · balram" wins over plain "Asana".
          const names = [
            candidate.displayName,
            splitAppConnectionName(candidate.displayName ?? '').appName,
            getAppDisplayName(candidate),
            candidate.provider,
          ]
            .filter((n): n is string => !!n?.trim())
            .sort((a, b) => b.length - a.length);
          for (const name of names) {
            const re = new RegExp(
              `(?:^|\\s)([@/])${escape(name.trim()).replace(/\s+/g, '\\s+')}(?![\\w-])`,
              'i',
            );
            const m = re.exec(body);
            if (!m) continue;
            const start = m.index + m[0].indexOf(m[1]);
            // A slash only addresses an app at the very start (`/asana …`).
            if (m[1] === '/' && body.slice(0, start).trim()) continue;
            if (!match || start < match.start) {
              match = {
                candidate,
                start,
                end: m.index + m[0].length,
                slash: m[1] === '/',
              };
            }
            break;
          }
        }

        if (match) {
          const channelLink = await this.prisma.channelIntegration.findFirst({
            where: {
              channelId: channel.id,
              integrationId: match.candidate.id,
              isEnabled: true,
            },
            select: { id: true },
          });

          if (channelLink) {
            integration = match.candidate;
            channelInfo = { id: channel.id, name: channel.name };
            const request = `${body.slice(0, match.start)} ${body.slice(match.end)}`
              .replace(/\s+/g, ' ')
              .trim();
            // `/asana create_task {…}` stays a direct command; anything else
            // is a sentence for the app to act on.
            effectiveBody = !request
              ? 'help'
              : match.slash && /^[a-z0-9_]+(\s+\{[\s\S]*\})?$/i.test(request)
                ? `/${request}`
                : request;
            if (!threadRootId) {
              threadRootId = event.event_id;
            }
          }
        }
      }
    }

    if (!integration) return false;
    if (event.sender === integration.matrixUserId) return false;

    const sender = await this.prisma.user.findFirst({
      where: { matrixUserId: event.sender },
      select: { id: true },
    });
    if (!sender) return false;

    void this.handleMessage(
      integration,
      event.room_id,
      sender.id,
      effectiveBody,
      threadRootId,
      channelInfo,
    ).catch((error) => {
      this.logger.error(
        `App bridge failed for ${integration.id} in ${event.room_id}: ${String(error)}`,
      );
    });

    return true;
  }

  private async handleMessage(
    integration: {
      id: string;
      matrixUserId: string | null;
      provider: string;
      displayName: string | null;
      workspaceId: string | null;
    },
    roomId: string,
    userId: string,
    body: string,
    threadRootId?: string,
    channel?: { id: string; name: string },
  ): Promise<void> {
    if (!integration.matrixUserId) return;

    const trimmed = body.trim();
    if (trimmed !== 'help' && this.planner && !trimmed.startsWith('/')) {
      try {
        await this.planner({ integration, roomId, userId, text: trimmed, threadRootId, channel });
      } catch (error) {
        await this.messaging.sendStructured(
          roomId,
          integration.matrixUserId,
          {
            type: 'mie.system',
            severity: 'error',
            title: `${integration.displayName ?? integration.provider} could not do that`,
            details: error instanceof Error ? error.message : String(error),
          },
          { threadRootId },
        );
      }
      return;
    }
    if (trimmed.startsWith('/')) {
      await this.runSlashCommand(
        integration,
        roomId,
        userId,
        trimmed,
        threadRootId,
      );
    } else {
      await this.postHelp(integration, roomId, userId, threadRootId);
    }
  }

  private async runSlashCommand(
    integration: {
      id: string;
      matrixUserId: string | null;
      workspaceId: string | null;
    },
    roomId: string,
    userId: string,
    command: string,
    threadRootId?: string,
  ): Promise<void> {
    if (!integration.matrixUserId) return;

    const spaceIndex = command.indexOf(' ');
    const actionId = (
      spaceIndex === -1 ? command.slice(1) : command.slice(1, spaceIndex)
    ).trim();
    const rest = spaceIndex === -1 ? '' : command.slice(spaceIndex + 1).trim();

    let rawInput: Record<string, unknown> = {};
    if (rest) {
      try {
        const parsed: unknown = JSON.parse(rest);
        if (parsed && typeof parsed === 'object') {
          rawInput = parsed as Record<string, unknown>;
        }
      } catch {
        await this.messaging.sendStructured(
          roomId,
          integration.matrixUserId,
          {
            type: 'mie.system',
            severity: 'error',
            title: 'Could not parse action input',
            details: `Expected JSON after /${actionId}, e.g. /${actionId} {"key":"value"}.`,
          },
          { threadRootId },
        );
        return;
      }
    }

    const confirm = rawInput['confirm'] === true;
    const { confirm: _drop, ...input } = rawInput;

    try {
      await this.integrationsService.executeAction(
        integration.id,
        actionId,
        input,
        confirm,
        userId,
        integration.workspaceId ?? undefined,
        roomId,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.messaging.sendStructured(
        roomId,
        integration.matrixUserId,
        {
          type: 'mie.system',
          severity: 'error',
          title: `/${actionId} failed`,
          details: message,
        },
        { threadRootId },
      );
    }
  }

  private async postHelp(
    integration: {
      id: string;
      matrixUserId: string | null;
      provider: string;
      displayName: string | null;
    },
    roomId: string,
    userId: string,
    threadRootId?: string,
  ): Promise<void> {
    if (!integration.matrixUserId) return;

    const actions = await this.integrationsService.getActions(
      integration.id,
      userId,
    );

    const appName = integration.displayName ?? integration.provider;
    await this.messaging.sendStructured(
      roomId,
      integration.matrixUserId,
      {
        type: 'mie.system',
        severity: 'info',
        title:
          actions.length > 0
            ? `${appName} understands these commands`
            : `${appName} has no chat actions yet`,
        details:
          actions.length > 0
            ? actions
                .map((action) => `/${action.id} — ${action.description}`)
                .join('\n')
            : 'This app only sends activity into channels for now.',
      },
      { threadRootId },
    );
  }
}

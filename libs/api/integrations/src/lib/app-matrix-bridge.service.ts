import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  MatrixBotMessagingService,
  MatrixInboundRouterService,
  type MatrixTimelineEvent,
} from '@org/api-matrix';
import { PrismaService } from '@org/database';
import { IntegrationsService } from './integrations.service.js';

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
  ) {}

  private planner?: AppChatPlanner;

  onModuleInit(): void {
    this.router.register((event) => this.tryHandle(event));
  }

  /** Lets "create a task for the launch" run as real app actions. */
  setPlanner(planner: AppChatPlanner): void {
    this.planner = planner;
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

    // `/asana …` or `@asana …` — the app is named by its provider.
    const named = /^\s*[/@]([a-z0-9_]+)\b/i.exec(body);
    if (!integration && named) {
      const channel = await this.prisma.channel.findFirst({
        where: { matrixRoomId: event.room_id },
        select: { id: true, name: true, workspaceId: true },
      });

      if (channel) {
        const command = named[1].toLowerCase();
        const candidate = await this.prisma.externalIntegration.findFirst({
          where: {
            workspaceId: channel.workspaceId,
            status: 'CONNECTED',
            provider: { equals: command, mode: 'insensitive' },
          },
          select: {
            id: true,
            matrixUserId: true,
            provider: true,
            displayName: true,
            workspaceId: true,
          },
        });

        if (candidate) {
          const channelLink = await this.prisma.channelIntegration.findFirst({
            where: {
              channelId: channel.id,
              integrationId: candidate.id,
              isEnabled: true,
            },
            select: { id: true },
          });

          if (channelLink) {
            integration = candidate;
            channelInfo = { id: channel.id, name: channel.name };
            const afterProvider = body.trim().slice(1 + command.length).trim();
            // `/asana create_task {…}` stays a direct command; anything else
            // after the provider is a sentence for the app to act on.
            effectiveBody = !afterProvider
              ? 'help'
              : /^[a-z0-9_]+(\s+\{[\s\S]*\})?$/i.test(afterProvider)
                ? `/${afterProvider}`
                : afterProvider;
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

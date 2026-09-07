import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  MatrixBotMessagingService,
  MatrixInboundRouterService,
  type MatrixTimelineEvent,
} from '@org/api-matrix';
import { PrismaService } from '@org/database';
import { IntegrationsService } from './integrations.service.js';

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

  onModuleInit(): void {
    this.router.register((event) => this.tryHandle(event));
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

    if (!integration && body.trim().startsWith('/')) {
      const channel = await this.prisma.channel.findFirst({
        where: { matrixRoomId: event.room_id },
        select: { id: true, workspaceId: true },
      });

      if (channel) {
        const command = body.trim().slice(1).split(' ')[0].toLowerCase();
        integration = await this.prisma.externalIntegration.findFirst({
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
        if (integration && !threadRootId) {
          threadRootId = event.event_id;
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
      body,
      threadRootId,
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
  ): Promise<void> {
    if (!integration.matrixUserId) return;

    const trimmed = body.trim();
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

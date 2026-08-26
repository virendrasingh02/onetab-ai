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
    const integration = await this.prisma.externalIntegration.findFirst({
      where: { matrixRoomId: event.room_id },
      select: {
        id: true,
        matrixUserId: true,
        provider: true,
        displayName: true,
        workspaceId: true,
      },
    });
    if (!integration) return false;
    if (event.sender === integration.matrixUserId) return false;

    const relatesTo = event.content['m.relates_to'] as
      | { rel_type?: string }
      | undefined;
    if (relatesTo?.rel_type === 'm.replace') return false;

    const body =
      typeof event.content['body'] === 'string' ? event.content['body'] : '';
    if (!body.trim()) return false;

    const sender = await this.prisma.user.findFirst({
      where: { matrixUserId: event.sender },
      select: { id: true },
    });
    // A room this bridge should ever see has exactly one human in it, whose
    // Matrix identity was provisioned by `MatrixAuthService.ensureIdentity` —
    // no match means this sender isn't one of our users, so there's no
    // `userId` to run permission checks as.
    if (!sender) return false;

    void this.handleMessage(integration, event.room_id, sender.id, body).catch(
      (error) => {
        this.logger.error(
          `App bridge failed for ${integration.id} in ${event.room_id}: ${String(error)}`,
        );
      },
    );

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
  ): Promise<void> {
    if (!integration.matrixUserId) return; // can't happen: this room only exists once matrixUserId does

    const trimmed = body.trim();
    if (trimmed.startsWith('/')) {
      await this.runSlashCommand(integration, roomId, userId, trimmed);
    } else {
      await this.postHelp(integration, roomId, userId);
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
        await this.messaging.sendStructured(roomId, integration.matrixUserId, {
          type: 'mie.system',
          severity: 'error',
          title: 'Could not parse action input',
          details: `Expected JSON after /${actionId}, e.g. /${actionId} {"key":"value"}.`,
        });
        return;
      }
    }

    // A bare slash-command has no dialog to confirm through, so an explicit
    // `"confirm": true` inside the JSON body is how a human opts into a
    // sensitive action from chat — `executeAction` refuses it otherwise and
    // posts why, same as it would for any other caller.
    const confirm = rawInput['confirm'] === true;
    const { confirm: _drop, ...input } = rawInput;

    try {
      // `executeAction` already posts the success/failure card into the room
      // itself (`IntegrationsService.postActionResult`) — nothing further to
      // post here on success.
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
      await this.messaging.sendStructured(roomId, integration.matrixUserId, {
        type: 'mie.system',
        severity: 'error',
        title: `/${actionId} failed`,
        details: message,
      });
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
  ): Promise<void> {
    if (!integration.matrixUserId) return;

    const actions = await this.integrationsService.getActions(
      integration.id,
      userId,
    );

    const appName = integration.displayName ?? integration.provider;
    await this.messaging.sendStructured(roomId, integration.matrixUserId, {
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
    });
  }
}

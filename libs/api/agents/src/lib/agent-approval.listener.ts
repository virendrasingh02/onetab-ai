import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvent, type AgentApprovalDecidedEvent } from '@org/api-common';
import { IntegrationsService } from '@org/api-integrations';
import { MatrixBotMessagingService } from '@org/api-matrix';
import { PrismaService } from '@org/database';

/**
 * Executes (or notifies the rejection of) a gated tool call once a human
 * decides an `ApprovalRequest` an Agent/Coworker turn raised
 * (`AIRuntimeService.runToolCall`) — the "Continue / Stop" half of the
 * approval flow. Lives as an event listener, not a direct call from
 * `ApprovalsService` (`@org/api-ai`), because `api-ai` must not depend on
 * `api-agents`, which already depends on it.
 */
@Injectable()
export class AgentApprovalListener {
  private readonly logger = new Logger(AgentApprovalListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly botMessaging: MatrixBotMessagingService,
  ) {}

  @OnEvent(AppEvent.AgentApprovalDecided)
  async handle(event: AgentApprovalDecidedEvent): Promise<void> {
    const payload = event.proposedPayload as {
      integrationId?: string;
      actionId?: string;
      actionLabel?: string;
      input?: Record<string, unknown>;
      roomId?: string | null;
      threadRootId?: string | null;
    };
    const { integrationId, actionId, input, roomId } = payload;
    const label = payload.actionLabel ?? event.actionType;

    if (!integrationId || !actionId) {
      this.logger.warn(
        `Approval ${event.approvalId} decided but its payload is missing integrationId/actionId — nothing to run.`,
      );
      return;
    }

    if (event.decision === 'REJECTED') {
      await this.notify(event, roomId ?? null, `❌ Rejected: ${label}`);
      return;
    }

    if (!event.approverId) {
      this.logger.warn(`Approval ${event.approvalId} approved with no approverId — refusing to run it.`);
      return;
    }

    try {
      await this.integrations.executeAction(
        integrationId,
        actionId,
        input ?? {},
        true,
        event.approverId,
        event.workspaceId,
        roomId ?? undefined,
      );
      // `executeAction` already posts the result into `roomId` as the
      // integration's own bot identity when one is given — no duplicate post.
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Approved action ${event.approvalId} failed to run: ${message}`);
      await this.notify(event, roomId ?? null, `⚠️ Approved but failed to run: ${label} — ${message}`);
    }
  }

  private async notify(
    event: AgentApprovalDecidedEvent,
    roomId: string | null,
    text: string,
  ): Promise<void> {
    if (!roomId) return;
    const entity = await this.prisma.aIAgent.findUnique({
      where: { id: event.entityId },
      select: { matrixUserId: true },
    });
    if (!entity?.matrixUserId) return;
    try {
      await this.botMessaging.sendText(roomId, entity.matrixUserId, text);
    } catch (error) {
      this.logger.warn(`Failed to post approval outcome for ${event.approvalId}: ${String(error)}`);
    }
  }
}

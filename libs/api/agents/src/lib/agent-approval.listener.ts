import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AppEvent, type AgentApprovalDecidedEvent } from '@org/api-common';
import { MCPService } from '@org/api-ai';
import { IntegrationsService } from '@org/api-integrations';
import { MatrixBotMessagingService } from '@org/api-matrix';
import { PrismaService } from '@org/database';
import { MCPToolRegistryService } from './mcp-tool-registry.service.js';

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
    private readonly mcpServers: MCPService,
    private readonly builtinTools: MCPToolRegistryService,
  ) {}

  @OnEvent(AppEvent.AgentApprovalDecided)
  async handle(event: AgentApprovalDecidedEvent): Promise<void> {
    const payload = event.proposedPayload as {
      integrationId?: string;
      actionId?: string;
      mcpConnectionId?: string;
      mcpToolName?: string;
      builtinTool?: string;
      actionLabel?: string;
      input?: Record<string, unknown>;
      roomId?: string | null;
      threadRootId?: string | null;
    };
    const { integrationId, actionId, input, roomId } = payload;
    const label = payload.actionLabel ?? event.actionType;

    if (payload.builtinTool) {
      await this.runBuiltinTool(event, payload.builtinTool, input ?? {}, roomId ?? null, label);
      return;
    }

    if (payload.mcpConnectionId && payload.mcpToolName) {
      await this.runMcpTool(
        event,
        payload.mcpConnectionId,
        payload.mcpToolName,
        input ?? {},
        roomId ?? null,
        label,
      );
      return;
    }

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

  /**
   * A workspace tool (`create_task`, `send_channel_message`, …) the agent's
   * autonomy or a "require approval" flag held back. It runs as it would have
   * in the turn — with the agent's creator as the acting user.
   */
  private async runBuiltinTool(
    event: AgentApprovalDecidedEvent,
    toolName: string,
    input: Record<string, unknown>,
    roomId: string | null,
    label: string,
  ): Promise<void> {
    if (event.decision === 'REJECTED') {
      await this.notify(event, roomId, `❌ Rejected: ${label}`);
      return;
    }
    const entity = await this.prisma.aIAgent.findUnique({
      where: { id: event.entityId },
      select: { creatorId: true, matrixUserId: true, workspaceId: true },
    });
    if (!entity || entity.workspaceId !== event.workspaceId) {
      this.logger.warn(`Approval ${event.approvalId}: its agent no longer exists — nothing to run.`);
      return;
    }
    try {
      const output = await this.builtinTools.executeTool(toolName, input, {
        workspaceId: event.workspaceId,
        actingUserId: entity.creatorId,
        agentMatrixUserId: entity.matrixUserId,
      });
      const summary = typeof output === 'string' ? output : JSON.stringify(output ?? 'Done.');
      await this.notify(event, roomId, `✅ ${label}: ${summary.slice(0, 1_500)}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Approved tool ${event.approvalId} failed to run: ${message}`);
      await this.notify(event, roomId, `⚠️ Approved but failed to run: ${label} — ${message}`);
    }
  }

  /** The MCP-server half: run the approved tool call, report either way. */
  private async runMcpTool(
    event: AgentApprovalDecidedEvent,
    connectionId: string,
    toolName: string,
    input: Record<string, unknown>,
    roomId: string | null,
    label: string,
  ): Promise<void> {
    if (event.decision === 'REJECTED') {
      await this.notify(event, roomId, `❌ Rejected: ${label}`);
      return;
    }
    try {
      const out = await this.mcpServers.callTool(event.workspaceId, connectionId, toolName, input);
      const summary = (out.text || 'Done.').slice(0, 1_500);
      await this.notify(
        event,
        roomId,
        out.isError ? `⚠️ ${label} reported an error: ${summary}` : `✅ ${label}: ${summary}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Approved MCP call ${event.approvalId} failed to run: ${message}`);
      await this.notify(event, roomId, `⚠️ Approved but failed to run: ${label} — ${message}`);
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

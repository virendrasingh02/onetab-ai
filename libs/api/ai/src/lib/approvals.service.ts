import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent, type AgentApprovalEntityType } from '@org/api-common';
import { PrismaService } from '@org/database';
import type { ApprovalDecisionInput } from '@org/types';

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Raises an approval checkpoint for a gated AI Agent/Coworker tool call
   * (`AIRuntimeService`'s tool-calling loop — distinct from a workflow's
   * `HUMAN_APPROVAL` node, which creates its own row directly).
   */
  async createForEntityAction(params: {
    workspaceId: string;
    entityType: AgentApprovalEntityType;
    entityId: string;
    requesterId: string | null;
    actionType: string;
    proposedPayload: Record<string, unknown>;
  }) {
    return this.prisma.approvalRequest.create({
      data: {
        workspaceId: params.workspaceId,
        entityType: params.entityType,
        entityId: params.entityId,
        requesterId: params.requesterId,
        actionType: params.actionType,
        proposedPayload: params.proposedPayload as any,
        state: 'PENDING',
      },
    });
  }

  async listApprovals(workspaceId: string, state?: string) {
    return this.prisma.approvalRequest.findMany({
      where: {
        workspaceId,
        ...(state ? { state } : {}),
      },
      include: {
        requester: {
          select: { id: true, name: true, avatarUrl: true },
        },
        approver: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getApproval(workspaceId: string, id: string) {
    const req = await this.prisma.approvalRequest.findFirst({
      where: { id, workspaceId },
      include: {
        requester: {
          select: { id: true, name: true, avatarUrl: true },
        },
        approver: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });
    if (!req) throw new NotFoundException('Approval request not found');
    return req;
  }

  async decide(
    workspaceId: string,
    id: string,
    approverId: string | undefined,
    data: ApprovalDecisionInput,
  ) {
    const req = await this.getApproval(workspaceId, id);
    if (req.state !== 'PENDING') {
      throw new BadRequestException(`Approval request is already ${req.state}`);
    }

    const updated = await this.prisma.approvalRequest.update({
      where: { id },
      data: {
        state: data.decision,
        approverId,
        comment: data.comment,
        respondedAt: new Date(),
        ...(data.revisedPayload ? { proposedPayload: data.revisedPayload as any } : {}),
      },
      include: {
        requester: {
          select: { id: true, name: true, avatarUrl: true },
        },
        approver: {
          select: { id: true, name: true, avatarUrl: true },
        },
      },
    });

    if (req.executionId) {
      const exec = await this.prisma.aIExecution.findUnique({
        where: { id: req.executionId },
      });
      if (exec && exec.status === 'WAITING_APPROVAL') {
        await this.prisma.aIExecution.update({
          where: { id: req.executionId },
          data: {
            status: data.decision === 'APPROVED' ? 'COMPLETED' : 'FAILED',
            finishedAt: new Date(),
          },
        });
      }
    }

    this.logger.log(
      `Approval request ${id} ${data.decision.toLowerCase()} by user ${approverId}`,
    );

    if (updated.entityType === 'agent' || updated.entityType === 'coworker') {
      this.events.emit(AppEvent.AgentApprovalDecided, {
        workspaceId,
        approvalId: updated.id,
        entityType: updated.entityType,
        entityId: updated.entityId,
        decision: data.decision,
        approverId: approverId ?? null,
        actionType: updated.actionType,
        proposedPayload: (updated.proposedPayload ?? {}) as Record<string, unknown>,
      });
    }

    return updated;
  }
}

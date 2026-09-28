import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent, type AgentApprovalEntityType } from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  canManageOwnedAIResource,
  type ApprovalDecisionInput,
  type WorkspacePermission,
} from '@org/types';

/** Who is looking at, or deciding, an approval. */
export interface ApprovalActor {
  userId: string;
  permissions?: readonly WorkspacePermission[];
}

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
    /** The run waiting on this decision, so deciding it closes the run. */
    executionId?: string | null;
  }) {
    return this.prisma.approvalRequest.create({
      data: {
        workspaceId: params.workspaceId,
        entityType: params.entityType,
        entityId: params.entityId,
        requesterId: params.requesterId,
        executionId: params.executionId ?? null,
        actionType: params.actionType,
        proposedPayload: params.proposedPayload as any,
        state: 'PENDING',
      },
    });
  }

  /**
   * Who may approve or reject: the person the request was raised on behalf
   * of (the agent's or workflow's creator — the action would run as them), or
   * a workspace admin. Previously any member with UPDATE could approve any
   * agent's destructive action, and a workflow step's "requires ADMIN or
   * OWNER review" was not enforced at all.
   */
  canDecide(requesterId: string | null, actor: ApprovalActor): boolean {
    return canManageOwnedAIResource(requesterId, actor);
  }

  async listApprovals(workspaceId: string, state?: string, actor?: ApprovalActor) {
    const rows = await this.prisma.approvalRequest.findMany({
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
    return rows.map((row) => ({
      ...row,
      canDecide: actor ? this.canDecide(row.requesterId, actor) : false,
    }));
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
    actor: ApprovalActor,
    data: ApprovalDecisionInput,
  ) {
    const approverId = actor.userId;
    const req = await this.getApproval(workspaceId, id);
    if (!this.canDecide(req.requesterId, actor)) {
      throw new ForbiddenException(
        'Only the person this request was raised for, or a workspace admin, can decide it.',
      );
    }
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

    // A workflow run resumes (or stops) in the automations engine, which
    // owns its status from here — see WorkflowApprovalListener.
    const isWorkflow = updated.entityType === 'WORKFLOW';
    if (req.executionId && !isWorkflow) {
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

    if (isWorkflow) {
      this.events.emit(AppEvent.WorkflowApprovalDecided, {
        workspaceId,
        approvalId: updated.id,
        workflowId: updated.entityId,
        executionId: updated.executionId,
        stepId: updated.stepId,
        decision: data.decision,
        approverId: approverId ?? null,
        comment: updated.comment ?? null,
        proposedPayload: (updated.proposedPayload ?? {}) as Record<string, unknown>,
      });
    } else if (updated.entityType === 'agent' || updated.entityType === 'coworker') {
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

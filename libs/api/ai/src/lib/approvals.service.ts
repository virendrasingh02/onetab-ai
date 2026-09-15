import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { ApprovalDecisionInput } from '@org/types';

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    return updated;
  }
}

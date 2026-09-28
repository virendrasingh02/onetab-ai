import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { AIExecutionFilter } from '@org/types';

@Injectable()
export class AIExecutionsService {
  constructor(private readonly prisma: PrismaService) {}

  async listExecutions(workspaceId: string, filters?: AIExecutionFilter) {
    return this.prisma.aIExecution.findMany({
      where: {
        workspaceId,
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.entityType ? { entityType: filters.entityType } : {}),
        ...(filters?.entityId ? { entityId: filters.entityId } : {}),
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: filters?.limit ?? 50,
      skip: filters?.offset ?? 0,
    });
  }

  async getExecution(workspaceId: string, id: string) {
    const exec = await this.prisma.aIExecution.findFirst({
      where: { id, workspaceId },
      include: {
        user: {
          select: { id: true, name: true },
        },
        steps: {
          orderBy: { startedAt: 'asc' },
        },
      },
    });
    if (!exec) throw new NotFoundException('Execution record not found');
    return exec;
  }

  /**
   * Cancels a run that is waiting for an approval: the run is closed and its
   * pending approvals are withdrawn, so approving one later cannot resume it.
   * A run that is actively executing cannot be interrupted mid-step — it is
   * refused rather than marked "cancelled" while it keeps going.
   */
  async cancelExecution(workspaceId: string, id: string) {
    const exec = await this.getExecution(workspaceId, id);
    if (exec.status === 'RUNNING') {
      throw new ConflictException(
        "This run is executing right now and can't be interrupted; it will finish on its own.",
      );
    }
    if (exec.status !== 'WAITING_APPROVAL') return exec;
    await this.prisma.$transaction([
      this.prisma.aIExecution.update({
        where: { id },
        data: { status: 'CANCELLED', finishedAt: new Date() },
      }),
      this.prisma.approvalRequest.updateMany({
        where: { executionId: id, state: 'PENDING' },
        data: { state: 'CANCELLED', respondedAt: new Date() },
      }),
    ]);
    return this.getExecution(workspaceId, id);
  }
}

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
        ...(filters?.startDate || filters?.endDate
          ? {
              startedAt: {
                ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
                ...(filters.endDate ? { lt: new Date(filters.endDate) } : {}),
              },
            }
          : {}),
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
   * Cancels a run. One waiting for an approval, or paused, closes now and its
   * pending approvals are withdrawn, so approving one later cannot resume it.
   * A workflow (or Studio agent) run that is executing stops at its next step
   * boundary — the engine checks between steps — and the step in progress is
   * not cut off mid-call. An agent chat turn cannot be interrupted, so it is
   * refused rather than marked "cancelled" while it keeps going.
   */
  async cancelExecution(workspaceId: string, id: string) {
    const exec = await this.getExecution(workspaceId, id);
    const running = exec.status === 'RUNNING';
    if (running && exec.entityType !== 'WORKFLOW') {
      throw new ConflictException(
        "This run is executing right now and can't be interrupted; it will finish on its own.",
      );
    }
    if (!running && exec.status !== 'WAITING_APPROVAL' && exec.status !== 'PAUSED') return exec;
    await this.prisma.$transaction([
      this.prisma.aIExecution.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          // A running run is closed (with its duration) by the engine when it stops.
          ...(running ? {} : { finishedAt: new Date() }),
          errorsJson: { message: 'Cancelled by a person.' },
        },
      }),
      this.prisma.approvalRequest.updateMany({
        where: { executionId: id, state: 'PENDING' },
        data: { state: 'CANCELLED', respondedAt: new Date() },
      }),
    ]);
    return this.getExecution(workspaceId, id);
  }
}

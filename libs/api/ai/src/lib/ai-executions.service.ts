import { Injectable, NotFoundException } from '@nestjs/common';
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

  async cancelExecution(workspaceId: string, id: string) {
    const exec = await this.getExecution(workspaceId, id);
    if (exec.status === 'RUNNING' || exec.status === 'WAITING_APPROVAL') {
      await this.prisma.aIExecution.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          finishedAt: new Date(),
        },
      });
    }
  }

  async retryExecution(workspaceId: string, id: string) {
    const original = await this.getExecution(workspaceId, id);

    return this.prisma.aIExecution.create({
      data: {
        workspaceId,
        userId: original.userId,
        entityType: original.entityType,
        entityId: original.entityId,
        version: original.version,
        status: 'RUNNING',
        stateJson: original.stateJson as any,
      },
    });
  }
}

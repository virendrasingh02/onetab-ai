import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { WorkflowEngineService } from './workflow-engine.service.js';

/**
 * Workflows belong to a workspace, so every lookup is filtered by it — a
 * workflow id supplied by the caller is not proof they may run it.
 */
@Injectable()
export class AutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService
  ) {}

  async getWorkflows(workspaceId: string) {
    return this.prisma.automationWorkflow.findMany({
      where: { workspaceId },
      include: { _count: { select: { executions: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createWorkflow(workspaceId: string, creatorId: string, data: { name: string; description?: string; triggerType?: string; nodesJson?: string; edgesJson?: string }) {
    return this.prisma.automationWorkflow.create({
      data: {
        workspaceId,
        creatorId,
        name: data.name,
        description: data.description,
        triggerType: data.triggerType ?? 'WEBHOOK',
        nodesJson: data.nodesJson ?? '[]',
        edgesJson: data.edgesJson ?? '[]',
      },
    });
  }

  async triggerWorkflow(
    workspaceId: string,
    workflowId: string,
    payload: Record<string, unknown> = {},
  ) {
    await this.assertWorkflow(workspaceId, workflowId);
    return this.workflowEngine.executeWorkflow(workflowId, payload);
  }

  async getExecutions(workspaceId: string, workflowId: string) {
    await this.assertWorkflow(workspaceId, workflowId);
    return this.prisma.workflowExecution.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }

  private async assertWorkflow(workspaceId: string, workflowId: string) {
    const found = await this.prisma.automationWorkflow.findFirst({
      where: { id: workflowId, workspaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Workflow not found.');
  }
}

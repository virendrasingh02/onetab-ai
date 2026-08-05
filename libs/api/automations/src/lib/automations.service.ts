import { Injectable } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { WorkflowEngineService } from './workflow-engine.service.js';

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

  async triggerWorkflow(workflowId: string, payload: Record<string, unknown> = {}) {
    return this.workflowEngine.executeWorkflow(workflowId, payload);
  }

  async getExecutions(workflowId: string) {
    return this.prisma.workflowExecution.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }
}

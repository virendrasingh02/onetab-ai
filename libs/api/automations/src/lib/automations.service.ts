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

  async updateWorkflow(
    workspaceId: string,
    workflowId: string,
    data: {
      name?: string;
      description?: string;
      triggerType?: string;
      nodesJson?: string;
      edgesJson?: string;
      isActive?: boolean;
    },
  ) {
    await this.assertWorkflow(workspaceId, workflowId);
    return this.prisma.automationWorkflow.update({
      where: { id: workflowId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.triggerType !== undefined
          ? { triggerType: data.triggerType }
          : {}),
        ...(data.nodesJson !== undefined ? { nodesJson: data.nodesJson } : {}),
        ...(data.edgesJson !== undefined ? { edgesJson: data.edgesJson } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async deleteWorkflow(workspaceId: string, workflowId: string): Promise<void> {
    await this.assertWorkflow(workspaceId, workflowId);
    await this.prisma.automationWorkflow.delete({ where: { id: workflowId } });
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

  /**
   * Recent executions across every workflow in the workspace.
   *
   * Scoped by the parent workflow's workspace — the logs screen is
   * workspace-wide, so there is no workflow id to check against.
   */
  async getWorkspaceExecutions(workspaceId: string, take = 50) {
    return this.prisma.workflowExecution.findMany({
      where: { workflow: { workspaceId } },
      include: {
        workflow: { select: { id: true, name: true, triggerType: true } },
      },
      orderBy: { startedAt: 'desc' },
      take,
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

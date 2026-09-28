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

  async createWorkflow(
    workspaceId: string,
    creatorId: string,
    data: {
      name: string;
      description?: string;
      triggerType?: string;
      nodesJson?: string;
      edgesJson?: string;
      isActive?: boolean;
    },
  ) {
    return this.prisma.automationWorkflow.create({
      data: {
        workspaceId,
        creatorId,
        name: data.name,
        description: data.description,
        triggerType: data.triggerType ?? 'WEBHOOK',
        nodesJson: data.nodesJson ?? '[]',
        edgesJson: data.edgesJson ?? '[]',
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
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

  async getWorkflow(workspaceId: string, workflowId: string) {
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: { id: workflowId, workspaceId },
      include: { _count: { select: { executions: true } } },
    });
    if (!workflow) throw new NotFoundException('Workflow not found.');
    return workflow;
  }

  async listVersions(workspaceId: string, workflowId: string) {
    await this.assertWorkflow(workspaceId, workflowId);
    return this.prisma.aIWorkflowVersion.findMany({
      where: { workflowId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        name: true,
        changeSummary: true,
        isPublished: true,
        createdAt: true,
      },
    });
  }

  /**
   * An immutable copy of the workflow's current graph. Publishing is a
   * snapshot marked published that also switches the workflow on, so what
   * triggers run is always a version someone can roll back to.
   */
  async snapshot(
    workspaceId: string,
    workflowId: string,
    options: { summary?: string; publish?: boolean } = {},
  ) {
    const workflow = await this.getWorkflow(workspaceId, workflowId);
    const latest = await this.prisma.aIWorkflowVersion.findFirst({
      where: { workflowId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const version = await this.prisma.aIWorkflowVersion.create({
      data: {
        workflowId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        name: workflow.name,
        description: workflow.description,
        nodesJson: workflow.nodesJson,
        edgesJson: workflow.edgesJson,
        changeSummary: options.summary?.trim() || (options.publish ? 'Published' : 'Snapshot'),
        isPublished: !!options.publish,
      },
    });
    if (options.publish && !workflow.isActive) {
      await this.prisma.automationWorkflow.update({
        where: { id: workflowId },
        data: { isActive: true },
      });
    }
    return version;
  }

  async restoreVersion(workspaceId: string, workflowId: string, versionNumber: number) {
    await this.assertWorkflow(workspaceId, workflowId);
    const version = await this.prisma.aIWorkflowVersion.findUnique({
      where: { workflowId_versionNumber: { workflowId, versionNumber } },
    });
    if (!version) throw new NotFoundException(`Version ${versionNumber} not found.`);
    return this.prisma.automationWorkflow.update({
      where: { id: workflowId },
      data: { nodesJson: version.nodesJson, edgesJson: version.edgesJson },
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

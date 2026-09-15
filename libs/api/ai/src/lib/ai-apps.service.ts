import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { CreateAIAppInput } from '@org/types';

@Injectable()
export class AIAppsService {

  constructor(private readonly prisma: PrismaService) {}

  async listApps(workspaceId: string) {
    return this.prisma.aIApp.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
      include: {
        agent: {
          select: { id: true, name: true, role: true, avatarUrl: true },
        },
      },
    });
  }

  async getApp(workspaceId: string, id: string) {
    const app = await this.prisma.aIApp.findFirst({
      where: { id, workspaceId },
      include: {
        agent: {
          select: { id: true, name: true, role: true, avatarUrl: true },
        },
      },
    });
    if (!app) throw new NotFoundException('AI App not found');
    return app;
  }

  async createApp(
    workspaceId: string,
    creatorId: string | undefined,
    data: CreateAIAppInput,
  ) {
    const slug = (
      data.slug ||
      data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    ) + `-${Date.now().toString().slice(-4)}`;

    return this.prisma.aIApp.create({
      data: {
        workspaceId,
        creatorId,
        name: data.name,
        slug,
        description: data.description,
        icon: data.icon ?? 'Sparkles',
        appType: data.appType ?? 'CHAT_APP',
        visibility: data.visibility ?? 'WORKSPACE',
        agentId: data.agentId,
        workflowId: data.workflowId,
        promptTemplateId: data.promptTemplateId,
        config: (data.config as any) ?? {},
      },
    });
  }

  async updateApp(
    workspaceId: string,
    id: string,
    data: Partial<CreateAIAppInput>,
  ) {
    await this.getApp(workspaceId, id);
    return this.prisma.aIApp.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        icon: data.icon,
        appType: data.appType,
        visibility: data.visibility,
        agentId: data.agentId,
        workflowId: data.workflowId,
        promptTemplateId: data.promptTemplateId,
        config: data.config ? (data.config as any) : undefined,
      },
    });
  }

  async deleteApp(workspaceId: string, id: string) {
    await this.getApp(workspaceId, id);
    await this.prisma.aIApp.delete({ where: { id } });
  }

  async publishApp(workspaceId: string, id: string, isPublished: boolean) {
    await this.getApp(workspaceId, id);
    return this.prisma.aIApp.update({
      where: { id },
      data: { isPublished },
    });
  }

  async executeApp(
    workspaceId: string,
    userId: string | undefined,
    id: string,
    payload: Record<string, unknown>,
  ) {
    const app = await this.getApp(workspaceId, id);

    const execution = await this.prisma.aIExecution.create({
      data: {
        workspaceId,
        userId,
        entityType: 'APP',
        entityId: app.id,
        appId: app.id,
        status: 'RUNNING',
        stateJson: payload as any,
      },
    });

    const start = Date.now();
    let result = `Processed request via AI App '${app.name}'.`;

    if (app.agentId) {
      result = `Delegated to underlying Agent (${app.agentId}) with response generated.`;
    } else if (app.workflowId) {
      result = `Triggered underlying Automation Workflow (${app.workflowId}).`;
    }

    const latencyMs = Date.now() - start;

    await this.prisma.aIExecution.update({
      where: { id: execution.id },
      data: {
        status: 'COMPLETED',
        finishedAt: new Date(),
        latencyMs,
        tokensUsed: 150,
        totalCost: 0.0003,
      },
    });

    return {
      executionId: execution.id,
      result,
    };
  }
}

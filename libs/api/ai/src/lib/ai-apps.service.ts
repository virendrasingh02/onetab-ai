import {
  Injectable,
  NotFoundException,
  NotImplementedException,
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

  /**
   * AI Apps have no runner yet. This used to return a canned sentence
   * ("Delegated to underlying Agent … with response generated.") and record a
   * COMPLETED run with a made-up 150 tokens, without running anything. It now
   * says so instead of fabricating a result; run the underlying agent or
   * workflow from the AI Workspace.
   */
  async executeApp(
    workspaceId: string,
    _userId: string | undefined,
    id: string,
    _payload: Record<string, unknown>,
  ): Promise<never> {
    await this.getApp(workspaceId, id);
    throw new NotImplementedException(
      'AI Apps cannot be run yet. Run the agent or workflow behind it from the AI Workspace.',
    );
  }
}

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { AIStudioOverview } from '@org/types';

@Injectable()
export class AIStudioService {

  constructor(private readonly prisma: PrismaService) {}

  async getOverview(workspaceId: string): Promise<AIStudioOverview> {
    const [
      totalAgents,
      totalCoworkers,
      totalWorkflows,
      totalApps,
      totalKnowledgeBases,
      totalExecutions,
      completedExecutions,
      recentExecutions,
      agents,
      workflows,
      apps,
    ] = await Promise.all([
      this.prisma.aIAgent.count({ where: { workspaceId, type: 'agent' } }),
      this.prisma.aIAgent.count({ where: { workspaceId, type: 'coworker' } }),
      this.prisma.automationWorkflow.count({ where: { workspaceId } }),
      this.prisma.aIApp.count({ where: { workspaceId } }),
      this.prisma.knowledgeBase.count({ where: { workspaceId } }),
      this.prisma.aIExecution.count({ where: { workspaceId } }),
      this.prisma.aIExecution.count({ where: { workspaceId, status: 'COMPLETED' } }),
      this.prisma.aIExecution.findMany({
        where: { workspaceId },
        orderBy: { startedAt: 'desc' },
        take: 8,
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.aIAgent.findMany({
        where: { workspaceId },
        select: { id: true, name: true, type: true, isActive: true, updatedAt: true },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.automationWorkflow.findMany({
        where: { workspaceId },
        select: { id: true, name: true, isActive: true, updatedAt: true },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.aIApp.findMany({
        where: { workspaceId },
        select: { id: true, name: true, isPublished: true, updatedAt: true },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const successRate = totalExecutions > 0 ? (completedExecutions / totalExecutions) * 100 : 100;
    const totalTokensUsed = recentExecutions.reduce((sum, e) => sum + (e.tokensUsed || 0), 0);
    const totalCostEstimate = recentExecutions.reduce((sum, e) => sum + (e.totalCost || 0), 0);

    const draftResources: AIStudioOverview['draftResources'] = [];
    const publishedResources: AIStudioOverview['publishedResources'] = [];

    for (const a of agents) {
      const item = {
        id: a.id,
        name: a.name,
        type: a.type as 'agent' | 'coworker',
        updatedAt: a.updatedAt.toISOString(),
      };
      if (a.isActive) publishedResources.push(item);
      else draftResources.push(item);
    }

    for (const w of workflows) {
      const item = {
        id: w.id,
        name: w.name,
        type: 'workflow' as const,
        updatedAt: w.updatedAt.toISOString(),
      };
      if (w.isActive) publishedResources.push(item);
      else draftResources.push(item);
    }

    for (const app of apps) {
      const item = {
        id: app.id,
        name: app.name,
        type: 'app' as const,
        updatedAt: app.updatedAt.toISOString(),
      };
      if (app.isPublished) publishedResources.push(item);
      else draftResources.push(item);
    }

    return {
      totalAgents,
      totalCoworkers,
      totalWorkflows,
      totalApps,
      totalKnowledgeBases,
      totalExecutions,
      successRate: Number(successRate.toFixed(1)),
      totalTokensUsed,
      totalCostEstimate: Number(totalCostEstimate.toFixed(4)),
      recentExecutions: recentExecutions.map((e) => ({
        id: e.id,
        workspaceId: e.workspaceId,
        userId: e.userId,
        entityType: e.entityType as any,
        entityId: e.entityId,
        version: e.version,
        status: e.status as any,
        startedAt: e.startedAt.toISOString(),
        finishedAt: e.finishedAt?.toISOString() ?? null,
        latencyMs: e.latencyMs,
        tokensUsed: e.tokensUsed,
        totalCost: e.totalCost,
        model: e.model,
        toolCalls: (e.toolCalls as any) ?? [],
        errorsJson: (e.errorsJson as any) ?? null,
        stateJson: (e.stateJson as any) ?? {},
        user: e.user,
      })),
      draftResources,
      publishedResources,
    };
  }

  async quickCreate(
    workspaceId: string,
    userId: string | undefined,
    data: { name: string; type: string; description?: string },
  ) {
    const name = data.name.trim();
    if (!name) throw new BadRequestException('Name is required');

    switch (data.type) {
      case 'agent': {
        const agent = await this.prisma.aIAgent.create({
          data: {
            workspaceId,
            creatorId: userId,
            type: 'agent',
            name,
            role: 'Specialist Agent',
            description: data.description,
            systemPrompt: 'You are an autonomous AI specialist assisting the team.',
          },
        });
        return { id: agent.id, type: 'agent' };
      }

      case 'coworker': {
        const coworker = await this.prisma.aIAgent.create({
          data: {
            workspaceId,
            creatorId: userId,
            type: 'coworker',
            name,
            role: 'AI Teammate',
            description: data.description,
            systemPrompt: 'You are an autonomous, persistent coworker in this workspace.',
          },
        });
        return { id: coworker.id, type: 'coworker' };
      }

      case 'workflow': {
        const wf = await this.prisma.automationWorkflow.create({
          data: {
            workspaceId,
            creatorId: userId,
            name,
            description: data.description,
            triggerType: 'MANUAL',
            nodesJson: JSON.stringify([
              { id: 'start-1', type: 'START', label: 'Start Workflow', config: {} },
              { id: 'llm-1', type: 'LLM', label: 'AI Process', config: { model: 'llama3' } },
              { id: 'out-1', type: 'OUTPUT', label: 'Final Output', config: {} },
            ]),
            edgesJson: JSON.stringify([
              { id: 'e1', source: 'start-1', target: 'llm-1' },
              { id: 'e2', source: 'llm-1', target: 'out-1' },
            ]),
          },
        });
        return { id: wf.id, type: 'workflow' };
      }

      case 'app': {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const app = await this.prisma.aIApp.create({
          data: {
            workspaceId,
            creatorId: userId,
            name,
            slug: `${slug}-${Date.now().toString().slice(-4)}`,
            description: data.description,
            appType: 'CHAT_APP',
          },
        });
        return { id: app.id, type: 'app' };
      }

      case 'knowledge': {
        const kb = await this.prisma.knowledgeBase.create({
          data: {
            workspaceId,
            createdById: userId,
            name,
            description: data.description,
          },
        });
        return { id: kb.id, type: 'knowledge' };
      }

      default:
        throw new BadRequestException(`Unsupported resource type: ${data.type}`);
    }
  }
}

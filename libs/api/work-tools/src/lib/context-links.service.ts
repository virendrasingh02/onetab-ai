import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type {
  ContextOverviewDto,
  CrossObjectLinkDto,
} from '@org/types';
import type { CreateCrossObjectLinkInput } from '@org/validation';

@Injectable()
export class ContextLinksService {
  constructor(private readonly prisma: PrismaService) {}

  async createLink(
    workspaceId: string,
    input: CreateCrossObjectLinkInput,
  ): Promise<CrossObjectLinkDto> {
    const link = await this.prisma.crossObjectLink.upsert({
      where: {
        workspaceId_sourceType_sourceId_targetType_targetId_linkType: {
          workspaceId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          targetType: input.targetType,
          targetId: input.targetId,
          linkType: input.linkType ?? 'RELATED',
        },
      },
      create: {
        workspaceId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        targetType: input.targetType,
        targetId: input.targetId,
        linkType: input.linkType ?? 'RELATED',
        metadata: (input.metadata as any) ?? {},
      },
      update: {
        metadata: (input.metadata as any) ?? {},
      },
    });

    return {
      id: link.id,
      workspaceId: link.workspaceId,
      sourceType: link.sourceType,
      sourceId: link.sourceId,
      targetType: link.targetType,
      targetId: link.targetId,
      linkType: link.linkType,
      metadata: (link.metadata as Record<string, unknown>) ?? {},
      createdAt: link.createdAt.toISOString(),
    };
  }

  async getContext(
    workspaceId: string,
    targetType: string,
    targetId: string,
  ): Promise<ContextOverviewDto> {
    // 1. Query explicit cross-object links
    const explicitLinks = await this.prisma.crossObjectLink.findMany({
      where: {
        workspaceId,
        OR: [
          { sourceType: targetType, sourceId: targetId },
          { targetType, targetId },
        ],
      },
    });

    const overview: ContextOverviewDto = {
      targetType,
      targetId,
      title: `${targetType} details`,
      relatedPeople: [],
      relatedMessages: [],
      relatedTasks: [],
      relatedFiles: [],
      relatedDocs: [],
      relatedAgents: [],
      activityCount: 0,
    };

    // 2. Resolve native details and relations based on targetType
    if (targetType === 'task') {
      const task = await this.prisma.task.findFirst({
        where: { id: targetId, workspaceId, deletedAt: null },
        include: {
          assignee: { select: { id: true, name: true, displayName: true, avatarUrl: true, presence: true } },
          reporter: { select: { id: true, name: true, displayName: true, avatarUrl: true, presence: true } },
          project: { select: { id: true, name: true } },
          comments: {
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { author: { select: { id: true, name: true, displayName: true, avatarUrl: true } } },
          },
        },
      });

      if (!task) throw new NotFoundException(`Task ${targetId} not found`);

      overview.title = task.identifier ? `${task.identifier} ${task.title}` : task.title;

      if (task.assignee) {
        overview.relatedPeople.push({
          id: task.assignee.id,
          name: task.assignee.displayName || task.assignee.name,
          role: 'Assignee',
          avatarUrl: task.assignee.avatarUrl,
          presence: task.assignee.presence,
        });
      }
      if (task.reporter && task.reporter.id !== task.assignee?.id) {
        overview.relatedPeople.push({
          id: task.reporter.id,
          name: task.reporter.displayName || task.reporter.name,
          role: 'Reporter',
          avatarUrl: task.reporter.avatarUrl,
          presence: task.reporter.presence,
        });
      }

      // Query related files for this task
      const files = await this.prisma.upload.findMany({
        where: {
          workspaceId,
          OR: [
            { contextType: 'ISSUE', contextId: targetId },
            ...(task.projectId ? [{ projectId: task.projectId, contextType: 'PROJECT' as const }] : []),
          ],
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      overview.relatedFiles = files.map((f) => ({
        id: f.id,
        filename: f.filename,
        size: f.size,
        mimeType: f.mimeType,
        href: `files?fileId=${f.id}`,
      }));

      // Task activities count
      overview.activityCount = await this.prisma.workItemActivity.count({
        where: { workItemId: targetId },
      });
    } else if (targetType === 'channel') {
      const channel = await this.prisma.channel.findFirst({
        where: { id: targetId, workspaceId },
        include: {
          members: {
            take: 10,
            include: {
              user: { select: { id: true, name: true, displayName: true, avatarUrl: true, presence: true } },
            },
          },
          channelAgents: {
            where: { isEnabled: true },
            include: { agent: { select: { id: true, name: true, model: true } } },
          },
        },
      });

      if (!channel) throw new NotFoundException(`Channel ${targetId} not found`);

      overview.title = `#${channel.name}`;
      overview.relatedPeople = channel.members.map((m) => ({
        id: m.user.id,
        name: m.user.displayName || m.user.name,
        role: m.role,
        avatarUrl: m.user.avatarUrl,
        presence: m.user.presence,
      }));

      overview.relatedAgents = channel.channelAgents.map((a) => ({
        id: a.agent.id,
        name: a.agent.name,
        model: a.agent.model,
      }));

      const files = await this.prisma.upload.findMany({
        where: { workspaceId, channelId: targetId },
        take: 10,
        orderBy: { createdAt: 'desc' },
      });

      overview.relatedFiles = files.map((f) => ({
        id: f.id,
        filename: f.filename,
        size: f.size,
        mimeType: f.mimeType,
        href: `files?fileId=${f.id}`,
      }));
    } else if (targetType === 'file' || targetType === 'upload') {
      const file = await this.prisma.upload.findFirst({
        where: { id: targetId, workspaceId },
        include: {
          uploader: { select: { id: true, name: true, displayName: true, avatarUrl: true, presence: true } },
          channel: { select: { id: true, name: true } },
          project: { select: { id: true, name: true } },
        },
      });

      if (!file) throw new NotFoundException(`File ${targetId} not found`);

      overview.title = file.filename;
      overview.relatedPeople.push({
        id: file.uploader.id,
        name: file.uploader.displayName || file.uploader.name,
        role: 'Uploader',
        avatarUrl: file.uploader.avatarUrl,
        presence: file.uploader.presence,
      });

      if (file.projectId) {
        const tasks = await this.prisma.task.findMany({
          where: { workspaceId, projectId: file.projectId, deletedAt: null },
          take: 5,
        });
        overview.relatedTasks = tasks.map((t) => ({
          id: t.id,
          title: t.identifier ? `${t.identifier} ${t.title}` : t.title,
          status: t.status,
          priority: t.priority,
          identifier: t.identifier ?? undefined,
          href: `tasks?taskId=${t.id}`,
        }));
      }
    } else if (targetType === 'doc' || targetType === 'document') {
      const doc = await this.prisma.workDocument.findFirst({
        where: { id: targetId, workspaceId, deletedAt: null },
        include: {
          author: { select: { id: true, name: true, displayName: true, avatarUrl: true, presence: true } },
        },
      });

      if (!doc) throw new NotFoundException(`Document ${targetId} not found`);

      overview.title = doc.title || 'Untitled Document';
      overview.relatedPeople.push({
        id: doc.author.id,
        name: doc.author.displayName || doc.author.name,
        role: 'Author',
        avatarUrl: doc.author.avatarUrl,
        presence: doc.author.presence,
      });
    }

    // 3. Process explicit links
    for (const link of explicitLinks) {
      const isSource = link.sourceType === targetType && link.sourceId === targetId;
      const otherType = isSource ? link.targetType : link.sourceType;
      const otherId = isSource ? link.targetId : link.sourceId;
      const meta = (link.metadata as Record<string, unknown>) ?? {};

      if (otherType === 'message') {
        overview.relatedMessages.push({
          id: otherId,
          roomId: (meta['roomId'] as string) || '',
          channelName: (meta['channelName'] as string) || undefined,
          senderName: (meta['senderName'] as string) || 'Team Member',
          body: (meta['preview'] as string) || (meta['body'] as string) || 'Linked conversation message',
          timestamp: link.createdAt.toISOString(),
          href: (meta['href'] as string) || 'inbox',
        });
      } else if (otherType === 'task' && targetType !== 'task') {
        const linkedTask = await this.prisma.task.findUnique({
          where: { id: otherId },
          select: { id: true, title: true, status: true, priority: true, identifier: true },
        });
        if (linkedTask) {
          overview.relatedTasks.push({
            id: linkedTask.id,
            title: linkedTask.identifier ? `${linkedTask.identifier} ${linkedTask.title}` : linkedTask.title,
            status: linkedTask.status,
            priority: linkedTask.priority,
            identifier: linkedTask.identifier ?? undefined,
            href: `tasks?taskId=${linkedTask.id}`,
          });
        }
      }
    }

    return overview;
  }
}

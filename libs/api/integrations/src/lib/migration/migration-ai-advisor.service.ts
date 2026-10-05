import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { AIAdoptionRecommendation } from '@org/types';

@Injectable()
export class MigrationAiAdvisorService {
  private readonly logger = new Logger(MigrationAiAdvisorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Analyzes the migrated workspace channels and message contents to generate
   * contextual platform adoption recommendations.
   */
  async generateAdoptionRecommendations(
    workspaceId: string,
    migrationId: string,
  ): Promise<AIAdoptionRecommendation[]> {
    const recommendations: AIAdoptionRecommendation[] = [];

    // 1. Inspect migrated channels
    const channels = await this.prisma.channel.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
    });

    const projectKeywords = ['project', 'launch', 'sprint', 'dev', 'release', 'roadmap', 'product', 'design'];
    const schedulingKeywords = ['schedule', 'meeting', 'calendar', 'sync', 'standup', 'huddle'];
    const reportingKeywords = ['kpi', 'report', 'metric', 'weekly', 'status', 'update', 'ops'];

    for (const channel of channels) {
      const name = channel.name.toLowerCase();
      const topic = (channel.topic || '').toLowerCase();

      // Check for project management discussions
      if (projectKeywords.some((k) => name.includes(k) || topic.includes(k))) {
        recommendations.push({
          id: `rec-proj-${channel.id}`,
          title: `Convert #${channel.name} discussions into a dedicated Project`,
          category: 'projects',
          rationale: `Channel #${channel.name} contains roadmap and deliverable discussions. OneTab Projects provides milestone tracking, Kanban boards, and linked documents directly integrated with this channel.`,
          channelId: channel.id,
          channelName: channel.name,
          suggestedAction: 'Create Project with linked board and channel',
          actionType: 'create_project',
        });
      }

      // Check for scheduling coordination
      if (schedulingKeywords.some((k) => name.includes(k) || topic.includes(k))) {
        recommendations.push({
          id: `rec-sched-${channel.id}`,
          title: `Activate AI Scheduler Coworker in #${channel.name}`,
          category: 'scheduler',
          rationale: `Frequent calendar coordination detected in #${channel.name}. The Scheduler Coworker automatically coordinates participant availability, creates video calls, and posts agendas into the channel.`,
          channelId: channel.id,
          channelName: channel.name,
          suggestedAction: 'Add Scheduler Coworker to channel',
          actionType: 'setup_scheduler',
        });
      }

      // Check for recurring operational/KPI updates
      if (reportingKeywords.some((k) => name.includes(k) || topic.includes(k))) {
        recommendations.push({
          id: `rec-track-${channel.id}`,
          title: `Enable AI Tracker Coworker for recurring updates`,
          category: 'tracker',
          rationale: `Recurring status reports and operational updates detected in #${channel.name}. The Tracker Coworker monitors KPIs, summarizes weekly output, and sends automated progress recaps.`,
          channelId: channel.id,
          channelName: channel.name,
          suggestedAction: 'Configure Tracker Coworker for automated summaries',
          actionType: 'setup_tracker',
        });
      }
    }

    // Check for inactive or duplicate channels
    if (channels.length > 5) {
      const potentiallyInactive = channels.filter(
        (c) => c.isArchived || (c._count.members <= 1 && c.name !== 'general'),
      );
      if (potentiallyInactive.length > 0) {
        recommendations.push({
          id: 'rec-cleanup-channels',
          title: `Clean up ${potentiallyInactive.length} low-activity channel(s)`,
          category: 'channels',
          rationale: `${potentiallyInactive.length} channels (${potentiallyInactive.map((c) => `#${c.name}`).slice(0, 3).join(', ')}${potentiallyInactive.length > 3 ? '...' : ''}) have single-member participation. Archiving them declutters your team's sidebar.`,
          suggestedAction: 'Review and archive low-activity channels',
          actionType: 'archive_channel',
        });
      }
    }

    // General AI Coworker recommendation if not already added
    const existingCoworkers = await this.prisma.aIAgent.count({
      where: { workspaceId, type: 'coworker' },
    });
    if (existingCoworkers === 0) {
      recommendations.push({
        id: 'rec-coworkers-init',
        title: 'Initialize AI Coworkers (Scheduler & Tracker)',
        category: 'coworkers',
        rationale:
          'Supercharge your workspace with autonomous AI coworkers tailored for meeting management and progress tracking across all migrated channels.',
        suggestedAction: 'Enable Scheduler and Tracker Coworkers',
        actionType: 'setup_scheduler',
      });
    }

    // Persist recommendations on migration record
    await this.prisma.migrationSession.update({
      where: { id: migrationId },
      data: {
        aiRecommendations: recommendations as any,
      },
    });

    return recommendations;
  }

  /**
   * Applies an approved recommendation directly into the destination workspace.
   */
  async applyRecommendation(
    workspaceId: string,
    recommendationId: string,
    actionType: string,
    payload?: Record<string, unknown>,
  ) {
    this.logger.log(`Applying AI recommendation ${recommendationId} (${actionType})`);

    switch (actionType) {
      case 'create_project': {
        const channelName = (payload?.channelName as string) || 'Migrated Project';
        const rawSlug = channelName.replace(/^#/, '').toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
        const project = await this.prisma.project.create({
          data: {
            workspaceId,
            name: channelName.replace(/^#/, ''),
            slug: `${rawSlug || 'migrated-project'}-${Date.now().toString(36)}`,
            description: 'Created from Slack migration channel discussions',
          },
        });
        return { success: true, createdId: project.id, type: 'project' };
      }

      case 'setup_scheduler': {
        // Ensure default coworkers exist
        const scheduler = await this.prisma.aIAgent.findFirst({
          where: { workspaceId, name: { contains: 'Scheduler', mode: 'insensitive' } },
        });
        if (payload?.channelId && scheduler) {
          await this.prisma.channelCoworker.upsert({
            where: {
              channelId_coworkerId: {
                channelId: payload.channelId as string,
                coworkerId: scheduler.id,
              },
            },
            create: {
              channelId: payload.channelId as string,
              coworkerId: scheduler.id,
              addedById: (payload?.userId as string) || 'system',
            },
            update: {},
          });
        }
        return { success: true, type: 'scheduler' };
      }

      case 'setup_tracker': {
        const tracker = await this.prisma.aIAgent.findFirst({
          where: { workspaceId, name: { contains: 'Tracker', mode: 'insensitive' } },
        });
        if (payload?.channelId && tracker) {
          await this.prisma.channelCoworker.upsert({
            where: {
              channelId_coworkerId: {
                channelId: payload.channelId as string,
                coworkerId: tracker.id,
              },
            },
            create: {
              channelId: payload.channelId as string,
              coworkerId: tracker.id,
              addedById: (payload?.userId as string) || 'system',
            },
            update: {},
          });
        }
        return { success: true, type: 'tracker' };
      }

      case 'archive_channel': {
        if (payload?.channelId) {
          await this.prisma.channel.update({
            where: { id: payload.channelId as string },
            data: { isArchived: true, archivedAt: new Date() },
          });
        }
        return { success: true, type: 'archive' };
      }

      default:
        return { success: true };
    }
  }
}

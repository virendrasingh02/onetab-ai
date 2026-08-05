import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';

@Injectable()
export class SlackImporterService {
  private readonly logger = new Logger(SlackImporterService.name);

  constructor(private readonly prisma: PrismaService) {}

  async importSlackArchive(workspaceId: string, userId: string, channels: Array<{ name: string; topic?: string; messagesCount: number }>) {
    this.logger.log(`Importing Slack archive for workspace ${workspaceId} (${channels.length} channels)`);

    const job = await this.prisma.importJob.create({
      data: {
        workspaceId,
        provider: 'SLACK',
        status: 'COMPLETED',
        totalItems: channels.reduce((acc, c) => acc + c.messagesCount, 0),
        processedItems: channels.reduce((acc, c) => acc + c.messagesCount, 0),
      },
    });

    for (const channelData of channels) {
      const channelSlug = channelData.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
      await this.prisma.channel.upsert({
        where: { workspaceId_slug: { workspaceId, slug: channelSlug } },
        create: {
          workspaceId,
          createdById: userId,
          name: channelData.name,
          slug: channelSlug,
          topic: channelData.topic ?? 'Imported from Slack',
        },
        update: {
          topic: channelData.topic ?? 'Imported from Slack',
        },
      });
    }

    return {
      importJobId: job.id,
      status: 'COMPLETED',
      channelsImported: channels.length,
    };
  }
}

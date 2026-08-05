import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';

@Injectable()
export class NotionImporterService {
  private readonly logger = new Logger(NotionImporterService.name);

  constructor(private readonly prisma: PrismaService) {}

  async importNotionPages(workspaceId: string, authorId: string, pages: Array<{ title: string; content: string }>) {
    this.logger.log(`Importing Notion pages for workspace ${workspaceId} (${pages.length} pages)`);

    const job = await this.prisma.importJob.create({
      data: {
        workspaceId,
        provider: 'NOTION',
        status: 'COMPLETED',
        totalItems: pages.length,
        processedItems: pages.length,
      },
    });

    for (const page of pages) {
      await this.prisma.workDocument.create({
        data: {
          workspaceId,
          authorId,
          title: page.title,
          content: page.content,
          kind: 'DOC',
        },
      });
    }

    return {
      importJobId: job.id,
      status: 'COMPLETED',
      pagesImported: pages.length,
    };
  }
}

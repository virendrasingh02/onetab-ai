import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { KnowledgeService, UnsupportedDocumentError, extractTextFromFile } from '@org/api-ai';
import { PrismaService } from '@org/database';
import { IntegrationsService } from './integrations.service.js';

export interface BrowsableItem {
  id: string;
  name: string;
  kind: string;
  modifiedAt?: string;
  url?: string;
}

const SUPPORTED = new Set(['GOOGLE_DRIVE', 'NOTION']);
const MAX_ITEMS = 25;

/**
 * Pulls content from a connected app (Google Drive, Notion) into a knowledge
 * base. It only goes through the integration's own `executeAction`, so the
 * connection's permission checks and stored credentials apply; nothing here
 * handles tokens. Re-importing an item updates it as a new version.
 */
@Injectable()
export class KnowledgeImportService {
  private readonly logger = new Logger(KnowledgeImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrations: IntegrationsService,
    private readonly knowledge: KnowledgeService,
  ) {}

  private async providerOf(workspaceId: string, integrationId: string): Promise<string> {
    const row = await this.prisma.externalIntegration.findFirst({
      where: { id: integrationId, OR: [{ workspaceId }, { workspaceId: null }] },
      select: { provider: true },
    });
    if (!row || !SUPPORTED.has(row.provider)) {
      throw new BadRequestException('Pick a connected Google Drive or Notion account.');
    }
    return row.provider;
  }

  private async run(
    integrationId: string,
    action: string,
    input: Record<string, unknown>,
    userId: string,
    workspaceId: string,
  ) {
    const result = await this.integrations.executeAction(integrationId, action, input, undefined, userId, workspaceId);
    if (!result.success) throw new BadRequestException(result.message || `${action} failed.`);
    return (result.data ?? {}) as Record<string, any>;
  }

  async browse(workspaceId: string, userId: string, integrationId: string, query?: string): Promise<BrowsableItem[]> {
    const provider = await this.providerOf(workspaceId, integrationId);
    if (provider === 'NOTION') {
      const data = await this.run(integrationId, 'search', { query: query ?? '', type: 'page' }, userId, workspaceId);
      return ((data['results'] ?? []) as any[]).map((r) => ({
        id: String(r.id),
        name: String(r.title ?? 'Untitled'),
        kind: 'page',
        modifiedAt: r.lastEditedTime,
        url: r.url,
      }));
    }
    const data = query?.trim()
      ? await this.run(integrationId, 'search_files', { query }, userId, workspaceId)
      : await this.run(integrationId, 'list_recent', {}, userId, workspaceId);
    return ((data['files'] ?? []) as any[])
      .filter((f) => f.mimeType !== 'application/vnd.google-apps.folder')
      .map((f) => ({
        id: String(f.id),
        name: String(f.name ?? 'Untitled'),
        kind: String(f.mimeType ?? 'file'),
        modifiedAt: f.modifiedTime,
        url: f.webViewLink,
      }));
  }

  async importItems(
    workspaceId: string,
    userId: string,
    knowledgeBaseId: string,
    integrationId: string,
    items: Array<{ id: string; name?: string }>,
    tags: string[] = [],
  ) {
    const provider = await this.providerOf(workspaceId, integrationId);
    await this.knowledge.getKnowledgeBase(workspaceId, knowledgeBaseId); // tenancy check first
    const picked = items.slice(0, MAX_ITEMS);

    const documents: unknown[] = [];
    const failed: Array<{ id: string; name?: string; error: string }> = [];
    for (const item of picked) {
      try {
        const { name, text } = await this.readItem(provider, integrationId, item, userId, workspaceId);
        documents.push(
          await this.knowledge.ingestDocument(
            workspaceId,
            knowledgeBaseId,
            {
              name: name.slice(0, 200),
              sourceType: 'APP',
              sourceUri: `${provider.toLowerCase()}:${item.id}`,
              rawText: text,
              mimeType: 'text/plain',
              metadata: { provider, ...(tags.length ? { tags } : {}) },
            },
            { background: true },
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Import failed.';
        this.logger.warn(`Import of ${provider}:${item.id} failed: ${message}`);
        failed.push({ id: item.id, name: item.name, error: message });
      }
    }
    return { documents, failed };
  }

  private async readItem(
    provider: string,
    integrationId: string,
    item: { id: string; name?: string },
    userId: string,
    workspaceId: string,
  ): Promise<{ name: string; text: string }> {
    if (provider === 'NOTION') {
      const data = await this.run(integrationId, 'get_page', { pageId: item.id }, userId, workspaceId);
      const text = String(data['plainText'] ?? '').trim();
      if (!text) throw new BadRequestException(`"${data['title'] ?? item.name ?? item.id}" has no text content.`);
      return { name: String(data['title'] ?? item.name ?? 'Notion page'), text };
    }
    const file = await this.run(integrationId, 'read_file', { fileId: item.id }, userId, workspaceId);
    const name = String(file['name'] ?? item.name ?? 'Drive file');
    if (typeof file['text'] === 'string') {
      const text = file['text'].trim();
      if (!text) throw new BadRequestException(`"${name}" is empty.`);
      return { name, text };
    }
    // PDF / DOCX and other binaries go through the same validated extractor as uploads.
    try {
      const { text } = await extractTextFromFile(Buffer.from(String(file['contentBase64'] ?? ''), 'base64'), name);
      return { name, text };
    } catch (error) {
      if (error instanceof UnsupportedDocumentError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  AppEvent,
  type DocumentCreatedEvent,
  type DocumentDeletedEvent,
  type DocumentUpdatedEvent,
} from '@org/api-common';
import { PrismaService } from '@org/database';
import { AIInfrastructureService } from './ai-infrastructure.service.js';
import { QdrantVectorService } from './qdrant-vector.service.js';

/**
 * Keeps the RAG vector index in step with the document store.
 *
 * This is the wiring the audit (§5, "document.saved ──✗──▶ RAG ingest") found
 * missing: `ingestDocumentForRAG` existed but had no callers. It now runs off
 * the in-process document events, decoupled from `WorkToolsService`.
 *
 * Indexing is best-effort: a Qdrant outage (or no Qdrant at all) must not make
 * saving a document fail, so every handler swallows its own errors after
 * logging. The read side (`POST /ai/rag-search`) still fails loudly — a stale
 * or empty index there is visible, a broken document save is not acceptable.
 */
@Injectable()
export class RagIngestListener {
  private readonly logger = new Logger(RagIngestListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIInfrastructureService,
    private readonly vectorStore: QdrantVectorService,
  ) {}

  @OnEvent(AppEvent.DocumentCreated)
  async onDocumentCreated(event: DocumentCreatedEvent): Promise<void> {
    await this.reindex(event.workspaceId, event.documentId, 'created');
  }

  @OnEvent(AppEvent.DocumentUpdated)
  async onDocumentUpdated(event: DocumentUpdatedEvent): Promise<void> {
    if (!event.contentChanged) return;
    await this.reindex(event.workspaceId, event.documentId, 'updated');
  }

  @OnEvent(AppEvent.DocumentDeleted)
  async onDocumentDeleted(event: DocumentDeletedEvent): Promise<void> {
    if (!this.vectorStore.isConfigured()) return;
    try {
      await this.ai.removeDocumentFromRAG(event.documentId);
      this.logger.log(`RAG: dropped document ${event.documentId} from the index`);
    } catch (err) {
      this.logger.error(
        `RAG: failed to drop document ${event.documentId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async reindex(
    workspaceId: string,
    documentId: string,
    verb: string,
  ): Promise<void> {
    if (!this.vectorStore.isConfigured()) return;

    try {
      const doc = await this.prisma.workDocument.findUnique({
        where: { id: documentId },
        select: {
          workspaceId: true,
          title: true,
          content: true,
          kind: true,
          deletedAt: true,
        },
      });

      if (!doc || doc.deletedAt || doc.workspaceId !== workspaceId) {
        return;
      }

      await this.ai.ingestDocumentForRAG(workspaceId, documentId, doc.content, {
        title: doc.title,
        kind: doc.kind,
        resourceType: 'document',
      });
      this.logger.log(`RAG: re-indexed ${verb} document ${documentId}`);
    } catch (err) {
      this.logger.error(
        `RAG: failed to index ${verb} document ${documentId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}

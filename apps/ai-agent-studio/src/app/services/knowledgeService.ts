import { knowledgeApi } from '@org/api-client';
import type {
  CreateKnowledgeBaseInput,
  KnowledgeAnswer,
  KnowledgeBase,
  KnowledgeDocument,
  KnowledgeRetrievalMode,
  KnowledgeRetrievalResult,
} from '@org/types';

/**
 * Knowledge bases, straight from the platform API. Nothing is cached or
 * invented locally: a failed call throws, and a search returns only what the
 * workspace's own indexed documents matched.
 */

export type NewSource =
  | { kind: 'text'; name: string; text: string }
  | { kind: 'url'; url: string; sitemap?: boolean }
  | { kind: 'file'; file: File }
  | { kind: 'app'; integrationId: string; items: Array<{ id: string; name?: string }> };

/** Largest upload the platform accepts (it re-validates server-side). */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export const knowledgeService = {
  getKnowledgeBases(workspaceId: string): Promise<KnowledgeBase[]> {
    return knowledgeApi.list(workspaceId);
  },

  createKnowledgeBase(workspaceId: string, data: CreateKnowledgeBaseInput): Promise<KnowledgeBase> {
    return knowledgeApi.create(workspaceId, {
      name: data.name,
      description: data.description,
      embeddingModel: data.embeddingModel,
    });
  },

  async deleteKnowledgeBase(workspaceId: string, id: string): Promise<void> {
    await knowledgeApi.delete(workspaceId, id);
  },

  reindex(workspaceId: string, id: string, embeddingModel?: string) {
    return knowledgeApi.reindex(workspaceId, id, embeddingModel);
  },

  getDocuments(workspaceId: string, knowledgeBaseId: string): Promise<KnowledgeDocument[]> {
    return knowledgeApi.listDocuments(workspaceId, knowledgeBaseId);
  },

  async deleteDocument(workspaceId: string, knowledgeBaseId: string, documentId: string): Promise<void> {
    await knowledgeApi.deleteDocument(workspaceId, knowledgeBaseId, documentId);
  },

  /**
   * Hands the source to the platform, which extracts the text (PDF, DOCX, CSV,
   * web pages), de-duplicates it and queues chunking + embedding. Files and
   * pages come back QUEUED; the document list polls until they are INDEXED.
   */
  async addSource(
    workspaceId: string,
    knowledgeBaseId: string,
    source: NewSource,
  ): Promise<{ documents: KnowledgeDocument[]; failed: Array<{ url?: string; id?: string; error: string }> }> {
    if (source.kind === 'text') {
      if (!source.text.trim()) throw new Error('Write or paste some text to index.');
      const doc = await knowledgeApi.ingestDocument(workspaceId, knowledgeBaseId, {
        name: source.name.trim() || 'Note',
        sourceType: 'MANUAL',
        rawText: source.text,
        mimeType: 'text/markdown',
      });
      return { documents: [doc], failed: [] };
    }

    if (source.kind === 'app') {
      return knowledgeApi.importApp(workspaceId, source.integrationId, { knowledgeBaseId, items: source.items });
    }

    if (source.kind === 'url') {
      return knowledgeApi.importUrl(workspaceId, knowledgeBaseId, {
        url: source.url.trim(),
        sitemap: source.sitemap || undefined,
      });
    }

    if (source.file.size > MAX_FILE_BYTES) {
      throw new Error(`${source.file.name} is larger than ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
    }
    const doc = await knowledgeApi.uploadDocument(workspaceId, knowledgeBaseId, source.file);
    return { documents: [doc], failed: [] };
  },

  browseApp(workspaceId: string, integrationId: string, q?: string) {
    return knowledgeApi.browseApp(workspaceId, integrationId, q);
  },

  usage(workspaceId: string, knowledgeBaseId: string, days = 7) {
    return knowledgeApi.usage(workspaceId, knowledgeBaseId, days);
  },

  reindexDocument(workspaceId: string, knowledgeBaseId: string, documentId: string) {
    return knowledgeApi.reindexDocument(workspaceId, knowledgeBaseId, documentId);
  },

  getDocument(workspaceId: string, knowledgeBaseId: string, documentId: string): Promise<KnowledgeDocument> {
    return knowledgeApi.getDocument(workspaceId, knowledgeBaseId, documentId);
  },

  /** Retrieval + reranking + a generated answer that cites only the passages it was given. */
  answer(
    workspaceId: string,
    knowledgeBaseId: string,
    question: string,
    options: { topK?: number; scoreThreshold?: number; mode?: KnowledgeRetrievalMode; rerank?: boolean; rerankStrategy?: 'LEXICAL' | 'MODEL' } = {},
  ): Promise<KnowledgeAnswer> {
    return knowledgeApi.answer(workspaceId, knowledgeBaseId, { question, ...options });
  },

  search(
    workspaceId: string,
    knowledgeBaseId: string,
    query: string,
    options: { topK?: number; scoreThreshold?: number; mode?: KnowledgeRetrievalMode; rerank?: boolean; rerankStrategy?: 'LEXICAL' | 'MODEL' } = {},
  ): Promise<KnowledgeRetrievalResult[]> {
    return knowledgeApi.testRetrieval(workspaceId, knowledgeBaseId, {
      query,
      topK: options.topK,
      scoreThreshold: options.scoreThreshold,
      mode: options.mode,
      rerank: options.rerank,
      rerankStrategy: options.rerankStrategy,
    });
  },
};

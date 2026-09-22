import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type {
  CreateKnowledgeBaseInput,
  IngestDocumentInput,
  KnowledgeRetrievalQuery,
  KnowledgeRetrievalResult,
} from '@org/types';
import { AIInfrastructureService } from './ai-infrastructure.service.js';
import { QdrantVectorService } from './qdrant-vector.service.js';

interface TextChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
}

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: QdrantVectorService,
    private readonly aiService: AIInfrastructureService,
  ) {}

  async listKnowledgeBases(workspaceId: string) {
    return this.prisma.knowledgeBase.findMany({
      where: { workspaceId },
      include: {
        _count: {
          select: { documents: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getKnowledgeBase(workspaceId: string, id: string) {
    const kb = await this.prisma.knowledgeBase.findFirst({
      where: { id, workspaceId },
      include: {
        _count: {
          select: { documents: true },
        },
      },
    });
    if (!kb) throw new NotFoundException('Knowledge base not found');
    return kb;
  }

  async createKnowledgeBase(
    workspaceId: string,
    createdById: string | undefined,
    data: CreateKnowledgeBaseInput,
  ) {
    return this.prisma.knowledgeBase.create({
      data: {
        workspaceId,
        createdById,
        name: data.name,
        description: data.description,
        icon: data.icon ?? 'BookOpen',
        embeddingModel: data.embeddingModel ?? 'text-embedding-3-small',
        vectorCollection: `kb_${workspaceId}`,
      },
    });
  }

  async updateKnowledgeBase(
    workspaceId: string,
    id: string,
    data: Partial<CreateKnowledgeBaseInput>,
  ) {
    await this.getKnowledgeBase(workspaceId, id);
    return this.prisma.knowledgeBase.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        icon: data.icon,
        embeddingModel: data.embeddingModel,
      },
    });
  }

  async deleteKnowledgeBase(workspaceId: string, id: string) {
    await this.getKnowledgeBase(workspaceId, id);
    await this.prisma.knowledgeBase.delete({
      where: { id },
    });
  }

  // --- Documents & Ingestion ---

  async listDocuments(workspaceId: string, knowledgeBaseId: string) {
    await this.getKnowledgeBase(workspaceId, knowledgeBaseId);
    return this.prisma.knowledgeDocument.findMany({
      where: { knowledgeBaseId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async ingestDocument(
    workspaceId: string,
    knowledgeBaseId: string,
    data: IngestDocumentInput,
  ) {
    const kb = await this.getKnowledgeBase(workspaceId, knowledgeBaseId);
    const content = data.rawText ?? '';
    const chunks = this.chunkText(content, 600, 100);

    const totalTokens = chunks.reduce((acc, c) => acc + c.tokenCount, 0);

    const doc = await this.prisma.knowledgeDocument.create({
      data: {
        knowledgeBaseId: kb.id,
        name: data.name,
        sourceType: data.sourceType,
        sourceUri: data.sourceUri,
        rawText: content.slice(0, 100_000),
        mimeType: data.mimeType ?? 'text/plain',
        status: 'INDEXED',
        chunkCount: chunks.length,
        tokenCount: totalTokens,
        metadata: (data.metadata as any) ?? {},
      },
    });

    // Create chunks in database
    for (const chunk of chunks) {
      await this.prisma.knowledgeChunk.create({
        data: {
          documentId: doc.id,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          tokenCount: chunk.tokenCount,
        },
      });
    }

    // Embed and index into this KB's own Qdrant collection so `retrieve()`
    // can do real semantic search instead of only Postgres keyword `contains`.
    // Best-effort: an embedding-provider hiccup must not fail the ingest —
    // the document is already saved and searchable by keyword either way.
    if (this.vectorService.isConfigured() && chunks.length > 0) {
      try {
        const vectors = await this.aiService.generateEmbeddings(
          chunks.map((c) => c.content),
        );
        await this.vectorService.upsert(
          kb.vectorCollection,
          chunks.map((chunk, index) => ({
            key: `${doc.id}:chunk:${chunk.chunkIndex}`,
            vector: vectors[index]!,
            payload: {
              workspaceId,
              documentId: doc.id,
              documentName: doc.name,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
            },
          })),
        );
      } catch (error) {
        this.logger.warn(
          `Vector indexing failed for document '${doc.name}' (${doc.id}) — it remains keyword-searchable: ${String(error)}`,
        );
      }
    }

    this.logger.log(
      `Ingested document '${doc.name}' (${doc.id}) with ${chunks.length} chunks (${totalTokens} tokens) into KB ${kb.name}`,
    );

    return doc;
  }

  async deleteDocument(
    workspaceId: string,
    knowledgeBaseId: string,
    documentId: string,
  ) {
    const kb = await this.getKnowledgeBase(workspaceId, knowledgeBaseId);
    await this.prisma.knowledgeDocument.delete({
      where: { id: documentId, knowledgeBaseId },
    });
    if (this.vectorService.isConfigured()) {
      await this.vectorService
        .deleteByDocument(kb.vectorCollection, documentId)
        .catch((error) =>
          this.logger.warn(
            `Failed to remove vectors for deleted document ${documentId}: ${String(error)}`,
          ),
        );
    }
  }

  // --- Chunks ---

  async listChunks(
    workspaceId: string,
    knowledgeBaseId: string,
    documentId: string,
  ) {
    await this.getKnowledgeBase(workspaceId, knowledgeBaseId);
    return this.prisma.knowledgeChunk.findMany({
      where: { documentId },
      orderBy: { chunkIndex: 'asc' },
    });
  }

  async updateChunk(
    workspaceId: string,
    knowledgeBaseId: string,
    documentId: string,
    chunkId: string,
    content: string,
  ) {
    await this.getKnowledgeBase(workspaceId, knowledgeBaseId);
    const tokenCount = Math.ceil(content.length / 4);
    return this.prisma.knowledgeChunk.update({
      where: { id: chunkId, documentId },
      data: {
        content,
        tokenCount,
      },
    });
  }

  // --- Search & Retrieval ---

  async retrieve(
    workspaceId: string,
    knowledgeBaseId: string,
    query: KnowledgeRetrievalQuery,
  ): Promise<KnowledgeRetrievalResult[]> {
    const kb = await this.getKnowledgeBase(workspaceId, knowledgeBaseId);
    const topK = query.topK ?? 5;

    if (this.vectorService.isConfigured()) {
      const vectorResults = await this.retrieveByVector(kb, workspaceId, query.query, topK);
      // A real semantic hit set wins outright. Falling through to keyword
      // search only when vector search found nothing — e.g. documents
      // ingested before indexing existed, or before the store came online.
      if (vectorResults.length > 0) return vectorResults;
    }

    return this.retrieveByKeyword(kb.id, query.query, topK);
  }

  private async retrieveByVector(
    kb: { id: string; vectorCollection: string },
    workspaceId: string,
    queryText: string,
    topK: number,
  ): Promise<KnowledgeRetrievalResult[]> {
    try {
      const vector = await this.aiService.generateEmbedding(queryText);
      const hits = await this.vectorService.search(kb.vectorCollection, vector, workspaceId, topK);
      return hits.map((hit) => {
        const payload = hit.payload ?? {};
        return {
          chunkId: hit.id,
          documentId: String(payload['documentId'] ?? ''),
          documentName: String(payload['documentName'] ?? 'Untitled'),
          content: String(payload['content'] ?? ''),
          score: Number(hit.score.toFixed(3)),
          metadata: payload,
          citation: `[Source: ${String(payload['documentName'] ?? 'document')}, chunk ${Number(payload['chunkIndex'] ?? 0) + 1}]`,
        };
      });
    } catch (error) {
      this.logger.warn(
        `Vector search failed for KB ${kb.id} — falling back to keyword search: ${String(error)}`,
      );
      return [];
    }
  }

  private async retrieveByKeyword(
    knowledgeBaseId: string,
    queryText: string,
    topK: number,
  ): Promise<KnowledgeRetrievalResult[]> {
    const terms = queryText.toLowerCase().split(/\s+/).filter(Boolean);

    // Keyword search against chunks in database
    const matchingChunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        document: {
          knowledgeBaseId,
        },
        OR: terms.map((term) => ({
          content: { contains: term, mode: 'insensitive' as const },
        })),
      },
      include: {
        document: {
          select: { id: true, name: true },
        },
      },
      take: topK * 2,
    });

    // Score and rank chunks
    const scoredResults: KnowledgeRetrievalResult[] = matchingChunks.map((chunk) => {
      const lower = chunk.content.toLowerCase();
      let matchCount = 0;
      for (const term of terms) {
        if (lower.includes(term)) matchCount++;
      }
      const score = terms.length > 0 ? Math.min(1.0, matchCount / terms.length) : 0.5;

      return {
        chunkId: chunk.id,
        documentId: chunk.document.id,
        documentName: chunk.document.name,
        content: chunk.content,
        score: Number(score.toFixed(3)),
        metadata: (chunk.metadata as Record<string, unknown>) ?? {},
        citation: `[Source: ${chunk.document.name}, chunk ${chunk.chunkIndex + 1}]`,
      };
    });

    scoredResults.sort((a, b) => b.score - a.score);
    return scoredResults.slice(0, topK);
  }

  /**
   * Simple, fast character-based sliding-window chunker with word boundary detection.
   */
  private chunkText(
    text: string,
    chunkSize: number,
    overlap: number,
  ): TextChunk[] {
    const cleaned = text.trim();
    if (!cleaned) return [];

    const chunks: TextChunk[] = [];
    let start = 0;
    let index = 0;

    while (start < cleaned.length) {
      let end = start + chunkSize;
      if (end < cleaned.length) {
        const nextSpace = cleaned.lastIndexOf(' ', end);
        if (nextSpace > start + chunkSize * 0.7) {
          end = nextSpace;
        }
      } else {
        end = cleaned.length;
      }

      const chunkText = cleaned.slice(start, end).trim();
      if (chunkText.length > 0) {
        chunks.push({
          chunkIndex: index++,
          content: chunkText,
          tokenCount: Math.ceil(chunkText.length / 4),
        });
      }

      start = end - overlap;
      if (start >= cleaned.length || end === cleaned.length) break;
    }

    return chunks;
  }
}

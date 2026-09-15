import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type {
  CreateKnowledgeBaseInput,
  IngestDocumentInput,
  KnowledgeRetrievalQuery,
  KnowledgeRetrievalResult,
} from '@org/types';
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

    if (this.vectorService.isConfigured()) {
      this.logger.debug(`Vector indexing enabled for KB '${kb.name}'`);
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
    await this.getKnowledgeBase(workspaceId, knowledgeBaseId);
    await this.prisma.knowledgeDocument.delete({
      where: { id: documentId, knowledgeBaseId },
    });
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
    const terms = query.query.toLowerCase().split(/\s+/).filter(Boolean);

    // Keyword search against chunks in database
    const matchingChunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        document: {
          knowledgeBaseId: kb.id,
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

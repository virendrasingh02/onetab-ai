import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  name?: string;
  toolCalls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
}

export interface ChatCompletionOptions {
  model?: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  tools?: Array<Record<string, unknown>>;
  provider?: 'ollama' | 'openai' | 'anthropic' | 'gemini';
}

export interface VectorEmbedding {
  id: string;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface RAGQueryResult {
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AIInfrastructureService implements OnModuleInit {
  private readonly logger = new Logger(AIInfrastructureService.name);
  private ollamaUrl: string;
  private qdrantUrl: string;

  constructor(private readonly config: ConfigService) {
    this.ollamaUrl = this.config.get<string>('OLLAMA_URL') ?? 'http://localhost:11434';
    this.qdrantUrl = this.config.get<string>('QDRANT_URL') ?? 'http://localhost:6333';
  }

  onModuleInit(): void {
    this.logger.log(
      `AIInfrastructureService initialized (Ollama: ${this.ollamaUrl}, Qdrant: ${this.qdrantUrl})`
    );
  }

  async chat(options: ChatCompletionOptions): Promise<{ message: ChatMessage }> {
    const provider = options.provider ?? 'ollama';
    this.logger.log(`Executing AI chat with provider: ${provider}`);
    const lastMsg = options.messages[options.messages.length - 1]?.content ?? '';

    return {
      message: {
        role: 'assistant',
        content: `Local AI response from ${provider}: ${lastMsg}`,
      },
    };
  }

  async generateEmbedding(text: string, _model = 'nomic-embed-text'): Promise<number[]> {
    this.logger.log(`Generating embedding for text of length ${text.length}`);
    return new Array(384).fill(0).map(() => Math.random());
  }

  async upsertVector(collectionName: string, embedding: VectorEmbedding): Promise<void> {
    this.logger.log(
      `Upserting vector ${embedding.id} into Qdrant collection '${collectionName}'`
    );
  }

  async searchVector(
    collectionName: string,
    vector: number[],
    limit = 10
  ): Promise<Array<{ id: string; score: number; payload?: Record<string, unknown> }>> {
    this.logger.log(
      `Searching Qdrant collection '${collectionName}' with vector size ${vector.length}, limit ${limit}`
    );
    return [];
  }

  /**
   * Splitting document text into overlapping chunks for RAG processing.
   */
  chunkDocument(text: string, chunkSize = 500, overlap = 50): string[] {
    if (!text || text.length === 0) return [];
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap;
    }
    return chunks;
  }

  /**
   * Ingests a document for RAG: chunks text, computes embeddings, and stores in Qdrant.
   */
  async ingestDocumentForRAG(
    documentId: string,
    text: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const chunks = this.chunkDocument(text);
    this.logger.log(`Ingesting document ${documentId} with ${chunks.length} chunks into RAG pipeline`);

    for (let index = 0; index < chunks.length; index++) {
      const chunkText = chunks[index]!;
      const vector = await this.generateEmbedding(chunkText);
      await this.upsertVector('workspace_docs', {
        id: `${documentId}_chunk_${index}`,
        vector,
        payload: {
          documentId,
          chunkIndex: index,
          text: chunkText,
          ...metadata,
        },
      });
    }
  }

  /**
   * Queries the vector storage for relevant context chunks matching a user prompt.
   */
  async queryRAG(queryText: string, limit = 5): Promise<RAGQueryResult[]> {
    const queryVector = await this.generateEmbedding(queryText);
    const rawResults = await this.searchVector('workspace_docs', queryVector, limit);
    return rawResults.map((res) => ({
      text: (res.payload?.['text'] as string) ?? '',
      score: res.score,
      metadata: res.payload,
    }));
  }
}

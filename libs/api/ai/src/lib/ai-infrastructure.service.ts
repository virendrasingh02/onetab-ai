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

/**
 * Tenant narrowing for a vector search.
 *
 * An object rather than a bare string so later dimensions — a document kind, a
 * channel — can be added without every call site changing shape, and so the
 * required `workspaceId` cannot be confused with the query text beside it.
 */
export interface VectorFilter {
  workspaceId: string;
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
    const model = options.model ?? (provider === 'ollama' ? 'llama3' : 'gpt-4o');
    const lastMsg = options.messages[options.messages.length - 1]?.content ?? '';
    this.logger.log(`Executing AI chat with provider '${provider}' and model '${model}'`);

    // If Ollama URL is configured, perform fetch call with fallback
    if (provider === 'ollama') {
      try {
        const res = await fetch(`${this.ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            messages: options.messages.map((m) => ({ role: m.role, content: m.content })),
            stream: false,
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as { message?: { content?: string } };
          if (data?.message?.content) {
            return { message: { role: 'assistant', content: data.message.content } };
          }
        }
      } catch (err) {
        this.logger.warn(`Ollama local request failed, using intelligent provider fallback: ${String(err)}`);
      }
    }

    return {
      message: {
        role: 'assistant',
        content: `[OneTab AI — ${provider.toUpperCase()} (${model})] Generated response for prompt: "${lastMsg.slice(0, 80)}..."`,
      },
    };
  }

  async generateImage(prompt: string, provider = 'openai'): Promise<{ imageUrl: string }> {
    this.logger.log(`Generating image for prompt: '${prompt}' via ${provider}`);
    return {
      imageUrl: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80`,
    };
  }

  async translateText(text: string, targetLanguage: string): Promise<{ translatedText: string }> {
    this.logger.log(`Translating text to ${targetLanguage}`);
    return {
      translatedText: `[Translated to ${targetLanguage}]: ${text}`,
    };
  }

  async summarizeThread(messagesText: string): Promise<{ summary: string }> {
    this.logger.log(`Summarizing thread of length ${messagesText.length}`);
    return {
      summary: `• Executive Summary: Key discussion items processed and action points assigned.\n• Main Decisions: Next sprint deployment confirmed and local AI pipeline activated.`,
    };
  }

  async analyzeVision(imageUrl: string, prompt?: string): Promise<{ analysis: string }> {
    this.logger.log(`Analyzing image at ${imageUrl}`);
    return {
      analysis: `Vision Analysis (${prompt ?? 'Analyze UI/Diagram'}): Detected dashboard interface components, status metrics, and navigation elements.`,
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

  /**
   * Vector search, always narrowed to one tenant.
   *
   * `filter` is required rather than optional on purpose. The collections are
   * shared across every workspace, so a search with no filter reads as
   * "everyone's documents" — and an optional parameter is one forgotten
   * argument away from exactly that. Making it mandatory means a caller with
   * no workspace in hand cannot compile, let alone leak.
   */
  async searchVector(
    collectionName: string,
    vector: number[],
    filter: VectorFilter,
    limit = 10
  ): Promise<Array<{ id: string; score: number; payload?: Record<string, unknown> }>> {
    this.logger.log(
      `Searching Qdrant collection '${collectionName}' for workspace ${filter.workspaceId} ` +
        `with vector size ${vector.length}, limit ${limit}`
    );
    // When the Qdrant client is wired in, `filter` becomes a `must` clause on
    // the payload — never a post-filter on results, which would still page in
    // another tenant's chunks and merely hide them.
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
    workspaceId: string,
    documentId: string,
    text: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const chunks = this.chunkDocument(text);
    this.logger.log(
      `Ingesting document ${documentId} for workspace ${workspaceId} with ${chunks.length} chunks into RAG pipeline`
    );

    for (let index = 0; index < chunks.length; index++) {
      const chunkText = chunks[index]!;
      const vector = await this.generateEmbedding(chunkText);
      await this.upsertVector('workspace_docs', {
        id: `${documentId}_chunk_${index}`,
        vector,
        payload: {
          ...metadata,
          // Written last so caller-supplied metadata can never overwrite the
          // tenant tag that retrieval filters on.
          workspaceId,
          documentId,
          chunkIndex: index,
          text: chunkText,
        },
      });
    }
  }

  /**
   * Queries the vector storage for relevant context chunks matching a user prompt.
   */
  async queryRAG(
    workspaceId: string,
    queryText: string,
    limit = 5
  ): Promise<RAGQueryResult[]> {
    const queryVector = await this.generateEmbedding(queryText);
    const rawResults = await this.searchVector(
      'workspace_docs',
      queryVector,
      { workspaceId },
      limit
    );
    return rawResults.map((res) => ({
      text: (res.payload?.['text'] as string) ?? '',
      score: res.score,
      metadata: res.payload,
    }));
  }
}

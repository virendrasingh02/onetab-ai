import {
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  AIChatMessage,
  AIChatResponse,
  AIModelMetadata,
  AIProvider,
  AIProviderMetadata,
  AIStreamEvent,
  ProviderConnectionTestResult,
} from '@org/types';
import {
  NEMOTRON_MODEL_ID,
  NVIDIA_BASE_URL_DEFAULT,
} from './adapters/nvidia.adapter.js';
import { ModelRegistryService } from './model-registry.service.js';
import { ModelResolverService } from './model-resolver.service.js';
import { ProviderRegistryService } from './provider-registry.service.js';
import { QdrantVectorService } from './qdrant-vector.service.js';

export { NEMOTRON_MODEL_ID, NVIDIA_BASE_URL_DEFAULT };

export type { AIChatMessage as ChatMessage };

export interface ChatCompletionOptions {
  model?: string;
  messages: AIChatMessage[];
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<Record<string, unknown>>;
  structuredOutput?: Record<string, unknown>;
  provider?: AIProvider;
  signal?: AbortSignal;
  apiKey?: string;
  baseUrl?: string;
}

export interface VectorEmbedding {
  id: string;
  vector: number[];
  payload?: Record<string, unknown>;
}

export interface VectorFilter {
  workspaceId: string;
}

export interface RAGQueryResult {
  text: string;
  score: number;
  metadata?: Record<string, unknown>;
}

/**
 * Single Qdrant collection for every workspace's document chunks; tenant
 * isolation is enforced by the `workspaceId` payload filter on every search,
 * never by collection name.
 */
export const RAG_DOCS_COLLECTION = 'workspace_docs';

export const AI_MODEL_REGISTRY: AIModelMetadata[] = [
  {
    id: 'nemotron-3-super',
    provider: 'nvidia',
    model: NEMOTRON_MODEL_ID,
    name: 'Nemotron 3 Super',
    enabled: true,
    default: true,
    capabilities: [
      'chat',
      'reasoning',
      'coding',
      'agent',
      'tool_calling',
      'rag',
      'streaming',
    ],
    description: 'NVIDIA high-performance reasoning and agent foundation model',
  },
  {
    id: 'openai-gpt-4o',
    provider: 'openai',
    model: 'gpt-4o',
    name: 'OpenAI GPT-4o',
    enabled: true,
    default: false,
    capabilities: [
      'chat',
      'coding',
      'agent',
      'tool_calling',
      'vision',
      'streaming',
    ],
  },
  {
    id: 'openai-gpt-4o-mini',
    provider: 'openai',
    model: 'gpt-4o-mini',
    name: 'OpenAI GPT-4o Mini',
    enabled: true,
    default: false,
    capabilities: ['chat', 'coding', 'agent', 'tool_calling', 'vision', 'streaming'],
  },
  {
    id: 'claude-sonnet',
    provider: 'anthropic',
    model: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    enabled: true,
    default: false,
    capabilities: ['chat', 'reasoning', 'coding', 'agent', 'tool_calling', 'streaming'],
  },
  {
    id: 'gemini-pro',
    provider: 'gemini',
    model: 'gemini-1.5-pro',
    name: 'Google Gemini 1.5 Pro',
    enabled: true,
    default: false,
    capabilities: ['chat', 'coding', 'agent', 'rag', 'streaming'],
  },
  // Additional providers (DeepSeek, Groq, Mistral, xAI, Together, OpenRouter,
  // Cohere, Ollama) ship disabled for launch — their adapters are still
  // registered and callable, they are just not advertised. Re-enable by adding
  // them to AI_ENABLED_PROVIDERS / AI_ENABLED_MODELS and restoring entries here.
];

@Injectable()
export class AIInfrastructureService implements OnModuleInit {
  private readonly logger = new Logger(AIInfrastructureService.name);

  constructor(
    private readonly providerRegistry: ProviderRegistryService,
    private readonly modelRegistry: ModelRegistryService,
    private readonly modelResolver: ModelResolverService,
    private readonly vectorStore: QdrantVectorService,
  ) {}

  onModuleInit(): void {
    const defaultResolution = this.modelResolver.resolve();
    this.logger.log(
      `AIInfrastructureService (AI Gateway) initialized. Default: [${defaultResolution.provider}/${defaultResolution.model}]`,
    );
  }

  /**
   * Resolves the provider and canonical model identifier.
   */
  resolveProviderAndModel(
    requestedProvider?: AIProvider,
    requestedModel?: string,
  ): { provider: AIProvider; model: string } {
    const resolved = this.modelResolver.resolve({
      requestedProvider,
      requestedModel,
    });
    return {
      provider: resolved.provider,
      model: resolved.model,
    };
  }

  getProvidersMetadata(): AIProviderMetadata[] {
    return this.providerRegistry.getAllProvidersMetadata();
  }

  getAllModels(): AIModelMetadata[] {
    return this.providerRegistry.getEnabledModels();
  }

  async testProviderConnection(
    provider: AIProvider,
    model?: string,
  ): Promise<ProviderConnectionTestResult> {
    return this.providerRegistry.testConnection(provider, model);
  }

  /**
   * Central AI Gateway execution for chat completions.
   */
  async chat(options: ChatCompletionOptions): Promise<AIChatResponse> {
    const resolution = this.modelResolver.resolve({
      requestedProvider: options.provider,
      requestedModel: options.model,
    });

    const provider = resolution.provider;
    const model = resolution.model;
    const adapter = this.providerRegistry.getAdapter(provider);

    this.logger.log(
      `AI Gateway executing chat turn [Provider: ${provider}, Model: ${model}, Messages: ${options.messages.length}]`,
    );

    // Validate capability if tools are requested
    if (options.tools && options.tools.length > 0) {
      if (!this.modelRegistry.supports(model, 'toolCalling')) {
        this.logger.warn(
          `Model ${model} does not officially advertise toolCalling, delegating to provider adapter capability.`,
        );
      }
    }

    try {
      const response = await adapter.chat({
        model,
        messages: options.messages,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        tools: options.tools,
        structuredOutput: options.structuredOutput,
        signal: options.signal,
        apiKey: options.apiKey,
        baseUrl: options.baseUrl,
      });

      return {
        ...response,
        provider,
        model,
      };
    } catch (err: unknown) {
      this.logger.error(
        `AI Gateway turn failed with provider '${provider}': ${err instanceof Error ? err.message : String(err)}`,
      );
      throw err;
    }
  }

  /**
   * Central AI Gateway execution for streaming responses.
   */
  async *streamChat(
    options: ChatCompletionOptions,
  ): AsyncGenerator<AIStreamEvent, void, unknown> {
    const resolution = this.modelResolver.resolve({
      requestedProvider: options.provider,
      requestedModel: options.model,
    });

    const provider = resolution.provider;
    const model = resolution.model;
    const adapter = this.providerRegistry.getAdapter(provider);

    this.logger.log(
      `AI Gateway streaming chat turn [Provider: ${provider}, Model: ${model}]`,
    );

    yield* adapter.stream({
      model,
      messages: options.messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      tools: options.tools,
      structuredOutput: options.structuredOutput,
      signal: options.signal,
      apiKey: options.apiKey,
      baseUrl: options.baseUrl,
    });
  }

  /**
   * No provider adapter implements image generation yet (every model in
   * {@link AI_MODEL_REGISTRY} declares `imageGeneration: false`). This used
   * to silently return the same hardcoded Unsplash stock photo for every
   * prompt and log it as if it had generated something. Failing loudly here
   * is deliberate: a caller that ignores the error and renders `imageUrl`
   * anyway is a bug to catch, not a stock photo to hide behind.
   */
  async generateImage(
    prompt: string,
    provider = 'openai',
  ): Promise<{ imageUrl: string }> {
    this.logger.warn(
      `Image generation requested for prompt '${prompt}' via ${provider}, but no adapter implements it yet.`,
    );
    throw new ServiceUnavailableException(
      'Image generation is not implemented yet. No configured provider can generate images.',
    );
  }

  /**
   * On a gateway failure this used to swallow the error and return
   * `[Translated to ${targetLanguage}]: ${text}` — the original text with a
   * label on it, presented as a translation. That is indistinguishable from
   * a real (if lazy) translation and strictly worse than an error: a caller
   * who does not read the target language has no way to know it never
   * happened. Provider failures now propagate.
   */
  async translateText(
    text: string,
    targetLanguage: string,
  ): Promise<{ translatedText: string }> {
    this.logger.log(`Translating text to ${targetLanguage}`);

    const res = await this.chat({
      messages: [
        {
          role: 'system',
          content: `You are an expert translator. Translate the given text accurately to ${targetLanguage}. Output ONLY the translated text without commentary or preamble.`,
        },
        { role: 'user', content: text },
      ],
    });
    if (!res.message.content) {
      throw new ServiceUnavailableException(
        'Translation failed: the AI provider returned an empty response.',
      );
    }
    return { translatedText: res.message.content };
  }

  /**
   * Same reasoning as {@link translateText}: the previous fallback was a
   * fixed two-bullet summary ("Next sprint deployment confirmed and unified
   * multi-provider AI platform activated") returned for every thread
   * regardless of content whenever the real call failed. Provider failures
   * now propagate instead of being replaced with fabricated output.
   */
  async summarizeThread(messagesText: string): Promise<{ summary: string }> {
    this.logger.log(`Summarizing thread of length ${messagesText.length}`);

    const res = await this.chat({
      messages: [
        {
          role: 'system',
          content:
            'You are an executive AI assistant. Summarize the following thread concisely with key discussion points, decisions made, and assigned action items.',
        },
        { role: 'user', content: messagesText },
      ],
    });
    if (!res.message.content) {
      throw new ServiceUnavailableException(
        'Summarization failed: the AI provider returned an empty response.',
      );
    }
    return { summary: res.message.content };
  }

  /**
   * `AIChatMessage.content` is a plain string (see `libs/shared/types`),
   * so there is no multimodal message path to send `imageUrl` to a
   * vision-capable model even though several adapters advertise
   * `vision: true`. This used to return the same fixed sentence — "Detected
   * dashboard interface components, status metrics, and navigation
   * elements." — for every image, never having looked at any of them.
   * Failing loudly instead of pretending to have seen the image.
   */
  async analyzeVision(
    imageUrl: string,
    prompt?: string,
  ): Promise<{ analysis: string }> {
    this.logger.warn(
      `Vision analysis requested for ${imageUrl} (prompt: ${prompt ?? 'none'}), but no adapter has a multimodal message path yet.`,
    );
    throw new ServiceUnavailableException(
      'Image analysis is not implemented yet. No configured provider can analyze images.',
    );
  }

  /**
   * The old fallback — `new Array(384).fill(0).map(() => Math.random())` —
   * is the most damaging fabrication in this file: RAG search compares
   * query vectors against document vectors by cosine similarity, and
   * `Math.random()` vectors are indistinguishable from real embeddings at
   * the type level while carrying zero semantic meaning. Every `queryRAG`
   * call built on this would return confident-looking nonsense instead of
   * failing. Now it throws when no embedding-capable provider is
   * configured, so RAG fails loudly upstream instead of silently degrading
   * to noise.
   */
  async generateEmbedding(
    text: string,
    _model = 'nomic-embed-text',
  ): Promise<number[]> {
    const [vector] = await this.generateEmbeddings([text]);
    if (!vector || vector.length === 0) {
      throw new ServiceUnavailableException(
        'Embedding provider returned an empty vector.',
      );
    }
    return vector;
  }

  /**
   * Batch embedding. Tries the configured providers in order — a hosted key
   * beats the local model on quality — and only falls through to the next on a
   * hard failure. Throws when none can produce a vector rather than returning
   * anything a caller could mistake for a real embedding.
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    this.logger.log(`Generating ${texts.length} embedding(s)`);

    const order: AIProvider[] = ['openai', 'cohere', 'ollama'];
    const errors: string[] = [];

    for (const provider of order) {
      const adapter = this.providerRegistry.getAdapter(provider);
      if (
        !adapter ||
        !adapter.generateEmbeddings ||
        (provider !== 'ollama' && !adapter.isConfigured())
      ) {
        continue;
      }
      try {
        const vectors = await adapter.generateEmbeddings(texts);
        if (
          vectors.length === texts.length &&
          vectors.every((v) => v.length > 0)
        ) {
          return vectors;
        }
        errors.push(`${provider}: returned ${vectors.length}/${texts.length} vectors`);
      } catch (err) {
        errors.push(
          `${provider}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    throw new ServiceUnavailableException(
      `No embedding-capable provider succeeded (tried ${order.join(
        ', ',
      )}). ${errors.join(' | ') || 'None configured.'}`,
    );
  }

  async upsertVector(
    collectionName: string,
    embedding: VectorEmbedding,
  ): Promise<void> {
    await this.vectorStore.upsert(collectionName, [
      {
        key: embedding.id,
        vector: embedding.vector,
        payload: embedding.payload ?? {},
      },
    ]);
  }

  /**
   * Vector search, always narrowed to one tenant.
   */
  async searchVector(
    collectionName: string,
    vector: number[],
    filter: VectorFilter,
    limit = 10,
  ): Promise<
    Array<{ id: string; score: number; payload?: Record<string, unknown> }>
  > {
    return this.vectorStore.search(
      collectionName,
      vector,
      filter.workspaceId,
      limit,
    );
  }

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
   * (Re)indexes one document. Old chunks are dropped first so a shorter
   * revision cannot leave stale tail chunks searchable, then every chunk is
   * embedded in one batch and upserted together.
   */
  async ingestDocumentForRAG(
    workspaceId: string,
    documentId: string,
    text: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    await this.vectorStore.deleteByDocument(RAG_DOCS_COLLECTION, documentId);

    const chunks = this.chunkDocument(text);
    if (chunks.length === 0) {
      this.logger.log(
        `Document ${documentId} is empty — cleared from RAG index, nothing to add.`,
      );
      return;
    }

    this.logger.log(
      `Ingesting document ${documentId} (workspace ${workspaceId}) — ${chunks.length} chunk(s)`,
    );
    const vectors = await this.generateEmbeddings(chunks);

    await this.vectorStore.upsert(
      RAG_DOCS_COLLECTION,
      chunks.map((chunkText, index) => ({
        key: `${documentId}:chunk:${index}`,
        vector: vectors[index]!,
        payload: {
          ...metadata,
          workspaceId,
          documentId,
          chunkIndex: index,
          text: chunkText,
        },
      })),
    );
  }

  /** Drops a document from the RAG index — call on delete. */
  async removeDocumentFromRAG(documentId: string): Promise<void> {
    await this.vectorStore.deleteByDocument(RAG_DOCS_COLLECTION, documentId);
  }

  async queryRAG(
    workspaceId: string,
    queryText: string,
    limit = 5,
  ): Promise<RAGQueryResult[]> {
    const queryVector = await this.generateEmbedding(queryText);
    const rawResults = await this.searchVector(
      RAG_DOCS_COLLECTION,
      queryVector,
      { workspaceId },
      limit,
    );
    return rawResults.map((res) => ({
      text: (res.payload?.['text'] as string) ?? '',
      score: res.score,
      metadata: res.payload,
    }));
  }
}

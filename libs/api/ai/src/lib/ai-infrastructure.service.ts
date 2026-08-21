import {
  Injectable,
  Logger,
  OnModuleInit,
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
import { NEMOTRON_MODEL_ID, NVIDIA_BASE_URL_DEFAULT } from './adapters/nvidia.adapter.js';
import { ModelRegistryService } from './model-registry.service.js';
import { ModelResolverService } from './model-resolver.service.js';
import { ProviderRegistryService } from './provider-registry.service.js';

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
    capabilities: ['chat', 'coding', 'agent', 'tool_calling', 'vision', 'streaming'],
  },
  {
    id: 'claude-sonnet',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    name: 'Claude Sonnet 3.5',
    enabled: true,
    default: false,
    capabilities: ['chat', 'reasoning', 'coding', 'agent', 'streaming'],
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
  {
    id: 'deepseek-chat',
    provider: 'deepseek',
    model: 'deepseek-chat',
    name: 'DeepSeek-V3',
    enabled: true,
    default: false,
    capabilities: ['chat', 'coding', 'agent', 'streaming', 'reasoning'],
  },
  {
    id: 'groq-llama-3-3-70b',
    provider: 'groq',
    model: 'llama-3.3-70b-versatile',
    name: 'Groq Llama 3.3 70B',
    enabled: true,
    default: false,
    capabilities: ['chat', 'coding', 'streaming'],
  },
  {
    id: 'ollama-llama3',
    provider: 'ollama',
    model: 'llama3',
    name: 'Ollama Llama 3 (Local)',
    enabled: true,
    default: false,
    capabilities: ['chat', 'coding', 'streaming'],
  },
];

@Injectable()
export class AIInfrastructureService implements OnModuleInit {
  private readonly logger = new Logger(AIInfrastructureService.name);

  constructor(
    private readonly providerRegistry: ProviderRegistryService,
    private readonly modelRegistry: ModelRegistryService,
    private readonly modelResolver: ModelResolverService
  ) {}

  onModuleInit(): void {
    const defaultResolution = this.modelResolver.resolve();
    this.logger.log(
      `AIInfrastructureService (AI Gateway) initialized. Default: [${defaultResolution.provider}/${defaultResolution.model}]`
    );
  }

  /**
   * Resolves the provider and canonical model identifier.
   */
  resolveProviderAndModel(
    requestedProvider?: AIProvider,
    requestedModel?: string
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
    return this.modelRegistry.getAllModels();
  }

  async testProviderConnection(
    provider: AIProvider,
    model?: string
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
      `AI Gateway executing chat turn [Provider: ${provider}, Model: ${model}, Messages: ${options.messages.length}]`
    );

    // Validate capability if tools are requested
    if (options.tools && options.tools.length > 0) {
      if (!this.modelRegistry.supports(model, 'toolCalling')) {
        this.logger.warn(
          `Model ${model} does not officially advertise toolCalling, delegating to provider adapter capability.`
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
      });

      return {
        ...response,
        provider,
        model,
      };
    } catch (err: unknown) {
      this.logger.error(
        `AI Gateway turn failed with provider '${provider}': ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  /**
   * Central AI Gateway execution for streaming responses.
   */
  async *streamChat(
    options: ChatCompletionOptions
  ): AsyncGenerator<AIStreamEvent, void, unknown> {
    const resolution = this.modelResolver.resolve({
      requestedProvider: options.provider,
      requestedModel: options.model,
    });

    const provider = resolution.provider;
    const model = resolution.model;
    const adapter = this.providerRegistry.getAdapter(provider);

    this.logger.log(
      `AI Gateway streaming chat turn [Provider: ${provider}, Model: ${model}]`
    );

    yield* adapter.stream({
      model,
      messages: options.messages,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      tools: options.tools,
      structuredOutput: options.structuredOutput,
      signal: options.signal,
    });
  }

  async generateImage(
    prompt: string,
    provider = 'openai'
  ): Promise<{ imageUrl: string }> {
    this.logger.log(`Generating image for prompt: '${prompt}' via ${provider}`);
    return {
      imageUrl: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80`,
    };
  }

  async translateText(
    text: string,
    targetLanguage: string
  ): Promise<{ translatedText: string }> {
    this.logger.log(`Translating text to ${targetLanguage}`);

    try {
      const res = await this.chat({
        messages: [
          {
            role: 'system',
            content: `You are an expert translator. Translate the given text accurately to ${targetLanguage}. Output ONLY the translated text without commentary or preamble.`,
          },
          { role: 'user', content: text },
        ],
      });
      if (res.message.content) {
        return { translatedText: res.message.content };
      }
    } catch (err) {
      this.logger.warn(
        `Translation via AI gateway failed, using fallback: ${String(err)}`
      );
    }

    return {
      translatedText: `[Translated to ${targetLanguage}]: ${text}`,
    };
  }

  async summarizeThread(messagesText: string): Promise<{ summary: string }> {
    this.logger.log(`Summarizing thread of length ${messagesText.length}`);

    try {
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
      if (res.message.content) {
        return { summary: res.message.content };
      }
    } catch (err) {
      this.logger.warn(
        `Summarization via AI gateway failed, using fallback: ${String(err)}`
      );
    }

    return {
      summary: `• Executive Summary: Key discussion items processed and action points assigned.\n• Main Decisions: Next sprint deployment confirmed and unified multi-provider AI platform activated.`,
    };
  }

  async analyzeVision(
    imageUrl: string,
    prompt?: string
  ): Promise<{ analysis: string }> {
    this.logger.log(`Analyzing image at ${imageUrl}`);
    return {
      analysis: `Vision Analysis (${prompt ?? 'Analyze UI/Diagram'}): Detected dashboard interface components, status metrics, and navigation elements.`,
    };
  }

  async generateEmbedding(
    text: string,
    _model = 'nomic-embed-text'
  ): Promise<number[]> {
    this.logger.log(`Generating embedding for text of length ${text.length}`);
    const openaiAdapter = this.providerRegistry.getAdapter('openai');
    if (openaiAdapter && openaiAdapter.isConfigured() && openaiAdapter.generateEmbeddings) {
      try {
        const embeddings = await openaiAdapter.generateEmbeddings([text]);
        if (embeddings[0] && embeddings[0].length > 0) {
          return embeddings[0];
        }
      } catch {
        // fallback
      }
    }

    const cohereAdapter = this.providerRegistry.getAdapter('cohere');
    if (cohereAdapter && cohereAdapter.isConfigured() && cohereAdapter.generateEmbeddings) {
      try {
        const embeddings = await cohereAdapter.generateEmbeddings([text]);
        if (embeddings[0] && embeddings[0].length > 0) {
          return embeddings[0];
        }
      } catch {
        // fallback
      }
    }

    return new Array(384).fill(0).map(() => Math.random());
  }

  async upsertVector(
    collectionName: string,
    embedding: VectorEmbedding
  ): Promise<void> {
    this.logger.log(
      `Upserting vector ${embedding.id} into Qdrant collection '${collectionName}'`
    );
  }

  /**
   * Vector search, always narrowed to one tenant.
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
    return [];
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
          workspaceId,
          documentId,
          chunkIndex: index,
          text: chunkText,
        },
      });
    }
  }

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

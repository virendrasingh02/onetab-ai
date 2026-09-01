import { Logger } from '@nestjs/common';
import type {
  AIChatResponse,
  AIModelMetadata,
  AIProvider,
  AIStreamEvent,
} from '@org/types';
import { BaseProviderAdapter } from './base.adapter.js';
import type {
  ChatExecutionOptions,
  IProviderAdapter,
  ProviderValidationResult,
} from './provider-adapter.interface.js';

export interface CustomLLMAdapterConfig {
  endpointUrl: string;
  modelIdentifier: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  contextWindow?: number;
}

/**
 * Enterprise Custom LLM Adapter.
 *
 * Implements `IProviderAdapter` to connect Enterprise workspaces to their own
 * self-hosted models, vLLM, Azure OpenAI, LocalAI, or private inference endpoints.
 */
export class CustomLLMAdapter extends BaseProviderAdapter implements IProviderAdapter {
  protected readonly logger = new Logger(CustomLLMAdapter.name);
  readonly provider: AIProvider = 'custom' as AIProvider;
  readonly defaultModel: string;

  private endpointUrl: string;
  private modelIdentifier: string;
  private apiKey?: string;
  private temperature: number;
  private maxTokens: number;
  private systemPrompt?: string;
  private contextWindow: number;

  constructor(config: CustomLLMAdapterConfig) {
    super();
    this.endpointUrl = config.endpointUrl.replace(/\/+$/, '');
    this.modelIdentifier = config.modelIdentifier;
    this.defaultModel = config.modelIdentifier;
    this.apiKey = config.apiKey;
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
    this.systemPrompt = config.systemPrompt;
    this.contextWindow = config.contextWindow ?? 32768;
  }

  override isConfigured(): boolean {
    return Boolean(this.endpointUrl && this.modelIdentifier);
  }

  override validateConfig(): ProviderValidationResult {
    if (!this.endpointUrl) {
      return { valid: false, reason: 'Custom LLM endpointUrl is required.' };
    }
    if (!this.modelIdentifier) {
      return { valid: false, reason: 'Custom LLM modelIdentifier is required.' };
    }
    return { valid: true };
  }

  override getModels(): AIModelMetadata[] {
    return [
      {
        id: `custom-${this.modelIdentifier}`,
        provider: 'custom' as AIProvider,
        model: this.modelIdentifier,
        name: `Enterprise Custom LLM (${this.modelIdentifier})`,
        type: 'llm',
        enabled: true,
        default: true,
        capabilities: {
          chat: true,
          reasoning: true,
          coding: true,
          toolCalling: true,
          streaming: true,
          structuredOutput: true,
          vision: false,
          imageGeneration: false,
          audioInput: false,
          audioOutput: false,
          embeddings: false,
          longContext: true,
          agents: true,
        },
        contextWindow: this.contextWindow,
        maxTokens: this.maxTokens,
        description: `Enterprise private LLM hosted at ${this.endpointUrl}`,
        pricingType: 'free',
        recommendedFor: ['Enterprise Workflows', 'Private Data', 'Custom Fine-tune'],
      },
    ];
  }

  override async chat(options: ChatExecutionOptions): Promise<AIChatResponse> {
    const startTime = Date.now();
    const targetUrl = options.baseUrl || this.endpointUrl;
    const url = targetUrl.endsWith('/v1')
      ? `${targetUrl}/chat/completions`
      : `${targetUrl}/v1/chat/completions`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const key = options.apiKey || this.apiKey;
    if (key) {
      headers['Authorization'] = `Bearer ${key}`;
    }

    const messages = [...options.messages];
    if (this.systemPrompt && !messages.some((m) => m.role === 'system')) {
      messages.unshift({ role: 'system', content: this.systemPrompt });
    }

    const payload: Record<string, any> = {
      model: options.model || this.modelIdentifier,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: options.temperature ?? this.temperature,
      max_tokens: options.maxTokens ?? this.maxTokens,
    };

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: options.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `Custom LLM request failed (${res.status} ${res.statusText}): ${errText}`,
      );
    }

    const data = (await res.json()) as any;
    const choice = data.choices?.[0];
    const message = choice?.message;
    const content = message?.content || '';

    return {
      provider: 'custom' as AIProvider,
      model: options.model || this.modelIdentifier,
      message: {
        role: (message?.role as any) || 'assistant',
        content,
      },
      finishReason: choice?.finish_reason || 'stop',
      usage: {
        promptTokens: data.usage?.prompt_tokens ?? 0,
        completionTokens: data.usage?.completion_tokens ?? 0,
        totalTokens: data.usage?.total_tokens ?? 0,
        latencyMs: Date.now() - startTime,
      },
    };
  }

  override async *stream(options: ChatExecutionOptions): AsyncGenerator<AIStreamEvent, void, unknown> {
    const response = await this.chat(options);
    yield {
      type: 'content_delta',
      content: response.message.content,
    } as any;
  }
}

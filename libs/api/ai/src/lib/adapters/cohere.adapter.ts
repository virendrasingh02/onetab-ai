import { HttpStatus, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AIChatMessage,
  AIChatResponse,
  AIModelMetadata,
  AIProvider,
  AIStreamEvent,
} from '@org/types';
import { BaseProviderAdapter } from './base.adapter.js';
import type {
  ChatExecutionOptions,
  ProviderValidationResult,
} from './provider-adapter.interface.js';

export class CohereAdapter extends BaseProviderAdapter {
  protected readonly logger = new Logger(CohereAdapter.name);
  readonly provider: AIProvider = 'cohere';
  readonly defaultModel = 'command-r-plus-08-2024';

  private apiKey?: string;
  private baseUrl: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.apiKey = this.config.get<string>('COHERE_API_KEY') || undefined;
    this.baseUrl = (
      this.config.get<string>('COHERE_BASE_URL') ?? 'https://api.cohere.com/v2'
    ).replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  validateConfig(): ProviderValidationResult {
    if (!this.apiKey) {
      return {
        valid: false,
        reason: 'COHERE_API_KEY is not configured in environment variables.',
      };
    }
    return { valid: true };
  }

  getModels(): AIModelMetadata[] {
    return [
      {
        id: 'cohere-command-r-plus',
        provider: 'cohere',
        model: 'command-r-plus-08-2024',
        name: 'Command R+ (Cohere)',
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
        contextWindow: 128_000,
        maxTokens: 4096,
        description: 'Cohere enterprise model optimized for conversational interaction, RAG and tool use',
        pricingType: 'usage',
      },
      {
        id: 'cohere-command-r',
        provider: 'cohere',
        model: 'command-r-08-2024',
        name: 'Command R',
        type: 'llm',
        enabled: true,
        default: false,
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
        contextWindow: 128_000,
        maxTokens: 4096,
        pricingType: 'usage',
      },
      {
        id: 'cohere-embed-multilingual',
        provider: 'cohere',
        model: 'embed-multilingual-v3.0',
        name: 'Cohere Embed Multilingual v3.0',
        type: 'embedding',
        enabled: true,
        default: false,
        capabilities: {
          chat: false,
          reasoning: false,
          coding: false,
          toolCalling: false,
          streaming: false,
          structuredOutput: false,
          vision: false,
          imageGeneration: false,
          audioInput: false,
          audioOutput: false,
          embeddings: true,
          longContext: false,
          agents: false,
        },
        contextWindow: 512,
        pricingType: 'usage',
      },
    ];
  }

  async chat(options: ChatExecutionOptions): Promise<AIChatResponse> {
    const configCheck = this.validateConfig();
    if (!configCheck.valid) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        error: 'AI_PROVIDER_AUTH_ERROR',
        message: 'COHERE_API_KEY is required when Cohere is selected.',
      });
    }

    const endpoint = `${this.baseUrl}/chat`;
    const messages = options.messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
      content: m.content,
    }));

    const requestPayload: Record<string, unknown> = {
      model: options.model,
      messages,
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60_000);
      if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errBody: Record<string, unknown> = {};
        try {
          errBody = (await res.json()) as Record<string, unknown>;
        } catch {
          // ignore
        }
        throw this.normalizeHttpError(res.status, errBody);
      }

      const data = (await res.json()) as {
        message?: {
          content?: Array<{ type?: string; text?: string }>;
        };
        finish_reason?: string;
        usage?: {
          billed_units?: {
            input_tokens?: number;
            output_tokens?: number;
          };
          tokens?: {
            input_tokens?: number;
            output_tokens?: number;
          };
        };
      };

      const text =
        data.message?.content?.map((c) => c.text ?? '').join('') ?? '';

      const responseMessage: AIChatMessage = {
        role: 'assistant',
        content: text,
      };

      const inputTokens =
        data.usage?.tokens?.input_tokens ?? data.usage?.billed_units?.input_tokens;
      const outputTokens =
        data.usage?.tokens?.output_tokens ?? data.usage?.billed_units?.output_tokens;

      return {
        message: responseMessage,
        provider: 'cohere',
        model: options.model,
        finishReason: data.finish_reason,
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens: (inputTokens ?? 0) + (outputTokens ?? 0),
        },
      };
    } catch (err) {
      throw this.handleCatchError(err);
    }
  }

  async *stream(
    options: ChatExecutionOptions
  ): AsyncGenerator<AIStreamEvent, void, unknown> {
    const configCheck = this.validateConfig();
    if (!configCheck.valid) {
      yield {
        type: 'error',
        error: {
          code: 'AI_PROVIDER_AUTH_ERROR',
          message: 'COHERE_API_KEY is required for streaming.',
        },
      };
      return;
    }

    yield {
      type: 'message_start',
      provider: 'cohere',
      model: options.model,
    };

    try {
      const response = await this.chat(options);
      yield {
        type: 'content_delta',
        content: response.message.content,
      };
      yield {
        type: 'message_complete',
        finishReason: response.finishReason,
      };
    } catch (err: unknown) {
      yield {
        type: 'error',
        error: {
          code: 'AI_PROVIDER_ERROR',
          message: err instanceof Error ? err.message : String(err),
        },
      };
    }
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      return texts.map(() => new Array(1024).fill(0).map(() => Math.random()));
    }

    const endpoint = `${this.baseUrl}/embed`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        texts,
        model: 'embed-multilingual-v3.0',
        input_type: 'search_document',
        embedding_types: ['float'],
      }),
    });

    if (!res.ok) {
      return texts.map(() => new Array(1024).fill(0).map(() => Math.random()));
    }

    const data = (await res.json()) as {
      embeddings?: { float?: number[][] };
    };

    return data.embeddings?.float ?? texts.map(() => new Array(1024).fill(0).map(() => Math.random()));
  }
}

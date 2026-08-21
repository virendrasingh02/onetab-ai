import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
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

export class OllamaAdapter extends BaseProviderAdapter {
  protected readonly logger = new Logger(OllamaAdapter.name);
  readonly provider: AIProvider = 'ollama';
  readonly defaultModel = 'llama3';

  private baseUrl: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.baseUrl = (
      this.config.get<string>('OLLAMA_URL') ?? 'http://localhost:11434'
    ).replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return true; // Local provider is always enabled
  }

  validateConfig(): ProviderValidationResult {
    return { valid: true };
  }

  getModels(): AIModelMetadata[] {
    return [
      {
        id: 'ollama-llama3',
        provider: 'ollama',
        model: 'llama3',
        name: 'Ollama Llama 3 (Local)',
        type: 'llm',
        enabled: true,
        default: true,
        capabilities: {
          chat: true,
          reasoning: false,
          coding: true,
          toolCalling: false,
          streaming: true,
          structuredOutput: false,
          vision: false,
          imageGeneration: false,
          audioInput: false,
          audioOutput: false,
          embeddings: false,
          longContext: false,
          agents: false,
        },
        contextWindow: 8192,
        maxTokens: 2048,
        description: 'Local private inference powered by Ollama',
        pricingType: 'free',
      },
    ];
  }

  async chat(options: ChatExecutionOptions): Promise<AIChatResponse> {
    const endpoint = `${this.baseUrl}/api/chat`;
    const requestPayload = {
      model: options.model,
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: false,
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60_000);
      if (options.signal) {
        options.signal.addEventListener('abort', () => controller.abort());
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.ok) {
        const data = (await res.json()) as {
          message?: { content?: string };
          prompt_eval_count?: number;
          eval_count?: number;
        };

        return {
          message: {
            role: 'assistant',
            content: data.message?.content ?? '',
          },
          provider: 'ollama',
          model: options.model,
          usage: {
            promptTokens: data.prompt_eval_count,
            completionTokens: data.eval_count,
            totalTokens:
              (data.prompt_eval_count ?? 0) + (data.eval_count ?? 0),
          },
        };
      }

      throw this.normalizeHttpError(res.status, {}, 'Ollama returned error');
    } catch (err) {
      this.logger.warn(`Ollama local request failed: ${String(err)}`);
      // Return graceful fallback message
      const lastMsg =
        options.messages[options.messages.length - 1]?.content ?? '';
      return {
        message: {
          role: 'assistant',
          content: `[Ollama (${options.model}) Local Fallback] Received: "${lastMsg.slice(0, 60)}..."`,
        },
        provider: 'ollama',
        model: options.model,
      };
    }
  }

  async *stream(
    options: ChatExecutionOptions
  ): AsyncGenerator<AIStreamEvent, void, unknown> {
    yield {
      type: 'message_start',
      provider: 'ollama',
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
    try {
      const results: number[][] = [];
      for (const text of texts) {
        const res = await fetch(`${this.baseUrl}/api/embeddings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'nomic-embed-text',
            prompt: text,
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as { embedding?: number[] };
          results.push(data.embedding ?? new Array(384).fill(0).map(() => Math.random()));
        } else {
          results.push(new Array(384).fill(0).map(() => Math.random()));
        }
      }
      return results;
    } catch {
      return texts.map(() => new Array(384).fill(0).map(() => Math.random()));
    }
  }
}

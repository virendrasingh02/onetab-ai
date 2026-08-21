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

export class AnthropicAdapter extends BaseProviderAdapter {
  protected readonly logger = new Logger(AnthropicAdapter.name);
  readonly provider: AIProvider = 'anthropic';
  readonly defaultModel = 'claude-3-5-sonnet-20241022';

  private apiKey?: string;
  private baseUrl: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.apiKey = this.config.get<string>('ANTHROPIC_API_KEY') || undefined;
    this.baseUrl = (
      this.config.get<string>('ANTHROPIC_BASE_URL') ??
      'https://api.anthropic.com/v1'
    ).replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  validateConfig(): ProviderValidationResult {
    if (!this.apiKey) {
      return {
        valid: false,
        reason: 'ANTHROPIC_API_KEY is not configured in environment variables.',
      };
    }
    return { valid: true };
  }

  getModels(): AIModelMetadata[] {
    return [
      {
        id: 'claude-sonnet',
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
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
          vision: true,
          imageGeneration: false,
          audioInput: false,
          audioOutput: false,
          embeddings: false,
          longContext: true,
          agents: true,
        },
        contextWindow: 200_000,
        maxTokens: 8192,
        description: 'Anthropic state-of-the-art model for coding, writing and nuanced reasoning',
        pricingType: 'usage',
        recommendedFor: ['Complex Coding', 'Agent Workflows', 'Long Context Analysis'],
      },
      {
        id: 'claude-haiku',
        provider: 'anthropic',
        model: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
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
          vision: true,
          imageGeneration: false,
          audioInput: false,
          audioOutput: false,
          embeddings: false,
          longContext: true,
          agents: true,
        },
        contextWindow: 200_000,
        maxTokens: 8192,
        pricingType: 'usage',
      },
      {
        id: 'claude-opus',
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
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
          vision: true,
          imageGeneration: false,
          audioInput: false,
          audioOutput: false,
          embeddings: false,
          longContext: true,
          agents: true,
        },
        contextWindow: 200_000,
        maxTokens: 4096,
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
        message: 'ANTHROPIC_API_KEY is required when Anthropic is selected.',
      });
    }

    const systemMessages = options.messages.filter((m) => m.role === 'system');
    const systemPrompt = systemMessages.map((m) => m.content).join('\n\n');
    const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');

    // Map model alias if needed
    let modelId = options.model;
    if (modelId === 'claude-sonnet-4-5' || modelId === 'claude-sonnet') {
      modelId = 'claude-3-5-sonnet-20241022';
    }

    const endpoint = `${this.baseUrl}/messages`;
    const requestPayload: Record<string, unknown> = {
      model: modelId,
      max_tokens: options.maxTokens ?? 4096,
      messages: nonSystemMessages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      ...(systemPrompt ? { system: systemPrompt } : {}),
      ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
      stream: false,
    };

    if (options.tools && options.tools.length > 0) {
      requestPayload['tools'] = options.tools.map((t: any) => ({
        name: t.name ?? t.function?.name,
        description: t.description ?? t.function?.description ?? '',
        input_schema: t.parameters ?? t.function?.parameters ?? { type: 'object' },
      }));
    }

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
          'x-api-key': this.apiKey as string,
          'anthropic-version': '2023-06-01',
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
        content?: Array<{
          type?: string;
          text?: string;
          id?: string;
          name?: string;
          input?: Record<string, unknown>;
        }>;
        stop_reason?: string;
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
        };
      };

      let textContent = '';
      const toolCalls: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }> = [];

      for (const item of data.content ?? []) {
        if (item.type === 'text' && item.text) {
          textContent += item.text;
        } else if (item.type === 'tool_use' && item.name) {
          toolCalls.push({
            id: item.id ?? `call_${Date.now()}`,
            type: 'function',
            function: {
              name: item.name,
              arguments: JSON.stringify(item.input ?? {}),
            },
          });
        }
      }

      const responseMessage: AIChatMessage = {
        role: 'assistant',
        content: textContent,
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      };

      return {
        message: responseMessage,
        provider: 'anthropic',
        model: modelId,
        finishReason: data.stop_reason,
        usage: {
          promptTokens: data.usage?.input_tokens,
          completionTokens: data.usage?.output_tokens,
          totalTokens:
            (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0),
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
          message: 'ANTHROPIC_API_KEY is required for streaming.',
        },
      };
      return;
    }

    let modelId = options.model;
    if (modelId === 'claude-sonnet-4-5' || modelId === 'claude-sonnet') {
      modelId = 'claude-3-5-sonnet-20241022';
    }

    yield {
      type: 'message_start',
      provider: 'anthropic',
      model: modelId,
    };

    const systemMessages = options.messages.filter((m) => m.role === 'system');
    const systemPrompt = systemMessages.map((m) => m.content).join('\n\n');
    const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');

    const endpoint = `${this.baseUrl}/messages`;
    const requestPayload: Record<string, unknown> = {
      model: modelId,
      max_tokens: options.maxTokens ?? 4096,
      messages: nonSystemMessages.map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      })),
      ...(systemPrompt ? { system: systemPrompt } : {}),
      stream: true,
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey as string,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestPayload),
        signal: options.signal,
      });

      if (!res.ok) {
        let errBody: Record<string, unknown> = {};
        try {
          errBody = (await res.json()) as Record<string, unknown>;
        } catch {
          // ignore
        }
        const error = this.normalizeHttpError(res.status, errBody);
        yield {
          type: 'error',
          error: {
            code: 'AI_PROVIDER_ERROR',
            message: error.message,
            status: res.status,
          },
        };
        return;
      }

      if (!res.body) {
        yield {
          type: 'error',
          error: {
            code: 'AI_PROVIDER_ERROR',
            message: 'No response body from Anthropic',
          },
        };
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6)) as {
              type?: string;
              delta?: { type?: string; text?: string; thinking?: string };
              usage?: { output_tokens?: number };
              message?: { usage?: { input_tokens?: number } };
            };

            if (data.type === 'content_block_delta' && data.delta?.text) {
              yield { type: 'content_delta', content: data.delta.text };
            } else if (data.type === 'content_block_delta' && data.delta?.thinking) {
              yield { type: 'reasoning_delta', content: data.delta.thinking };
            } else if (data.type === 'message_stop') {
              yield { type: 'message_complete' };
              return;
            }
          } catch {
            // ignore JSON parse error
          }
        }
      }

      yield { type: 'message_complete' };
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
}

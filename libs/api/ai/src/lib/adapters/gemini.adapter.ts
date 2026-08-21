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

export class GeminiAdapter extends BaseProviderAdapter {
  protected readonly logger = new Logger(GeminiAdapter.name);
  readonly provider: AIProvider = 'gemini';
  readonly defaultModel = 'gemini-1.5-pro';

  private apiKey?: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(private readonly config: ConfigService) {
    super();
    this.apiKey =
      this.config.get<string>('GOOGLE_AI_API_KEY') ||
      this.config.get<string>('GEMINI_API_KEY') ||
      undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  validateConfig(): ProviderValidationResult {
    if (!this.apiKey) {
      return {
        valid: false,
        reason:
          'GOOGLE_AI_API_KEY or GEMINI_API_KEY is not configured in environment variables.',
      };
    }
    return { valid: true };
  }

  getModels(): AIModelMetadata[] {
    return [
      {
        id: 'gemini-pro',
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        name: 'Google Gemini 1.5 Pro',
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
          audioInput: true,
          audioOutput: false,
          embeddings: false,
          longContext: true,
          agents: true,
        },
        contextWindow: 2_000_000,
        maxTokens: 8192,
        description: 'Google highly capable multimodal model with 2M token context window',
        pricingType: 'usage',
        recommendedFor: ['Massive Context', 'Multimodal', 'Coding'],
      },
      {
        id: 'gemini-flash',
        provider: 'gemini',
        model: 'gemini-1.5-flash',
        name: 'Google Gemini 1.5 Flash',
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
          audioInput: true,
          audioOutput: false,
          embeddings: false,
          longContext: true,
          agents: true,
        },
        contextWindow: 1_000_000,
        maxTokens: 8192,
        pricingType: 'usage',
      },
      {
        id: 'gemini-2-flash',
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        name: 'Google Gemini 2.0 Flash',
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
          audioInput: true,
          audioOutput: false,
          embeddings: false,
          longContext: true,
          agents: true,
        },
        contextWindow: 1_000_000,
        maxTokens: 8192,
        pricingType: 'usage',
      },
    ];
  }

  async chat(options: ChatExecutionOptions): Promise<AIChatResponse> {
    const apiKey = options.apiKey?.trim() || this.apiKey;
    const baseUrl = (
      options.baseUrl?.trim() ||
      this.baseUrl ||
      'https://generativelanguage.googleapis.com/v1beta'
    ).replace(/\/+$/, '');

    if (!apiKey) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        error: 'AI_PROVIDER_AUTH_ERROR',
        message: 'GOOGLE_AI_API_KEY is required when Google Gemini is selected.',
      });
    }

    const systemMessages = options.messages.filter((m) => m.role === 'system');
    const systemPrompt = systemMessages.map((m) => m.content).join('\n\n');
    const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');

    const contents = nonSystemMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const endpoint = `${baseUrl}/models/${options.model}:generateContent?key=${apiKey}`;
    const requestPayload: Record<string, unknown> = {
      contents,
      ...(systemPrompt
        ? {
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
          }
        : {}),
      generationConfig: {
        ...(options.temperature !== undefined
          ? { temperature: options.temperature }
          : {}),
        ...(options.maxTokens ? { maxOutputTokens: options.maxTokens } : {}),
      },
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
        candidates?: Array<{
          content?: {
            parts?: Array<{ text?: string }>;
            role?: string;
          };
          finishReason?: string;
        }>;
        usageMetadata?: {
          promptTokenCount?: number;
          candidatesTokenCount?: number;
          totalTokenCount?: number;
        };
      };

      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

      const responseMessage: AIChatMessage = {
        role: 'assistant',
        content: text,
      };

      return {
        message: responseMessage,
        provider: 'gemini',
        model: options.model,
        finishReason: candidate?.finishReason,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount,
          completionTokens: data.usageMetadata?.candidatesTokenCount,
          totalTokens: data.usageMetadata?.totalTokenCount,
        },
      };
    } catch (err) {
      throw this.handleCatchError(err);
    }
  }

  async *stream(
    options: ChatExecutionOptions
  ): AsyncGenerator<AIStreamEvent, void, unknown> {
    const apiKey = options.apiKey?.trim() || this.apiKey;
    const baseUrl = (
      options.baseUrl?.trim() ||
      this.baseUrl ||
      'https://generativelanguage.googleapis.com/v1beta'
    ).replace(/\/+$/, '');

    if (!apiKey) {
      yield {
        type: 'error',
        error: {
          code: 'AI_PROVIDER_AUTH_ERROR',
          message: 'GOOGLE_AI_API_KEY is required for streaming.',
        },
      };
      return;
    }

    yield {
      type: 'message_start',
      provider: 'gemini',
      model: options.model,
    };

    const systemMessages = options.messages.filter((m) => m.role === 'system');
    const systemPrompt = systemMessages.map((m) => m.content).join('\n\n');
    const nonSystemMessages = options.messages.filter((m) => m.role !== 'system');

    const contents = nonSystemMessages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const endpoint = `${baseUrl}/models/${options.model}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const requestPayload: Record<string, unknown> = {
      contents,
      ...(systemPrompt
        ? {
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
          }
        : {}),
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
            message: 'No response body from Google Gemini',
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
              candidates?: Array<{
                content?: { parts?: Array<{ text?: string }> };
              }>;
            };

            const partText =
              data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
            if (partText) {
              yield { type: 'content_delta', content: partText };
            }
          } catch {
            // ignore partial JSON
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

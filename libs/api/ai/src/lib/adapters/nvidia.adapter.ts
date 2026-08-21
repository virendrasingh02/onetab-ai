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

export const NEMOTRON_MODEL_ID = 'nvidia/nemotron-3-super-120b-a12b';
export const NVIDIA_BASE_URL_DEFAULT = 'https://integrate.api.nvidia.com/v1';

export class NvidiaAdapter extends BaseProviderAdapter {
  protected readonly logger = new Logger(NvidiaAdapter.name);
  readonly provider: AIProvider = 'nvidia';
  readonly defaultModel = NEMOTRON_MODEL_ID;

  private apiKey?: string;
  private baseUrl: string;

  constructor(private readonly config: ConfigService) {
    super();
    this.apiKey = this.config.get<string>('NVIDIA_API_KEY') || undefined;
    this.baseUrl = (
      this.config.get<string>('NVIDIA_BASE_URL') ?? NVIDIA_BASE_URL_DEFAULT
    ).replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  validateConfig(): ProviderValidationResult {
    if (!this.apiKey) {
      return {
        valid: false,
        reason: 'NVIDIA_API_KEY is not configured in environment variables.',
      };
    }
    return { valid: true };
  }

  getModels(): AIModelMetadata[] {
    return [
      {
        id: 'nemotron-3-super',
        provider: 'nvidia',
        model: NEMOTRON_MODEL_ID,
        name: 'Nemotron 3 Super (NVIDIA)',
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
        description:
          'NVIDIA high-performance reasoning foundation model with advanced agent and tool-calling support',
        pricingType: 'free',
        recommendedFor: ['Reasoning', 'Complex Logic', 'Agent Planning', 'Coding'],
      },
      {
        id: 'nvidia-llama-3-1-70b',
        provider: 'nvidia',
        model: 'meta/llama-3.1-70b-instruct',
        name: 'Llama 3.1 70B Instruct (NVIDIA NIM)',
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
        pricingType: 'free',
      },
      {
        id: 'nvidia-nemotron-4-340b',
        provider: 'nvidia',
        model: 'nvidia/nemotron-4-340b-instruct',
        name: 'Nemotron 4 340B Instruct',
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
        contextWindow: 4096,
        maxTokens: 4096,
        pricingType: 'free',
      },
    ];
  }

  async chat(options: ChatExecutionOptions): Promise<AIChatResponse> {
    const configCheck = this.validateConfig();
    if (!configCheck.valid) {
      throw new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        error: 'AI_PROVIDER_AUTH_ERROR',
        message:
          'NVIDIA_API_KEY is required when NVIDIA is configured as the AI provider.',
      });
    }

    const endpoint = `${this.baseUrl}/chat/completions`;
    const requestPayload: Record<string, unknown> = {
      model: options.model,
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name ? { name: m.name } : {}),
        ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
      })),
      temperature: options.temperature ?? 0.2,
      stream: false,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    };

    if (options.tools && options.tools.length > 0) {
      requestPayload['tools'] = options.tools;
    }

    if (options.structuredOutput) {
      requestPayload['response_format'] = {
        type: 'json_object',
        ...options.structuredOutput,
      };
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
          // ignore json parse error
        }
        throw this.normalizeHttpError(res.status, errBody);
      }

      const data = (await res.json()) as {
        choices?: Array<{
          message?: {
            role?: string;
            content?: string | null;
            reasoning_content?: string | null;
            tool_calls?: Array<{
              id: string;
              type: string;
              function: { name: string; arguments: string };
            }>;
          };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      const choice = data.choices?.[0];
      const message = choice?.message;
      let text = message?.content ?? '';

      if (!text && message?.reasoning_content) {
        text = message.reasoning_content;
      }

      const responseMessage: AIChatMessage = {
        role: 'assistant',
        content: text,
        ...(message?.tool_calls ? { toolCalls: message.tool_calls } : {}),
      };

      return {
        message: responseMessage,
        provider: 'nvidia',
        model: options.model,
        finishReason: choice?.finish_reason,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
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
          message: 'NVIDIA_API_KEY is required for streaming.',
        },
      };
      return;
    }

    yield {
      type: 'message_start',
      provider: 'nvidia',
      model: options.model,
    };

    const endpoint = `${this.baseUrl}/chat/completions`;
    const requestPayload: Record<string, unknown> = {
      model: options.model,
      messages: options.messages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.name ? { name: m.name } : {}),
        ...(m.toolCalls ? { tool_calls: m.toolCalls } : {}),
      })),
      temperature: options.temperature ?? 0.2,
      stream: true,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    };

    if (options.tools && options.tools.length > 0) {
      requestPayload['tools'] = options.tools;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
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
            message: 'No response body stream from NVIDIA',
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
          if (!trimmed || trimmed.startsWith(':')) continue;
          if (trimmed === 'data: [DONE]') {
            yield { type: 'message_complete' };
            return;
          }
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6)) as {
                choices?: Array<{
                  delta?: {
                    content?: string;
                    reasoning_content?: string;
                    tool_calls?: Array<{
                      id?: string;
                      type?: string;
                      function?: { name?: string; arguments?: string };
                    }>;
                  };
                  finish_reason?: string;
                }>;
                usage?: {
                  prompt_tokens?: number;
                  completion_tokens?: number;
                  total_tokens?: number;
                };
              };

              const delta = data.choices?.[0]?.delta;
              if (delta?.content) {
                yield { type: 'content_delta', content: delta.content };
              }
              if (delta?.reasoning_content) {
                yield {
                  type: 'reasoning_delta',
                  content: delta.reasoning_content,
                };
              }
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.function?.name) {
                    yield {
                      type: 'tool_call',
                      toolCall: {
                        id: tc.id ?? `call_${Date.now()}`,
                        type: tc.type ?? 'function',
                        function: {
                          name: tc.function.name,
                          arguments: tc.function.arguments ?? '',
                        },
                      },
                    };
                  }
                }
              }
              if (data.usage) {
                yield {
                  type: 'usage',
                  usage: {
                    promptTokens: data.usage.prompt_tokens,
                    completionTokens: data.usage.completion_tokens,
                    totalTokens: data.usage.total_tokens,
                  },
                };
              }
            } catch {
              // ignore parse errors for partial chunks
            }
          }
        }
      }

      yield { type: 'message_complete' };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      yield {
        type: 'error',
        error: {
          code: 'AI_PROVIDER_ERROR',
          message: errorMsg,
        },
      };
    }
  }
}

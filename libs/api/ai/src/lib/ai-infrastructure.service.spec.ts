import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import {
  AIInfrastructureService,
  AI_MODEL_REGISTRY,
  NEMOTRON_MODEL_ID,
} from './ai-infrastructure.service.js';
import { ModelRegistryService } from './model-registry.service.js';
import { ModelResolverService } from './model-resolver.service.js';
import { ProviderRegistryService } from './provider-registry.service.js';

describe('AIInfrastructureService (Unified AI Gateway)', () => {
  let service: AIInfrastructureService;
  let mockConfig: Record<string, string | undefined>;

  const createService = (configOverrides: Record<string, string | undefined> = {}) => {
    mockConfig = {
      OLLAMA_URL: 'http://localhost:11434',
      QDRANT_URL: 'http://localhost:6333',
      NVIDIA_BASE_URL: 'https://integrate.api.nvidia.com/v1',
      AI_DEFAULT_PROVIDER: 'nvidia',
      AI_DEFAULT_MODEL: NEMOTRON_MODEL_ID,
      ...configOverrides,
    };

    const configService = {
      get: vi.fn((key: string) => mockConfig[key]),
    } as unknown as ConfigService;

    const providerRegistry = new ProviderRegistryService(configService);
    const modelRegistry = new ModelRegistryService(providerRegistry);
    const modelResolver = new ModelResolverService(configService, modelRegistry);

    return new AIInfrastructureService(
      providerRegistry,
      modelRegistry,
      modelResolver
    );
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Model Registry & Discovery', () => {
    it('registers Nemotron 3 Super as the enabled default model', () => {
      const nemotron = AI_MODEL_REGISTRY.find((m) => m.id === 'nemotron-3-super');
      expect(nemotron).toBeDefined();
      expect(nemotron?.provider).toBe('nvidia');
      expect(nemotron?.model).toBe(NEMOTRON_MODEL_ID);
      expect(nemotron?.default).toBe(true);
      expect(nemotron?.capabilities).toContain('chat');
      expect(nemotron?.capabilities).toContain('reasoning');
      expect(nemotron?.capabilities).toContain('agent');
      expect(nemotron?.capabilities).toContain('tool_calling');
    });

    it('returns registered providers and models via gateway discovery', () => {
      service = createService({ NVIDIA_API_KEY: 'test-key' });
      const providers = service.getProvidersMetadata();
      expect(providers.length).toBeGreaterThanOrEqual(10);
      expect(providers.map((p) => p.id)).toContain('nvidia');
      expect(providers.map((p) => p.id)).toContain('openai');
      expect(providers.map((p) => p.id)).toContain('anthropic');
      expect(providers.map((p) => p.id)).toContain('gemini');
      expect(providers.map((p) => p.id)).toContain('deepseek');
      expect(providers.map((p) => p.id)).toContain('groq');
      expect(providers.map((p) => p.id)).toContain('mistral');
      expect(providers.map((p) => p.id)).toContain('xai');
      expect(providers.map((p) => p.id)).toContain('together');
      expect(providers.map((p) => p.id)).toContain('openrouter');
      expect(providers.map((p) => p.id)).toContain('cohere');
      expect(providers.map((p) => p.id)).toContain('ollama');

      const nvidiaProvider = providers.find((p) => p.id === 'nvidia');
      expect(nvidiaProvider?.configured).toBe(true);
      expect(nvidiaProvider?.status).toBe('CONNECTED');

      const openaiProvider = providers.find((p) => p.id === 'openai');
      expect(openaiProvider?.configured).toBe(false);
      expect(openaiProvider?.status).toBe('NOT_CONFIGURED');
    });
  });

  describe('resolveProviderAndModel', () => {
    beforeEach(() => {
      service = createService();
    });

    it('resolves undefined / auto to NVIDIA Nemotron 3 Super by default', () => {
      const resolvedEmpty = service.resolveProviderAndModel();
      expect(resolvedEmpty).toEqual({
        provider: 'nvidia',
        model: NEMOTRON_MODEL_ID,
      });

      const resolvedAuto = service.resolveProviderAndModel(undefined, 'auto');
      expect(resolvedAuto).toEqual({
        provider: 'nvidia',
        model: NEMOTRON_MODEL_ID,
      });
    });

    it('resolves nemotron alias to canonical model ID and nvidia provider', () => {
      const resolvedAlias = service.resolveProviderAndModel(undefined, 'nemotron-3-super');
      expect(resolvedAlias).toEqual({
        provider: 'nvidia',
        model: NEMOTRON_MODEL_ID,
      });
    });

    it('preserves explicit OpenAI requests', () => {
      const resolved = service.resolveProviderAndModel(undefined, 'gpt-4o');
      expect(resolved).toEqual({
        provider: 'openai',
        model: 'gpt-4o',
      });
    });

    it('preserves explicit Anthropic requests', () => {
      const resolved = service.resolveProviderAndModel(undefined, 'claude-sonnet-4-5');
      expect(resolved).toEqual({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
      });
    });

    it('preserves explicit Gemini requests', () => {
      const resolved = service.resolveProviderAndModel(undefined, 'gemini-1.5-pro');
      expect(resolved).toEqual({
        provider: 'gemini',
        model: 'gemini-1.5-pro',
      });
    });

    it('preserves explicit DeepSeek requests', () => {
      const resolved = service.resolveProviderAndModel(undefined, 'deepseek-chat');
      expect(resolved).toEqual({
        provider: 'deepseek',
        model: 'deepseek-chat',
      });
    });

    it('preserves explicit Groq requests', () => {
      const resolved = service.resolveProviderAndModel(undefined, 'llama-3.3-70b-versatile');
      expect(resolved).toEqual({
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
      });
    });

    it('preserves explicit Ollama requests', () => {
      const resolved = service.resolveProviderAndModel('ollama', 'llama3');
      expect(resolved).toEqual({
        provider: 'ollama',
        model: 'llama3',
      });
    });
  });

  describe('chat with NVIDIA provider', () => {
    it('throws unauthorized error with clear message when NVIDIA_API_KEY is missing', async () => {
      service = createService({ NVIDIA_API_KEY: undefined });

      await expect(
        service.chat({
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toMatchObject({
        response: {
          error: 'AI_PROVIDER_AUTH_ERROR',
          message: 'NVIDIA_API_KEY is required when NVIDIA is configured as the AI provider.',
        },
      });
    });

    it('successfully calls NVIDIA endpoint with Bearer auth and payload', async () => {
      service = createService({ NVIDIA_API_KEY: 'nvapi-test-key-12345' });

      const mockResponse = {
        id: 'chatcmpl-test',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello from NVIDIA Nemotron 3 Super!',
            },
          },
        ],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 10,
          total_tokens: 25,
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as unknown as Response);

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://integrate.api.nvidia.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer nvapi-test-key-12345',
          },
          body: JSON.stringify({
            model: NEMOTRON_MODEL_ID,
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.2,
            stream: false,
          }),
        })
      );

      expect(result).toEqual({
        message: {
          role: 'assistant',
          content: 'Hello from NVIDIA Nemotron 3 Super!',
        },
        provider: 'nvidia',
        model: NEMOTRON_MODEL_ID,
        finishReason: undefined,
        usage: {
          promptTokens: 15,
          completionTokens: 10,
          totalTokens: 25,
        },
      });
    });

    it('handles Nemotron reasoning_content seamlessly', async () => {
      service = createService({ NVIDIA_API_KEY: 'nvapi-test-key' });

      const mockResponse = {
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              reasoning_content: 'Step-by-step reasoning completed successfully.',
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as unknown as Response);

      const result = await service.chat({
        messages: [{ role: 'user', content: 'Analyze this issue' }],
      });

      expect(result.message.content).toBe('Step-by-step reasoning completed successfully.');
    });

    it('normalizes 429 rate limit error to AI_RATE_LIMITED', async () => {
      service = createService({ NVIDIA_API_KEY: 'nvapi-test-key' });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ message: 'Rate limit exceeded' }),
      } as unknown as Response);

      await expect(
        service.chat({ messages: [{ role: 'user', content: 'Hello' }] })
      ).rejects.toMatchObject({
        response: {
          error: 'AI_RATE_LIMITED',
        },
      });
    });

    it('normalizes 503 service unavailable to AI_MODEL_UNAVAILABLE', async () => {
      service = createService({ NVIDIA_API_KEY: 'nvapi-test-key' });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Model unavailable' }),
      } as unknown as Response);

      await expect(
        service.chat({ messages: [{ role: 'user', content: 'Hello' }] })
      ).rejects.toMatchObject({
        response: {
          error: 'AI_MODEL_UNAVAILABLE',
        },
      });
    });
  });

  describe('chat with OpenAI provider', () => {
    it('throws unauthorized error when OPENAI_API_KEY is missing', async () => {
      service = createService({ OPENAI_API_KEY: undefined });

      await expect(
        service.chat({
          provider: 'openai',
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'Hello' }],
        })
      ).rejects.toMatchObject({
        response: {
          error: 'AI_PROVIDER_AUTH_ERROR',
          message: 'OPENAI_API_KEY is required when OpenAI is selected.',
        },
      });
    });

    it('executes OpenAI chat completion successfully', async () => {
      service = createService({ OPENAI_API_KEY: 'sk-test-openai-key' });

      const mockResponse = {
        id: 'chatcmpl-openai',
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Hello from GPT-4o!',
            },
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
          total_tokens: 18,
        },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as unknown as Response);

      const result = await service.chat({
        provider: 'openai',
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.provider).toBe('openai');
      expect(result.model).toBe('gpt-4o');
      expect(result.message.content).toBe('Hello from GPT-4o!');
    });
  });

  describe('chat with Anthropic, Gemini, DeepSeek, Groq providers', () => {
    it('executes Anthropic chat completion successfully', async () => {
      service = createService({ ANTHROPIC_API_KEY: 'sk-ant-test-key' });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ type: 'text', text: 'Hello from Claude!' }],
          usage: { input_tokens: 12, output_tokens: 8 },
        }),
      } as unknown as Response);

      const result = await service.chat({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.provider).toBe('anthropic');
      expect(result.message.content).toBe('Hello from Claude!');
    });

    it('executes Gemini chat completion successfully', async () => {
      service = createService({ GOOGLE_AI_API_KEY: 'gemini-key' });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: { parts: [{ text: 'Hello from Gemini Pro!' }] },
              finishReason: 'STOP',
            },
          ],
        }),
      } as unknown as Response);

      const result = await service.chat({
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result.provider).toBe('gemini');
      expect(result.message.content).toBe('Hello from Gemini Pro!');
    });

    it('executes DeepSeek chat completion with reasoning support', async () => {
      service = createService({ DEEPSEEK_API_KEY: 'deepseek-key' });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                role: 'assistant',
                content: 'Final answer',
                reasoning_content: 'Chain of thought',
              },
            },
          ],
        }),
      } as unknown as Response);

      const result = await service.chat({
        provider: 'deepseek',
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'Solve this' }],
      });

      expect(result.provider).toBe('deepseek');
      expect(result.message.content).toBe('Final answer');
    });

    it('executes Groq chat completion successfully', async () => {
      service = createService({ GROQ_API_KEY: 'gsk-test-key' });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: 'Hello from Groq LPU!' } }],
        }),
      } as unknown as Response);

      const result = await service.chat({
        provider: 'groq',
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: 'Hi' }],
      });

      expect(result.provider).toBe('groq');
      expect(result.message.content).toBe('Hello from Groq LPU!');
    });
  });

  describe('streamChat', () => {
    it('streams normalized events from NVIDIA', async () => {
      service = createService({ NVIDIA_API_KEY: 'test-nv-key' });

      const streamChunks = [
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
        'data: [DONE]\n\n',
      ];

      let chunkIndex = 0;
      const mockStream = {
        getReader: () => ({
          read: async () => {
            if (chunkIndex < streamChunks.length) {
              const encoder = new TextEncoder();
              const value = encoder.encode(streamChunks[chunkIndex++]);
              return { done: false, value };
            }
            return { done: true, value: undefined };
          },
        }),
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: mockStream,
      } as unknown as Response);

      const events = [];
      for await (const event of service.streamChat({
        messages: [{ role: 'user', content: 'Hi' }],
      })) {
        events.push(event);
      }

      expect(events[0]).toEqual({
        type: 'message_start',
        provider: 'nvidia',
        model: NEMOTRON_MODEL_ID,
      });

      const deltas = events
        .filter((e) => e.type === 'content_delta')
        .map((e: any) => e.content);
      expect(deltas.join('')).toBe('Hello world');
      expect(events[events.length - 1]?.type).toBe('message_complete');
    });
  });

  describe('testProviderConnection', () => {
    it('returns NOT_CONFIGURED when API key is missing', async () => {
      service = createService({ ANTHROPIC_API_KEY: undefined });
      const testResult = await service.testProviderConnection('anthropic');
      expect(testResult.status).toBe('NOT_CONFIGURED');
      expect(testResult.latencyMs).toBeNull();
    });

    it('returns CONNECTED when provider health check succeeds', async () => {
      service = createService({ NVIDIA_API_KEY: 'test-nvidia-key' });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { role: 'assistant', content: 'Pong' } }],
        }),
      } as unknown as Response);

      const testResult = await service.testProviderConnection('nvidia');
      expect(testResult.status).toBe('CONNECTED');
      expect(testResult.latencyMs).toBeTypeOf('number');
      expect(testResult.detail).toContain('Connected to NVIDIA');
    });
  });
});

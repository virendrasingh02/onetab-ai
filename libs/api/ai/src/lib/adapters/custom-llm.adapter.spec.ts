import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CustomLLMAdapter } from './custom-llm.adapter.js';

describe('CustomLLMAdapter', () => {
  let adapter: CustomLLMAdapter;

  beforeEach(() => {
    adapter = new CustomLLMAdapter({
      endpointUrl: 'https://custom-llm.enterprise.internal/v1',
      modelIdentifier: 'llama-3-70b-custom',
      apiKey: 'sk-secret-key-1234',
      temperature: 0.5,
      maxTokens: 2048,
    });
  });

  it('validates configuration correctly', () => {
    expect(adapter.isConfigured()).toBe(true);
    expect(adapter.validateConfig().valid).toBe(true);
    expect(adapter.defaultModel).toBe('llama-3-70b-custom');
  });

  it('reports custom model metadata with correct capabilities', () => {
    const models = adapter.getModels();
    expect(models.length).toBe(1);
    expect(models[0].id).toBe('custom-llama-3-70b-custom');
    expect(models[0].name).toContain('Enterprise Custom LLM');
    expect(models[0].capabilities).toEqual(
      expect.objectContaining({
        chat: true,
        reasoning: true,
        coding: true,
      }),
    );
  });

  it('executes chat completion against the custom endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'chatcmpl-custom-999',
        choices: [
          {
            message: { role: 'assistant', content: 'Hello from custom enterprise LLM!' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 8,
          total_tokens: 18,
        },
      }),
    });

    global.fetch = mockFetch;

    const response = await adapter.chat({
      model: 'llama-3-70b-custom',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      'https://custom-llm.enterprise.internal/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer sk-secret-key-1234',
        }),
      }),
    );

    expect(response.message.content).toBe('Hello from custom enterprise LLM!');
    expect(response.message.role).toBe('assistant');
    expect(response.usage?.totalTokens).toBe(18);
  });
});


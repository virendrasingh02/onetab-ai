import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ProviderRegistryService } from './provider-registry.service.js';

const makeConfig = (overrides: Record<string, string | undefined> = {}) =>
  ({
    get: vi.fn((key: string) => overrides[key]),
  }) as unknown as ConfigService;

describe('ProviderRegistryService — launch allowlists', () => {
  it('surfaces every provider and model when no allowlist is set', () => {
    const registry = new ProviderRegistryService(makeConfig());

    const providerIds = registry.getAllProvidersMetadata().map((p) => p.id);
    expect(providerIds).toEqual(
      expect.arrayContaining(['nvidia', 'openai', 'anthropic', 'gemini', 'deepseek', 'ollama']),
    );
    // getEnabledModels === full catalogue when unfiltered
    expect(registry.getEnabledModels().length).toBe(registry.getAllModels().length);
    expect(registry.isProviderEnabled('cohere')).toBe(true);
  });

  it('narrows advertised providers to AI_ENABLED_PROVIDERS', () => {
    const registry = new ProviderRegistryService(
      makeConfig({ AI_ENABLED_PROVIDERS: 'nvidia, openai , anthropic,gemini' }),
    );

    const providerIds = registry.getAllProvidersMetadata().map((p) => p.id);
    expect(providerIds.sort()).toEqual(['anthropic', 'gemini', 'nvidia', 'openai']);
    expect(registry.isProviderEnabled('groq')).toBe(false);
    // The adapter is still registered and directly resolvable.
    expect(registry.getAdapter('groq').provider).toBe('groq');
  });

  it('narrows advertised models to AI_ENABLED_MODELS (by id or model string)', () => {
    const registry = new ProviderRegistryService(
      makeConfig({
        AI_ENABLED_PROVIDERS: 'nvidia,openai,anthropic,gemini',
        AI_ENABLED_MODELS:
          'nvidia/nemotron-3-super-120b-a12b,gpt-4o,gpt-4o-mini,claude-sonnet-4-5,gemini-1.5-pro',
      }),
    );

    const models = registry.getEnabledModels();
    const modelStrings = models.map((m) => m.model).sort();
    expect(modelStrings).toEqual(
      [
        'claude-sonnet-4-5',
        'gemini-1.5-pro',
        'gpt-4o',
        'gpt-4o-mini',
        'nvidia/nemotron-3-super-120b-a12b',
      ].sort(),
    );
    // No disabled provider leaks a model through.
    expect(models.some((m) => m.provider === 'groq')).toBe(false);
    // Provider metadata's per-provider model list is filtered too.
    const openai = registry
      .getAllProvidersMetadata()
      .find((p) => p.id === 'openai');
    expect(openai?.models.map((m) => m.model).sort()).toEqual(['gpt-4o', 'gpt-4o-mini']);
  });
});

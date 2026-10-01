import { describe, expect, it, vi } from 'vitest';
import { chatWithFailover, isTransientModelError } from './model-failover.js';

function deps(chat: (opts: { provider: string }) => Promise<unknown>, keys: Record<string, string | undefined>) {
  return {
    ai: { chat: vi.fn(chat) } as any,
    modelResolver: { resolve: (p: { requestedProvider?: string; requestedModel?: string }) => ({ provider: p.requestedProvider ?? 'nvidia', model: p.requestedModel ?? 'nemotron' }) } as any,
    credentials: { resolveCredential: vi.fn(async (provider: string) => ({ apiKey: keys[provider] })) } as any,
    providers: {
      getEnabledModels: () => [
        { provider: 'nvidia', model: 'nemotron' },
        { provider: 'openai', model: 'gpt-4o' },
        { provider: 'openai', model: 'gpt-4o-mini' },
        { provider: 'anthropic', model: 'claude-sonnet-4-5' },
      ],
      hasAdapter: () => true,
    } as any,
  };
}

const ok = { message: { role: 'assistant', content: 'hi' } };

describe('chatWithFailover', () => {
  it('moves to the next provider with a key when the default is overloaded', async () => {
    const d = deps(async ({ provider }) => {
      if (provider === 'nvidia') throw new Error('nvidia model is currently unavailable: Service temporarily overloaded');
      return ok;
    }, { nvidia: 'k1', openai: undefined, anthropic: 'k3' });
    const result = await chatWithFailover(d, 'ws', {}, [{ role: 'user', content: 'x' }]);
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('claude-sonnet-4-5');
    expect(result.failedOver).toEqual([expect.stringContaining('nvidia: ')]);
    // openai had no key, so it was never called.
    expect(d.ai.chat.mock.calls.map((c: any[]) => c[0].provider)).toEqual(['nvidia', 'anthropic']);
  });

  it('does not move a step that pinned its model', async () => {
    const d = deps(async () => {
      throw new Error('Service temporarily overloaded');
    }, { nvidia: 'k', anthropic: 'k' });
    await expect(chatWithFailover(d, 'ws', { provider: 'nvidia' }, [])).rejects.toThrow(/overloaded/);
    expect(d.ai.chat).toHaveBeenCalledTimes(1);
  });

  it('does not move on a non-transient error', async () => {
    const d = deps(async () => {
      throw new Error('Invalid API key');
    }, { nvidia: 'k', anthropic: 'k' });
    await expect(chatWithFailover(d, 'ws', {}, [])).rejects.toThrow(/Invalid API key/);
    expect(d.ai.chat).toHaveBeenCalledTimes(1);
  });

  it('says so when every provider is down', async () => {
    const d = deps(async ({ provider }) => {
      throw new Error(`${provider} 503 Service Unavailable`);
    }, { nvidia: 'k', openai: 'k', anthropic: 'k' });
    await expect(chatWithFailover(d, 'ws', {}, [])).rejects.toThrow(/Every configured AI model is unavailable/);
  });

  it('gives up on a provider that takes too long and tries the next', async () => {
    const d = deps(
      (opts: any) =>
        opts.provider === 'nvidia'
          ? new Promise((_resolve, reject) => opts.signal?.addEventListener('abort', () => reject(new Error('aborted'))))
          : Promise.resolve(ok),
      { nvidia: 'k', anthropic: 'k' },
    );
    const result = await chatWithFailover(d, 'ws', {}, [], { timeoutMs: 30 });
    expect(result.provider).toBe('anthropic');
    expect(result.failedOver).toEqual([expect.stringMatching(/nvidia: the model took longer than/)]);
  });

  it('gives up on time even when the adapter ignores the abort signal', async () => {
    const d = deps(
      (opts: any) => (opts.provider === 'nvidia' ? new Promise(() => undefined) : Promise.resolve(ok)),
      { nvidia: 'k', anthropic: 'k' },
    );
    const result = await chatWithFailover(d, 'ws', {}, [], { timeoutMs: 30 });
    expect(result.provider).toBe('anthropic');
  });

  it('recognises transient failures', () => {
    expect(isTransientModelError('Service temporarily overloaded')).toBe(true);
    expect(isTransientModelError('Request failed with status code 429')).toBe(true);
    expect(isTransientModelError('Invalid API key')).toBe(false);
  });
});

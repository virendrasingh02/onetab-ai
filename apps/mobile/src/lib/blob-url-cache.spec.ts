import { describe, expect, it, vi } from 'vitest';
import { createBlobUrlCache } from './blob-url-cache';

describe('createBlobUrlCache', () => {
  it('fetches each URL once with the headers and reuses the object URL', async () => {
    const fetchImpl = vi.fn(async () => new Response('png'));
    let n = 0;
    const urls = { createObjectURL: vi.fn(() => `blob:${++n}`) };
    const cache = createBlobUrlCache(fetchImpl, urls);
    const headers = { Authorization: 'Bearer m' };

    const [a, b] = await Promise.all([
      cache.get('https://hs/a', headers),
      cache.get('https://hs/a', headers),
    ]);
    expect(a).toBe('blob:1');
    expect(b).toBe('blob:1');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('https://hs/a', { headers });
    expect(cache.peek('https://hs/a')).toBe('blob:1');
    await expect(cache.get('https://hs/a', headers)).resolves.toBe('blob:1');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures, so a later render can retry', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(new Response('png'));
    const cache = createBlobUrlCache(fetchImpl, {
      createObjectURL: () => 'blob:ok',
    });

    await expect(cache.get('https://hs/b', {})).rejects.toThrow('401');
    expect(cache.peek('https://hs/b')).toBeUndefined();
    await expect(cache.get('https://hs/b', {})).resolves.toBe('blob:ok');
  });
});

import { CURATED_GIFS } from '@org/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GifsService } from './gifs.service.js';

function makeService(env: Record<string, string | undefined>): GifsService {
  const config = {
    get: (key: string) => env[key],
  };
  return new GifsService(config as never);
}

const TENOR_OK = {
  next: 'cursor-2',
  results: [
    {
      id: 'abc123',
      content_description: 'a cat waving hello',
      media_formats: {
        tinygif: { url: 'https://media.tenor.com/abc/tiny.gif', dims: [220, 176] },
        nanogif: { url: 'https://media.tenor.com/abc/nano.gif', dims: [90, 72] },
        gif: { url: 'https://media.tenor.com/abc/full.gif', dims: [498, 398] },
      },
    },
  ],
};

describe('GifsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('without TENOR_API_KEY', () => {
    let service: GifsService;
    beforeEach(() => {
      service = makeService({ TENOR_CLIENT_KEY: 'test' });
    });

    it('serves the curated set for trending without calling the network', async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);

      const page = await service.trending(5);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(page.items).toEqual(CURATED_GIFS.slice(0, 5));
      expect(page.next).toBe('');
    });

    it('filters the curated set by query for search', async () => {
      const page = await service.search('applause');
      expect(page.items.length).toBeGreaterThan(0);
      expect(
        page.items.every((gif) => gif.title.toLowerCase().includes('applause')),
      ).toBe(true);
    });

    it('returns default categories', async () => {
      const cats = await service.categories();
      expect(cats).toContain('celebrate');
    });
  });

  describe('with TENOR_API_KEY', () => {
    let service: GifsService;
    beforeEach(() => {
      service = makeService({ TENOR_API_KEY: 'key-123', TENOR_CLIENT_KEY: 'test' });
    });

    it('maps a Tenor result to the GifItem shape (tinygif as url, nanogif as preview)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => TENOR_OK,
        }),
      );

      const page = await service.search('cat', 10);

      expect(page).toEqual({
        items: [
          {
            id: 'abc123',
            title: 'a cat waving hello',
            url: 'https://media.tenor.com/abc/tiny.gif',
            previewUrl: 'https://media.tenor.com/abc/nano.gif',
            width: 220,
            height: 176,
          },
        ],
        next: 'cursor-2',
      });
    });

    it('sends key and client_key on the request', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => TENOR_OK });
      vi.stubGlobal('fetch', fetchSpy);

      await service.search('dogs');

      const calledUrl = String(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain('key=key-123');
      expect(calledUrl).toContain('client_key=test');
      expect(calledUrl).toContain('/v2/search');
      expect(calledUrl).toContain('q=dogs');
    });

    it('falls back to the curated set when Tenor errors', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

      const page = await service.trending(3);

      expect(page.items).toEqual(CURATED_GIFS.slice(0, 3));
    });

    it('caches trending between calls', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => TENOR_OK });
      vi.stubGlobal('fetch', fetchSpy);

      await service.trending(10);
      await service.trending(10);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});

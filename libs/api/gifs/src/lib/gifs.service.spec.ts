import { CURATED_GIFS } from '@org/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GifsService } from './gifs.service.js';

function makeService(env: Record<string, string | undefined>): GifsService {
  const config = {
    get: (key: string) => env[key],
  };
  return new GifsService(config as never);
}


const GIPHY_OK = {
  pagination: {
    total_count: 50,
    count: 1,
    offset: 0,
  },
  data: [
    {
      id: 'abc123',
      title: 'a cat waving hello',
      images: {
        fixed_height: { url: 'https://media.giphy.com/media/abc/200.gif', width: '220', height: '176' },
        fixed_height_small: { url: 'https://media.giphy.com/media/abc/100.gif', width: '90', height: '72' },
        original: { url: 'https://media.giphy.com/media/abc/giphy.gif', width: '498', height: '398' },
      },
    },
  ],
};

describe('GifsService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('without GIPHY_API_KEY', () => {
    let service: GifsService;
    beforeEach(() => {
      service = makeService({});
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

  describe('with GIPHY_API_KEY', () => {
    let service: GifsService;
    beforeEach(() => {
      service = makeService({ GIPHY_API_KEY: 'key-123' });
    });

    it('maps a GIPHY result to the GifItem shape (fixed_height as url, fixed_height_small as preview)', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => GIPHY_OK,
        }),
      );

      const page = await service.search('cat', 10);

      expect(page).toEqual({
        items: [
          {
            id: 'abc123',
            title: 'a cat waving hello',
            url: 'https://media.giphy.com/media/abc/200.gif',
            previewUrl: 'https://media.giphy.com/media/abc/100.gif',
            width: 220,
            height: 176,
          },
        ],
        next: '1',
      });
    });

    it('sends api_key and params on the request', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => GIPHY_OK });
      vi.stubGlobal('fetch', fetchSpy);

      await service.search('dogs');

      const calledUrl = String(fetchSpy.mock.calls[0][0]);
      expect(calledUrl).toContain('api_key=key-123');
      expect(calledUrl).toContain('/v1/gifs/search');
      expect(calledUrl).toContain('q=dogs');
      expect(calledUrl).toContain('rating=g');
    });

    it('falls back to the curated set when GIPHY errors', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));

      const page = await service.trending(3);

      expect(page.items).toEqual(CURATED_GIFS.slice(0, 3));
    });

    it('caches trending between calls', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({ ok: true, json: async () => GIPHY_OK });
      vi.stubGlobal('fetch', fetchSpy);

      await service.trending(10);
      await service.trending(10);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});

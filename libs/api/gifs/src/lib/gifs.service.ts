import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CURATED_GIFS, type GifItem, type GifPage } from '@org/types';

/**
 * Proxies the GIPHY API so the key stays server-side and the client sees
 * one stable shape ({@link GifPage}). With no `GIPHY_API_KEY` configured every
 * method degrades to the bundled {@link CURATED_GIFS} set, so the picker's GIF
 * tab is useful out of the box.
 */

const GIPHY_BASE = 'https://api.giphy.com/v1/gifs';
const REQUEST_TIMEOUT_MS = 8000;
/** Trending and categories barely move; cache them to stay well under quota. */
const CACHE_TTL_MS = 10 * 60 * 1000;

const DEFAULT_CATEGORIES = [
  'celebrate',
  'thumbs up',
  'facepalm',
  'mind blown',
  'applause',
  'eye roll',
  'shrug',
  'dance',
  'thank you',
  'high five',
];

interface GiphyImageRendition {
  url: string;
  width?: string;
  height?: string;
}

interface GiphyImages {
  fixed_height?: GiphyImageRendition;
  fixed_height_small?: GiphyImageRendition;
  fixed_width?: GiphyImageRendition;
  fixed_width_small?: GiphyImageRendition;
  downsized?: GiphyImageRendition;
  original?: GiphyImageRendition;
}

interface GiphyResult {
  id: string;
  title?: string;
  images?: GiphyImages;
}

interface GiphyPagination {
  total_count?: number;
  count?: number;
  offset?: number;
}

interface GiphyResponse {
  data?: GiphyResult[];
  pagination?: GiphyPagination;
}

interface GiphyCategory {
  name?: string;
  name_encoded?: string;
}

interface GiphyCategoriesResponse {
  data?: GiphyCategory[];
}

interface CacheEntry<T> {
  at: number;
  value: T;
}

@Injectable()
export class GifsService {
  private readonly logger = new Logger(GifsService.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string | undefined {
    return this.config.get<string>('GIPHY_API_KEY') || undefined;
  }

  async trending(limit = 24, pos?: string): Promise<GifPage> {
    if (!this.apiKey) return this.curatedPage(limit);

    const cacheKey = `trending:${limit}:${pos ?? ''}`;
    const cached = this.readCache<GifPage>(cacheKey);
    if (cached) return cached;

    const page = await this.fetchGiphy('trending', {
      limit,
      offset: parseOffset(pos),
    });
    this.writeCache(cacheKey, page);
    return page;
  }

  async search(query: string, limit = 24, pos?: string): Promise<GifPage> {
    const q = query.trim();
    if (!q) return this.trending(limit, pos);
    if (!this.apiKey) return this.curatedPage(limit, q);

    return this.fetchGiphy('search', {
      q,
      limit,
      offset: parseOffset(pos),
    });
  }

  async categories(): Promise<string[]> {
    if (!this.apiKey) return DEFAULT_CATEGORIES;

    const cached = this.readCache<string[]>('categories');
    if (cached) return cached;

    try {
      const url = this.buildUrl('categories', {});
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`GIPHY categories ${res.status}`);
      const body = (await res.json()) as GiphyCategoriesResponse;
      const terms = (body.data ?? [])
        .map((cat) => (cat.name || cat.name_encoded || '').trim())
        .filter(Boolean);
      const value = terms.length > 0 ? terms : DEFAULT_CATEGORIES;
      this.writeCache('categories', value);
      return value;
    } catch (error) {
      this.logger.warn(`Falling back to default GIF categories: ${String(error)}`);
      return DEFAULT_CATEGORIES;
    }
  }

  private async fetchGiphy(
    endpoint: 'search' | 'trending',
    params: Record<string, string | number | undefined>,
  ): Promise<GifPage> {
    try {
      const url = this.buildUrl(endpoint, {
        rating: 'g',
        ...params,
      });
      const res = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`GIPHY ${endpoint} ${res.status}`);
      const body = (await res.json()) as GiphyResponse;
      const items = (body.data ?? []).map((result) => toGifItem(result));
      const requestedOffset = Number(params['offset']) || 0;
      const currentOffset = body.pagination?.offset ?? requestedOffset;
      const count = body.pagination?.count ?? items.length;
      const totalCount = body.pagination?.total_count;
      const nextOffset = currentOffset + count;
      const limit = typeof params['limit'] === 'number' ? params['limit'] : 24;
      const hasNext = totalCount !== undefined ? nextOffset < totalCount : count >= limit;

      return {
        items,
        next: hasNext ? String(nextOffset) : '',
      };
    } catch (error) {
      this.logger.warn(`GIPHY ${endpoint} failed, serving curated set: ${String(error)}`);
      const q = typeof params['q'] === 'string' ? (params['q'] as string) : undefined;
      const limit = typeof params['limit'] === 'number' ? (params['limit'] as number) : 24;
      return this.curatedPage(limit, q);
    }
  }

  private buildUrl(
    endpoint: string,
    params: Record<string, string | number | undefined>,
  ): string {
    const url = new URL(`${GIPHY_BASE}/${endpoint}`);
    url.searchParams.set('api_key', this.apiKey ?? '');
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  private curatedPage(limit: number, query?: string): GifPage {
    const q = query?.trim().toLowerCase();
    const items = (q
      ? CURATED_GIFS.filter((gif) => gif.title.toLowerCase().includes(q))
      : CURATED_GIFS
    ).slice(0, limit);
    return { items, next: '' };
  }

  private readCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() - entry.at > CACHE_TTL_MS) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  private writeCache<T>(key: string, value: T): void {
    this.cache.set(key, { at: Date.now(), value });
  }
}

function parseOffset(pos?: string): number | undefined {
  if (!pos) return undefined;
  const n = parseInt(pos, 10);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function toGifItem(result: GiphyResult): GifItem {
  const images = result.images ?? {};
  const main = images.fixed_height ?? images.downsized ?? images.original;
  const preview = images.fixed_height_small ?? images.fixed_width_small ?? main;
  const width = Number(main?.width) || 200;
  const height = Number(main?.height) || 200;
  return {
    id: result.id,
    title: result.title || 'GIF',
    url: main?.url ?? '',
    previewUrl: preview?.url ?? main?.url ?? '',
    width,
    height,
  };
}

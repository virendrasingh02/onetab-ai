import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CURATED_GIFS, type GifItem, type GifPage } from '@org/types';

/**
 * Proxies the Tenor GIF API so the key stays server-side and the client sees
 * one stable shape ({@link GifPage}). With no `TENOR_API_KEY` configured every
 * method degrades to the bundled {@link CURATED_GIFS} set, so the picker's GIF
 * tab is useful out of the box.
 */

const TENOR_BASE = 'https://tenor.googleapis.com/v2';
/** One reasonably sized GIF + one thumbnail; asking for less keeps responses small. */
const MEDIA_FILTER = 'tinygif,nanogif,gif';
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

interface TenorMediaFormat {
  url: string;
  dims?: [number, number];
}

interface TenorResult {
  id: string;
  title?: string;
  content_description?: string;
  media_formats?: Record<string, TenorMediaFormat>;
}

interface TenorResponse {
  results?: TenorResult[];
  next?: string;
}

interface TenorCategoriesResponse {
  tags?: { searchterm?: string; name?: string }[];
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
    return this.config.get<string>('TENOR_API_KEY') || undefined;
  }

  private get clientKey(): string {
    return this.config.get<string>('TENOR_CLIENT_KEY') || 'onetab-ai';
  }

  async trending(limit = 24, pos?: string): Promise<GifPage> {
    if (!this.apiKey) return this.curatedPage(limit);

    const cacheKey = `trending:${limit}:${pos ?? ''}`;
    const cached = this.readCache<GifPage>(cacheKey);
    if (cached) return cached;

    const page = await this.fetchTenor('featured', { limit, pos });
    this.writeCache(cacheKey, page);
    return page;
  }

  async search(query: string, limit = 24, pos?: string): Promise<GifPage> {
    const q = query.trim();
    if (!q) return this.trending(limit, pos);
    if (!this.apiKey) return this.curatedPage(limit, q);

    return this.fetchTenor('search', { q, limit, pos });
  }

  async categories(): Promise<string[]> {
    if (!this.apiKey) return DEFAULT_CATEGORIES;

    const cached = this.readCache<string[]>('categories');
    if (cached) return cached;

    try {
      const url = this.buildUrl('categories', { type: 'featured' });
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Tenor categories ${res.status}`);
      const body = (await res.json()) as TenorCategoriesResponse;
      const terms = (body.tags ?? [])
        .map((tag) => (tag.searchterm || tag.name || '').trim())
        .filter(Boolean);
      const value = terms.length > 0 ? terms : DEFAULT_CATEGORIES;
      this.writeCache('categories', value);
      return value;
    } catch (error) {
      this.logger.warn(`Falling back to default GIF categories: ${String(error)}`);
      return DEFAULT_CATEGORIES;
    }
  }

  private async fetchTenor(
    endpoint: 'search' | 'featured',
    params: Record<string, string | number | undefined>,
  ): Promise<GifPage> {
    try {
      const url = this.buildUrl(endpoint, {
        ...params,
        media_filter: MEDIA_FILTER,
        contentfilter: 'high',
      });
      const res = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Tenor ${endpoint} ${res.status}`);
      const body = (await res.json()) as TenorResponse;
      return {
        items: (body.results ?? []).map((result) => toGifItem(result)),
        next: body.next ?? '',
      };
    } catch (error) {
      this.logger.warn(`Tenor ${endpoint} failed, serving curated set: ${String(error)}`);
      const q = typeof params['q'] === 'string' ? (params['q'] as string) : undefined;
      const limit = typeof params['limit'] === 'number' ? (params['limit'] as number) : 24;
      return this.curatedPage(limit, q);
    }
  }

  private buildUrl(
    endpoint: string,
    params: Record<string, string | number | undefined>,
  ): string {
    const url = new URL(`${TENOR_BASE}/${endpoint}`);
    url.searchParams.set('key', this.apiKey ?? '');
    url.searchParams.set('client_key', this.clientKey);
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

function toGifItem(result: TenorResult): GifItem {
  const formats = result.media_formats ?? {};
  const main = formats['tinygif'] ?? formats['gif'] ?? formats['nanogif'];
  const preview = formats['nanogif'] ?? formats['tinygif'] ?? main;
  const [width, height] = main?.dims ?? [220, 220];
  return {
    id: result.id,
    title: result.content_description || result.title || 'GIF',
    url: main?.url ?? '',
    previewUrl: preview?.url ?? main?.url ?? '',
    width,
    height,
  };
}

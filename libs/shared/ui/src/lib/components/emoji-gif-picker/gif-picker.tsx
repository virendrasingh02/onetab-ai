import { cn } from '@org/utils';
import { Loader2, Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CURATED_GIFS,
  useGifSource,
  type GifItem,
} from './gif-source-context.js';
import { usePickerRecents } from './use-picker-recents.js';

/**
 * The GIF tab.
 *
 * Live search when a {@link GifSource} is provided (see `<GifSourceProvider>`),
 * otherwise the bundled {@link CURATED_GIFS} filtered by title. Presentational:
 * `onGifSelect` out, the source injected via context.
 */

export interface GifPickerProps {
  onGifSelect: (gif: GifItem) => void;
  className?: string;
  autoFocus?: boolean;
}

function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function curatedPage(query: string): GifItem[] {
  const q = query.trim().toLowerCase();
  return q
    ? CURATED_GIFS.filter((gif) => gif.title.toLowerCase().includes(q))
    : CURATED_GIFS;
}

export function GifPicker({ onGifSelect, className, autoFocus }: GifPickerProps) {
  const source = useGifSource();
  const recentGifs = usePickerRecents((s) => s.gifs);
  const pushGif = usePickerRecents((s) => s.pushGif);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [items, setItems] = useState<GifItem[]>([]);
  const [next, setNext] = useState('');
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebouncedValue(query);
  const effectiveQuery = (debouncedQuery.trim() || category || '').trim();
  const requestId = useRef(0);

  const handleSelect = (gif: GifItem) => {
    pushGif(gif);
    onGifSelect(gif);
  };

  // Category chips (source-backed only).
  useEffect(() => {
    if (!source) return;
    let alive = true;
    void source
      .categories()
      .then((cats) => alive && setCategories(cats.slice(0, 12)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [source]);

  // First page whenever the effective query changes.
  useEffect(() => {
    const id = ++requestId.current;
    if (!source) {
      setItems(curatedPage(effectiveQuery));
      setNext('');
      return;
    }
    setLoading(true);
    const load = effectiveQuery
      ? source.search(effectiveQuery)
      : source.trending();
    void load
      .then((page) => {
        if (requestId.current !== id) return;
        setItems(page.items);
        setNext(page.next);
      })
      .catch(() => {
        if (requestId.current !== id) return;
        setItems(curatedPage(effectiveQuery));
        setNext('');
      })
      .finally(() => {
        if (requestId.current === id) setLoading(false);
      });
  }, [source, effectiveQuery]);

  const loadMore = useCallback(() => {
    if (!source || !next || loading) return;
    const id = ++requestId.current;
    setLoading(true);
    const load = effectiveQuery
      ? source.search(effectiveQuery, next)
      : source.trending(next);
    void load
      .then((page) => {
        if (requestId.current !== id) return;
        setItems((current) => [...current, ...page.items]);
        setNext(page.next);
      })
      .catch(() => undefined)
      .finally(() => {
        if (requestId.current === id) setLoading(false);
      });
  }, [source, next, loading, effectiveQuery]);

  // Infinite scroll.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !next) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && loadMore(),
      { rootMargin: '200px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [next, loadMore]);

  const showRecentsStrip =
    !effectiveQuery && recentGifs.length > 0;
  const displayItems = useMemo(
    () => (showRecentsStrip ? recentGifs : items),
    [showRecentsStrip, recentGifs, items],
  );

  return (
    <div
      className={cn(
        'flex h-88 w-full flex-col bg-popover text-popover-foreground',
        className,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
          <input
            type="text"
            autoFocus={autoFocus}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCategory(null);
            }}
            placeholder="Search Tenor…"
            className="h-8 w-full rounded-input border border-border/60 bg-surface-inset pl-8 pr-8 text-xs text-foreground outline-none transition-colors placeholder:text-subtle focus:border-primary"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery('')}
              className="absolute right-2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        {categories.length > 0 && !query ? (
          <div className="flex flex-wrap gap-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory((c) => (c === cat ? null : cat))}
                className={cn(
                  'rounded-full px-2.5 py-1 text-[11px] font-medium capitalize transition-colors',
                  category === cat
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-inset text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-subtle p-3">
        {showRecentsStrip ? (
          <p className="px-0.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Recent
          </p>
        ) : null}

        {displayItems.length === 0 && !loading ? (
          <p className="grid h-full place-items-center text-xs text-muted-foreground">
            {effectiveQuery ? `No GIFs for “${effectiveQuery}”` : 'No GIFs'}
          </p>
        ) : (
          <div className="columns-2 gap-2 [column-fill:_balance]">
            {displayItems.map((gif) => (
              <button
                key={gif.id}
                type="button"
                onClick={() => handleSelect(gif)}
                title={gif.title}
                className="group relative mb-2 block w-full overflow-hidden rounded-lg border border-border bg-surface-inset transition-transform hover:z-10 hover:scale-[1.02] hover:border-primary"
              >
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  loading="lazy"
                  className="w-full object-cover"
                  style={{ aspectRatio: `${gif.width} / ${gif.height}` }}
                />
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent p-1.5 text-left text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {gif.title}
                </span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-3 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : null}

        {next ? <div ref={sentinelRef} className="h-px w-full" /> : null}
      </div>

      {source ? (
        <div className="flex h-8 shrink-0 items-center justify-end border-t border-border bg-surface-inset/50 px-3 text-[10px] text-subtle">
          Powered by Tenor
        </div>
      ) : null}
    </div>
  );
}

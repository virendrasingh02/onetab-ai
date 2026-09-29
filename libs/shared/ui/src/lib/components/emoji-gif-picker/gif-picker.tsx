import { cn } from '@org/utils';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CURATED_GIFS,
  useGifSource,
  type GifItem,
} from './gif-source-context.js';
import { PickerEmptyState, PickerErrorState } from './picker-empty-state.js';
import { PickerSearch } from './picker-search.js';
import { PickerSectionLabel } from './picker-section-label.js';
import { PickerSkeleton } from './picker-skeleton.js';
import { usePickerRecents } from './use-picker-recents.js';

/**
 * The GIF tab.
 *
 * Live search when a {@link GifSource} is provided (see `<GifSourceProvider>`),
 * otherwise the bundled {@link CURATED_GIFS} filtered by title. Presentational:
 * `onGifSelect` out, the source injected via context.
 *
 * With no query it shows a compact "Recent" strip above the full, infinitely
 * scrolling trending feed; a query swaps both for the search results.
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
  const [items, setItems] = useState<GifItem[]>([]);
  const [next, setNext] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveQuery = useDebouncedValue(query).trim();
  const requestId = useRef(0);

  const handleSelect = (gif: GifItem) => {
    pushGif(gif);
    onGifSelect(gif);
  };

  const loadData = useCallback(() => {
    const id = ++requestId.current;
    if (!source) {
      setItems(curatedPage(effectiveQuery));
      setNext('');
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const load = effectiveQuery
      ? source.search(effectiveQuery)
      : source.trending();
    void load
      .then((page) => {
        if (requestId.current !== id) return;
        setItems(page.items);
        setNext(page.next);
      })
      .catch((err) => {
        if (requestId.current !== id) return;
        console.warn('GIF search error:', err);
        setError('Unable to load GIFs. Showing offline collection.');
        setItems(curatedPage(effectiveQuery));
        setNext('');
      })
      .finally(() => {
        if (requestId.current === id) setLoading(false);
      });
  }, [source, effectiveQuery]);

  // First page whenever the effective query changes.
  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const showRecents = !effectiveQuery && recentGifs.length > 0;

  return (
    <div
      className={cn(
        'flex h-88 w-full flex-col bg-popover text-popover-foreground',
        className,
      )}
    >
      <div className="border-b border-border p-3">
        {/* The placeholder doubles as the attribution GIPHY's API terms
          require wherever its content is shown. */}
        <PickerSearch
          tab="gifs"
          placeholder={source ? 'Search GIPHY…' : undefined}
          value={query}
          onChange={setQuery}
          autoFocus={autoFocus}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-subtle px-3 pb-3">
        {showRecents ? (
          <section>
            <PickerSectionLabel>Recent</PickerSectionLabel>
            <div className="-mx-3 flex gap-2 overflow-x-auto scrollbar-none px-3 pb-1">
              {recentGifs.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => handleSelect(gif)}
                  title={gif.title}
                  aria-label={gif.title}
                  className="h-18 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-inset transition-colors hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  style={{ aspectRatio: `${gif.width} / ${gif.height}` }}
                >
                  <img
                    src={gif.previewUrl}
                    alt=""
                    loading="lazy"
                    className="size-full object-cover"
                  />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section>
          <PickerSectionLabel>
            {effectiveQuery ? 'Results' : source ? 'Trending' : 'All GIFs'}
          </PickerSectionLabel>

          {error ? (
            <div className="mb-2">
              <PickerErrorState message={error} onRetry={loadData} />
            </div>
          ) : null}

          {loading && items.length === 0 ? (
            <PickerSkeleton count={6} />
          ) : items.length === 0 && !loading ? (
            <PickerEmptyState
              title={effectiveQuery ? `No GIFs for “${effectiveQuery}”` : 'No GIFs'}
              description={effectiveQuery ? 'Try another search term.' : undefined}
            />
          ) : (
            <div className="columns-2 gap-2 [column-fill:_balance]">
              {items.map((gif) => (
                <button
                  key={gif.id}
                  type="button"
                  onClick={() => handleSelect(gif)}
                  title={gif.title}
                  className="group relative mb-2 block w-full overflow-hidden rounded-lg border border-border bg-surface-inset transition-transform hover:z-10 hover:scale-[1.02] hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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

          {loading && items.length > 0 ? (
            <div className="flex items-center justify-center py-3 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : null}

          {next ? <div ref={sentinelRef} className="h-px w-full" /> : null}
        </section>
      </div>
    </div>
  );
}

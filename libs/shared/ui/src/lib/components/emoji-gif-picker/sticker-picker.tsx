import { cn } from '@org/utils';
import type { StickerItem, StickerPack } from '@org/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PickerEmptyState, PickerErrorState } from './picker-empty-state.js';
import { PickerSearch } from './picker-search.js';
import { StickerSkeletonGrid } from './picker-skeleton.js';
import {
  CURATED_STICKER_PACKS,
  useStickerSource,
} from './sticker-source-context.js';
import { usePickerRecents } from './use-picker-recents.js';

export interface StickerPickerProps {
  onStickerSelect: (sticker: StickerItem) => void;
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

export function StickerPicker({
  onStickerSelect,
  className,
  autoFocus = false,
}: StickerPickerProps) {
  const source = useStickerSource();
  const recentStickers = usePickerRecents((s) => s.stickers);
  const pushSticker = usePickerRecents((s) => s.pushSticker);

  const [packs, setPacks] = useState<StickerPack[]>(CURATED_STICKER_PACKS);
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StickerItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebouncedValue(query.trim());
  const searchReqId = useRef(0);

  const loadPacks = useCallback(() => {
    if (!source) {
      setPacks(CURATED_STICKER_PACKS);
      return;
    }
    setLoading(true);
    setError(null);
    source
      .getPacks()
      .then((p) => {
        setPacks(p.length > 0 ? p : CURATED_STICKER_PACKS);
        if (!selectedPackId && p.length > 0) {
          setSelectedPackId(p[0].id);
        }
      })
      .catch((err) => {
        console.warn('Failed to load sticker packs, falling back to curated set', err);
        setPacks(CURATED_STICKER_PACKS);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [source, selectedPackId]);

  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  // Set default pack when packs load
  useEffect(() => {
    if (!selectedPackId && packs.length > 0) {
      setSelectedPackId(packs[0].id);
    }
  }, [packs, selectedPackId]);

  // Handle Search
  useEffect(() => {
    const req = ++searchReqId.current;
    if (!debouncedQuery) {
      setSearchResults(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const doSearch = source
      ? source.search(debouncedQuery)
      : Promise.resolve(
          packs.flatMap((p) => p.stickers).filter((s) => {
            const q = debouncedQuery.toLowerCase();
            return (
              s.name.toLowerCase().includes(q) ||
              s.alt.toLowerCase().includes(q) ||
              s.tags?.some((t) => t.toLowerCase().includes(q))
            );
          }),
        );

    doSearch
      .then((res) => {
        if (searchReqId.current !== req) return;
        setSearchResults(res);
      })
      .catch((err) => {
        if (searchReqId.current !== req) return;
        console.warn('Sticker search error:', err);
        setError('Unable to search stickers');
      })
      .finally(() => {
        if (searchReqId.current === req) setLoading(false);
      });
  }, [debouncedQuery, source, packs]);

  const handleSelect = (sticker: StickerItem) => {
    pushSticker(sticker);
    onStickerSelect(sticker);
  };

  const activePack = useMemo(() => {
    return packs.find((p) => p.id === selectedPackId) ?? packs[0];
  }, [packs, selectedPackId]);

  const showRecentsStrip =
    !debouncedQuery && recentStickers.length > 0;

  const displayStickers = useMemo(() => {
    if (searchResults !== null) return searchResults;
    return activePack?.stickers ?? [];
  }, [searchResults, activePack]);

  return (
    <div
      className={cn(
        'flex h-88 w-full flex-col bg-popover text-popover-foreground',
        className,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <PickerSearch
          tab="stickers"
          value={query}
          onChange={setQuery}
          autoFocus={autoFocus}
          onClear={() => setQuery('')}
        />

        {!debouncedQuery && packs.length > 0 ? (
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
            {packs.map((pack) => {
              const isActive = pack.id === activePack?.id;
              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setSelectedPackId(pack.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-surface-inset text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                  title={pack.name}
                >
                  {pack.icon ? <span className="text-xs leading-none">{pack.icon}</span> : null}
                  <span>{pack.name}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-subtle p-3">
        {showRecentsStrip ? (
          <div className="mb-3">
            <p className="px-0.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Recent Stickers
            </p>
            <div className="grid grid-cols-4 gap-2">
              {recentStickers.slice(0, 8).map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => handleSelect(sticker)}
                  title={sticker.name || sticker.alt}
                  aria-label={sticker.name || sticker.alt}
                  className="group relative flex size-18 items-center justify-center rounded-xl p-1.5 transition-all hover:scale-110 hover:bg-accent/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <img
                    src={sticker.thumbnail || sticker.url}
                    alt={sticker.alt}
                    loading="lazy"
                    className="size-full object-contain pointer-events-none drop-shadow-xs"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {loading ? (
          <StickerSkeletonGrid count={8} />
        ) : error ? (
          <PickerErrorState message={error} onRetry={loadPacks} />
        ) : displayStickers.length === 0 ? (
          <PickerEmptyState
            title={debouncedQuery ? `No stickers for “${debouncedQuery}”` : 'No stickers'}
            description={debouncedQuery ? 'Try another keyword or browse sticker packs.' : undefined}
          />
        ) : (
          <div>
            {!debouncedQuery && activePack ? (
              <p className="px-0.5 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {activePack.name}
              </p>
            ) : null}
            <div className="grid grid-cols-4 gap-2">
              {displayStickers.map((sticker) => (
                <button
                  key={sticker.id}
                  type="button"
                  onClick={() => handleSelect(sticker)}
                  title={sticker.name || sticker.alt}
                  aria-label={sticker.name || sticker.alt}
                  className="group relative flex size-18 items-center justify-center rounded-xl p-1.5 transition-all hover:scale-110 hover:bg-accent/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <img
                    src={sticker.thumbnail || sticker.url}
                    alt={sticker.alt}
                    loading="lazy"
                    className="size-full object-contain pointer-events-none drop-shadow-xs"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex h-8 shrink-0 items-center justify-between border-t border-border bg-surface-inset/50 px-3 text-[10px] text-muted-foreground">
        <span>{displayStickers.length} stickers</span>
        <span className="text-subtle">Click sticker to send</span>
      </div>
    </div>
  );
}

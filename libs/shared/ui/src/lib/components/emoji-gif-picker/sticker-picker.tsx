import { cn } from '@org/utils';
import type { StickerItem, StickerPack } from '@org/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PickerEmptyState, PickerErrorState } from './picker-empty-state.js';
import { PickerSearch } from './picker-search.js';
import { PickerSectionLabel } from './picker-section-label.js';
import { StickerSkeletonGrid } from './picker-skeleton.js';
import {
  CURATED_STICKER_PACKS,
  useStickerSource,
} from './sticker-source-context.js';
import { usePickerRecents } from './use-picker-recents.js';

/**
 * The Stickers tab.
 *
 * Every pack is laid out as its own section in one scrolling list (recents
 * first), so browsing needs no pack switcher; a query searches across all
 * packs — through the {@link StickerSource} when one is provided, otherwise
 * over {@link CURATED_STICKER_PACKS}' names, alt text and tags.
 */

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

function matchesQuery(sticker: StickerItem, query: string): boolean {
  const q = query.toLowerCase();
  return (
    sticker.name.toLowerCase().includes(q) ||
    sticker.alt.toLowerCase().includes(q) ||
    Boolean(sticker.tags?.some((tag) => tag.toLowerCase().includes(q)))
  );
}

function StickerGrid({
  stickers,
  onSelect,
}: {
  stickers: StickerItem[];
  onSelect: (sticker: StickerItem) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5 pb-1">
      {stickers.map((sticker) => (
        <button
          key={sticker.id}
          type="button"
          onClick={() => onSelect(sticker)}
          title={sticker.name || sticker.alt}
          aria-label={sticker.name || sticker.alt}
          className="flex aspect-square w-full items-center justify-center rounded-xl p-2 transition-all hover:scale-105 hover:bg-accent/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <img
            src={sticker.thumbnail || sticker.url}
            alt={sticker.alt}
            loading="lazy"
            className="pointer-events-none size-full object-contain drop-shadow-xs"
          />
        </button>
      ))}
    </div>
  );
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
  const [packsLoading, setPacksLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<StickerItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchAttempt, setSearchAttempt] = useState(0);

  const debouncedQuery = useDebouncedValue(query.trim());
  const searchReqId = useRef(0);

  const loadPacks = useCallback(() => {
    if (!source) {
      setPacks(CURATED_STICKER_PACKS);
      return;
    }
    setPacksLoading(true);
    source
      .getPacks()
      .then((p) => setPacks(p.length > 0 ? p : CURATED_STICKER_PACKS))
      .catch((err) => {
        console.warn('Failed to load sticker packs, falling back to curated set', err);
        setPacks(CURATED_STICKER_PACKS);
      })
      .finally(() => setPacksLoading(false));
  }, [source]);

  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  useEffect(() => {
    const req = ++searchReqId.current;
    if (!debouncedQuery) {
      setSearchResults(null);
      setSearchError(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    setSearchError(null);

    const doSearch = source
      ? source.search(debouncedQuery)
      : Promise.resolve(
          packs
            .flatMap((pack) => pack.stickers)
            .filter((sticker) => matchesQuery(sticker, debouncedQuery)),
        );

    doSearch
      .then((res) => {
        if (searchReqId.current !== req) return;
        setSearchResults(res);
      })
      .catch((err) => {
        if (searchReqId.current !== req) return;
        console.warn('Sticker search error:', err);
        setSearchError('Unable to search stickers');
      })
      .finally(() => {
        if (searchReqId.current === req) setSearching(false);
      });
  }, [debouncedQuery, source, packs, searchAttempt]);

  const handleSelect = (sticker: StickerItem) => {
    pushSticker(sticker);
    onStickerSelect(sticker);
  };

  const packsWithStickers = packs.filter((pack) => pack.stickers.length > 0);

  const renderSearch = () => {
    if (searching && searchResults === null) {
      return (
        <div className="pt-3">
          <StickerSkeletonGrid count={8} />
        </div>
      );
    }
    if (searchError) {
      return (
        <div className="pt-3">
          <PickerErrorState
            message={searchError}
            onRetry={() => setSearchAttempt((n) => n + 1)}
          />
        </div>
      );
    }
    if (!searchResults || searchResults.length === 0) {
      return (
        <div className="pt-3">
          <PickerEmptyState
            title={`No stickers for “${debouncedQuery}”`}
            description="Try another keyword."
          />
        </div>
      );
    }
    return (
      <section>
        <PickerSectionLabel>Results</PickerSectionLabel>
        <StickerGrid stickers={searchResults} onSelect={handleSelect} />
      </section>
    );
  };

  const renderBrowse = () => {
    if (packsLoading && packsWithStickers.length === 0) {
      return (
        <div className="pt-3">
          <StickerSkeletonGrid count={8} />
        </div>
      );
    }
    if (packsWithStickers.length === 0 && recentStickers.length === 0) {
      return (
        <div className="pt-3">
          <PickerEmptyState title="No stickers" />
        </div>
      );
    }
    return (
      <>
        {recentStickers.length > 0 ? (
          <section>
            <PickerSectionLabel>Recent</PickerSectionLabel>
            <StickerGrid
              stickers={recentStickers.slice(0, 8)}
              onSelect={handleSelect}
            />
          </section>
        ) : null}
        {packsWithStickers.map((pack) => (
          <section key={pack.id} aria-label={pack.name}>
            <PickerSectionLabel>
              {pack.icon ? (
                <span aria-hidden className="text-xs normal-case leading-none">
                  {pack.icon}
                </span>
              ) : null}
              {pack.name}
            </PickerSectionLabel>
            <StickerGrid stickers={pack.stickers} onSelect={handleSelect} />
          </section>
        ))}
      </>
    );
  };

  return (
    <div
      className={cn(
        'flex h-88 w-full flex-col bg-popover text-popover-foreground',
        className,
      )}
    >
      <div className="border-b border-border p-3">
        <PickerSearch
          tab="stickers"
          value={query}
          onChange={setQuery}
          autoFocus={autoFocus}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-subtle px-3 pb-3">
        {debouncedQuery ? renderSearch() : renderBrowse()}
      </div>
    </div>
  );
}

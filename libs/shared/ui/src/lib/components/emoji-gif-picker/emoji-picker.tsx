import { cn } from '@org/utils';
import { EmojiPicker as Frimousse } from 'frimousse';
import { Search, X } from 'lucide-react';
import { useState } from 'react';
import { usePickerRecents } from './use-picker-recents.js';

/**
 * The central emoji picker.
 *
 * A thin, tokenised shell around {@link https://frimousse.liveblocks.io | frimousse}
 * (headless, built on the same primitives as the rest of our Radix UI): full
 * Unicode set, fuzzy search, skin-tone selector, virtualised grid. Adds a
 * one-row "Frequently used" strip and a live preview, all platform-styled;
 * the grid's own sticky category headers do the wayfinding.
 */

export interface EmojiSelection {
  emoji: string;
  label: string;
}

export interface EmojiPickerProps {
  onEmojiSelect: (emoji: EmojiSelection) => void;
  /**
   * Where to fetch the Emojibase JSON from — `${url}/${locale}/${file}.json`.
   * Defaults to the self-hosted copy under the app's `/emojibase` (synced by
   * `scripts/sync-emojibase.mjs`). Override for other hosts via the prop or
   * {@link setEmojiPickerBaseUrl}.
   */
  emojibaseUrl?: string;
  columns?: number;
  showRecents?: boolean;
  showPreview?: boolean;
  showSkinToneSelector?: boolean;
  autoFocus?: boolean;
  className?: string;
}

let defaultEmojibaseUrl = '/emojibase';

/** App-level override for the Emojibase host (e.g. the desktop shell). */
export function setEmojiPickerBaseUrl(url: string): void {
  defaultEmojibaseUrl = url;
}

export function EmojiPicker({
  onEmojiSelect,
  emojibaseUrl,
  columns = 9,
  showRecents = true,
  showPreview = true,
  showSkinToneSelector = true,
  autoFocus = true,
  className,
}: EmojiPickerProps) {
  const [search, setSearch] = useState('');
  const recents = usePickerRecents((s) => s.emojis);
  const pushEmoji = usePickerRecents((s) => s.pushEmoji);

  const handleSelect = (selection: EmojiSelection) => {
    pushEmoji(selection.emoji);
    onEmojiSelect(selection);
  };

  const showRecentsStrip = showRecents && !search.trim() && recents.length > 0;

  return (
    <div className="h-full w-full">
      <Frimousse.Root
        onEmojiSelect={handleSelect}
        columns={columns}
        emojibaseUrl={emojibaseUrl ?? defaultEmojibaseUrl}
        className={cn(
          'h-88 isolate flex w-full flex-col bg-popover text-popover-foreground',
          '[&_[frimousse-viewport]]:min-h-0 [&_[frimousse-viewport]]:scrollbar-subtle [&_[frimousse-viewport]]:flex-1 [&_[frimousse-viewport]]:overflow-y-auto [&_[frimousse-viewport]]:overscroll-contain',
          '[&_[frimousse-list]]:pb-2 [&_[frimousse-list]]:select-none',
          className,
        )}
      >
        <div className="gap-2 p-3 flex flex-col border-b border-border">
          <div className="relative flex items-center">
            <Search className="left-2.5 size-3.5 pointer-events-none absolute text-muted-foreground" />
            <Frimousse.Search
              autoFocus={autoFocus}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search emoji…"
              className="h-8 pl-8 pr-8 text-xs w-full rounded-input border border-border/60 bg-surface-inset text-foreground transition-colors outline-none placeholder:text-subtle focus:border-ring"
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch('')}
                className="right-2 p-0.5 absolute rounded-sm text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          {showRecentsStrip ? (
            <div>
              <p className="px-0.5 pb-1 font-bold tracking-wider text-meta text-muted-foreground uppercase">
                Frequently used
              </p>
              {/* One row only, sized to the grid's columns — a second row
                would push the emoji grid below the fold. */}
              <div
                className="gap-0.5 grid"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {recents.slice(0, columns).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSelect({ emoji, label: emoji })}
                    className="h-9 flex w-full items-center justify-center rounded-lg text-[22px] transition-transform hover:scale-110 hover:bg-accent focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <Frimousse.Viewport>
          <Frimousse.Loading className="p-6 text-xs grid flex-1 place-items-center text-muted-foreground">
            Loading emoji…
          </Frimousse.Loading>
          <Frimousse.Empty className="p-6 text-xs grid flex-1 place-items-center text-muted-foreground">
            {({ search: term }) => <>No emoji for “{term}”</>}
          </Frimousse.Empty>
          <Frimousse.List
            components={{
              CategoryHeader: ({ category, ...props }) => (
                <div
                  {...props}
                  data-category-label={category.label}
                  className="px-3 pb-1 pt-2 font-bold tracking-wider backdrop-blur bg-popover/95 text-meta text-muted-foreground uppercase"
                >
                  {category.label}
                </div>
              ),
              Row: ({ children, ...props }) => (
                <div {...props} className="gap-0.5 px-2 flex">
                  {children}
                </div>
              ),
              Emoji: ({ emoji, ...props }) => (
                <button
                  {...props}
                  className={cn(
                    'size-9 flex items-center justify-center rounded-lg text-[22px] transition-transform',
                    emoji.isActive && 'scale-110 bg-accent',
                  )}
                >
                  {emoji.emoji}
                </button>
              ),
            }}
          />
        </Frimousse.Viewport>

        {showPreview || showSkinToneSelector ? (
          <div className="h-10 px-3 flex shrink-0 items-center justify-between border-t border-border bg-surface-inset/50">
            {showPreview ? (
              <Frimousse.ActiveEmoji>
                {({ emoji }) =>
                  emoji ? (
                    <span className="gap-2 text-xs flex items-center">
                      <span className="text-xl leading-none">
                        {emoji.emoji}
                      </span>
                      <span className="font-medium truncate text-foreground">
                        {emoji.label}
                      </span>
                    </span>
                  ) : (
                    <span className="text-meta text-subtle">Pick an emoji</span>
                  )
                }
              </Frimousse.ActiveEmoji>
            ) : (
              <span />
            )}

            {showSkinToneSelector ? (
              <Frimousse.SkinToneSelector className="size-7 text-base flex items-center justify-center rounded-md transition-colors hover:bg-accent" />
            ) : null}
          </div>
        ) : null}
      </Frimousse.Root>
    </div>
  );
}

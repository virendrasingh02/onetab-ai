import { cn } from '@org/utils';
import { EmojiPicker as Frimousse } from 'frimousse';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { usePickerRecents } from './use-picker-recents.js';

/**
 * The central emoji picker.
 *
 * A thin, tokenised shell around {@link https://frimousse.liveblocks.io | frimousse}
 * (headless, built on the same primitives as the rest of our Radix UI): full
 * Unicode set, fuzzy search, skin-tone selector, virtualised grid. Adds a
 * "Frequently used" strip and a live preview, both platform-styled.
 *
 * Presentational — `onEmojiSelect` out, nothing fetched. Used on its own for
 * emoji-only surfaces (reactions, status) and inside `<EmojiGifPicker>` for the
 * chat composer.
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
    <Frimousse.Root
      onEmojiSelect={handleSelect}
      columns={columns}
      emojibaseUrl={emojibaseUrl ?? defaultEmojibaseUrl}
      className={cn(
        'isolate flex h-88 w-full flex-col bg-popover text-popover-foreground',
        // The scroll container and list wrapper are frimousse-owned bare
        // elements (not overridable via `components`), so reach them by their
        // `frimousse-*` attribute.
        '[&_[frimousse-viewport]]:min-h-0 [&_[frimousse-viewport]]:flex-1 [&_[frimousse-viewport]]:overflow-y-auto [&_[frimousse-viewport]]:overscroll-contain [&_[frimousse-viewport]]:scrollbar-subtle',
        '[&_[frimousse-list]]:select-none [&_[frimousse-list]]:pb-2',
        className,
      )}
    >
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 size-3.5 text-muted-foreground" />
          <Frimousse.Search
            autoFocus={autoFocus}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search emoji…"
            className="h-8 w-full rounded-input border border-border/60 bg-surface-inset pl-8 pr-3 text-xs text-foreground outline-none transition-colors placeholder:text-subtle focus:border-primary"
          />
        </div>

        {showRecentsStrip ? (
          <div>
            <p className="px-0.5 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Frequently used
            </p>
            <div className="flex flex-wrap gap-0.5">
              {recents.slice(0, columns * 2).map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleSelect({ emoji, label: emoji })}
                  className="flex size-9 items-center justify-center rounded-lg text-[22px] transition-transform hover:scale-110 hover:bg-accent"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <Frimousse.Viewport>
        <Frimousse.Loading className="grid flex-1 place-items-center p-6 text-xs text-muted-foreground">
          Loading emoji…
        </Frimousse.Loading>
        <Frimousse.Empty className="grid flex-1 place-items-center p-6 text-xs text-muted-foreground">
          {({ search: term }) => <>No emoji for “{term}”</>}
        </Frimousse.Empty>
        <Frimousse.List
          components={{
            CategoryHeader: ({ category, ...props }) => (
              <div
                {...props}
                className="bg-popover/95 px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur"
              >
                {category.label}
              </div>
            ),
            Row: ({ children, ...props }) => (
              <div {...props} className="flex gap-0.5 px-2">
                {children}
              </div>
            ),
            Emoji: ({ emoji, ...props }) => (
              <button
                {...props}
                className={cn(
                  'flex size-9 items-center justify-center rounded-lg text-[22px] transition-transform',
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
        <div className="flex h-10 shrink-0 items-center justify-between border-t border-border bg-surface-inset/50 px-3">
          {showPreview ? (
            <Frimousse.ActiveEmoji>
              {({ emoji }) =>
                emoji ? (
                  <span className="flex items-center gap-2 text-xs">
                    <span className="text-xl leading-none">{emoji.emoji}</span>
                    <span className="truncate font-medium text-foreground">
                      {emoji.label}
                    </span>
                  </span>
                ) : (
                  <span className="text-[11px] text-subtle">
                    Pick an emoji
                  </span>
                )
              }
            </Frimousse.ActiveEmoji>
          ) : (
            <span />
          )}

          {showSkinToneSelector ? (
            <Frimousse.SkinToneSelector className="flex size-7 items-center justify-center rounded-md text-base transition-colors hover:bg-accent" />
          ) : null}
        </div>
      ) : null}
    </Frimousse.Root>
  );
}

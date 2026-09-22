import { cn } from '@org/utils';
import type { GifItem, StickerItem } from '@org/types';
import { useState } from 'react';
import { Tabs, TabsContent } from '../tabs.js';
import { EmojiPicker, type EmojiSelection } from './emoji-picker.js';
import { GifPicker } from './gif-picker.js';
import { PickerTabs, type UnifiedPickerTab } from './picker-tabs.js';
import { StickerPicker } from './sticker-picker.js';

export type { UnifiedPickerTab };

export interface UnifiedEmojiPickerProps {
  onEmojiSelect: (emoji: EmojiSelection) => void;
  onGifSelect?: (gif: GifItem) => void;
  onStickerSelect?: (sticker: StickerItem) => void;
  defaultTab?: UnifiedPickerTab;
  /** Controlled active tab; pair with `onTabChange`. */
  tab?: UnifiedPickerTab;
  onTabChange?: (tab: UnifiedPickerTab) => void;
  emojibaseUrl?: string;
  className?: string;
}

export function UnifiedEmojiPicker({
  onEmojiSelect,
  onGifSelect,
  onStickerSelect,
  defaultTab = 'emoji',
  tab: controlledTab,
  onTabChange,
  emojibaseUrl,
  className,
}: UnifiedEmojiPickerProps) {
  const [uncontrolledTab, setUncontrolledTab] = useState<UnifiedPickerTab>(defaultTab);
  const tab = controlledTab ?? uncontrolledTab;

  const setTab = (next: UnifiedPickerTab) => {
    setUncontrolledTab(next);
    onTabChange?.(next);
  };

  const hasGifs = Boolean(onGifSelect);
  const hasStickers = Boolean(onStickerSelect);
  const hasMultipleTabs = hasGifs || hasStickers;

  // Single emoji-only view if neither GIFs nor Stickers are supported on this surface
  if (!hasMultipleTabs) {
    return (
      <div className={cn('w-88 max-w-[calc(100vw-1rem)]', className)}>
        <EmojiPicker onEmojiSelect={onEmojiSelect} emojibaseUrl={emojibaseUrl} />
      </div>
    );
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as UnifiedPickerTab)}
      className={cn(
        'w-88 max-w-[calc(100vw-1rem)] gap-0',
        className,
      )}
    >
      <PickerTabs
        activeTab={tab}
        hasGifs={hasGifs}
        hasStickers={hasStickers}
      />

      <TabsContent value="emoji" className="mt-0 focus-visible:outline-none">
        <EmojiPicker
          onEmojiSelect={onEmojiSelect}
          emojibaseUrl={emojibaseUrl}
          autoFocus={tab === 'emoji'}
        />
      </TabsContent>

      {hasGifs ? (
        <TabsContent value="gifs" className="mt-0 focus-visible:outline-none">
          <GifPicker onGifSelect={onGifSelect!} autoFocus={tab === 'gifs'} />
        </TabsContent>
      ) : null}

      {hasStickers ? (
        <TabsContent value="stickers" className="mt-0 focus-visible:outline-none">
          <StickerPicker onStickerSelect={onStickerSelect!} autoFocus={tab === 'stickers'} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}

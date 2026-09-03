import { cn } from '@org/utils';
import { Film, Smile } from 'lucide-react';
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../tabs.js';
import { EmojiPicker, type EmojiSelection } from './emoji-picker.js';
import { GifPicker } from './gif-picker.js';
import type { GifItem } from './gif-source-context.js';

/**
 * Emoji + GIF in one panel, the way the chat composer wants it.
 *
 * The GIF tab only appears when `onGifSelect` is given — emoji-only surfaces
 * (reactions, status) pass just `onEmojiSelect` and get the bare
 * `<EmojiPicker>` with no tab strip.
 */

export type EmojiGifTab = 'emoji' | 'gif';

export interface EmojiGifPickerProps {
  onEmojiSelect: (emoji: EmojiSelection) => void;
  onGifSelect?: (gif: GifItem) => void;
  defaultTab?: EmojiGifTab;
  /** Controlled active tab; pair with `onTabChange`. */
  tab?: EmojiGifTab;
  onTabChange?: (tab: EmojiGifTab) => void;
  emojibaseUrl?: string;
  className?: string;
}

export function EmojiGifPicker({
  onEmojiSelect,
  onGifSelect,
  defaultTab = 'emoji',
  tab: controlledTab,
  onTabChange,
  emojibaseUrl,
  className,
}: EmojiGifPickerProps) {
  const [uncontrolledTab, setUncontrolledTab] = useState<EmojiGifTab>(defaultTab);
  const tab = controlledTab ?? uncontrolledTab;
  const setTab = (next: EmojiGifTab) => {
    setUncontrolledTab(next);
    onTabChange?.(next);
  };

  if (!onGifSelect) {
    return (
      <div className={cn('w-88 max-w-[calc(100vw-1rem)]', className)}>
        <EmojiPicker onEmojiSelect={onEmojiSelect} emojibaseUrl={emojibaseUrl} />
      </div>
    );
  }

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setTab(value as EmojiGifTab)}
      className={cn(
        'w-88 max-w-[calc(100vw-1rem)] gap-0',
        className,
      )}
    >
      <div className="border-b border-border p-2">
        <TabsList variant="segmented" size="sm" className="w-full">
          <TabsTrigger value="emoji" className="flex-1" icon={<Smile />}>
            Emoji
          </TabsTrigger>
          <TabsTrigger value="gif" className="flex-1" icon={<Film />}>
            GIF
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="emoji" className="mt-0">
        <EmojiPicker
          onEmojiSelect={onEmojiSelect}
          emojibaseUrl={emojibaseUrl}
          autoFocus={tab === 'emoji'}
        />
      </TabsContent>
      <TabsContent value="gif" className="mt-0">
        <GifPicker onGifSelect={onGifSelect} autoFocus={tab === 'gif'} />
      </TabsContent>
    </Tabs>
  );
}

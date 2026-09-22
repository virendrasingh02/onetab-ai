import type { GifItem, StickerItem } from '@org/types';
import type { EmojiSelection } from './emoji-picker.js';
import {
  UnifiedEmojiPicker,
  type UnifiedPickerTab,
} from './unified-emoji-picker.js';

export type EmojiGifTab = 'emoji' | 'gif' | 'gifs' | 'stickers';

export interface EmojiGifPickerProps {
  onEmojiSelect: (emoji: EmojiSelection) => void;
  onGifSelect?: (gif: GifItem) => void;
  onStickerSelect?: (sticker: StickerItem) => void;
  defaultTab?: EmojiGifTab;
  /** Controlled active tab; pair with `onTabChange`. */
  tab?: EmojiGifTab;
  onTabChange?: (tab: EmojiGifTab) => void;
  emojibaseUrl?: string;
  className?: string;
}

function normalizeTab(t?: EmojiGifTab): UnifiedPickerTab {
  if (t === 'gif' || t === 'gifs') return 'gifs';
  if (t === 'stickers') return 'stickers';
  return 'emoji';
}

/**
 * Backward-compatible wrapper around `<UnifiedEmojiPicker>`.
 */
export function EmojiGifPicker({
  defaultTab = 'emoji',
  tab,
  onTabChange,
  ...props
}: EmojiGifPickerProps) {
  return (
    <UnifiedEmojiPicker
      {...props}
      defaultTab={normalizeTab(defaultTab)}
      tab={tab ? normalizeTab(tab) : undefined}
      onTabChange={onTabChange ? (t) => onTabChange(t) : undefined}
    />
  );
}

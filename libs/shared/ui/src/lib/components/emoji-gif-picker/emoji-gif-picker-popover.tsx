import type { ComponentProps, ReactNode } from 'react';
import type { PopoverContent } from '../popover.js';
import type { EmojiGifPickerProps } from './emoji-gif-picker.js';
import { UnifiedEmojiPickerPopover } from './unified-emoji-picker-popover.js';
import type { UnifiedPickerTab } from './unified-emoji-picker.js';

export interface EmojiGifPickerPopoverProps extends EmojiGifPickerProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: ComponentProps<typeof PopoverContent>['side'];
  align?: ComponentProps<typeof PopoverContent>['align'];
  sideOffset?: number;
  /** Close the popover after an emoji is chosen (reactions, status). */
  closeOnEmojiSelect?: boolean;
  contentClassName?: string;
}

function normalizeTab(t?: EmojiGifPickerProps['tab']): UnifiedPickerTab | undefined {
  if (!t) return undefined;
  if (t === 'gif' || t === 'gifs') return 'gifs';
  if (t === 'stickers') return 'stickers';
  return 'emoji';
}

/**
 * Backward-compatible wrapper around `<UnifiedEmojiPickerPopover>`.
 */
export function EmojiGifPickerPopover({
  defaultTab = 'emoji',
  tab,
  onTabChange,
  ...props
}: EmojiGifPickerPopoverProps) {
  return (
    <UnifiedEmojiPickerPopover
      {...props}
      defaultTab={normalizeTab(defaultTab) ?? 'emoji'}
      tab={normalizeTab(tab)}
      onTabChange={onTabChange ? (t) => onTabChange(t) : undefined}
    />
  );
}

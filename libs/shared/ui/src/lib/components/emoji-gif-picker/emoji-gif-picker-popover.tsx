import type { ComponentProps, ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../popover.js';
import { EmojiGifPicker, type EmojiGifPickerProps } from './emoji-gif-picker.js';

/**
 * `<EmojiGifPicker>` in a Radix popover — the drop-in for any trigger button.
 *
 * ```tsx
 * <EmojiGifPickerPopover
 *   onEmojiSelect={(e) => insert(e.emoji)}
 *   onGifSelect={(g) => sendGif(g)}
 * >
 *   <button aria-label="Emoji"><Smile /></button>
 * </EmojiGifPickerPopover>
 * ```
 */

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

export function EmojiGifPickerPopover({
  children,
  open,
  onOpenChange,
  side = 'top',
  align = 'start',
  sideOffset = 8,
  closeOnEmojiSelect = false,
  contentClassName,
  onEmojiSelect,
  onGifSelect,
  ...pickerProps
}: EmojiGifPickerPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={contentClassName ?? 'w-auto overflow-hidden p-0'}
      >
        <EmojiGifPicker
          {...pickerProps}
          onEmojiSelect={(emoji) => {
            onEmojiSelect(emoji);
            if (closeOnEmojiSelect) onOpenChange?.(false);
          }}
          onGifSelect={
            onGifSelect
              ? (gif) => {
                  onGifSelect(gif);
                  onOpenChange?.(false);
                }
              : undefined
          }
        />
      </PopoverContent>
    </Popover>
  );
}

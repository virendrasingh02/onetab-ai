import type { ComponentProps, ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '../popover.js';
import {
  UnifiedEmojiPicker,
  type UnifiedEmojiPickerProps,
} from './unified-emoji-picker.js';

export interface UnifiedEmojiPickerPopoverProps extends UnifiedEmojiPickerProps {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  side?: ComponentProps<typeof PopoverContent>['side'];
  align?: ComponentProps<typeof PopoverContent>['align'];
  sideOffset?: number;
  /** Close the popover after an emoji is chosen (reactions, status modal). Defaults to false for composer. */
  closeOnEmojiSelect?: boolean;
  contentClassName?: string;
}

export function UnifiedEmojiPickerPopover({
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
  onStickerSelect,
  ...pickerProps
}: UnifiedEmojiPickerPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        sideOffset={sideOffset}
        className={contentClassName ?? 'w-auto overflow-hidden p-0 border border-border shadow-xl rounded-xl z-50'}
      >
        <UnifiedEmojiPicker
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
          onStickerSelect={
            onStickerSelect
              ? (sticker) => {
                  onStickerSelect(sticker);
                  onOpenChange?.(false);
                }
              : undefined
          }
        />
      </PopoverContent>
    </Popover>
  );
}

import { cn } from '@org/utils';
import { Film, Smile, Sticker } from 'lucide-react';
import { TabsList, TabsTrigger } from '../tabs.js';

export type UnifiedPickerTab = 'emoji' | 'gifs' | 'stickers';

export interface PickerTabsProps {
  activeTab: UnifiedPickerTab;
  className?: string;
  hasGifs?: boolean;
  hasStickers?: boolean;
}

export function PickerTabs({
  activeTab,
  className,
  hasGifs = true,
  hasStickers = true,
}: PickerTabsProps) {
  return (
    <div className={cn('border-b border-border p-2 bg-popover', className)}>
      <TabsList variant="segmented" size="sm" className="w-full">
        <TabsTrigger
          value="emoji"
          className="flex-1 text-xs gap-1.5 font-medium transition-colors"
          icon={<Smile className="size-3.5 shrink-0" />}
          aria-label="Emoji tab"
        >
          <span>Emoji</span>
        </TabsTrigger>

        {hasGifs ? (
          <TabsTrigger
            value="gifs"
            className="flex-1 text-xs gap-1.5 font-medium transition-colors"
            icon={<Film className="size-3.5 shrink-0" />}
            aria-label="GIFs tab"
          >
            <span>GIFs</span>
          </TabsTrigger>
        ) : null}

        {hasStickers ? (
          <TabsTrigger
            value="stickers"
            className="flex-1 text-xs gap-1.5 font-medium transition-colors"
            icon={<Sticker className="size-3.5 shrink-0" />}
            aria-label="Stickers tab"
          >
            <span>Stickers</span>
          </TabsTrigger>
        ) : null}
      </TabsList>
    </div>
  );
}

import { cn } from '@org/utils';
import { Search, X } from 'lucide-react';
import type { ComponentPropsWithoutRef } from 'react';
import type { UnifiedPickerTab } from './picker-tabs.js';

export interface PickerSearchProps extends Omit<ComponentPropsWithoutRef<'input'>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  tab: UnifiedPickerTab;
  placeholder?: string;
  onClear?: () => void;
  className?: string;
  autoFocus?: boolean;
}

const DEFAULT_PLACEHOLDERS: Record<UnifiedPickerTab, string> = {
  emoji: 'Search emoji…',
  gifs: 'Search GIFs…',
  stickers: 'Search stickers…',
};

export function PickerSearch({
  value,
  onChange,
  tab,
  placeholder,
  onClear,
  className,
  autoFocus = false,
  ...inputProps
}: PickerSearchProps) {
  const effectivePlaceholder = placeholder ?? DEFAULT_PLACEHOLDERS[tab];

  return (
    <div className={cn('relative flex items-center w-full', className)}>
      <Search
        className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="text"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={effectivePlaceholder}
        aria-label={effectivePlaceholder}
        className="h-8 w-full rounded-input border border-border/60 bg-surface-inset pl-8 pr-8 text-xs text-foreground outline-none transition-colors placeholder:text-subtle focus:border-primary"
        {...inputProps}
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange('');
            onClear?.();
          }}
          className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5 rounded-sm transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

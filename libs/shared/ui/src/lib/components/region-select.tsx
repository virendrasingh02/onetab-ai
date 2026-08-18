import {
  WORLD_REGIONS,
  cn,
  type RegionInfo,
} from '@org/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from './button.js';
import { Input } from './input.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';
import { ScrollArea } from './scroll-area.js';

export interface RegionSelectProps {
  /** Country code, e.g. `US`, `GB`, `IN`. */
  value: string;
  onChange: (region: RegionInfo) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export function RegionSelect({
  value,
  onChange,
  id,
  className,
  disabled = false,
}: RegionSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const currentRegion = useMemo(() => {
    return (
      WORLD_REGIONS.find((r) => r.code === value) ||
      WORLD_REGIONS.find((r) => r.code === 'US') ||
      WORLD_REGIONS[0]
    );
  }, [value]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return WORLD_REGIONS;
    return WORLD_REGIONS.filter(
      (r) =>
        r.name.toLowerCase().includes(needle) ||
        r.code.toLowerCase().includes(needle),
    );
  }, [query]);

  const handleSelect = (region: RegionInfo) => {
    onChange(region);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          className={cn(
            'h-9 w-full justify-between px-3 text-xs font-normal',
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="text-base leading-none">{currentRegion.flag}</span>
            <span className="truncate">{currentRegion.name}</span>
            <span className="text-[10px] text-muted-foreground font-mono">
              ({currentRegion.code})
            </span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-72 p-0 border-border bg-popover text-foreground shadow-overlay"
      >
        <div className="p-2 border-b border-border">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search country or region…"
            className="h-8 text-xs"
            autoFocus
          />
        </div>

        <ScrollArea className="max-h-60 p-1">
          <div className="space-y-0.5">
            {matches.map((region) => {
              const isSelected = region.code === currentRegion.code;
              return (
                <button
                  key={region.code}
                  type="button"
                  onClick={() => handleSelect(region)}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left',
                    isSelected
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-accent text-foreground',
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="text-base leading-none">{region.flag}</span>
                    <span className="truncate">{region.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {region.code}
                    </span>
                  </span>
                  {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                </button>
              );
            })}

            {matches.length === 0 && (
              <div className="py-4 text-center text-xs text-muted-foreground">
                No regions match "{query}"
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

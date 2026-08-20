import {
  cn,
  describeTimezone,
  formatTimeInZone,
  formatZoneOffset,
  getSystemTimezone,
  listTimezones,
} from '@org/utils';
import { Check, ChevronsUpDown, Globe, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from './button.js';
import { Input } from './input.js';
import { useMinuteTick } from './local-time.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';
import { ScrollArea } from './scroll-area.js';

export interface TimezoneSelectProps {
  /** IANA zone id, e.g. `Europe/Berlin`. */
  value: string;
  onChange: (timezone: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Searchable timezone picker.
 *
 * A plain `<Select>` was not an option: the IANA list is ~420 entries, and
 * finding your own city by scrolling is worse than typing three letters of it.
 * Each row carries its live local time, which is also the fastest way to tell
 * two similarly-named zones apart.
 */
export function TimezoneSelect({
  value,
  onChange,
  id,
  className,
  disabled = false,
}: TimezoneSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const now = useMinuteTick();

  const systemZone = getSystemTimezone();
  // The list is stable for the session; only the times inside it move.
  const zones = useMemo(() => listTimezones(), []);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/\s+/g, '_');
    if (!needle) return zones;
    return zones.filter((zone) => zone.toLowerCase().includes(needle));
  }, [zones, query]);

  const select = (zone: string) => {
    onChange(zone);
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
            'h-9 px-3 text-xs font-normal w-full justify-between',
            className,
          )}
        >
          <span className="min-w-0 gap-2 flex items-center">
            <Globe
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="truncate">{describeTimezone(value)}</span>
          </span>
          <span className="gap-2 flex shrink-0 items-center text-muted-foreground">
            <span className="tabular-nums">{formatTimeInZone(now, value)}</span>
            <ChevronsUpDown className="size-3.5" aria-hidden />
          </span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="p-0 w-(--radix-popover-trigger-width)"
      >
        <div className="p-2 relative border-b border-border">
          <Search
            className="left-4 size-3.5 absolute top-1/2 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search city or region…"
            aria-label="Search timezones"
            className="h-8 pl-8 text-xs"
          />
        </div>

        {value !== systemZone ? (
          <button
            type="button"
            onClick={() => select(systemZone)}
            className="gap-2 px-3 py-2 text-xs flex w-full items-center border-b border-border text-left text-primary hover:bg-accent"
          >
            <Globe className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              Use this device&apos;s timezone — {describeTimezone(systemZone)}
            </span>
          </button>
        ) : null}

        <ScrollArea className="max-h-64" contentClassName="p-1">
          {matches.length === 0 ? (
            <p className="p-4 text-xs text-center text-muted-foreground">
              No timezone matches “{query}”.
            </p>
          ) : (
            matches.map((zone) => {
              const isSelected = zone === value;
              return (
                <button
                  key={zone}
                  type="button"
                  onClick={() => select(zone)}
                  aria-selected={isSelected}
                  className={cn(
                    'gap-2 px-2 py-1.5 text-xs flex w-full items-center rounded-md text-left',
                    'hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
                    isSelected && 'font-medium bg-selected/70',
                  )}
                >
                  <Check
                    className={cn(
                      'size-3.5 shrink-0 text-primary',
                      isSelected ? 'opacity-100' : 'opacity-0',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {describeTimezone(zone)}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                    {formatTimeInZone(now, zone)} ·{' '}
                    {formatZoneOffset(zone, now)}
                  </span>
                </button>
              );
            })
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

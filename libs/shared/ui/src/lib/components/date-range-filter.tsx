import {
  cn,
  DATE_RANGE_PRESETS,
  formatDateRangeSpan,
  getDateRangeLabel,
  resolveDateRange,
  toIsoDay,
  type DateRangePreset,
  type DateRangeValue,
} from '@org/utils';
import { endOfDay, format } from 'date-fns';
import { CalendarDays, CalendarRange, ChevronDown } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Button } from './button.js';
import { Calendar } from './calendar.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu.js';
import { Popover, PopoverAnchor, PopoverContent } from './popover.js';

export interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Subset (and order) of presets to offer. Defaults to all of them. */
  presets?: readonly DateRangePreset[];
  /** Offer "Custom range…". Defaults to true. */
  allowCustom?: boolean;
  /** Earliest pickable day for a custom range. */
  minDate?: Date;
  /** Latest pickable day for a custom range. Defaults to today. */
  maxDate?: Date;
  /** 0 = Sunday (default, matches `Calendar`), 1 = Monday. */
  weekStartsOn?: 0 | 1;
  size?: 'sm' | 'md';
  align?: 'start' | 'end';
  disabled?: boolean;
  className?: string;
}

const CUSTOM_ITEM = '__custom__';

/**
 * The platform's one date-range control. Every analytics surface — workspace
 * analytics, the admin console, dashboards — renders this and keeps the value
 * as a `DateRangeValue`, so the presets, their labels and the day arithmetic
 * behind them (`resolveDateRange` in `@org/utils`) cannot drift per screen.
 *
 * Presets are a Radix radio menu (arrow keys, typeahead, a check on the active
 * row). "Custom range…" opens a popover anchored to the same trigger with a
 * two-click range calendar and explicit Apply / Cancel, so a half-picked range
 * never reaches the page.
 */
export function DateRangeFilter({
  value,
  onChange,
  presets,
  allowCustom = true,
  minDate,
  maxDate,
  weekStartsOn = 0,
  size = 'sm',
  align = 'end',
  disabled = false,
  className,
}: DateRangeFilterProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState<Date | undefined>();
  const [draftTo, setDraftTo] = useState<Date | undefined>();
  // Set between picking "Custom range…" and the menu finishing its close, so
  // the menu does not pull focus back to the trigger over the popover.
  const openingCustom = useRef(false);

  const options = useMemo(
    () =>
      presets
        ? DATE_RANGE_PRESETS.filter((p) => presets.includes(p.id))
        : DATE_RANGE_PRESETS,
    [presets],
  );

  const resolved = resolveDateRange(value, { weekStartsOn });
  const label = getDateRangeLabel(value, { weekStartsOn });
  const latest = maxDate ?? endOfDay(new Date());

  const beginCustom = () => {
    setDraftFrom(resolved.from);
    setDraftTo(resolved.to);
    openingCustom.current = true;
    setCustomOpen(true);
  };

  const pickDay = (day: Date | undefined) => {
    if (!day) return;
    if (!draftFrom || draftTo) {
      setDraftFrom(day);
      setDraftTo(undefined);
    } else if (day < draftFrom) {
      setDraftFrom(day);
    } else {
      setDraftTo(day);
    }
  };

  const applyCustom = () => {
    if (!draftFrom || !draftTo) return;
    onChange({ preset: 'custom', from: toIsoDay(draftFrom), to: toIsoDay(draftTo) });
    setCustomOpen(false);
  };

  const triggerSize = size === 'md' ? 'md' : 'sm';

  return (
    <Popover open={customOpen} onOpenChange={setCustomOpen}>
      <PopoverAnchor asChild>
        <div className={cn('inline-flex', className)}>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild disabled={disabled}>
              <Button
                type="button"
                variant="outline"
                size={triggerSize}
                aria-label={`Date range: ${label}`}
                leadingIcon={<CalendarDays className="text-muted-foreground" />}
                trailingIcon={
                  <ChevronDown
                    className={cn(
                      'size-3.5 text-muted-foreground transition-transform duration-(--duration-fast)',
                      menuOpen && 'rotate-180',
                    )}
                  />
                }
                className="max-w-full font-medium"
              >
                <span className="truncate">{label}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={align}
              className="w-60"
              onCloseAutoFocus={(event) => {
                if (openingCustom.current) {
                  event.preventDefault();
                  openingCustom.current = false;
                }
              }}
            >
              <DropdownMenuLabel>Date range</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={value.preset === 'custom' ? CUSTOM_ITEM : value.preset}
                onValueChange={(next) => {
                  if (next === CUSTOM_ITEM) return;
                  onChange({ preset: next as DateRangePreset });
                }}
              >
                {options.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.id}
                    value={option.id}
                    indicator="check"
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
                {allowCustom ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioItem
                      value={CUSTOM_ITEM}
                      indicator="check"
                      onSelect={beginCustom}
                    >
                      <CalendarRange />
                      Custom range…
                    </DropdownMenuRadioItem>
                  </>
                ) : null}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled
                className="text-[11px] font-normal tabular-nums text-muted-foreground data-[disabled]:opacity-100"
              >
                {formatDateRangeSpan(resolved)}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </PopoverAnchor>

      <PopoverContent
        align={align}
        className="p-0 w-auto"
        aria-label="Choose a custom date range"
      >
        <Calendar
          range={{ from: draftFrom, to: draftTo }}
          onSelect={pickDay}
          minDate={minDate}
          maxDate={latest}
          defaultMonth={draftTo ?? draftFrom}
        />
        <div className="gap-2 p-3 flex flex-col border-t border-border">
          <div
            className="gap-2 text-xs grid grid-cols-2 tabular-nums"
            aria-live="polite"
          >
            <div>
              <div className="text-[10px] tracking-wider text-subtle uppercase">
                Start
              </div>
              <div className="font-medium text-foreground">
                {draftFrom ? format(draftFrom, 'MMM dd, yyyy') : '—'}
              </div>
            </div>
            <div>
              <div className="text-[10px] tracking-wider text-subtle uppercase">
                End
              </div>
              <div
                className={cn(
                  'font-medium',
                  draftTo ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {draftTo ? format(draftTo, 'MMM dd, yyyy') : 'Pick an end date'}
              </div>
            </div>
          </div>
          <div className="gap-2 flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCustomOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!draftFrom || !draftTo}
              onClick={applyCustom}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

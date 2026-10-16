import { useMemo, useState, type ReactNode } from 'react';
import { format, isValid, parse, startOfDay } from 'date-fns';
import { CalendarClock, X } from 'lucide-react';
import { cn } from '@org/utils';
import { Button } from './button.js';
import { Calendar } from './calendar.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';
import { AppSelect, type AppSelectOption } from './app-select.js';

/**
 * Themed replacements for the native `datetime-local` / `time` inputs, which
 * render an unstyled, browser-specific popup. Values use the same string
 * formats the native inputs did (`yyyy-MM-ddTHH:mm` and `HH:mm`, local time),
 * so a call site swaps `<Input type="datetime-local">` for `<DateTimePicker>`
 * without touching its form state.
 */

const DATETIME_FORMAT = "yyyy-MM-dd'T'HH:mm";

/** Parses a `yyyy-MM-ddTHH:mm` (or full ISO) string or Date; invalid → undefined. */
export function parseDateTimeValue(
  value: string | Date | null | undefined,
): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return isValid(value) ? value : undefined;
  const local = parse(value.slice(0, 16), DATETIME_FORMAT, new Date());
  if (isValid(local)) return local;
  const fallback = new Date(value);
  return isValid(fallback) ? fallback : undefined;
}

/** Formats a Date as the `yyyy-MM-ddTHH:mm` local string `datetime-local` used. */
export function toDateTimeValue(date: Date): string {
  return format(date, DATETIME_FORMAT);
}

function toTimeValue(date: Date): string {
  return format(date, 'HH:mm');
}

function withTime(day: Date, time: string): Date {
  const [h, m] = time.split(':').map(Number);
  const out = new Date(day);
  out.setHours(h || 0, m || 0, 0, 0);
  return out;
}

function timeLabel(time: string): string {
  return withTime(new Date(), time).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

/* ------------------------------------------------------------------ */
/* TimePicker                                                          */
/* ------------------------------------------------------------------ */

export interface TimePickerProps {
  /** `HH:mm` (24h), or '' for nothing selected. */
  value?: string;
  onChange?: (value: string) => void;
  /** Minutes between slots. */
  step?: number;
  /**
   * The day these times belong to. With `disablePast`, slots earlier than
   * now are disabled when it is today.
   */
  day?: Date;
  disablePast?: boolean;
  /** Earliest selectable instant (combined with `day`). */
  min?: Date;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  id?: string;
  'aria-label'?: string;
}

export function buildTimeOptions({
  step = 15,
  day,
  disablePast,
  min,
  current,
}: {
  step?: number;
  day?: Date;
  disablePast?: boolean;
  min?: Date;
  current?: string;
}): AppSelectOption[] {
  const base = day ?? new Date();
  const floor = Math.max(
    disablePast ? Date.now() : -Infinity,
    min ? min.getTime() : -Infinity,
  );
  const values = new Set<string>();
  for (let mins = 0; mins < 24 * 60; mins += step) {
    values.add(
      `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(
        mins % 60,
      ).padStart(2, '0')}`,
    );
  }
  // An existing value off the step grid (e.g. 10:07 from saved data) stays
  // selectable instead of silently vanishing from the trigger.
  if (current && /^\d{2}:\d{2}$/.test(current)) values.add(current);

  return [...values].sort().map((value) => ({
    value,
    label: timeLabel(value),
    disabled: day ? withTime(base, value).getTime() <= floor : false,
  }));
}

export function TimePicker({
  value = '',
  onChange,
  step = 15,
  day,
  disablePast = false,
  min,
  placeholder = 'Select time',
  disabled,
  size = 'sm',
  className,
  id,
  'aria-label': ariaLabel = 'Time',
}: TimePickerProps) {
  const options = useMemo(
    () => buildTimeOptions({ step, day, disablePast, min, current: value }),
    [step, day, disablePast, min, value],
  );
  return (
    <AppSelect
      id={id}
      size={size}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      onValueChange={(v) => onChange?.(v)}
      options={options}
      disabled={disabled}
      className={cn('w-full', className)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* DateTimePickerPanel — calendar + time, no trigger                    */
/* ------------------------------------------------------------------ */

export interface DateTimePickerPanelProps {
  value?: Date;
  onChange?: (value: Date) => void;
  /** Disables days and times before now. */
  disablePast?: boolean;
  minDate?: Date;
  maxDate?: Date;
  step?: number;
  className?: string;
  /** Rendered under the time select (e.g. a summary or action button). */
  footer?: ReactNode;
}

/** First valid slot on `day`, preferring the time of `preferred`. */
function snapToValid(
  day: Date,
  preferredTime: string,
  opts: { step: number; disablePast: boolean; min?: Date },
): Date {
  const options = buildTimeOptions({ ...opts, day, current: preferredTime });
  const keep = options.find((o) => o.value === preferredTime && !o.disabled);
  const pick = keep ?? options.find((o) => !o.disabled) ?? options[0];
  return withTime(day, pick.value);
}

export function DateTimePickerPanel({
  value,
  onChange,
  disablePast = false,
  minDate,
  maxDate,
  step = 15,
  className,
  footer,
}: DateTimePickerPanelProps) {
  const effectiveMinDay = useMemo(() => {
    const candidates = [
      disablePast ? startOfDay(new Date()) : undefined,
      minDate ? startOfDay(minDate) : undefined,
    ].filter(Boolean) as Date[];
    return candidates.length
      ? new Date(Math.max(...candidates.map((d) => d.getTime())))
      : undefined;
  }, [disablePast, minDate]);

  const time = value ? toTimeValue(value) : '';

  return (
    <div className={cn('space-y-3', className)}>
      <Calendar
        selected={value}
        defaultMonth={value ?? minDate}
        minDate={effectiveMinDay}
        maxDate={maxDate}
        onSelect={(day) => {
          if (!day) return;
          onChange?.(
            snapToValid(day, time || '09:00', {
              step,
              disablePast,
              min: minDate,
            }),
          );
        }}
        className="p-0 w-full"
      />
      <div className="space-y-1.5">
        <span className="font-medium block text-xs text-muted-foreground">
          Time
        </span>
        <TimePicker
          value={time}
          step={step}
          day={value}
          disablePast={disablePast}
          min={minDate}
          placeholder={value ? 'Select time' : 'Pick a day first'}
          disabled={!value}
          aria-label="Time"
          onChange={(t) => value && onChange?.(withTime(value, t))}
        />
      </div>
      {footer}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DateTimePicker — field-shaped trigger + popover                      */
/* ------------------------------------------------------------------ */

export interface DateTimePickerProps {
  /** `yyyy-MM-ddTHH:mm` local string (the `datetime-local` format) or Date. */
  value?: string | Date | null;
  /** Emits the `yyyy-MM-ddTHH:mm` local string, or undefined when cleared. */
  onChange?: (value: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  clearable?: boolean;
  disablePast?: boolean;
  minDate?: Date;
  maxDate?: Date;
  step?: number;
  align?: 'start' | 'center' | 'end';
  className?: string;
  id?: string;
  'aria-label'?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = 'Select date & time',
  disabled = false,
  clearable = false,
  disablePast = false,
  minDate,
  maxDate,
  step = 15,
  align = 'start',
  className,
  id,
  'aria-label': ariaLabel,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const dateValue = parseDateTimeValue(value);
  const display = dateValue
    ? dateValue.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : undefined;

  return (
    <div className={cn('relative flex items-center', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={
              ariaLabel ?? (display ? `Date and time: ${display}` : placeholder)
            }
            className={cn(
              'h-9 px-3 font-normal shadow-xs w-full justify-start text-left',
              !dateValue && 'text-muted-foreground',
              clearable && dateValue && 'pr-8',
            )}
          >
            <CalendarClock className="mr-2 size-4 shrink-0 text-muted-foreground" />
            <span className="text-xs sm:text-sm truncate">
              {display ?? placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-3 w-[304px]" align={align}>
          <DateTimePickerPanel
            value={dateValue}
            disablePast={disablePast}
            minDate={minDate}
            maxDate={maxDate}
            step={step}
            onChange={(d) => onChange?.(toDateTimeValue(d))}
            footer={
              <div className="gap-2 pt-2 flex items-center justify-between border-t border-border">
                {clearable && dateValue ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      onChange?.(undefined);
                      setOpen(false);
                    }}
                  >
                    Clear
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setOpen(false)}
                >
                  Done
                </Button>
              </div>
            }
          />
        </PopoverContent>
      </Popover>
      {clearable && dateValue && !disabled ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation();
            onChange?.(undefined);
          }}
          aria-label="Clear date and time"
          className="right-1 size-7 absolute text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}


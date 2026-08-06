import { useState } from 'react';
import { format, parseISO, isValid, addDays, addWeeks } from 'date-fns';
import { Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@org/utils';
import { Button } from './button.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';
import { Calendar } from './calendar.js';

export interface DatePickerProps {
  /** Date string in 'YYYY-MM-DD' format or Date object */
  value?: string | Date;
  /** Callback fired when a date is selected or cleared */
  onChange?: (date: string | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  clearable?: boolean;
  align?: 'start' | 'center' | 'end';
  minDate?: Date;
  maxDate?: Date;
  showPresets?: boolean;
  id?: string;
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Select date',
  disabled = false,
  className,
  clearable = true,
  align = 'start',
  minDate,
  maxDate,
  showPresets = true,
  id,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const dateValue: Date | undefined =
    typeof value === 'string'
      ? value && isValid(parseISO(value))
        ? parseISO(value)
        : undefined
      : value;

  const handleSelect = (selectedDate: Date | undefined) => {
    if (!selectedDate) {
      onChange?.(undefined);
    } else {
      const formatted = format(selectedDate, 'yyyy-MM-dd');
      onChange?.(formatted);
    }
    setOpen(false);
  };

  const handlePreset = (presetDate: Date) => {
    handleSelect(presetDate);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(undefined);
  };

  return (
    <div className={cn('relative flex items-center', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={dateValue ? `Date selected: ${format(dateValue, 'MMM d, yyyy')}` : placeholder}
            className={cn(
              'h-9 w-full justify-start px-3 text-left font-normal shadow-xs',
              !dateValue && 'text-muted-foreground',
              clearable && dateValue && 'pr-8'
            )}
          >
            <CalendarIcon className="mr-2 size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-xs sm:text-sm">
              {dateValue ? format(dateValue, 'MMM d, yyyy') : placeholder}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align={align}>
          <Calendar
            selected={dateValue}
            onSelect={handleSelect}
            minDate={minDate}
            maxDate={maxDate}
            disabled={disabled}
          />
          {showPresets ? (
            <div className="border-border border-t p-2 flex items-center justify-between gap-1 text-xs">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => handlePreset(new Date())}
              >
                Today
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => handlePreset(addDays(new Date(), 1))}
              >
                Tomorrow
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px]"
                onClick={() => handlePreset(addWeeks(new Date(), 1))}
              >
                Next week
              </Button>
              {dateValue ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                  onClick={() => handleSelect(undefined)}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
      {clearable && dateValue && !disabled ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={handleClear}
          aria-label="Clear date"
          className="absolute right-1 size-7 text-muted-foreground hover:text-foreground"
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

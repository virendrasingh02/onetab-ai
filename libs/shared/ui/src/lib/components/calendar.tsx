import { useState } from 'react';
import {
  addMonths,
  subMonths,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  isValid,
} from 'date-fns';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { cn } from '@org/utils';
import { Button } from './button.js';

export interface CalendarProps {
  selected?: Date | string;
  onSelect?: (date: Date | undefined) => void;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
}

export function Calendar({
  selected,
  onSelect,
  className,
  minDate,
  maxDate,
  disabled = false,
}: CalendarProps) {
  const selectedDate =
    typeof selected === 'string'
      ? isValid(parseISO(selected))
        ? parseISO(selected)
        : undefined
      : selected;

  const [currentMonth, setCurrentMonth] = useState<Date>(
    selectedDate ?? new Date()
  );

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    onSelect?.(today);
  };

  const isDateDisabled = (day: Date) => {
    if (disabled) return true;
    if (minDate && day < minDate) return true;
    if (maxDate && day > maxDate) return true;
    return false;
  };

  return (
    <div className={cn('w-[280px] p-3 select-none', className)}>
      {/* Calendar Header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleToday}
            title="Jump to today"
            aria-label="Jump to today"
            className="size-7 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handlePrevMonth}
            aria-label="Previous month"
            className="size-7 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleNextMonth}
            aria-label="Next month"
            className="size-7 text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="mb-1.5 grid grid-cols-7 text-center">
        {weekDays.map((day) => (
          <span
            key={day}
            className="text-[11px] font-medium text-muted-foreground"
          >
            {day}
          </span>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isDisabled = isDateDisabled(day);
          const isCurrentDay = isToday(day);

          return (
            <button
              key={day.toISOString()}
              type="button"
              disabled={isDisabled}
              onClick={() => onSelect?.(day)}
              className={cn(
                'flex size-8 items-center justify-center rounded-md text-xs font-normal transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                !isCurrentMonth && 'text-muted-foreground/40',
                isCurrentMonth && !isSelected && 'text-foreground hover:bg-accent hover:text-accent-foreground',
                isCurrentDay && !isSelected && 'font-semibold text-primary ring-1 ring-primary/40',
                isSelected && 'bg-primary font-semibold text-primary-foreground shadow-xs hover:bg-primary/90',
                isDisabled && 'cursor-not-allowed opacity-30 hover:bg-transparent hover:text-inherit'
              )}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}

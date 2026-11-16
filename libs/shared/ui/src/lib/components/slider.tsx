import { cn } from '@org/utils';
import { useCallback, useRef, useState, type ComponentProps } from 'react';

export interface SliderProps extends Omit<
  ComponentProps<'div'>,
  'onChange' | 'defaultValue'
> {
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onValueChange?: (values: number[]) => void;
  showTooltip?: boolean;
  formatTooltip?: (value: number) => string;
}

export function Slider({
  value: controlledValue,
  defaultValue = [0],
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  onValueChange,
  showTooltip = false,
  formatTooltip = (val) => String(val),
  className,
  ...props
}: SliderProps) {
  const [internalValue, setInternalValue] = useState<number[]>(defaultValue);
  const values = controlledValue ?? internalValue;
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeThumbIndex, setActiveThumbIndex] = useState<number | null>(null);

  const clamp = useCallback(
    (val: number) => Math.min(Math.max(val, min), max),
    [min, max],
  );

  const snap = useCallback(
    (val: number) => {
      const stepped = Math.round((val - min) / step) * step + min;
      return clamp(Number(stepped.toFixed(4)));
    },
    [clamp, min, step],
  );

  const updateValue = useCallback(
    (index: number, nextVal: number) => {
      const snapped = snap(nextVal);
      const nextValues = [...values];
      nextValues[index] = snapped;
      if (!controlledValue) {
        setInternalValue(nextValues);
      }
      onValueChange?.(nextValues);
    },
    [controlledValue, onValueChange, snap, values],
  );

  const handlePointerDown = (index: number) => (e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    setActiveThumbIndex(index);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activeThumbIndex === null || !trackRef.current || disabled) return;
    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    const rawVal = min + percent * (max - min);
    updateValue(activeThumbIndex, rawVal);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeThumbIndex !== null) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      setActiveThumbIndex(null);
    }
  };

  const handleTrackClick = (e: React.MouseEvent) => {
    if (disabled || !trackRef.current || activeThumbIndex !== null) return;
    const rect = trackRef.current.getBoundingClientRect();
    const percent = Math.max(
      0,
      Math.min(1, (e.clientX - rect.left) / rect.width),
    );
    const rawVal = min + percent * (max - min);
    const snapped = snap(rawVal);

    // Find closest thumb
    let closestIndex = 0;
    let minDistance = Infinity;
    values.forEach((val, idx) => {
      const dist = Math.abs(val - snapped);
      if (dist < minDistance) {
        minDistance = dist;
        closestIndex = idx;
      }
    });

    updateValue(closestIndex, snapped);
  };

  const rangeStartPercent =
    values.length === 1
      ? 0
      : Math.min(...values.map((v) => ((v - min) / (max - min)) * 100));
  const rangeEndPercent =
    values.length === 1
      ? ((values[0] - min) / (max - min)) * 100
      : Math.max(...values.map((v) => ((v - min) / (max - min)) * 100));

  return (
    <div
      className={cn(
        'py-2 relative flex w-full cursor-pointer touch-none items-center select-none',
        disabled && 'pointer-events-none cursor-not-allowed opacity-50',
        className,
      )}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      {...props}
    >
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="h-1.5 relative w-full grow overflow-hidden rounded-full border border-border bg-surface-raised"
      >
        <div
          className="absolute h-full bg-brand transition-all duration-75"
          style={{
            left: `${rangeStartPercent}%`,
            width: `${rangeEndPercent - rangeStartPercent}%`,
          }}
        />
      </div>

      {values.map((val, idx) => {
        const percent = ((clamp(val) - min) / (max - min)) * 100;
        const isDragging = activeThumbIndex === idx;

        return (
          <div
            key={idx}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={val}
            aria-disabled={disabled}
            onPointerDown={handlePointerDown(idx)}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
                e.preventDefault();
                updateValue(idx, val + step);
              } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
                e.preventDefault();
                updateValue(idx, val - step);
              } else if (e.key === 'Home') {
                e.preventDefault();
                updateValue(idx, min);
              } else if (e.key === 'End') {
                e.preventDefault();
                updateValue(idx, max);
              }
            }}
            className={cn(
              'size-4 absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-surface shadow-xs',
              'transition-transform duration-(--duration-fast) outline-none',
              'hover:scale-110 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50',
              isDragging && 'scale-125 border-brand shadow-md',
            )}
            style={{ left: `${percent}%` }}
          >
            {(showTooltip || isDragging) && (
              <span className="-top-7 px-1.5 py-0.5 font-medium pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-btn bg-foreground text-2xs whitespace-nowrap text-background shadow-xs">
                {formatTooltip(val)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

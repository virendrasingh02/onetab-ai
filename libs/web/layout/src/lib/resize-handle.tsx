import { cn } from '@org/utils';
import { GripVertical } from 'lucide-react';
import React from 'react';

export interface ResizeHandleProps {
  side: 'left' | 'right';
  isResizing: boolean;
  currentWidth: number;
  minWidth: number;
  maxWidth: number;
  /** Receives the handle element itself — the drag reads its geometry. */
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onDoubleClick: () => void;
  onStepWidth: (delta: number) => void;
  onResetWidth: () => void;
  className?: string;
}

export function ResizeHandle({
  side,
  isResizing,
  currentWidth,
  minWidth,
  maxWidth,
  onPointerDown,
  onDoubleClick,
  onStepWidth,
  onResetWidth,
  className,
}: ResizeHandleProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 20 : 5;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      onStepWidth(side === 'left' ? -step : step);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      onStepWidth(side === 'left' ? step : -step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      onStepWidth(side === 'left' ? minWidth - currentWidth : maxWidth - currentWidth);
    } else if (e.key === 'End') {
      e.preventDefault();
      onStepWidth(side === 'left' ? maxWidth - currentWidth : minWidth - currentWidth);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onResetWidth();
    }
  };

  const label = side === 'left' ? 'Resize left sidebar' : 'Resize right panel';

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(currentWidth)}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuetext={`${Math.round(currentWidth)} pixels wide`}
      title={`${label} (${Math.round(currentWidth)}px). Double-click to reset.`}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative z-20 flex w-0 -mx-[3px] cursor-col-resize select-none items-center justify-center touch-none',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
        className,
      )}
    >
      {/* Invisible expanded touch hit target */}
      <div className="absolute inset-y-0 -left-3 -right-3" />

      {/*
        Separator line. The active glow is expressed as a ring in `primary/40`
        rather than a hand-built rgba shadow — the previous
        `rgba(var(--primary-rgb), .5)` referenced a token the theme never
        defined, so the whole shadow resolved to an invalid colour and no glow
        ever painted.
      */}
      <div
        className={cn(
          'h-full w-px transition-colors duration-(--duration-fast) ease-standard',
          isResizing
            ? 'bg-primary ring-2 ring-primary/40'
            : 'bg-border group-hover:bg-primary/70 group-focus-visible:bg-primary',
        )}
      />

      {/* Center Grip Pill Handle */}
      <div
        className={cn(
          'absolute flex h-7 w-3.5 items-center justify-center rounded-full border border-border bg-background shadow-xs transition-opacity duration-150',
          isResizing ? 'opacity-100 border-primary text-primary' : 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 text-muted-foreground',
        )}
      >
        <GripVertical className="size-2.5" aria-hidden="true" />
      </div>
    </div>
  );
}

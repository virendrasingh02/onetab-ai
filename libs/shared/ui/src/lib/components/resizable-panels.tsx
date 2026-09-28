import { cn } from '@org/utils';
import { GripVertical, GripHorizontal } from 'lucide-react';
import {
  useCallback,
  useRef,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

export interface ResizablePanelsProps extends ComponentProps<'div'> {
  orientation?: 'horizontal' | 'vertical';
  defaultSizes?: [number, number]; // Percentages, e.g. [30, 70]
  minSizes?: [number, number]; // e.g. [15, 15]
  leftOrTop: ReactNode;
  rightOrBottom: ReactNode;
  onSizesChange?: (sizes: [number, number]) => void;
  paneOneClassName?: string;
  paneTwoClassName?: string;
  handleClassName?: string;
}

export function ResizablePanels({
  orientation = 'horizontal',
  defaultSizes = [50, 50],
  minSizes = [15, 15],
  leftOrTop,
  rightOrBottom,
  onSizesChange,
  className,
  paneOneClassName,
  paneTwoClassName,
  handleClassName,
  ...props
}: ResizablePanelsProps) {
  const [sizes, setSizes] = useState<[number, number]>(defaultSizes);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const updateSizes = useCallback(
    (newFirst: number) => {
      const clampedFirst = Math.min(
        Math.max(newFirst, minSizes[0]),
        100 - minSizes[1],
      );
      const nextSizes: [number, number] = [clampedFirst, 100 - clampedFirst];
      setSizes(nextSizes);
      onSizesChange?.(nextSizes);
    },
    [minSizes, onSizesChange],
  );

  const handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    let percent: number;
    if (orientation === 'horizontal') {
      percent = ((e.clientX - rect.left) / rect.width) * 100;
    } else {
      percent = ((e.clientY - rect.top) / rect.height) * 100;
    }

    updateSizes(percent);
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (isDragging) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      setIsDragging(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 10 : 2;
    if (
      (orientation === 'horizontal' && e.key === 'ArrowLeft') ||
      (orientation === 'vertical' && e.key === 'ArrowUp')
    ) {
      e.preventDefault();
      updateSizes(sizes[0] - step);
    } else if (
      (orientation === 'horizontal' && e.key === 'ArrowRight') ||
      (orientation === 'vertical' && e.key === 'ArrowDown')
    ) {
      e.preventDefault();
      updateSizes(sizes[0] + step);
    } else if (e.key === 'Home') {
      e.preventDefault();
      updateSizes(minSizes[0]);
    } else if (e.key === 'End') {
      e.preventDefault();
      updateSizes(100 - minSizes[1]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      updateSizes(defaultSizes[0]);
    }
  };

  const handleDoubleClick = () => {
    updateSizes(defaultSizes[0]);
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={cn(
        'relative flex w-full h-full min-w-0 min-h-0 overflow-hidden select-none',
        orientation === 'horizontal' ? 'flex-row' : 'flex-col',
        className,
      )}
      {...props}
    >
      {/* First Pane */}
      <div
        style={{
          [orientation === 'horizontal' ? 'width' : 'height']: `${sizes[0]}%`,
        }}
        className={cn(
          'overflow-auto scrollbar-subtle shrink-0 min-w-0 min-h-0',
          paneOneClassName,
        )}
      >
        {leftOrTop}
      </div>

      {/* Resize Handle */}
      <div
        role="separator"
        tabIndex={0}
        // The divider runs across the split: side-by-side panes have a
        // vertical separator between them (WAI-ARIA window-splitter pattern).
        aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'}
        aria-label={`Resize ${orientation === 'horizontal' ? 'columns' : 'rows'}`}
        aria-valuenow={Math.round(sizes[0])}
        aria-valuemin={minSizes[0]}
        aria-valuemax={100 - minSizes[1]}
        aria-valuetext={`${Math.round(sizes[0])}%`}
        onPointerDown={handlePointerDown}
        onKeyDown={handleKeyDown}
        onDoubleClick={handleDoubleClick}
        className={cn(
          'group relative z-10 flex items-center justify-center bg-border transition-colors hover:bg-primary/70 shrink-0 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary',
          orientation === 'horizontal'
            ? 'w-1.5 cursor-col-resize hover:w-2'
            : 'h-1.5 cursor-row-resize hover:h-2',
          isDragging && 'bg-primary ring-2 ring-primary/40',
          handleClassName,
        )}
      >
        {/* Invisible expanded touch hit target */}
        <div
          className={cn(
            'absolute',
            orientation === 'horizontal'
              ? 'inset-y-0 -left-2 -right-2'
              : 'inset-x-0 -top-2 -bottom-2',
          )}
        />

        <div className="absolute flex items-center justify-center text-muted-foreground group-hover:text-primary-foreground pointer-events-none">
          {orientation === 'horizontal' ? (
            <GripVertical className="size-3 opacity-60 group-hover:opacity-100" />
          ) : (
            <GripHorizontal className="size-3 opacity-60 group-hover:opacity-100" />
          )}
        </div>
      </div>

      {/* Second Pane */}
      <div
        style={{
          [orientation === 'horizontal' ? 'width' : 'height']: `${sizes[1]}%`,
        }}
        className={cn(
          'overflow-auto scrollbar-subtle flex-1 min-w-0 min-h-0',
          paneTwoClassName,
        )}
      >
        {rightOrBottom}
      </div>
    </div>
  );
}

export const ResizablePanelLayout = ResizablePanels;

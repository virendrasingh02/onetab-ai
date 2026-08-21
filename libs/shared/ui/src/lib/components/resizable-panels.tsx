import { cn } from '@org/utils';
import { GripVertical, GripHorizontal } from 'lucide-react';
import {
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';

export interface ResizablePanelsProps extends ComponentProps<'div'> {
  orientation?: 'horizontal' | 'vertical';
  defaultSizes?: [number, number]; // Percentages, e.g. [30, 70]
  minSizes?: [number, number]; // e.g. [15, 15]
  leftOrTop: ReactNode;
  rightOrBottom: ReactNode;
}

export function ResizablePanels({
  orientation = 'horizontal',
  defaultSizes = [50, 50],
  minSizes = [15, 15],
  leftOrTop,
  rightOrBottom,
  className,
  ...props
}: ResizablePanelsProps) {
  const [sizes, setSizes] = useState<[number, number]>(defaultSizes);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    let percent: number;
    if (orientation === 'horizontal') {
      percent = ((e.clientX - rect.left) / rect.width) * 100;
    } else {
      percent = ((e.clientY - rect.top) / rect.height) * 100;
    }

    const clampedFirst = Math.min(Math.max(percent, minSizes[0]), 100 - minSizes[1]);
    setSizes([clampedFirst, 100 - clampedFirst]);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // Ignore
      }
      setIsDragging(false);
    }
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={cn(
        'relative flex w-full h-full overflow-hidden select-none',
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
        className="overflow-auto scrollbar-subtle shrink-0"
      >
        {leftOrTop}
      </div>

      {/* Resize Handle */}
      <div
        onPointerDown={handlePointerDown}
        className={cn(
          'group relative z-10 flex items-center justify-center bg-border transition-colors hover:bg-primary/70 shrink-0 select-none',
          orientation === 'horizontal'
            ? 'w-1.5 cursor-col-resize hover:w-2'
            : 'h-1.5 cursor-row-resize hover:h-2',
          isDragging && 'bg-primary',
        )}
      >
        <div className="absolute flex items-center justify-center text-muted-foreground group-hover:text-primary-foreground">
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
        className="overflow-auto scrollbar-subtle flex-1"
      >
        {rightOrBottom}
      </div>
    </div>
  );
}

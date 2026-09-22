import { cn } from '@org/utils';

export interface PickerSkeletonProps {
  type?: 'grid' | 'chips' | 'rows';
  count?: number;
  className?: string;
}

export function PickerSkeleton({
  type = 'grid',
  count = 6,
  className,
}: PickerSkeletonProps) {
  if (type === 'chips') {
    return (
      <div className={cn('flex flex-wrap gap-1', className)}>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="h-6 rounded-full bg-muted/60 animate-pulse"
            style={{ width: `${40 + (i % 4) * 16}px` }}
          />
        ))}
      </div>
    );
  }

  if (type === 'rows') {
    return (
      <div className={cn('space-y-2 p-2', className)}>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="h-8 w-full rounded-md bg-muted/50 animate-pulse"
          />
        ))}
      </div>
    );
  }

  // Masonry / 2-column grid for GIFs or 4-column grid for Stickers
  return (
    <div className={cn('grid grid-cols-2 gap-2 p-1', className)}>
      {Array.from({ length: count }, (_, i) => {
        // Alternating heights to mimic masonry without layout jumping
        const height = 90 + (i % 3) * 25;
        return (
          <div
            key={i}
            className="w-full rounded-lg bg-muted/60 animate-pulse border border-border/40"
            style={{ height: `${height}px` }}
          />
        );
      })}
    </div>
  );
}

export function StickerSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-4 gap-2 p-1">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="size-16 rounded-lg bg-muted/50 animate-pulse border border-border/30"
        />
      ))}
    </div>
  );
}

import { Skeleton } from '@org/ui';
import { cn } from '@org/utils';

export interface LinkPreviewSkeletonProps {
  compact?: boolean;
  className?: string;
}

export function LinkPreviewSkeleton({
  compact = false,
  className,
}: LinkPreviewSkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading link preview"
      className={cn(
        'relative flex overflow-hidden rounded-lg border border-border bg-surface-raised animate-pulse',
        'border-l-4 border-l-primary/40',
        compact ? 'max-w-xl p-2.5' : 'max-w-xl my-1.5 p-3',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Favicon & Domain skeleton */}
        <div className="flex items-center gap-2">
          <Skeleton className="size-3.5 rounded-xs" />
          <Skeleton className="h-3 w-28 rounded-xs" />
        </div>

        {/* Title skeleton */}
        <Skeleton className="h-4 w-3/4 rounded-xs" />

        {/* Description skeleton */}
        <div className="space-y-1">
          <Skeleton className="h-3 w-full rounded-xs" />
          <Skeleton className="h-3 w-4/5 rounded-xs" />
        </div>

        {/* Big image placeholder if not compact */}
        {!compact ? (
          <Skeleton className="mt-1 h-36 w-full max-w-md rounded-md" />
        ) : null}
      </div>

      {/* Right thumbnail skeleton if compact */}
      {compact ? (
        <div className="ml-3 shrink-0">
          <Skeleton className="size-16 rounded-md" />
        </div>
      ) : null}
    </div>
  );
}

import { cn } from '@org/utils';
import type { ComponentProps } from 'react';

export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      // aria-hidden: the surrounding region announces its own busy state.
      aria-hidden
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export interface SkeletonListProps extends ComponentProps<'div'> {
  rows?: number;
  /** Show a leading circle per row, for avatar/member lists. */
  withAvatar?: boolean;
}

/** Placeholder matching the shape of a dense list row. */
export function SkeletonList({
  rows = 5,
  withAvatar = false,
  className,
  ...props
}: SkeletonListProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('gap-3 flex flex-col', className)}
      {...props}
    >
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="gap-3 flex items-center">
          {withAvatar ? (
            <Skeleton className="size-8 shrink-0 rounded-full" />
          ) : null}
          <div className="min-w-0 gap-1.5 flex flex-1 flex-col">
            <Skeleton className="h-3.5 w-[38%]" />
            <Skeleton className="h-3 w-[62%]" />
          </div>
        </div>
      ))}
    </div>
  );
}

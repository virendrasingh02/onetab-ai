import { cn } from '@org/utils';
import { Loader2 } from 'lucide-react';
import type { ComponentProps } from 'react';

export interface SpinnerProps extends ComponentProps<'svg'> {
  label?: string;
}

export function Spinner({
  className,
  label = 'Loading',
  ...props
}: SpinnerProps) {
  return (
    <>
      <Loader2
        role="presentation"
        className={cn('size-4 animate-spin text-muted-foreground', className)}
        {...props}
      />
      <span className="sr-only">{label}</span>
    </>
  );
}

export interface LoadingStateProps extends ComponentProps<'div'> {
  label?: string;
  /** Fill the parent and centre — for route-level suspense fallbacks. */
  fullPage?: boolean;
}

/**
 * Indeterminate loading indicator. Prefer <SkeletonList> when the shape of the
 * incoming content is known — it reduces perceived latency and layout shift.
 */
export function LoadingState({
  label = 'Loading…',
  fullPage = false,
  className,
  ...props
}: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'gap-3 flex flex-col items-center justify-center',
        fullPage ? 'min-h-[60vh] w-full' : 'p-8',
        className,
      )}
      {...props}
    >
      <Loader2
        className="size-5 animate-spin text-muted-foreground"
        aria-hidden
      />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

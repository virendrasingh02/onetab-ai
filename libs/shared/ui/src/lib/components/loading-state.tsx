import { cn } from '@org/utils';
import { Loader2 } from 'lucide-react';
import type { ComponentProps } from 'react';

export interface SpinnerProps extends ComponentProps<'svg'> {
  label?: string;
}

export function Spinner({ className, label = 'Loading', ...props }: SpinnerProps) {
  return (
    <>
      <Loader2
        role="presentation"
        className={cn('text-muted-foreground size-4 animate-spin', className)}
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
        'flex flex-col items-center justify-center gap-3',
        fullPage ? 'min-h-[60vh] w-full' : 'p-8',
        className,
      )}
      {...props}
    >
      <Loader2 className="text-muted-foreground size-5 animate-spin" aria-hidden />
      <p className="text-muted-foreground text-sm">{label}</p>
    </div>
  );
}

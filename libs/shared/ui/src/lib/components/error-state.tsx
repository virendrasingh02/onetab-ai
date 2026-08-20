import { cn } from '@org/utils';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import { Button } from './button.js';

export interface ErrorStateProps extends ComponentProps<'div'> {
  title?: string;
  description?: string;
  /** Wired to a retry affordance when provided. */
  onRetry?: () => void;
  retryLabel?: string;
  action?: ReactNode;
  fullPage?: boolean;
  /** Raw detail (stack, request id). Collapsed behind a disclosure. */
  detail?: string;
}

/**
 * Terminal failure state for a region that could not load.
 *
 * `detail` is rendered inside a <details> rather than inline so a stack trace
 * never dominates the UI, but stays available for a bug report.
 */
export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this content. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  action,
  fullPage = false,
  detail,
  className,
  ...props
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'gap-3 flex flex-col items-center justify-center text-center',
        fullPage ? 'px-6 min-h-[60vh] w-full' : 'px-6 py-12',
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="size-11 flex items-center justify-center rounded-full bg-destructive/10 text-destructive"
      >
        <AlertTriangle className="size-5" />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-balance text-muted-foreground">
        {description}
      </p>

      {onRetry || action ? (
        <div className="mt-2 gap-2 flex items-center">
          {onRetry ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              leadingIcon={<RefreshCw />}
            >
              {retryLabel}
            </Button>
          ) : null}
          {action}
        </div>
      ) : null}

      {detail ? (
        <details className="mt-3 max-w-full text-left">
          <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
            Technical details
          </summary>
          <pre className="scrollbar-subtle mt-2 max-h-40 p-3 overflow-auto rounded-md bg-muted text-left font-mono text-[11px] whitespace-pre-wrap text-muted-foreground">
            {detail}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

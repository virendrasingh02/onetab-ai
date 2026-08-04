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
        'flex flex-col items-center justify-center gap-3 text-center',
        fullPage ? 'min-h-[60vh] w-full px-6' : 'px-6 py-12',
        className,
      )}
      {...props}
    >
      <div
        aria-hidden
        className="bg-destructive/10 text-destructive flex size-11 items-center justify-center rounded-full"
      >
        <AlertTriangle className="size-5" />
      </div>
      <p className="text-foreground text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground max-w-sm text-sm text-balance">
        {description}
      </p>

      {onRetry || action ? (
        <div className="mt-2 flex items-center gap-2">
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
          <summary className="text-muted-foreground hover:text-foreground cursor-pointer text-xs">
            Technical details
          </summary>
          <pre className="bg-muted text-muted-foreground mt-2 max-h-40 overflow-auto rounded-md p-3 text-left font-mono text-[11px] whitespace-pre-wrap">
            {detail}
          </pre>
        </details>
      ) : null}
    </div>
  );
}

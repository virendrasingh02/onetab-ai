import { cn } from '@org/utils';
import { AlertCircle, RefreshCw, SearchX } from 'lucide-react';

export interface PickerEmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export function PickerEmptyState({
  title = 'No results found',
  description,
  className,
}: PickerEmptyStateProps) {
  return (
    <div
      className={cn(
        'grid flex-1 place-items-center p-6 text-center text-xs text-muted-foreground',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-1.5 max-w-xs">
        <SearchX className="size-6 text-muted-foreground/60" aria-hidden="true" />
        <span className="font-medium text-foreground">{title}</span>
        {description ? <span className="text-[11px] text-muted-foreground">{description}</span> : null}
      </div>
    </div>
  );
}

export interface PickerErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function PickerErrorState({
  message = 'Unable to load content',
  onRetry,
  className,
}: PickerErrorStateProps) {
  return (
    <div
      className={cn(
        'grid flex-1 place-items-center p-6 text-center text-xs text-muted-foreground',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-2">
        <AlertCircle className="size-5 text-destructive/80" aria-hidden="true" />
        <p className="font-medium text-foreground">{message}</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-md border border-border bg-surface-raised hover:bg-accent text-foreground transition-colors"
          >
            <RefreshCw className="size-3" />
            <span>Try again</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

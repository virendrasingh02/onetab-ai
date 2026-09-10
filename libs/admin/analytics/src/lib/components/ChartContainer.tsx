import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@org/ui';
import { cn } from '@org/utils';
import { AlertCircle, BarChart3, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export interface ChartContainerProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  errorMessage?: string;
  onRetry?: () => void;
  height?: number | string;
  className?: string;
  children: ReactNode;
}

export function ChartContainer({
  title,
  description,
  action,
  isLoading = false,
  isError = false,
  isEmpty = false,
  emptyMessage = 'No data available for the selected period.',
  errorMessage = 'Failed to load chart data.',
  onRetry,
  height = 300,
  className,
  children,
}: ChartContainerProps) {
  return (
    <Card className={cn('flex flex-col', className)}>
      {(title || description || action) && (
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div className="space-y-1">
            {title && <CardTitle className="text-base font-semibold">{title}</CardTitle>}
            {description && (
              <CardDescription className="text-xs text-muted-foreground">
                {description}
              </CardDescription>
            )}
          </div>
          {action && <div className="shrink-0 ml-2">{action}</div>}
        </CardHeader>
      )}
      <CardContent className="flex-1 pb-4">
        {isLoading ? (
          <div
            style={{ height }}
            className="w-full flex flex-col justify-center items-center gap-2 animate-pulse bg-muted/20 rounded-md p-4"
          >
            <div className="w-full h-full flex items-end gap-2 pt-6">
              <Skeleton className="w-1/6 h-[40%]" />
              <Skeleton className="w-1/6 h-[75%]" />
              <Skeleton className="w-1/6 h-[55%]" />
              <Skeleton className="w-1/6 h-[90%]" />
              <Skeleton className="w-1/6 h-[65%]" />
              <Skeleton className="w-1/6 h-[80%]" />
            </div>
          </div>
        ) : isError ? (
          <div
            style={{ height }}
            className="w-full flex flex-col items-center justify-center gap-3 text-center p-6 bg-destructive/5 rounded-md border border-destructive/20"
          >
            <AlertCircle className="size-8 text-destructive opacity-80" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">{errorMessage}</p>
              <p className="text-xs text-muted-foreground">Please try again or adjust your filters.</p>
            </div>
            {onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5 mt-1">
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
            )}
          </div>
        ) : isEmpty ? (
          <div
            style={{ height }}
            className="w-full flex flex-col items-center justify-center gap-2 text-center p-6 bg-muted/10 rounded-md border border-dashed border-border"
          >
            <BarChart3 className="size-8 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">{emptyMessage}</p>
          </div>
        ) : (
          <div style={{ height, minHeight: height }} className="w-full">
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

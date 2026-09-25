import {
  Button,
  DateRangeFilter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { cn } from '@org/utils';
import { Monitor, RotateCcw } from 'lucide-react';
import type { AdminAnalyticsFilterState } from '../use-admin-analytics-filter.js';

export interface AnalyticsFilterBarProps {
  state: AdminAnalyticsFilterState;
  showPlatformFilter?: boolean;
  showTimeRange?: boolean;
  className?: string;
}

/**
 * Admin analytics filter row: the shared `DateRangeFilter` plus the
 * web/desktop split. State lives in `useAdminAnalyticsFilter` (URL-backed);
 * this component only renders it.
 */
export function AnalyticsFilterBar({
  state,
  showPlatformFilter = true,
  showTimeRange = true,
  className,
}: AnalyticsFilterBarProps) {
  return (
    <div
      className={cn(
        'gap-3 p-2.5 text-xs flex flex-wrap items-center justify-between rounded-lg border border-border bg-card',
        className,
      )}
    >
      <div className="gap-2.5 flex flex-wrap items-center">
        {showTimeRange ? (
          <DateRangeFilter value={state.range} onChange={state.setRange} align="start" />
        ) : null}

        {showPlatformFilter ? (
          <Select
            value={state.platform}
            onValueChange={(value) =>
              state.setPlatform(value as AdminAnalyticsFilterState['platform'])
            }
          >
            <SelectTrigger className="h-7 text-xs w-[150px]" aria-label="Platform">
              <Monitor className="size-3.5 text-muted-foreground" />
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              <SelectItem value="web">Web only</SelectItem>
              <SelectItem value="desktop">Desktop only</SelectItem>
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {state.isFiltered ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={state.reset}
          leadingIcon={<RotateCcw />}
        >
          Reset filters
        </Button>
      ) : null}
    </div>
  );
}

import type { AdminAnalyticsFilter } from '@org/types';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { Calendar, Monitor, RotateCcw } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

export interface AnalyticsFilterBarProps {
  filter: AdminAnalyticsFilter;
  onFilterChange: (newFilter: AdminAnalyticsFilter) => void;
  showPlatformFilter?: boolean;
  showTimeRange?: boolean;
  className?: string;
}

export function AnalyticsFilterBar({
  filter,
  onFilterChange,
  showPlatformFilter = true,
  showTimeRange = true,
  className,
}: AnalyticsFilterBarProps) {
  const [searchParams, setSearchParams] = useSearchParams();

  const handleRangeChange = (range: string) => {
    const updated = { ...filter, range: range as AdminAnalyticsFilter['range'] };
    onFilterChange(updated);
    const newParams = new URLSearchParams(searchParams);
    if (range) newParams.set('range', range);
    else newParams.delete('range');
    setSearchParams(newParams, { replace: true });
  };

  const handlePlatformChange = (platform: string) => {
    const p = platform === 'all' ? undefined : (platform as 'web' | 'desktop');
    const updated = { ...filter, platform: p };
    onFilterChange(updated);
    const newParams = new URLSearchParams(searchParams);
    if (p) newParams.set('platform', p);
    else newParams.delete('platform');
    setSearchParams(newParams, { replace: true });
  };

  const handleReset = () => {
    onFilterChange({ range: '30d' });
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('range');
    newParams.delete('platform');
    setSearchParams(newParams, { replace: true });
  };

  const isFiltered =
    (filter.range && filter.range !== '30d') || Boolean(filter.platform);

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-lg border bg-card/60 backdrop-blur-xs text-xs ${
        className || ''
      }`}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        {showTimeRange && (
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-muted-foreground" />
            <Select
              value={filter.range || '30d'}
              onValueChange={handleRangeChange}
            >
              <SelectTrigger className="h-8 text-xs w-[110px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today" className="text-xs">Today</SelectItem>
                <SelectItem value="7d" className="text-xs">Last 7 Days</SelectItem>
                <SelectItem value="30d" className="text-xs">Last 30 Days</SelectItem>
                <SelectItem value="90d" className="text-xs">Last 90 Days</SelectItem>
                <SelectItem value="this_year" className="text-xs">This Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {showPlatformFilter && (
          <div className="flex items-center gap-1.5">
            <Monitor className="size-3.5 text-muted-foreground" />
            <Select
              value={filter.platform || 'all'}
              onValueChange={handlePlatformChange}
            >
              <SelectTrigger className="h-8 text-xs w-[120px]">
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Platforms</SelectItem>
                <SelectItem value="web" className="text-xs">Web Only</SelectItem>
                <SelectItem value="desktop" className="text-xs">Desktop Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {isFiltered && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3" />
          Reset filters
        </Button>
      )}
    </div>
  );
}

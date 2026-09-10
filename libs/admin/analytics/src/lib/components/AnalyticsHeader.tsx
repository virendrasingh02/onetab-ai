import type { AdminAnalyticsFilter } from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@org/ui';
import { Download, FileDown, FileJson, RefreshCw, Radio } from 'lucide-react';
import type { ReactNode } from 'react';
import { useExportAnalytics } from '../use-admin-analytics.js';

export interface AnalyticsHeaderProps {
  title: string;
  description?: string;
  lastUpdated?: string | number | Date;
  isLive?: boolean;
  onToggleLive?: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  exportType?: string;
  filter?: AdminAnalyticsFilter;
  extraActions?: ReactNode;
}

export function AnalyticsHeader({
  title,
  description,
  lastUpdated,
  isLive,
  onToggleLive,
  onRefresh,
  isRefreshing = false,
  exportType,
  filter,
  extraActions,
}: AnalyticsHeaderProps) {
  const exportMutation = useExportAnalytics();

  const formattedTime = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : null;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b">
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
          {isLive !== undefined && (
            <Badge
              variant={isLive ? 'success' : 'outline'}
              className="gap-1 text-xs cursor-pointer select-none"
              onClick={onToggleLive}
            >
              <Radio className={`size-3 ${isLive ? 'animate-pulse text-success' : 'text-muted-foreground'}`} />
              {isLive ? 'Live' : 'Paused'}
            </Badge>
          )}
        </div>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground">{description}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {formattedTime && (
          <span className="text-xs text-muted-foreground hidden md:inline">
            Updated: {formattedTime}
          </span>
        )}

        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="gap-1.5 h-8 text-xs"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}

        {exportType && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                disabled={exportMutation.isPending}
              >
                <Download className="size-3.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                onClick={() =>
                  exportMutation.mutate({ type: exportType, format: 'csv', filter })
                }
                className="gap-2 cursor-pointer text-xs"
              >
                <FileDown className="size-3.5 text-success" />
                Export CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  exportMutation.mutate({ type: exportType, format: 'json', filter })
                }
                className="gap-2 cursor-pointer text-xs"
              >
                <FileJson className="size-3.5 text-accent-blue" />
                Export JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {extraActions}
      </div>
    </div>
  );
}

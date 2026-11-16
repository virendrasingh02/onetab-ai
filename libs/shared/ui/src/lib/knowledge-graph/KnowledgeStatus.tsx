import type { KnowledgeGraphHealth } from '@org/types';
import { cn } from '@org/utils';
import { Activity, Database, GitBranch, Layers, Sparkles, Zap } from 'lucide-react';

export interface KnowledgeStatusProps {
  health: KnowledgeGraphHealth | null | undefined;
  isLoading?: boolean;
  className?: string;
}

export function KnowledgeStatus({ health, isLoading, className }: KnowledgeStatusProps) {
  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-muted-foreground animate-pulse', className)}>
        <Activity className="size-3.5 animate-spin" />
        <span>Loading Knowledge Graph status...</span>
      </div>
    );
  }

  if (!health) {
    return (
      <div className={cn('text-xs text-muted-foreground', className)}>
        Knowledge Graph status unavailable
      </div>
    );
  }

  const isHealthy = health.status === 'HEALTHY';

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Graph Engine
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
              isHealthy
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-full',
                isHealthy ? 'bg-emerald-500' : 'bg-amber-500',
              )}
            />
            {health.status}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Zap className="size-3 text-amber-500" />
          <span>{health.averageQueryLatencyMs.toFixed(1)}ms avg query</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Entities</span>
            <Layers className="size-3.5 text-primary" />
          </div>
          <p className="text-lg font-bold text-foreground">
            {health.totalNodes.toLocaleString()}
          </p>
        </div>

        <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Relationships</span>
            <GitBranch className="size-3.5 text-violet-500" />
          </div>
          <p className="text-lg font-bold text-foreground">
            {health.totalEdges.toLocaleString()}
          </p>
        </div>

        <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Indexed Sources</span>
            <Database className="size-3.5 text-blue-500" />
          </div>
          <p className="text-lg font-bold text-foreground">
            {health.totalSources.toLocaleString()}
          </p>
        </div>

        <div className="p-2.5 rounded-lg border border-border bg-card/60 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-medium">Token Savings</span>
            <Sparkles className="size-3.5 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            {health.measuredTokenSavingsPercent > 0
              ? `~${health.measuredTokenSavingsPercent.toFixed(1)}%`
              : 'Active'}
          </p>
        </div>
      </div>
    </div>
  );
}

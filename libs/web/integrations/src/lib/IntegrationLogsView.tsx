import {
  Badge,
  Button,
  EmptyState,
  Spinner,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
} from 'lucide-react';
import type { ExternalIntegration } from '@org/types';
import { useIntegrationSyncJobs } from './use-integrations.js';

interface IntegrationLogsViewProps {
  workspaceId: string;
  integrations: ExternalIntegration[];
}

export function IntegrationLogsView({
  workspaceId,
  integrations,
}: IntegrationLogsViewProps) {
  const activeIntegration = integrations[0];
  const syncJobsQuery = useIntegrationSyncJobs(
    workspaceId,
    activeIntegration?.id,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="size-4 text-primary" />
            Integration Sync & Activity Log
          </h3>
          <p className="text-xs text-muted-foreground">
            Monitor real-time synchronization jobs, background task statuses, and integration errors.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => syncJobsQuery.refetch()}
          className="h-8 text-xs gap-1.5"
        >
          <RefreshCw className={cn('size-3.5', syncJobsQuery.isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border">
        {syncJobsQuery.isLoading ? (
          <div className="p-12 flex items-center justify-center">
            <Spinner className="size-6" />
          </div>
        ) : (syncJobsQuery.data ?? []).length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={<Activity className="size-8 text-muted-foreground" />}
              title="No recent sync events"
              description="Background synchronization events and error traces will appear here."
            />
          </div>
        ) : (
          (syncJobsQuery.data ?? []).map((job) => (
            <div
              key={job.id}
              className="p-4 flex items-center justify-between gap-4 transition-colors hover:bg-accent/20"
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    'size-8 rounded-lg flex items-center justify-center',
                    job.status === 'COMPLETED' && 'bg-emerald-500/10 text-emerald-500',
                    job.status === 'RUNNING' && 'bg-blue-500/10 text-blue-500 animate-pulse',
                    job.status === 'FAILED' && 'bg-rose-500/10 text-rose-500',
                    job.status === 'PENDING' && 'bg-amber-500/10 text-amber-500',
                  )}
                >
                  {job.status === 'COMPLETED' && <CheckCircle2 className="size-4" />}
                  {job.status === 'RUNNING' && <RefreshCw className="size-4 animate-spin" />}
                  {job.status === 'FAILED' && <AlertCircle className="size-4" />}
                  {job.status === 'PENDING' && <Clock className="size-4" />}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {job.jobType.replace(/_/g, ' ')}
                    </span>
                    <Badge
                      variant={
                        job.status === 'COMPLETED'
                          ? 'success'
                          : job.status === 'FAILED'
                            ? 'destructive'
                            : 'neutral'
                      }
                      className="text-[10px] px-1.5 py-0"
                    >
                      {job.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Processed {job.itemsProcessed} items • {new Date(job.createdAt).toLocaleString()}
                  </p>
                  {job.errorMessage && (
                    <p className="text-[11px] text-rose-500 mt-0.5 font-mono">
                      Error: {job.errorMessage}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-right text-[11px] text-muted-foreground shrink-0">
                {job.retryCount > 0 && <span>Retries: {job.retryCount} • </span>}
                <span>ID: {job.id.slice(0, 8)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

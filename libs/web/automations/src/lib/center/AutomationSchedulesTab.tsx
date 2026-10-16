import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  toast,
} from '@org/ui';
import { useCurrentWorkspace, useWorkspacePermission } from '@org/web-workspace';
import {
  CalendarClock,
  Clock,
  ExternalLink,
  Pause,
  Play,
  Plus,
  RefreshCw,
} from 'lucide-react';
import {
  useAutomationSchedules,
  useWorkflowMutations,
} from '../use-automations.js';

export function AutomationSchedulesTab() {
  const navigate = useNavigate();
  const { workspaceId, slug } = useCurrentWorkspace();
  const { can } = useWorkspacePermission();
  const schedulesQuery = useAutomationSchedules(workspaceId);
  const { trigger, update } = useWorkflowMutations(workspaceId);

  const schedules = schedulesQuery.data ?? [];

  const handleRunNow = (workflowId: string, name: string) => {
    trigger.mutate(
      { workflowId },
      {
        onSuccess: (res) => {
          toast.success(`Triggered “${name}” successfully`, {
            description: `Run started: ${res.runId}`,
          });
        },
        onError: (err) => {
          toast.error(`Could not run “${name}”`, {
            description: err instanceof Error ? err.message : undefined,
          });
        },
      },
    );
  };

  const handleToggleActive = (workflowId: string, currentActive: boolean, name: string) => {
    update.mutate(
      {
        workflowId,
        input: { isActive: !currentActive },
      },
      {
        onSuccess: () => {
          schedulesQuery.refetch();
          toast.success(`${currentActive ? 'Paused' : 'Activated'} schedule for “${name}”`);
        },
        onError: () => {
          toast.error(`Could not update “${name}”`);
        },
      },
    );
  };

  if (schedulesQuery.isLoading) {
    return <LoadingState label="Loading scheduled automations…" />;
  }

  if (schedulesQuery.isError) {
    return (
      <ErrorState
        title="Could not load schedules"
        description="Unable to fetch scheduled automations for this workspace."
        onRetry={() => schedulesQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Scheduled Automations ({schedules.length})
          </h3>
          <p className="text-sm text-muted-foreground">
            All cron jobs, interval timers, and business-hour automations scheduled to run automatically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => schedulesQuery.refetch()}
            disabled={schedulesQuery.isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${schedulesQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          {can('create') && (
            <Button
              size="sm"
              onClick={() => navigate(`/w/${slug}/automations/builder/new?trigger=CRON`)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New Scheduled Automation
            </Button>
          )}
        </div>
      </div>

      {schedules.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-8" />}
          title="No scheduled automations found"
          description="Create an automation with a CRON trigger to run recurrent workflows every hour, day, week, or month."
          action={
            can('create') ? (
              <Button
                size="sm"
                onClick={() => navigate(`/w/${slug}/automations/builder/new?trigger=CRON`)}
              >
                Schedule an Automation
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card divide-y divide-border/60">
          {schedules.map((item) => {
            const nextRunFormatted = item.nextRunAt
              ? new Date(item.nextRunAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : 'Paused or unset';

            return (
              <div
                key={item.workflowId}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-sm text-foreground">
                      {item.name}
                    </span>
                    <Badge
                      variant={item.isActive ? 'success' : 'secondary'}
                      className="text-[10px]"
                    >
                      {item.isActive ? 'Active' : 'Paused'}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>{item.humanSchedule}</span>
                    <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-foreground/80">
                      {item.cron}
                    </span>
                    <span className="text-[11px]">({item.timezone})</span>
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground block">
                      Next Scheduled Run
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {nextRunFormatted}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {can('create') && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() => handleToggleActive(item.workflowId, item.isActive, item.name)}
                          title={item.isActive ? 'Pause automation' : 'Resume automation'}
                        >
                          {item.isActive ? (
                            <>
                              <Pause className="h-3.5 w-3.5 mr-1 text-amber-500" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5 mr-1 text-success-text" />
                              Resume
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 px-2.5 text-xs"
                          onClick={() => handleRunNow(item.workflowId, item.name)}
                          disabled={trigger.isPending}
                        >
                          Run Now
                        </Button>
                      </>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-2 text-xs"
                      onClick={() => navigate(`/w/${slug}/automations/builder/${item.workflowId}`)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

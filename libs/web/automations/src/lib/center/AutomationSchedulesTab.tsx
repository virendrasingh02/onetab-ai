import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  toast,
} from '@org/ui';
import {
  useCurrentWorkspace,
  useWorkspacePermission,
} from '@org/web-workspace';
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

  const handleToggleActive = (
    workflowId: string,
    currentActive: boolean,
    name: string,
  ) => {
    update.mutate(
      {
        workflowId,
        input: { isActive: !currentActive },
      },
      {
        onSuccess: () => {
          schedulesQuery.refetch();
          toast.success(
            `${currentActive ? 'Paused' : 'Activated'} schedule for “${name}”`,
          );
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
      <div className="sm:flex-row sm:items-center gap-4 flex flex-col items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg gap-2 flex items-center text-foreground">
            <CalendarClock className="h-5 w-5 text-primary" />
            Scheduled Automations ({schedules.length})
          </h3>
          <p className="text-sm text-muted-foreground">
            All cron jobs, interval timers, and business-hour automations
            scheduled to run automatically.
          </p>
        </div>

        <div className="gap-2 flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => schedulesQuery.refetch()}
            disabled={schedulesQuery.isFetching}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${schedulesQuery.isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
          {can('create') && (
            <Button
              size="sm"
              onClick={() =>
                navigate(`/w/${slug}/automations/builder/new?trigger=CRON`)
              }
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
                onClick={() =>
                  navigate(`/w/${slug}/automations/builder/new?trigger=CRON`)
                }
              >
                Schedule an Automation
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="divide-y divide-border/60 overflow-hidden rounded-lg border bg-card">
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
                className="p-4 md:flex-row md:items-center gap-4 flex flex-col justify-between transition-colors hover:bg-muted/30"
              >
                <div className="space-y-1">
                  <div className="gap-2.5 flex items-center">
                    <span className="font-semibold text-sm text-foreground">
                      {item.name}
                    </span>
                    <Badge
                      variant={item.isActive ? 'success' : 'secondary'}
                      className="text-2xs"
                    >
                      {item.isActive ? 'Active' : 'Paused'}
                    </Badge>
                  </div>

                  <p className="text-xs gap-2 flex items-center text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span>{item.humanSchedule}</span>
                    <span className="px-1.5 py-0.5 rounded bg-muted font-mono text-meta text-foreground/80">
                      {item.cron}
                    </span>
                    <span className="text-meta">({item.timezone})</span>
                  </p>
                </div>

                <div className="gap-4 flex items-center">
                  <div className="text-right">
                    <span className="tracking-wider block text-meta text-muted-foreground uppercase">
                      Next Scheduled Run
                    </span>
                    <span className="text-xs font-medium text-foreground">
                      {nextRunFormatted}
                    </span>
                  </div>

                  <div className="gap-1.5 flex items-center">
                    {can('create') && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-xs"
                          onClick={() =>
                            handleToggleActive(
                              item.workflowId,
                              item.isActive,
                              item.name,
                            )
                          }
                          title={
                            item.isActive
                              ? 'Pause automation'
                              : 'Resume automation'
                          }
                        >
                          {item.isActive ? (
                            <>
                              <Pause className="h-3.5 w-3.5 mr-1 text-warning-text" />
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
                          onClick={() =>
                            handleRunNow(item.workflowId, item.name)
                          }
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
                      onClick={() =>
                        navigate(
                          `/w/${slug}/automations/builder/${item.workflowId}`,
                        )
                      }
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

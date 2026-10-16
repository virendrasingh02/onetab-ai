import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ErrorState,
  LoadingState,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  AlertCircle,
  Bug,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import type { AutomationErrorGroup } from '@org/types';
import { useAutomationErrors } from '../use-automations.js';

export function AutomationErrorsTab() {
  const navigate = useNavigate();
  const { workspaceId, slug } = useCurrentWorkspace();
  const errorsQuery = useAutomationErrors(workspaceId);

  const [selectedError, setSelectedError] = useState<AutomationErrorGroup | null>(null);

  if (errorsQuery.isLoading) {
    return <LoadingState label="Loading error diagnostics…" />;
  }

  if (errorsQuery.isError) {
    return (
      <ErrorState
        title="Could not load error diagnostics"
        onRetry={() => errorsQuery.refetch()}
      />
    );
  }

  const errorGroups = errorsQuery.data ?? [];
  const totalErrors = errorGroups.reduce((acc, g) => acc + g.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
            <Bug className="h-5 w-5 text-rose-500" />
            Error Monitoring & Failure Classification ({totalErrors})
          </h3>
          <p className="text-sm text-muted-foreground">
            Automatically classified failure patterns, timeout root causes, and connector rate limits across your workspace.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => errorsQuery.refetch()}
          disabled={errorsQuery.isFetching}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${errorsQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {errorGroups.length === 0 ? (
        <Card className="p-8 text-center bg-success/5 border-success/20">
          <div className="mx-auto w-12 h-12 rounded-full bg-success/10 text-success-text flex items-center justify-center mb-3">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h4 className="font-semibold text-base text-foreground mb-1">
            Zero Failures Detected
          </h4>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            All recent workflow executions have completed cleanly without any uncaught exceptions or timeouts.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {errorGroups.map((group) => {
            const lastTime = group.latestOccurredAt
              ? formatRelative(group.latestOccurredAt)
              : 'Recently';

            return (
              <Card
                key={group.classification}
                className="p-5 flex flex-col justify-between hover:border-rose-500/40 transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge variant="destructive" className="font-mono text-[10px]">
                      {group.classification}
                    </Badge>
                    <span className="font-semibold text-xs text-rose-600 dark:text-rose-400">
                      {group.count} {group.count === 1 ? 'failure' : 'failures'}
                    </span>
                  </div>

                  <h4 className="font-semibold text-sm text-foreground mb-1.5">
                    {group.classification.replace(/_/g, ' ')}
                  </h4>

                  <p className="text-xs text-muted-foreground font-mono bg-muted/40 p-2 rounded line-clamp-3 mb-3">
                    {group.latestError}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-3">
                    <span>{group.affectedWorkflows.length} workflows affected</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {lastTime}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => setSelectedError(group)}
                    >
                      Inspect Root Cause
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="w-full text-xs"
                      onClick={() => navigate(`/w/${slug}/automations?tab=runs&status=FAILED`)}
                    >
                      View Runs
                      <ExternalLink className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Inspect Error Modal */}
      {selectedError && (
        <Dialog open={!!selectedError} onOpenChange={(open) => !open && setSelectedError(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-500" />
                <DialogTitle>{selectedError.classification}</DialogTitle>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-4 py-2">
              <div>
                <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Latest Error Message
                </h5>
                <pre className="font-mono text-xs bg-muted/60 p-3 rounded-lg overflow-x-auto text-foreground whitespace-pre-wrap">
                  {selectedError.latestError}
                </pre>
              </div>

              <div>
                <h5 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Affected Workflows ({selectedError.affectedWorkflows.length})
                </h5>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedError.affectedWorkflows.map((w) => (
                    <div
                      key={w.id}
                      className="p-2 rounded bg-muted/30 border border-border/40 text-xs flex items-center justify-between"
                    >
                      <span className="font-medium text-foreground">{w.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[11px]"
                        onClick={() => {
                          setSelectedError(null);
                          navigate(`/w/${slug}/automations/builder/${w.id}`);
                        }}
                      >
                        Edit Workflow
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </DialogBody>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedError(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setSelectedError(null);
                  navigate(`/w/${slug}/automations?tab=runs&status=FAILED`);
                }}
              >
                Inspect Failed Runs
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

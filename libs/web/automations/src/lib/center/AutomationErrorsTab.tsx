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

  const [selectedError, setSelectedError] =
    useState<AutomationErrorGroup | null>(null);

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
      <div className="sm:flex-row sm:items-center gap-4 flex flex-col items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg gap-2 flex items-center text-foreground">
            <Bug className="h-5 w-5 text-destructive-text" />
            Error Monitoring & Failure Classification ({totalErrors})
          </h3>
          <p className="text-sm text-muted-foreground">
            Automatically classified failure patterns, timeout root causes, and
            connector rate limits across your workspace.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => errorsQuery.refetch()}
          disabled={errorsQuery.isFetching}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1.5 ${errorsQuery.isFetching ? 'animate-spin' : ''}`}
          />
          Refresh
        </Button>
      </div>

      {errorGroups.length === 0 ? (
        <Card className="p-8 border-success/20 bg-success/5 text-center">
          <div className="w-12 h-12 mb-3 mx-auto flex items-center justify-center rounded-full bg-success/10 text-success-text">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h4 className="font-semibold text-base mb-1 text-foreground">
            Zero Failures Detected
          </h4>
          <p className="text-sm max-w-md mx-auto text-muted-foreground">
            All recent workflow executions have completed cleanly without any
            uncaught exceptions or timeouts.
          </p>
        </Card>
      ) : (
        <div className="md:grid-cols-2 lg:grid-cols-3 gap-4 grid grid-cols-1">
          {errorGroups.map((group) => {
            const lastTime = group.latestOccurredAt
              ? formatRelative(group.latestOccurredAt)
              : 'Recently';

            return (
              <Card
                key={group.classification}
                className="p-5 flex flex-col justify-between transition-colors hover:border-destructive/40"
              >
                <div>
                  <div className="gap-2 mb-2 flex items-start justify-between">
                    <Badge variant="destructive" className="font-mono text-2xs">
                      {group.classification}
                    </Badge>
                    <span className="font-semibold text-xs text-destructive-text">
                      {group.count} {group.count === 1 ? 'failure' : 'failures'}
                    </span>
                  </div>

                  <h4 className="font-semibold text-sm mb-1.5 text-foreground">
                    {group.classification.replace(/_/g, ' ')}
                  </h4>

                  <p className="text-xs p-2 rounded mb-3 line-clamp-3 bg-muted/40 font-mono text-muted-foreground">
                    {group.latestError}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/50">
                  <div className="mb-3 flex items-center justify-between text-meta text-muted-foreground">
                    <span>
                      {group.affectedWorkflows.length} workflows affected
                    </span>
                    <span className="gap-1 flex items-center">
                      <Clock className="h-3 w-3" />
                      {lastTime}
                    </span>
                  </div>

                  <div className="gap-2 flex items-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs w-full"
                      onClick={() => setSelectedError(group)}
                    >
                      Inspect Root Cause
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs w-full"
                      onClick={() =>
                        navigate(
                          `/w/${slug}/automations?tab=runs&status=FAILED`,
                        )
                      }
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
        <Dialog
          open={!!selectedError}
          onOpenChange={(open) => !open && setSelectedError(null)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="gap-2 flex items-center">
                <AlertCircle className="h-5 w-5 text-destructive-text" />
                <DialogTitle>{selectedError.classification}</DialogTitle>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-4 py-2">
              <div>
                <h5 className="text-xs font-semibold tracking-wider mb-1 text-muted-foreground uppercase">
                  Latest Error Message
                </h5>
                <pre className="text-xs p-3 overflow-x-auto rounded-lg bg-muted/60 font-mono whitespace-pre-wrap text-foreground">
                  {selectedError.latestError}
                </pre>
              </div>

              <div>
                <h5 className="text-xs font-semibold tracking-wider mb-2 text-muted-foreground uppercase">
                  Affected Workflows ({selectedError.affectedWorkflows.length})
                </h5>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selectedError.affectedWorkflows.map((w) => (
                    <div
                      key={w.id}
                      className="p-2 rounded text-xs flex items-center justify-between border border-border/40 bg-muted/30"
                    >
                      <span className="font-medium text-foreground">
                        {w.name}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-meta"
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

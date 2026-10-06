import { approvalsApi } from '@org/api-client';
import {
  Badge,
  Button,
  CodeBlock,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Page,
  PageHeader,
  Panel,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import {
  fetchWorkspaceApprovals,
  workspaceApprovalsKey,
} from '../services/approvals-query.js';
import { useStudioSession } from '../session-guard.js';

export function ApprovalsPage() {
  const { activeWorkspace } = useStudioSession();
  const queryClient = useQueryClient();
  const [filterState, setFilterState] = useState<string>('PENDING');
  const [selectedApproval, setSelectedApproval] = useState<any | null>(null);
  const [decisionReason, setDecisionReason] = useState<string>('');

  const {
    data: approvals = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: workspaceApprovalsKey(activeWorkspace.id, filterState),
    queryFn: () => fetchWorkspaceApprovals(activeWorkspace.id, filterState),
  });

  const decideMutation = useMutation({
    mutationFn: async ({
      id,
      decision,
      reason,
    }: {
      id: string;
      decision: 'APPROVED' | 'REJECTED';
      reason?: string;
    }) => {
      return approvalsApi.decide(activeWorkspace.id, id, {
        decision,
        comment: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-approvals'] });
      setSelectedApproval(null);
      setDecisionReason('');
      toast.success('Decision recorded successfully!');
    },
  });

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'APPROVED':
        return (
          <Badge variant="success" className="gap-1 font-mono text-[11px]">
            <CheckCircle2 className="size-3" />
            Approved
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="destructive" className="gap-1 font-mono text-[11px]">
            <XCircle className="size-3" />
            Rejected
          </Badge>
        );
      case 'EXPIRED':
        return (
          <Badge variant="warning" className="gap-1 font-mono text-[11px]">
            <Clock className="size-3" />
            Expired
          </Badge>
        );
      default:
        return (
          <Badge variant="primary" className="gap-1 font-mono text-[11px]">
            <Clock className="size-3" />
            Pending Review
          </Badge>
        );
    }
  };

  return (
    <Page width="wide" padding="none" className="space-y-6">
      {/* Admin standard PageHeader */}
      <PageHeader
        title="Human-in-the-Loop Approvals"
        description={`Review and govern sensitive agent operations, external writes, and critical workflow pauses in ${activeWorkspace.name}.`}
        icon={<UserCheck className="size-5" />}
        accent="blue"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-2 text-xs"
          >
            <RefreshCw
              className={cn('size-3.5', isRefetching && 'animate-spin')}
            />
            Refresh
          </Button>
        }
      />

      {/* Filter Tabs Toolbar */}
      <div className="flex items-center gap-1.5 border-b border-border pb-3">
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((tab) => (
          <Button
            key={tab}
            variant={filterState === tab ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setFilterState(tab)}
            className="text-xs h-8"
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      {/* Content Area */}
      {isLoading ? (
        <LoadingState label="Loading approval requests..." />
      ) : isError ? (
        <ErrorState title="Couldn’t load approvals" description="The platform didn’t answer. Try again in a moment." onRetry={() => void refetch()} />
      ) : approvals.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="size-8 text-muted-foreground" />}
          title="No approval requests found"
          description={
            filterState === 'PENDING'
              ? 'No agent executions are currently blocked waiting for approval.'
              : `No approvals match the current filter (${filterState.toLowerCase()}).`
          }
        />
      ) : (
        <div className="space-y-3">
          {approvals.map((req) => (
            <Panel key={req.id} className="p-4 transition-all hover:border-primary/40">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getStatusBadge(req.state)}
                    <span className="text-xs font-mono font-medium text-foreground bg-surface-raised px-2 py-0.5 rounded border border-border">
                      {req.actionType || 'GENERIC_ACTION'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Target: {req.entityType} ({req.entityId?.slice(0, 8)}...)
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3">
                    <span>
                      Created: {new Date(req.createdAt).toLocaleString()}
                    </span>
                    {req.executionId && (
                      <span className="font-mono text-[11px]">
                        Exec: {req.executionId.slice(0, 8)}
                      </span>
                    )}
                    {req.requester?.name && (
                      <span>By: {req.requester.name}</span>
                    )}
                  </div>
                  {req.comment && (
                    <p className="text-xs italic text-muted-foreground bg-surface-raised p-2 rounded border border-border">
                      Decision note: &quot;{req.comment}&quot;
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedApproval(req)}
                    className="gap-1.5 text-xs"
                  >
                    <Eye className="size-3.5" />
                    Inspect Payload
                  </Button>
                  {req.state === 'PENDING' && (
                    <>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1.5 text-xs"
                        onClick={() =>
                          decideMutation.mutate({
                            id: req.id,
                            decision: 'REJECTED',
                            reason: 'Rejected via studio',
                          })
                        }
                        disabled={decideMutation.isPending}
                      >
                        <ThumbsDown className="size-3.5" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        className="gap-1.5 text-xs"
                        onClick={() =>
                          decideMutation.mutate({
                            id: req.id,
                            decision: 'APPROVED',
                            reason: 'Approved via studio',
                          })
                        }
                        disabled={decideMutation.isPending}
                      >
                        <ThumbsUp className="size-3.5" />
                        Approve
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* Inspector / Decision Dialog */}
      <Dialog
        open={!!selectedApproval}
        onOpenChange={(open) => !open && setSelectedApproval(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-warning" />
              Approval Request Details
            </DialogTitle>
          </DialogHeader>

          {selectedApproval && (
            <DialogBody className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-surface-raised rounded-lg border border-border">
                <div>
                  <div className="text-muted-foreground">Action</div>
                  <div className="font-semibold text-foreground">
                    {selectedApproval.actionType}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div>{getStatusBadge(selectedApproval.state)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Entity</div>
                  <div className="font-mono">
                    {selectedApproval.entityType}: {selectedApproval.entityId}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Execution ID</div>
                  <div className="font-mono">
                    {selectedApproval.executionId || 'N/A'}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Proposed Payload / Parameters
                </label>
                <CodeBlock
                  variant="compact"
                  language="json"
                  code={JSON.stringify(
                    selectedApproval.proposedPayload || {},
                    null,
                    2,
                  )}
                />
              </div>

              {selectedApproval.state === 'PENDING' && (
                <div className="space-y-2 border-t border-border pt-4">
                  <label className="text-xs font-semibold text-foreground block">
                    Decision Reason / Comment (Optional)
                  </label>
                  <Input
                    type="text"
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder="Provide rationale for approval or rejection..."
                    className="text-xs"
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() =>
                        decideMutation.mutate({
                          id: selectedApproval.id,
                          decision: 'REJECTED',
                          reason: decisionReason || 'Rejected by user',
                        })
                      }
                      disabled={decideMutation.isPending}
                    >
                      <ThumbsDown className="mr-1.5 size-3.5" />
                      Reject Execution
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        decideMutation.mutate({
                          id: selectedApproval.id,
                          decision: 'APPROVED',
                          reason: decisionReason || 'Approved by user',
                        })
                      }
                      disabled={decideMutation.isPending}
                    >
                      <ThumbsUp className="mr-1.5 size-3.5" />
                      Approve & Resume
                    </Button>
                  </div>
                </div>
              )}
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>
    </Page>
  );
}

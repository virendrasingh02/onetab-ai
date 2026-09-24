import { approvalsApi } from '@org/api-client';
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, LoadingState } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
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
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['workspace-approvals', activeWorkspace.id, filterState],
    queryFn: () => approvalsApi.list(activeWorkspace.id, filterState === 'ALL' ? undefined : filterState),
  });

  const decideMutation = useMutation({
    mutationFn: async ({ id, decision, reason }: { id: string; decision: 'APPROVED' | 'REJECTED'; reason?: string }) => {
      return approvalsApi.decide(activeWorkspace.id, id, { decision, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-approvals'] });
      setSelectedApproval(null);
      setDecisionReason('');
    },
  });

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'APPROVED':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1 text-[11px]">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 gap-1 text-[11px]">
            <XCircle className="h-3 w-3" />
            Rejected
          </Badge>
        );
      case 'EXPIRED':
        return (
          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1 text-[11px]">
            <Clock className="h-3 w-3" />
            Expired
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20 gap-1 text-[11px] animate-pulse">
            <Clock className="h-3 w-3" />
            Pending Review
          </Badge>
        );
    }
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl flex items-center gap-2">
            <UserCheck className="h-6 w-6 text-primary" />
            Human-in-the-Loop Approvals
          </h1>
          <p className="text-xs text-muted-foreground">
            Review and govern sensitive agent operations, external writes, and critical workflow pauses in {activeWorkspace.name}.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-2">
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((tab) => (
          <button
            key={tab}
            onClick={() => setFilterState(tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterState === tab
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            {tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <LoadingState message="Loading approval requests..." />
        </div>
      ) : approvals.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <UserCheck className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-foreground">No approval requests found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm">
            {filterState === 'PENDING'
              ? 'No agent executions are currently blocked waiting for approval.'
              : `No approvals match the current filter (${filterState}).`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((req) => (
            <div
              key={req.id}
              className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 md:flex-row md:items-center md:justify-between"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {getStatusBadge(req.state)}
                  <span className="text-xs font-mono font-medium text-foreground bg-accent/50 px-2 py-0.5 rounded">
                    {req.actionType || 'GENERIC_ACTION'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Target: {req.entityType} ({req.entityId?.slice(0, 8)}...)
                  </span>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-3">
                  <span>Created: {new Date(req.createdAt).toLocaleString()}</span>
                  {req.executionId && (
                    <span className="font-mono text-[11px]">Exec: {req.executionId.slice(0, 8)}</span>
                  )}
                  {req.requester?.name && (
                    <span>By: {req.requester.name}</span>
                  )}
                </div>
                {req.comment && (
                  <p className="text-xs italic text-muted-foreground bg-muted/30 p-2 rounded border border-border/50">
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
                  <Eye className="h-3.5 w-3.5" />
                  Inspect Payload
                </Button>
                {req.state === 'PENDING' && (
                  <>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1.5 text-xs"
                      onClick={() => decideMutation.mutate({ id: req.id, decision: 'REJECTED', reason: 'Rejected via studio' })}
                      disabled={decideMutation.isPending}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => decideMutation.mutate({ id: req.id, decision: 'APPROVED', reason: 'Approved via studio' })}
                      disabled={decideMutation.isPending}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inspector / Decision Dialog */}
      <Dialog open={!!selectedApproval} onOpenChange={(open) => !open && setSelectedApproval(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-500" />
              Approval Request Details
            </DialogTitle>
          </DialogHeader>

          {selectedApproval && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-accent/30 rounded-lg border border-border">
                <div>
                  <div className="text-muted-foreground">Action</div>
                  <div className="font-semibold text-foreground">{selectedApproval.actionType}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div>{getStatusBadge(selectedApproval.state)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Entity</div>
                  <div className="font-mono">{selectedApproval.entityType}: {selectedApproval.entityId}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Execution ID</div>
                  <div className="font-mono">{selectedApproval.executionId || 'N/A'}</div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Proposed Payload / Parameters
                </label>
                <pre className="max-h-60 overflow-y-auto rounded-lg border border-border bg-muted/50 p-3 font-mono text-[11px] text-foreground">
                  {JSON.stringify(selectedApproval.proposedPayload || {}, null, 2)}
                </pre>
              </div>

              {selectedApproval.state === 'PENDING' && (
                <div className="space-y-2 border-t border-border pt-4">
                  <label className="text-xs font-semibold text-foreground block">
                    Decision Reason / Comment (Optional)
                  </label>
                  <input
                    type="text"
                    value={decisionReason}
                    onChange={(e) => setDecisionReason(e.target.value)}
                    placeholder="Provide rationale for approval or rejection..."
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => decideMutation.mutate({
                        id: selectedApproval.id,
                        decision: 'REJECTED',
                        reason: decisionReason || 'Rejected by user',
                      })}
                      disabled={decideMutation.isPending}
                    >
                      <ThumbsDown className="mr-1.5 h-3.5 w-3.5" />
                      Reject Execution
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => decideMutation.mutate({
                        id: selectedApproval.id,
                        decision: 'APPROVED',
                        reason: decisionReason || 'Approved by user',
                      })}
                      disabled={decideMutation.isPending}
                    >
                      <ThumbsUp className="mr-1.5 h-3.5 w-3.5" />
                      Approve & Resume
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

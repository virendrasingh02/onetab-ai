import type { AIApprovalRequest } from '@org/types';
import {
  AIRunStatusBadge,
  Badge,
  Button,
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  EmptyState,
  ErrorState,
  LoadingState,
  SegmentedControl,
  Textarea,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { Check, ChevronDown, ShieldCheck, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { aiWorkspacePath } from './ai-workspace-routes.js';
import { useApprovals, useDecideApproval, useRunSubjects, useWorkspaceIds } from './use-ai-workspace.js';

const STATE_OPTIONS = [
  { value: 'PENDING', label: 'Waiting' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ALL', label: 'All' },
] as const;

/**
 * Actions an agent or a workflow paused on until a person decides. Only the
 * person the request was raised for (the agent's or workflow's creator — the
 * action would run as them) or an admin can decide; everyone else sees who it
 * is waiting on. Approving runs the action; for a workflow it resumes the run.
 */
export function AIApprovalsSection() {
  const { workspaceId, slug } = useWorkspaceIds();
  const [params, setParams] = useSearchParams();
  const state = params.get('state') || 'PENDING';
  const approvals = useApprovals(workspaceId, state === 'ALL' ? undefined : state);
  const subjects = useRunSubjects(workspaceId);
  const decide = useDecideApproval(workspaceId);

  return (
    <div className="space-y-4">
      <SegmentedControl
        aria-label="Filter approvals"
        size="sm"
        options={STATE_OPTIONS}
        value={state as (typeof STATE_OPTIONS)[number]['value']}
        onChange={(v) =>
          setParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              if (v === 'PENDING') next.delete('state');
              else next.set('state', v);
              return next;
            },
            { replace: true },
          )
        }
      />

      {approvals.isLoading ? (
        <LoadingState label="Loading approvals…" />
      ) : approvals.isError ? (
        <ErrorState title="Couldn't load approvals" onRetry={() => void approvals.refetch()} />
      ) : (approvals.data ?? []).length === 0 ? (
        <EmptyState
          icon={<ShieldCheck />}
          title={state === 'PENDING' ? 'Nothing is waiting for approval' : 'No approvals here'}
          description="When an agent tries an action its autonomy setting holds back, or a workflow reaches an approval step, it waits here."
        />
      ) : (
        <div className="space-y-3">
          {(approvals.data ?? []).map((approval) => (
            <ApprovalCard
              key={approval.id}
              approval={approval}
              subjectName={subjects.get(approval.entityId)?.name}
              subjectLink={
                approval.entityType === 'WORKFLOW'
                  ? aiWorkspacePath(slug, 'workflows', approval.entityId)
                  : aiWorkspacePath(slug, 'agents', approval.entityId)
              }
              runLink={
                approval.executionId ? `${aiWorkspacePath(slug, 'runs')}?run=${approval.executionId}` : null
              }
              deciding={decide.isPending && decide.variables?.id === approval.id}
              onDecide={(decision, comment) => decide.mutate({ id: approval.id, decision, comment })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ApprovalCard({
  approval,
  subjectName,
  subjectLink,
  runLink,
  deciding,
  onDecide,
}: {
  approval: AIApprovalRequest;
  subjectName?: string;
  subjectLink: string;
  runLink: string | null;
  deciding: boolean;
  onDecide: (decision: 'APPROVED' | 'REJECTED', comment?: string) => void;
}) {
  const [comment, setComment] = useState('');
  const payload = (approval.proposedPayload ?? {}) as Record<string, unknown>;
  const label =
    (typeof payload['actionLabel'] === 'string' && (payload['actionLabel'] as string)) || approval.actionType;
  const input = (payload['input'] as Record<string, unknown> | undefined) ?? (approval.entityType === 'WORKFLOW' ? payload : undefined);
  const isWorkflow = approval.entityType === 'WORKFLOW';
  const pending = approval.state === 'PENDING';

  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isWorkflow ? 'Workflow' : approval.entityType === 'coworker' ? 'Coworker' : 'Agent'}{' '}
            <Link to={subjectLink} className="font-medium text-foreground underline-offset-2 hover:underline">
              {subjectName ?? 'a deleted item'}
            </Link>{' '}
            asked {formatRelative(approval.createdAt)}
            {approval.requester ? ` on behalf of ${approval.requester.name}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pending ? (
            <AIRunStatusBadge status="WAITING_APPROVAL" />
          ) : (
            <Badge variant={approval.state === 'APPROVED' ? 'success' : 'neutral'} className="text-[10px]">
              {approval.state.toLowerCase()}
              {approval.approver ? ` by ${approval.approver.name}` : ''}
            </Badge>
          )}
          {runLink ? (
            <Link to={runLink} className="text-xs text-primary underline-offset-2 hover:underline">
              View run
            </Link>
          ) : null}
        </div>
      </div>

      {input && Object.keys(input).length > 0 ? (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ChevronDown className="size-3.5" /> What it will do with
          </CollapsibleTrigger>
          <CollapsibleContent>
            <pre className="mt-2 max-h-56 overflow-auto rounded-lg border border-border bg-surface-inset p-3 font-mono text-xs text-foreground">
              {JSON.stringify(input, null, 2)}
            </pre>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {approval.comment ? (
        <p className="rounded-lg bg-surface-inset p-2 text-xs text-muted-foreground">“{approval.comment}”</p>
      ) : null}

      {pending && approval.canDecide ? (
        <div className="space-y-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a note (optional)"
            rows={2}
            aria-label={`Note for ${label}`}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              leadingIcon={<Check />}
              loading={deciding}
              onClick={() => onDecide('APPROVED', comment.trim() || undefined)}
            >
              {isWorkflow ? 'Approve and continue' : 'Approve and run'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              leadingIcon={<X />}
              disabled={deciding}
              onClick={() => onDecide('REJECTED', comment.trim() || undefined)}
            >
              Reject
            </Button>
          </div>
        </div>
      ) : pending ? (
        <p className="text-xs text-muted-foreground">
          Waiting on {approval.requester?.name ?? "the item's creator"} or a workspace admin.
        </p>
      ) : null}
    </Card>
  );
}

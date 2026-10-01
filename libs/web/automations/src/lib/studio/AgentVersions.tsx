import { describeAgentScope, describeTriggerShort, type AgentProfile, type StudioAgentDetail } from '@org/types';
import {
  Badge,
  Button,
  Card,
  confirm,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@org/ui';
import { formatDateTime, formatRelative } from '@org/utils';
import { GitCompare, History, Rocket, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useAgentVersion, useAgentVersions, useStudioMutations } from './use-studio.js';

interface Change {
  kind: 'added' | 'removed' | 'changed';
  text: string;
}

/** How the current plan differs from an older version, step by step. */
export function comparePlans(older: AgentProfile | null, current: AgentProfile | null): Change[] {
  if (!older || !current) return [];
  const changes: Change[] = [];
  if (describeTriggerShort(older.trigger) !== describeTriggerShort(current.trigger)) {
    changes.push({ kind: 'changed', text: `Runs: ${describeTriggerShort(older.trigger)} → ${describeTriggerShort(current.trigger)}` });
  }
  const olderSteps = new Map(older.steps.map((s) => [s.id, s]));
  const currentSteps = new Map(current.steps.map((s) => [s.id, s]));
  for (const s of current.steps) {
    const was = olderSteps.get(s.id);
    if (!was) changes.push({ kind: 'added', text: `Step “${s.title}”` });
    else if (JSON.stringify(was) !== JSON.stringify(s)) changes.push({ kind: 'changed', text: `Step “${s.title}”` });
  }
  for (const s of older.steps) if (!currentSteps.has(s.id)) changes.push({ kind: 'removed', text: `Step “${s.title}”` });
  for (const scope of current.scopes) if (!older.scopes.includes(scope)) changes.push({ kind: 'added', text: `Permission: ${describeAgentScope(scope).label}` });
  for (const scope of older.scopes) if (!current.scopes.includes(scope)) changes.push({ kind: 'removed', text: `Permission: ${describeAgentScope(scope).label}` });
  if (JSON.stringify(older.output) !== JSON.stringify(current.output)) changes.push({ kind: 'changed', text: 'Where the result goes' });
  if (older.name !== current.name) changes.push({ kind: 'changed', text: `Name: ${older.name} → ${current.name}` });
  return changes;
}

/**
 * Every saved version of the agent — what changed, when, and which one runs
 * on its trigger — with compare, roll back and publish.
 */
export function AgentVersions({ workspaceId, agent, canManage }: { workspaceId: string | undefined; agent: StudioAgentDetail; canManage: boolean }) {
  const versions = useAgentVersions(workspaceId, agent.id);
  const { restoreVersion, publish } = useStudioMutations(workspaceId);
  const [comparing, setComparing] = useState<number | null>(null);

  if (versions.isLoading) return <LoadingState label="Loading versions…" />;
  if (versions.isError) return <ErrorState title="Couldn't load versions" onRetry={() => void versions.refetch()} />;
  const list = versions.data ?? [];
  const latestPublished = list.find((v) => v.isPublished)?.versionNumber ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Every save is a version. {latestPublished ? `v${latestPublished} is what runs on the trigger.` : 'Nothing is published yet — switching it on publishes a version.'}
        </p>
        {canManage ? (
          <Button size="sm" variant="outline" leadingIcon={<Rocket />} loading={publish.isPending} onClick={() => publish.mutate(agent.id)}>
            Publish current plan
          </Button>
        ) : null}
      </div>
      {list.length === 0 ? (
        <EmptyState size="sm" icon={<History />} title="No versions yet" />
      ) : (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {list.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="w-10 shrink-0 font-mono text-sm font-semibold text-foreground">v{v.versionNumber}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-foreground">{v.changeSummary ?? 'Snapshot'}</p>
                <p className="text-xs text-muted-foreground" title={formatDateTime(v.createdAt)}>
                  {formatRelative(v.createdAt)}
                </p>
              </div>
              {v.isPublished ? (
                <Badge variant={v.versionNumber === latestPublished ? 'success' : 'neutral'} className="text-[10px]">
                  {v.versionNumber === latestPublished ? 'Live' : 'Published'}
                </Badge>
              ) : null}
              <div className="flex gap-1">
                <Button variant="ghost" size="xs" leadingIcon={<GitCompare />} onClick={() => setComparing(v.versionNumber)}>
                  Compare
                </Button>
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="xs"
                    leadingIcon={<RotateCcw />}
                    loading={restoreVersion.isPending && restoreVersion.variables?.version === v.versionNumber}
                    onClick={async () => {
                      const ok = await confirm({
                        title: `Roll back to v${v.versionNumber}?`,
                        description: 'The plan, steps and permissions go back to how they were. The current plan stays in the history.',
                        confirmLabel: 'Roll back',
                      });
                      if (ok) restoreVersion.mutate({ id: agent.id, version: v.versionNumber });
                    }}
                  >
                    Roll back
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
        </Card>
      )}
      <CompareDialog workspaceId={workspaceId} agent={agent} version={comparing} onClose={() => setComparing(null)} />
    </div>
  );
}

function CompareDialog({
  workspaceId,
  agent,
  version,
  onClose,
}: {
  workspaceId: string | undefined;
  agent: StudioAgentDetail;
  version: number | null;
  onClose: () => void;
}) {
  const older = useAgentVersion(workspaceId, agent.id, version);
  const changes = comparePlans(older.data?.profile ?? null, agent.profile);
  return (
    <Dialog open={version !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>v{version} compared with now</DialogTitle>
          <DialogDescription>What changed in the plan since this version.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          {older.isLoading ? (
            <LoadingState label="Loading version…" />
          ) : !older.data?.profile || !agent.profile ? (
            <p className="text-sm text-muted-foreground">This version has no plan to compare — it was saved on the canvas.</p>
          ) : changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No differences — the plan is the same as in v{version}.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {changes.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Badge variant={c.kind === 'added' ? 'success' : c.kind === 'removed' ? 'destructive' : 'info'} className="w-16 shrink-0 justify-center text-[10px]">
                    {c.kind}
                  </Badge>
                  <span className="text-foreground">{c.text}</span>
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

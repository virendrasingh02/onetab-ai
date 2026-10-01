import { ApiError } from '@org/api-client';
import {
  AGENT_KINDS,
  describeAgentScope,
  describeTriggerShort,
  type AgentBlueprint,
  type StudioAgentDetail,
} from '@org/types';
import {
  ActionDropdownMenu,
  AIRunStatusBadge,
  Badge,
  Button,
  Card,
  confirm,
  EmptyState,
  ErrorState,
  LoadingState,
  ResponsiveTabsList,
  Tabs,
  TabsTrigger,
  toast,
  UserAvatar,
} from '@org/ui';
import { cn, formatDateTime, formatRelative } from '@org/utils';
import {
  aiWorkspacePath,
  errorText,
  mainPath,
  nodeLabel,
  RunDetailPanel,
  studioAgentPath,
  useAIRuns,
  useAIRunUpdates,
} from '@org/web-ai';
import { useCanManageAIResource, useCurrentWorkspace, useWorkspacePermission } from '@org/web-workspace';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  FlaskConical,
  History,
  Info,
  LayoutList,
  MessageSquare,
  MoreHorizontal,
  Pause,
  Play,
  Power,
  Save,
  Settings2,
  Undo2,
  Workflow,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { buildAgentActions } from './agent-actions.js';
import { AgentChat } from './AgentChat.js';
import { AgentVersions } from './AgentVersions.js';
import { PlanEditor } from './plan-editor/PlanEditor.js';
import { AgentStateBadge, formatUpcoming, KIND_ICON } from './studio-meta.js';
import { TestRunDialog } from './TestRunDialog.js';
import { useStudioAgent, useStudioCatalog, useStudioMutations } from './use-studio.js';

type Tab = 'overview' | 'chat' | 'plan' | 'runs' | 'versions' | 'settings';

const TABS: ReadonlyArray<{ id: Tab; label: string; icon: typeof Activity }> = [
  { id: 'overview', label: 'Overview', icon: Info },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'plan', label: 'Plan', icon: LayoutList },
  { id: 'runs', label: 'Runs', icon: Activity },
  { id: 'versions', label: 'Versions', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

/**
 * One agent: what it does and how it's doing, a chat to ask it things, its
 * plan to edit, every run with its steps, its versions and its settings.
 */
export function AgentDetailPage() {
  const { workflowId } = useParams<{ workflowId: string }>();
  const { workspaceId, slug } = useCurrentWorkspace();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { can } = useWorkspacePermission();
  const canManageResource = useCanManageAIResource();
  const agent = useStudioAgent(workspaceId, workflowId);
  const mutations = useStudioMutations(workspaceId);
  const [testOpen, setTestOpen] = useState(false);
  useAIRunUpdates(workspaceId);
  const tab = (params.get('tab') as Tab) || 'overview';
  const setTab = (next: Tab) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === 'overview') p.delete('tab');
        else p.set('tab', next);
        if (next !== 'runs') p.delete('run');
        return p;
      },
      { replace: true },
    );

  if (agent.isLoading) return <LoadingState fullPage label="Loading agent…" />;
  if (agent.isError || !agent.data) {
    return (
      <div className="p-6">
        <ErrorState
          title="Couldn't load this agent"
          description={agent.error ? errorText(agent.error) : undefined}
          onRetry={() => void agent.refetch()}
          action={
            <Button variant="outline" asChild>
              <Link to={aiWorkspacePath(slug, 'agents')}>Back to agents</Link>
            </Button>
          }
        />
      </div>
    );
  }
  const data = agent.data;
  const canManage = canManageResource(data.owner?.id ?? null);
  const Icon = KIND_ICON[data.kind] ?? KIND_ICON.workflow;
  const blockedReason = data.blockers.length ? data.blockers.join(' ') : undefined;
  const runAndShow = (mode: 'live' | 'test') =>
    mutations.run.mutateAsync({ id: data.id, mode }).then((started) => {
      setParams({ tab: 'runs', run: started.runId }, { replace: true });
    });
  const actions = buildAgentActions(data, {
    canManage,
    canCreate: can('create'),
    onDuplicate: () => mutations.duplicate.mutateAsync(data.id).then((copy) => navigate(studioAgentPath(slug, copy.id))),
    onOpenCanvas: () => navigate(aiWorkspacePath(slug, 'workflows', data.id)),
    onArchive: () => mutations.setState.mutateAsync({ id: data.id, state: 'archived' }),
    onRestore: () => mutations.setState.mutateAsync({ id: data.id, state: 'draft' }),
    onDelete: () => mutations.remove.mutateAsync(data.id).then(() => navigate(aiWorkspacePath(slug, 'agents'))),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex min-h-12 flex-wrap items-center gap-2 px-3 py-1.5 sm:px-6">
          <Button variant="ghost" size="icon-sm" asChild aria-label="Back to agents">
            <Link to={aiWorkspacePath(slug, 'agents')}>
              <ArrowLeft />
            </Link>
          </Button>
          <span aria-hidden className={cn('flex size-7 items-center justify-center rounded-lg [&_svg]:size-4', data.state === 'active' ? 'bg-primary/10 text-primary' : 'bg-surface-raised text-muted-foreground')}>
            <Icon />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-foreground">{data.name}</h1>
            <p className="flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
              <AgentStateBadge state={data.state} />
              {describeTriggerShort(data.trigger)}
              {data.nextRunAt ? ` · next ${formatUpcoming(data.nextRunAt)}` : ''}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {can('create') && data.state !== 'archived' ? (
              <>
                {data.isStudioAgent ? (
                  <Button variant="outline" size="sm" leadingIcon={<FlaskConical />} onClick={() => setTestOpen(true)}>
                    Test
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant={data.state === 'active' || data.trigger.kind === 'manual' ? 'primary' : 'outline'}
                  leadingIcon={<Play />}
                  loading={mutations.run.isPending}
                  disabled={Boolean(blockedReason)}
                  title={blockedReason}
                  onClick={() => void runAndShow('live')}
                >
                  Run now
                </Button>
              </>
            ) : null}
            {canManage && data.state !== 'archived' ? (
              data.state === 'active' ? (
                <Button variant="outline" size="sm" leadingIcon={<Pause />} loading={mutations.setState.isPending} onClick={() => mutations.setState.mutate({ id: data.id, state: 'paused' })}>
                  Pause
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant={data.trigger.kind === 'manual' ? 'outline' : 'primary'}
                  leadingIcon={<Power />}
                  loading={mutations.setState.isPending}
                  disabled={Boolean(blockedReason)}
                  title={blockedReason ?? (data.trigger.kind === 'manual' ? 'Publishes a version' : 'Runs on its trigger from now on')}
                  onClick={() => mutations.setState.mutate({ id: data.id, state: 'active' })}
                >
                  Switch on
                </Button>
              )
            ) : null}
            <ActionDropdownMenu
              actions={actions}
              entityType="agent"
              entity={data}
              trigger={
                <Button variant="ghost" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              }
            />
          </div>
        </div>
        <div className="border-t border-border/40 bg-surface-muted/30 px-3 sm:px-6">
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
            <ResponsiveTabsList variant="underline" size="sm" aria-label="Agent sections" className="w-full border-b-0">
              {TABS.map(({ id, label, icon: TabIcon }) => (
                <TabsTrigger key={id} value={id} icon={<TabIcon className="size-3.5" aria-hidden />}>
                  {label}
                </TabsTrigger>
              ))}
            </ResponsiveTabsList>
          </Tabs>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn('mx-auto w-full space-y-4 p-3 sm:p-6', tab === 'runs' ? 'max-w-6xl' : 'max-w-4xl')}>
          {data.blockers.length && tab !== 'plan' ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm">
              <span className="flex items-start gap-2 text-foreground">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <span>
                  <span className="font-medium">Needs your input before it can run:</span> {data.blockers.join(' ')}
                </span>
              </span>
              <Button size="sm" variant="outline" onClick={() => setTab('plan')}>
                Open the plan
              </Button>
            </div>
          ) : null}
          {tab === 'overview' ? <Overview workspaceId={workspaceId} slug={slug} agent={data} onTab={setTab} /> : null}
          {tab === 'chat' ? <AgentChat workspaceId={workspaceId} slug={slug} agent={data} /> : null}
          {tab === 'plan' ? <PlanTab workspaceId={workspaceId} slug={slug} agent={data} canManage={canManage} /> : null}
          {tab === 'runs' ? <RunsTab workspaceId={workspaceId} slug={slug} agent={data} /> : null}
          {tab === 'versions' ? <AgentVersions workspaceId={workspaceId} agent={data} canManage={canManage} /> : null}
          {tab === 'settings' ? <SettingsTab workspaceId={workspaceId} slug={slug} agent={data} canManage={canManage} /> : null}
        </div>
      </div>

      {data.isStudioAgent ? <TestRunDialog workspaceId={workspaceId} slug={slug} agent={data} open={testOpen} onOpenChange={setTestOpen} /> : null}
    </div>
  );
}

function Overview({
  workspaceId,
  slug,
  agent,
  onTab,
}: {
  workspaceId: string | undefined;
  slug: string | undefined;
  agent: StudioAgentDetail;
  onTab: (tab: Tab) => void;
}) {
  const profile = agent.profile;
  return (
    <div className="space-y-4">
      <Card className="space-y-4 p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {agent.kind === 'workflow' ? 'Workflow' : AGENT_KINDS[agent.kind]?.label}
          </p>
          <p className="mt-1 text-sm text-foreground">{profile?.objective || agent.description || 'No objective written yet.'}</p>
        </div>
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Detail label="Runs">
            {describeTriggerShort(agent.trigger)}
            {agent.trigger.kind === 'schedule' && agent.trigger.timezone ? ` (${agent.trigger.timezone})` : ''}
            {agent.nextRunAt ? <span className="block text-xs text-muted-foreground">Next {formatUpcoming(agent.nextRunAt)}</span> : null}
          </Detail>
          <Detail label="Works from">{profile?.context.length ? profile.context.join(', ') : `${agent.stepCount} steps`}</Detail>
          {profile ? (
            <Detail label="Result">
              {
                { run: 'Shown in the run', doc: 'Saved as a doc', channel: `Posted in #${profile.output.channelSlug ?? '…'}`, notification: 'Sent to you as a notification' }[
                  profile.output.destination
                ]
              }
            </Detail>
          ) : null}
          {profile ? (
            <Detail label="May">
              {profile.scopes.length ? profile.scopes.map((s) => describeAgentScope(s).label).join(', ') : 'Only think — no tools'}
            </Detail>
          ) : null}
          <Detail label="Runs so far">
            {agent.runCount} {agent.recentFailures ? <Badge variant="destructive" className="ml-1 text-[10px]">{agent.recentFailures} failed today</Badge> : null}
          </Detail>
          {agent.owner ? (
            <Detail label="Owner">
              <span className="inline-flex items-center gap-1.5">
                <UserAvatar name={agent.owner.name} src={agent.owner.avatarUrl ?? undefined} seed={agent.owner.id} size="xs" indicator={false} />
                {agent.isMine ? 'You' : agent.owner.name}
              </span>
            </Detail>
          ) : null}
        </dl>
        {agent.canvasEdited ? (
          <p className="flex items-start gap-2 rounded-lg bg-surface-inset p-2.5 text-xs text-muted-foreground">
            <Workflow className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            This agent was changed on the workflow canvas after its plan was saved. The canvas version is what runs.
          </p>
        ) : null}
      </Card>

      <section aria-labelledby="latest-run" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 id="latest-run" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {agent.lastRun ? `Latest run · ${formatRelative(agent.lastRun.startedAt)}` : 'Latest run'}
          </h2>
          {agent.lastRun ? (
            <Button variant="ghost" size="sm" onClick={() => onTab('runs')}>
              All runs
            </Button>
          ) : null}
        </div>
        {agent.lastRun ? (
          <Card className="p-4">
            <RunDetailPanel
              workspaceId={workspaceId}
              slug={slug}
              runId={agent.lastRun.id}
              graph={{ nodes: agent.nodes, edges: agent.edges }}
              permissionsHref={studioAgentPath(slug, agent.id, 'plan')}
            />
          </Card>
        ) : (
          <EmptyState
            size="sm"
            icon={<Play />}
            title="It hasn’t run yet"
            description="Test it first — it reads your real data but changes nothing — or run it for real."
          />
        )}
      </section>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground">{children}</dd>
    </div>
  );
}

function PlanTab({
  workspaceId,
  slug,
  agent,
  canManage,
}: {
  workspaceId: string | undefined;
  slug: string | undefined;
  agent: StudioAgentDetail;
  canManage: boolean;
}) {
  const catalog = useStudioCatalog(workspaceId);
  const { update } = useStudioMutations(workspaceId);
  const [draft, setDraft] = useState<AgentBlueprint | null>(agent.profile);
  // A fresh copy after a save, a rollback or an update from elsewhere.
  useEffect(() => setDraft(agent.profile), [agent.profile]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(agent.profile), [draft, agent.profile]);

  if (!agent.profile || !draft) {
    const steps = mainPath({ nodes: agent.nodes, edges: agent.edges });
    return (
      <Card className="space-y-3 p-4">
        <p className="text-sm text-foreground">This workflow was built on the canvas, so it has no plan to edit here. Its steps, in order:</p>
        <ol className="space-y-1 pl-5 text-sm text-foreground">
          {steps.map((n) => (
            <li key={n.id} className="list-decimal">
              {nodeLabel(n, n.id)}
            </li>
          ))}
        </ol>
        <Button asChild variant="outline" size="sm" leadingIcon={<Workflow />}>
          <Link to={aiWorkspacePath(slug, 'workflows', agent.id)}>Open the canvas</Link>
        </Button>
      </Card>
    );
  }

  const save = (overwriteCanvasEdits = false) =>
    update.mutate(
      { id: agent.id, blueprint: draft, overwriteCanvasEdits },
      {
        onSuccess: () => toast.success('Plan saved', { description: 'A new version was recorded.' }),
        onError: async (err) => {
          if (err instanceof ApiError && err.status === 409) {
            const ok = await confirm({
              title: 'Replace the canvas edits?',
              description: 'This agent was changed on the workflow canvas since its plan was saved. Saving the plan rebuilds the workflow from it; the canvas version stays in the history.',
              confirmLabel: 'Save the plan',
            });
            if (ok) save(true);
            return;
          }
          toast.error('Could not save the plan', { description: errorText(err) });
        },
      },
    );

  return (
    <div className="space-y-4 pb-24">
      <PlanEditor
        workspaceId={workspaceId}
        value={draft}
        onChange={setDraft}
        catalog={catalog.data}
        readOnlyReason={canManage ? undefined : 'Only the agent’s owner or a workspace admin can change its plan.'}
      />
      {canManage && dirty ? (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-border bg-background/95 p-3 shadow-sm backdrop-blur-md">
          <span className="mr-auto text-xs text-muted-foreground">Unsaved changes to the plan.</span>
          <Button variant="ghost" leadingIcon={<Undo2 />} onClick={() => setDraft(agent.profile)}>
            Discard
          </Button>
          <Button leadingIcon={<Save />} loading={update.isPending} onClick={() => save()}>
            Save plan
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RunsTab({ workspaceId, slug, agent }: { workspaceId: string | undefined; slug: string | undefined; agent: StudioAgentDetail }) {
  const [params, setParams] = useSearchParams();
  const runs = useAIRuns(workspaceId, { entityType: 'WORKFLOW', entityId: agent.id, limit: 50 });
  const selected = params.get('run') ?? runs.data?.[0]?.id ?? null;
  const select = (id: string) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set('tab', 'runs');
        p.set('run', id);
        return p;
      },
      { replace: true },
    );

  if (runs.isLoading) return <LoadingState label="Loading runs…" />;
  if ((runs.data ?? []).length === 0) {
    return <EmptyState icon={<Activity />} title="No runs yet" description="Runs appear here the moment they start, step by step." />;
  }
  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="max-h-[70vh] divide-y divide-border overflow-y-auto p-0" role="list" aria-label="Runs">
        {(runs.data ?? []).map((run) => {
          const state = (run.stateJson ?? {}) as Record<string, unknown>;
          const asked = (state['input'] as { text?: string } | undefined)?.text;
          return (
            <button
              key={run.id}
              role="listitem"
              type="button"
              onClick={() => select(run.id)}
              aria-current={run.id === selected ? 'true' : undefined}
              className={cn(
                'flex w-full flex-col gap-1 px-3 py-2.5 text-left transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none',
                run.id === selected && 'bg-selected',
              )}
            >
              <span className="flex items-center gap-2">
                <AIRunStatusBadge status={run.status} />
                {state['__mode'] === 'test' ? <Badge variant="info" className="text-[10px]">Test</Badge> : null}
                <span className="ml-auto text-[11px] text-muted-foreground">{formatRelative(run.startedAt)}</span>
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {asked || { schedule: 'On schedule', event: 'On an event', retry: 'Ran again' }[String(state['__startedBy'])] || 'Run'}
              </span>
            </button>
          );
        })}
      </Card>
      {selected ? (
        <Card className="min-w-0 p-4">
          <RunDetailPanel
            workspaceId={workspaceId}
            slug={slug}
            runId={selected}
            graph={{ nodes: agent.nodes, edges: agent.edges }}
            permissionsHref={studioAgentPath(slug, agent.id, 'plan')}
          />
        </Card>
      ) : null}
    </div>
  );
}

function SettingsTab({
  workspaceId,
  slug,
  agent,
  canManage,
}: {
  workspaceId: string | undefined;
  slug: string | undefined;
  agent: StudioAgentDetail;
  canManage: boolean;
}) {
  const navigate = useNavigate();
  const { setState, duplicate, remove } = useStudioMutations(workspaceId);
  const { can } = useWorkspacePermission();
  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-foreground">Status</h2>
        <p className="text-sm text-muted-foreground">
          {agent.state === 'active'
            ? `On — runs ${describeTriggerShort(agent.trigger).toLowerCase()}. Published v${agent.publishedVersion}.`
            : agent.state === 'paused'
              ? 'Paused — it doesn’t run on its trigger. You can still run it by hand.'
              : agent.state === 'archived'
                ? 'Archived — out of the library and never runs.'
                : 'Draft — never switched on.'}
        </p>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {agent.state === 'archived' ? (
              <Button variant="outline" size="sm" onClick={() => setState.mutate({ id: agent.id, state: 'draft' })}>
                Restore
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setState.mutate({ id: agent.id, state: 'archived' })}>
                Archive
              </Button>
            )}
          </div>
        ) : null}
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-foreground">Details</h2>
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Detail label="Created">{formatDateTime(agent.createdAt)}</Detail>
          <Detail label="Last changed">{formatDateTime(agent.updatedAt)}</Detail>
          <Detail label="Owner">{agent.owner?.name ?? 'Unknown'}</Detail>
          <Detail label="Agent id">
            <code className="text-xs">{agent.id}</code>
          </Detail>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" leadingIcon={<Workflow />}>
            <Link to={aiWorkspacePath(slug, 'workflows', agent.id)}>Open the workflow canvas</Link>
          </Button>
          {can('create') ? (
            <Button
              variant="outline"
              size="sm"
              loading={duplicate.isPending}
              onClick={() => duplicate.mutate(agent.id, { onSuccess: (copy) => navigate(studioAgentPath(slug, copy.id)) })}
            >
              Duplicate
            </Button>
          ) : null}
        </div>
      </Card>

      {canManage ? (
        <Card className="space-y-3 border-destructive/30 p-4">
          <h2 className="text-sm font-semibold text-foreground">Delete</h2>
          <p className="text-sm text-muted-foreground">Deletes the plan, versions and schedule. Past runs stay in Runs.</p>
          <Button
            variant="destructive"
            size="sm"
            loading={remove.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: `Delete “${agent.name}”?`,
                description: 'This can’t be undone.',
                confirmLabel: 'Delete agent',
                destructive: true,
                requireText: agent.name,
              });
              if (ok) remove.mutate(agent.id, { onSuccess: () => navigate(aiWorkspacePath(slug, 'agents')) });
            }}
          >
            Delete agent
          </Button>
        </Card>
      ) : null}
    </div>
  );
}

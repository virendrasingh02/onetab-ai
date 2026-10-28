import type { CoworkerRoster, CoworkerRosterEntry, CoworkerStatus, RosterConnector } from '@org/types';
import {
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  LoadingState,
  Page,
  PageHeader,
  Progress,
  confirm,
  toast,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { AgentBuilderOptionsProvider, AIEntityAvatar } from '@org/web-agents';
import { CoworkerCreateDialog, ProviderModelFields, useCoworker, useCoworkerMutations, useCoworkerRoster } from '@org/web-coworkers';
import { useCanManageAIResource, useCreationPolicies, useWorkspacePermission } from '@org/web-workspace';
import {
  Activity,
  Bot,
  ChevronDown,
  Cpu,
  ExternalLink,
  GitBranch,
  Link2,
  MessageSquare,
  Pause,
  Plug,
  Plus,
  Rocket,
  Settings2,
  ShieldCheck,
  Unlink,
  Users,
} from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { WEB_APP_URL } from '../auth-redirect.js';
import {
  AIEntityFacts,
  AIEntityHeader,
  AIEntityOwner,
  aiEntityStatusLabel,
  plural,
  type AIEntityFact,
  type AIEntityStatus,
} from '../components/common/ai-entity-summary.js';
import { AppConnectorIcon } from '../components/common/app-connector-icon.jsx';
import { useNavigate } from '../router.js';
import { useStudioSession } from '../session-guard.js';

const STATE_LABEL: Record<RosterConnector['state'], string> = {
  attached: 'Attached',
  ready_to_attach: 'Ready to attach',
  needs_reconnect: 'Reconnect',
  needs_connection: 'Not connected',
  not_set_up: 'Needs OAuth app',
  unavailable: 'Not available',
};

const STATE_VARIANT: Record<RosterConnector['state'], 'success' | 'info' | 'warning' | 'neutral' | 'destructive'> = {
  attached: 'success',
  ready_to_attach: 'info',
  needs_reconnect: 'warning',
  needs_connection: 'neutral',
  not_set_up: 'neutral',
  unavailable: 'neutral',
};

const ADOPTED_LABEL: Record<string, string> = { finance: 'Finance', developer: 'Developer', hr: 'HR', project_manager: 'Project Manager' };

const number = new Intl.NumberFormat();
const limitText = (n: number) => (n === -1 ? 'Custom' : number.format(n));

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * AI Coworkers: each one an Orchestrator over specialist agents and app
 * connectors. Every count, state and metric comes from the roster API.
 */
export function CoworkersPage() {
  const { activeWorkspace } = useStudioSession();
  const roster = useCoworkerRoster(activeWorkspace.id);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const { can } = useWorkspacePermission();
  // Settings → Permissions & Policies → "Who can create AI Coworkers"; the server re-checks it.
  const { canCreateCoworkers } = useCreationPolicies(activeWorkspace.id);
  const canCreate = can('create') && canCreateCoworkers;
  const coworkers = roster.data?.coworkers ?? [];

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allOpen = coworkers.length > 0 && coworkers.every((c) => expanded.has(c.id));

  return (
    <Page>
      <PageHeader
        title="AI Coworkers"
        description="Each coworker is an orchestrator: it plans the work, hands reasoning to its specialist agents and acts through the app connectors attached to it. Writes, sends and money moves wait for approval."
        icon={<Users />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {coworkers.length ? (
              <Button size="sm" variant="outline" onClick={() => setExpanded(allOpen ? new Set() : new Set(coworkers.map((c) => c.id)))}>
                {allOpen ? 'Collapse all' : 'Expand all'}
              </Button>
            ) : null}
            {canCreate ? (
              <Button size="sm" leadingIcon={<Plus />} onClick={() => setCreateOpen(true)}>
                New coworker
              </Button>
            ) : null}
          </div>
        }
      />
      <CoworkerCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        workspaceId={activeWorkspace.id}
        // Open the new one so its apps and specialists can be added straight away.
        onCreated={(id) => setExpanded((prev) => new Set(prev).add(id))}
      />

      {roster.isLoading ? (
        <LoadingState label="Loading coworkers…" />
      ) : roster.isError ? (
        <ErrorState title="Couldn’t load coworkers" description={errorText(roster.error, 'Try again in a moment.')} onRetry={() => void roster.refetch()} />
      ) : coworkers.length === 0 ? (
        <EmptyState icon={<Users />} title="No coworkers yet" description="Default coworkers are created the first time this page loads for a workspace. Reload to try again." />
      ) : (
        <div className="space-y-4">
          {roster.data ? <PlanStrip plan={roster.data.plan} coworkers={coworkers} /> : null}
          <ul className="space-y-3" aria-label="Coworkers">
            {coworkers.map((c) => (
              <li key={c.id}>
                <CoworkerCard
                  coworker={c}
                  connectable={roster.data?.connectableApps ?? []}
                  workspaceId={activeWorkspace.id}
                  slug={activeWorkspace.slug}
                  open={expanded.has(c.id)}
                  onToggle={() => toggle(c.id)}
                />
              </li>
            ))}
          </ul>
          {roster.data ? (
            <p className="text-xs text-muted-foreground">Updated {formatRelative(roster.data.generatedAt)} · refreshes when a coworker run finishes.</p>
          ) : null}
        </div>
      )}
    </Page>
  );
}

/** The plan's shared allocation — every coworker draws on the same pool. */
function PlanStrip({ plan, coworkers }: { plan: CoworkerRoster['plan']; coworkers: CoworkerRosterEntry[] }) {
  const runsPct = plan.requestsPerMonth > 0 ? (plan.aiRunsThisMonth / plan.requestsPerMonth) * 100 : 0;
  const concurrencyPct = plan.concurrentExecutions > 0 ? (plan.runningNow / plan.concurrentExecutions) * 100 : 0;
  const live = coworkers.filter((c) => c.isActive).length;
  const attached = coworkers.reduce((n, c) => n + c.connectors.filter((x) => x.state === 'attached').length, 0);
  return (
    <Card className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Coworkers live" value={`${live} of ${coworkers.length}`} hint={`${attached} connector${attached === 1 ? '' : 's'} attached`} />
      <div className="space-y-1.5">
        <Stat label="AI runs this month" value={`${number.format(plan.aiRunsThisMonth)} / ${limitText(plan.requestsPerMonth)}`} hint={`${plan.name} plan · all agents, coworkers and workflows`} />
        {plan.requestsPerMonth > 0 ? <Progress value={runsPct} size="sm" accent={runsPct >= 90 ? 'rose' : undefined} label={`${Math.round(runsPct)}% of monthly requests used`} /> : null}
      </div>
      <div className="space-y-1.5">
        <Stat label="Running now" value={`${plan.runningNow} / ${limitText(plan.concurrentExecutions)}`} hint="Concurrent executions" />
        {plan.concurrentExecutions > 0 ? <Progress value={concurrencyPct} size="sm" label={`${plan.runningNow} of ${plan.concurrentExecutions} concurrent runs`} /> : null}
      </div>
      <Stat
        label="Machine allocation"
        value={plan.cpu === -1 ? 'Custom' : `${plan.cpu} vCPU · ${plan.ramGb} GB`}
        hint={plan.maxExecutionTimeMs === -1 ? 'Shared across coworkers · custom run time' : `Shared across coworkers · ${plan.maxExecutionTimeMs} ms per step`}
        icon={<Cpu />}
      />
    </Card>
  );
}

function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 truncate text-base font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function statusOf(c: CoworkerRosterEntry): AIEntityStatus {
  if (!c.isActive) return 'paused';
  if (c.status === 'ERROR') return 'error';
  if (c.status === 'WORKING' || c.status === 'RUNNING_TASK') return 'working';
  return 'live';
}

/**
 * Edits a coworker in Studio with the same dialog the main app uses (identity,
 * persona, model, tools, specialists). Loads the full record only when opened.
 */
function CoworkerConfigureDialog({ coworkerId, workspaceId, onClose }: { coworkerId: string; workspaceId: string; onClose: () => void }) {
  const detail = useCoworker(workspaceId, coworkerId);
  useEffect(() => {
    if (detail.isError) {
      toast.error('Couldn’t load this coworker', { description: errorText(detail.error, 'Try again in a moment.') });
      onClose();
    }
  }, [detail.isError, detail.error, onClose]);
  if (!detail.data) return null;
  return <CoworkerCreateDialog open onOpenChange={(open) => !open && onClose()} workspaceId={workspaceId} coworker={detail.data} />;
}

/** Same facts, same order as a My Agents card: tools, apps, then what's specific to a coworker. */
function coworkerFacts(c: CoworkerRosterEntry): AIEntityFact[] {
  const attached = c.connectors.filter((x) => x.state === 'attached').length;
  const facts: AIEntityFact[] = [
    { label: plural(c.orchestrator.tools, 'tool'), value: c.orchestrator.tools, muted: !c.orchestrator.tools },
    { label: c.connectors.length ? 'apps attached' : 'apps', value: c.connectors.length ? `${attached}/${c.connectors.length}` : 0, muted: !attached },
    { label: plural(c.specialists.length, 'specialist'), value: c.specialists.length, muted: !c.specialists.length },
    { label: plural(c.workflows.length, 'workflow'), value: c.workflows.length, muted: !c.workflows.length },
    { label: 'runs · 30d', value: number.format(c.activity.runs30d), muted: !c.activity.runs30d },
  ];
  if (c.activity.waitingApproval) facts.push({ label: 'awaiting approval', value: c.activity.waitingApproval });
  return facts;
}

function CoworkerCard({
  coworker: c,
  connectable,
  workspaceId,
  slug,
  open,
  onToggle,
}: {
  coworker: CoworkerRosterEntry;
  connectable: RosterConnector[];
  workspaceId: string;
  slug: string;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  const status = statusOf(c);
  const attached = c.connectors.filter((x) => x.state === 'attached');
  const { can } = useWorkspacePermission();
  const canManage = useCanManageAIResource()(c.creatorId) && can('update');
  const [configureOpen, setConfigureOpen] = useState(false);
  return (
    <Card className="overflow-hidden p-0">
      {configureOpen ? <CoworkerConfigureDialog coworkerId={c.id} workspaceId={workspaceId} onClose={() => setConfigureOpen(false)} /> : null}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${c.name}, ${c.role}, ${aiEntityStatusLabel(status)}. ${attached.length} of ${c.connectors.length} apps attached. ${open ? 'Collapse' : 'Expand'} details`}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-surface-raised/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <AIEntityHeader
          avatar={<AIEntityAvatar name={c.name} type="coworker" avatarUrl={c.avatarUrl} status={c.status as CoworkerStatus} showStatusDot={false} size="md" />}
          name={c.name}
          kind="Coworker"
          role={c.role}
          status={status}
          model={c.model}
          provider={c.provider}
          badges={c.adoptedFrom ? <Badge variant="outline" className="text-2xs">Was {ADOPTED_LABEL[c.adoptedFrom] ?? c.adoptedFrom}</Badge> : null}
        >
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <AIEntityFacts facts={coworkerFacts(c)} />
            <AIEntityOwner owner={c.owner} />
          </span>
          {c.connectors.length ? (
            // Spans, not a list: a button may only hold phrasing content. The button's label carries the summary.
            <span className="flex flex-wrap gap-1.5" aria-hidden>
              {c.connectors.map((x) => (
                <span
                  key={x.provider}
                  title={`${x.name}: ${STATE_LABEL[x.state]}`}
                  className={`flex size-7 items-center justify-center rounded-md border bg-surface-raised ${x.state === 'attached' ? 'border-success/40' : 'border-border opacity-50 grayscale'}`}
                >
                  <AppConnectorIcon connectorId={x.provider.toLowerCase()} name={x.name} category={x.category ?? ''} size={15} />
                </span>
              ))}
            </span>
          ) : null}
        </AIEntityHeader>
        <ChevronDown aria-hidden className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div id={panelId} className="min-w-0 space-y-5 border-t border-border p-4">
          <OrchestratorPanel coworker={c} workspaceId={workspaceId} slug={slug} onConfigure={() => setConfigureOpen(true)} />
          <div className="grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
            <SpecialistsSection coworker={c} onConfigure={canManage ? () => setConfigureOpen(true) : undefined} />
            <ConnectorsSection coworker={c} connectable={connectable} workspaceId={workspaceId} />
          </div>
          <WorkflowsSection coworker={c} slug={slug} />
          <MetricsSection coworker={c} slug={slug} />
        </div>
      ) : null}
    </Card>
  );
}

function SectionTitle({ icon, children, aside }: { icon: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground [&_svg]:size-3.5">
        {icon}
        {children}
      </h3>
      {aside}
    </div>
  );
}

/** Model, launch state and what the orchestrator itself may do. */
function OrchestratorPanel({
  coworker: c,
  workspaceId,
  slug,
  onConfigure,
}: {
  coworker: CoworkerRosterEntry;
  workspaceId: string;
  slug: string;
  onConfigure: () => void;
}) {
  const { can } = useWorkspacePermission();
  const canManage = useCanManageAIResource()(c.creatorId) && can('update');
  const mutations = useCoworkerMutations(workspaceId);
  const [provider, setProvider] = useState(c.provider ?? '');
  const [model, setModel] = useState(c.model ?? '');
  const dirty = provider !== (c.provider ?? '') || model !== (c.model ?? '');

  const saveModel = () =>
    mutations.update.mutate(
      // Only what changed; an empty value is a real choice ("default"), which the runtime reads as such.
      {
        coworkerId: c.id,
        input: {
          ...(provider !== (c.provider ?? '') ? { provider } : {}),
          ...(model !== (c.model ?? '') ? { model } : {}),
        },
      },
      {
        onSuccess: () =>
          toast.success(
            model
              ? `${c.name} now uses ${model}`
              : provider
                ? `${c.name} now uses ${provider}’s default model`
                : `${c.name} now uses the workspace default model`,
          ),
        onError: (error) => toast.error('Couldn’t change the model', { description: errorText(error, '') }),
      },
    );

  const setLive = async (isActive: boolean) => {
    if (!isActive) {
      const ok = await confirm({
        title: `Pause ${c.name}?`,
        description: 'It stops answering in chat, workflows that call it fail at that step, and its scheduled work waits until you launch it again.',
        confirmLabel: 'Pause',
        tone: 'warning',
      });
      if (!ok) return;
    }
    mutations.update.mutate(
      { coworkerId: c.id, input: { isActive } },
      {
        onSuccess: () => toast.success(isActive ? `${c.name} is live` : `${c.name} is paused`),
        onError: (error) => toast.error(isActive ? 'Couldn’t launch' : 'Couldn’t pause', { description: errorText(error, '') }),
      },
    );
  };

  return (
    <section aria-label="Orchestrator" className="rounded-lg border border-border bg-surface-raised/40 p-3">
      <SectionTitle
        icon={<Bot />}
        aside={
          <div className="flex flex-wrap items-center gap-2">
            {/* Chat lives in the main app; say so instead of silently leaving Studio. */}
            <Button asChild size="sm" variant="ghost" leadingIcon={<MessageSquare />} trailingIcon={<ExternalLink />}>
              <a href={`${WEB_APP_URL}/w/${slug}/coworkers/${c.id}`} target="_blank" rel="noreferrer">
                Chat
              </a>
            </Button>
            {canManage ? (
              <Button size="sm" variant="ghost" leadingIcon={<Settings2 />} onClick={onConfigure}>
                Configure
              </Button>
            ) : null}
            {canManage ? (
              c.isActive ? (
                <Button size="sm" variant="outline" leadingIcon={<Pause />} loading={mutations.update.isPending} onClick={() => void setLive(false)}>
                  Pause
                </Button>
              ) : (
                <Button size="sm" leadingIcon={<Rocket />} loading={mutations.update.isPending} onClick={() => void setLive(true)}>
                  Launch
                </Button>
              )
            ) : null}
          </div>
        }
      >
        Orchestrator
      </SectionTitle>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] [&>*]:min-w-0">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <dt className="text-muted-foreground">Platform tools</dt>
          <dd className="tabular-nums text-foreground">{c.orchestrator.tools}</dd>
          <dt className="text-muted-foreground">Granted writes</dt>
          <dd className="tabular-nums text-foreground">{c.orchestrator.grantedWrites}</dd>
          <dt className="text-muted-foreground">Hands work to</dt>
          <dd className="text-foreground">{c.orchestrator.collaborators.length ? c.orchestrator.collaborators.map((x) => x.name).join(', ') : 'Nobody'}</dd>
          <dt className="text-muted-foreground">Channels</dt>
          <dd className="tabular-nums text-foreground">{c.channels}</dd>
          <dt className="col-span-2 flex items-center gap-1.5 pt-1 text-muted-foreground">
            <ShieldCheck className="size-3.5 text-success" aria-hidden />
            App writes, sends, deletes and payments always wait for approval.
          </dt>
        </dl>
        {canManage ? (
          <AgentBuilderOptionsProvider workspaceId={workspaceId}>
            <div className="space-y-2">
              <ProviderModelFields
                provider={provider}
                model={model}
                onProviderChange={(v) => {
                  setProvider(v);
                  setModel('');
                }}
                onModelChange={setModel}
              />
              {dirty ? (
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => { setProvider(c.provider ?? ''); setModel(c.model ?? ''); }}>
                    Cancel
                  </Button>
                  <Button size="sm" loading={mutations.update.isPending} onClick={saveModel}>
                    Save model
                  </Button>
                </div>
              ) : null}
            </div>
          </AgentBuilderOptionsProvider>
        ) : (
          <p className="text-xs text-muted-foreground">
            Model: <span className="text-foreground">{c.model ?? c.provider ?? 'Workspace default'}</span>
          </p>
        )}
      </div>
    </section>
  );
}

function SpecialistsSection({ coworker: c, onConfigure }: { coworker: CoworkerRosterEntry; onConfigure?: () => void }) {
  return (
    <section aria-label="Specialist agents">
      <SectionTitle
        icon={<Bot />}
        aside={
          onConfigure ? (
            <Button size="sm" variant="ghost" leadingIcon={<Settings2 />} onClick={onConfigure}>
              Manage
            </Button>
          ) : undefined
        }
      >
        Specialist agents ({c.specialists.length})
      </SectionTitle>
      {c.specialists.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          None yet. The orchestrator answers on its own.{onConfigure ? ' Use Manage to link agents it can hand specialised work to.' : ''}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {c.specialists.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2 text-xs">
              <AIEntityAvatar name={s.name} type="agent" size="xs" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-medium text-foreground">{s.name}</span> <span className="text-muted-foreground">· {s.role}</span>
              </span>
              {!s.isActive ? <Badge variant="neutral" className="text-2xs">Off</Badge> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Connector agents: one canonical connection per app, attached to as many coworkers as need it. */
function ConnectorsSection({ coworker: c, connectable, workspaceId }: { coworker: CoworkerRosterEntry; connectable: RosterConnector[]; workspaceId: string }) {
  const navigate = useNavigate();
  const { can } = useWorkspacePermission();
  const canManage = useCanManageAIResource()(c.creatorId) && can('update');
  const mutations = useCoworkerMutations(workspaceId);
  const [busy, setBusy] = useState<string | null>(null);
  const ready = c.connectors.filter((x) => x.state === 'ready_to_attach' && x.integrationId);
  // Template apps already have their own row and Attach button.
  const addable = connectable.filter((x) => !c.connectors.some((y) => y.provider === x.provider));

  const attach = async (list: RosterConnector[]) => {
    setBusy(list.length > 1 ? '*' : list[0]?.provider ?? null);
    let done = 0;
    for (const x of list) {
      try {
        await mutations.linkApp.mutateAsync({ coworkerId: c.id, integrationId: x.integrationId as string });
        done++;
      } catch (error) {
        toast.error(`Couldn’t attach ${x.name}`, { description: errorText(error, '') });
      }
    }
    setBusy(null);
    if (done) toast.success(`${c.name} can now use ${done === 1 ? list[0].name : `${done} apps`}`, { description: 'Reads run directly; anything that changes data asks for approval.' });
  };

  const detach = async (x: RosterConnector) => {
    const ok = await confirm({
      title: `Detach ${x.name} from ${c.name}?`,
      description: `${c.name} loses its ${x.name} tools. The connection itself stays${x.sharedWith.length ? ` and ${x.sharedWith.map((s) => s.name).join(', ')} keep${x.sharedWith.length === 1 ? 's' : ''} using it` : ''}.`,
      confirmLabel: 'Detach',
      tone: 'warning',
    });
    if (!ok) return;
    setBusy(x.provider);
    mutations.unlinkApp.mutate(
      { coworkerId: c.id, integrationId: x.integrationId as string },
      {
        onSettled: () => setBusy(null),
        onSuccess: () => toast.success(`Detached ${x.name}`),
        onError: (error) => toast.error(`Couldn’t detach ${x.name}`, { description: errorText(error, '') }),
      },
    );
  };

  const action = (x: RosterConnector) => {
    if (!canManage && x.state !== 'needs_connection' && x.state !== 'not_set_up') return null;
    switch (x.state) {
      case 'attached':
        return (
          <Button size="sm" variant="ghost" leadingIcon={<Unlink />} loading={busy === x.provider} onClick={() => void detach(x)} aria-label={`Detach ${x.name}`}>
            Detach
          </Button>
        );
      case 'ready_to_attach':
        return (
          <Button size="sm" variant="outline" leadingIcon={<Link2 />} loading={busy === x.provider} onClick={() => void attach([x])} aria-label={`Attach ${x.name}`}>
            Attach
          </Button>
        );
      case 'needs_reconnect':
      case 'needs_connection':
      case 'not_set_up':
        return can('update') ? (
          <Button size="sm" variant="ghost" leadingIcon={<Plug />} onClick={() => navigate(`/connectors/${x.provider.toLowerCase()}`)} aria-label={`${x.state === 'not_set_up' ? 'Set up' : 'Connect'} ${x.name}`}>
            {x.state === 'needs_reconnect' ? 'Reconnect' : x.state === 'not_set_up' ? 'Set up' : 'Connect'}
          </Button>
        ) : null;
      default:
        return null;
    }
  };

  return (
    <section aria-label="Connector agents">
      <SectionTitle
        icon={<Plug />}
        aside={
          canManage ? (
            <div className="flex flex-wrap items-center gap-1">
              {ready.length > 1 ? (
                <Button size="sm" variant="ghost" loading={busy === '*'} onClick={() => void attach(ready)}>
                  Attach all ready ({ready.length})
                </Button>
              ) : null}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" leadingIcon={<Plus />} loading={busy !== null && addable.some((x) => x.provider === busy)} aria-label={`Add an app to ${c.name}`}>
                    Add app
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-80 w-72 overflow-y-auto">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Connected apps</DropdownMenuLabel>
                  {addable.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">Every connected app is already on {c.name}.</p>
                  ) : (
                    addable.map((x) => (
                      <DropdownMenuItem key={x.provider} onSelect={() => void attach([x])} className="gap-2 text-xs">
                        <AppConnectorIcon connectorId={x.provider.toLowerCase()} name={x.name} category={x.category ?? ''} size={15} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium text-foreground">{x.name}</span>
                          <span className="block truncate text-muted-foreground">
                            {x.readActions} read · {x.writeActions} write
                            {x.connectionScope === 'USER' ? ' · personal' : ''}
                          </span>
                        </span>
                      </DropdownMenuItem>
                    ))
                  )}
                  {can('update') ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => navigate('/connectors')} className="gap-2 text-xs">
                        <Plug className="size-3.5" /> Connect another app…
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : undefined
        }
      >
        Connector agents ({c.connectors.filter((x) => x.state === 'attached').length}/{c.connectors.length})
      </SectionTitle>
      {c.connectors.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
          No apps for this coworker yet.{canManage ? ' Use Add app to attach a connected app.' : ''}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {c.connectors.map((x) => (
            <li key={x.provider} className="flex flex-wrap items-center gap-2 rounded-md border border-border px-2.5 py-2 text-xs">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised">
                <AppConnectorIcon connectorId={x.provider.toLowerCase()} name={x.name} category={x.category ?? ''} size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-foreground">{x.name}</span>
                  <Badge variant={STATE_VARIANT[x.state]} className="text-2xs">{STATE_LABEL[x.state]}</Badge>
                  {!x.fromTemplate ? <Badge variant="outline" className="text-2xs">Added</Badge> : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {x.state === 'unavailable' || x.state === 'not_set_up'
                    ? x.reason
                    : [
                        x.connectionLabel ? `${x.connectionLabel}${x.connectionScope === 'USER' ? ' (personal)' : ''}` : null,
                        `${x.readActions} read · ${x.writeActions} write${x.triggers ? ` · ${x.triggers} trigger${x.triggers === 1 ? '' : 's'}` : ''}`,
                        x.sharedWith.length ? `shared with ${x.sharedWith.map((s) => s.name).join(', ')}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                </p>
              </div>
              {action(x)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function WorkflowsSection({ coworker: c, slug }: { coworker: CoworkerRosterEntry; slug: string }) {
  const navigate = useNavigate();
  const shared = c.workflows.filter((w) => w.sharedWith.length).length;
  return (
    <section aria-label="Workflows">
      <SectionTitle icon={<GitBranch />}>
        Workflows ({c.workflows.length}
        {shared ? ` · ${shared} shared` : ''})
      </SectionTitle>
      {c.workflows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No workflow calls {c.name} yet. Add an “AI coworker” step on the canvas to group work under it.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {c.workflows.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => navigate(`/w/${slug}/ai/workflows/${w.id}`)}
                className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className={`size-1.5 rounded-full ${w.isActive ? 'bg-success' : 'bg-muted-foreground/50'}`} aria-hidden />
                <span className="text-foreground">{w.name}</span>
                <span className="sr-only">{w.isActive ? '(on)' : '(off)'}</span>
                {w.sharedWith.length ? <span className="text-muted-foreground">· with {w.sharedWith.map((s) => s.name).join(', ')}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MetricsSection({ coworker: c, slug }: { coworker: CoworkerRosterEntry; slug: string }) {
  const navigate = useNavigate();
  const a = c.activity;
  const items: Array<{ label: string; value: string }> = [
    { label: 'Runs · 30 days', value: number.format(a.runs30d) },
    { label: 'Failed · 30 days', value: number.format(a.failed30d) },
    { label: 'Awaiting approval', value: number.format(a.waitingApproval) },
    { label: 'Runs this month', value: number.format(a.runsThisMonth) },
    { label: 'Open tasks', value: number.format(a.openTasks) },
    { label: 'Tasks done · 30 days', value: number.format(a.completedTasks30d) },
    { label: 'Tokens · 30 days', value: number.format(a.tokens30d) },
    { label: 'Avg run time', value: a.avgLatencyMs === null ? '—' : a.avgLatencyMs >= 1000 ? `${(a.avgLatencyMs / 1000).toFixed(1)} s` : `${a.avgLatencyMs} ms` },
    { label: 'Deployments', value: c.deployments.total ? `${c.deployments.active} active / ${c.deployments.total}` : 'None' },
    { label: 'Last run', value: a.lastRunAt ? formatRelative(a.lastRunAt) : 'Never' },
  ];
  return (
    <section aria-label="Usage and execution">
      <SectionTitle
        icon={<Activity />}
        aside={
          <div className="flex gap-1">
            {a.waitingApproval ? (
              <Button size="sm" variant="ghost" leadingIcon={<ShieldCheck />} onClick={() => navigate(`/w/${slug}/ai/approvals`)}>
                Approvals
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" leadingIcon={<ExternalLink />} onClick={() => navigate(`/w/${slug}/ai/runs?type=COWORKER&entity=${c.id}`)}>
              Execution history
            </Button>
          </div>
        }
      >
        Usage & execution
      </SectionTitle>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((m) => (
          <div key={m.label} className="rounded-md border border-border px-2.5 py-2">
            <dt className="truncate text-xs text-muted-foreground">{m.label}</dt>
            <dd className="text-sm font-semibold tabular-nums text-foreground">{m.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

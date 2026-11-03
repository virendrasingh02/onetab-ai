import { agentStudioApi, agentsApi, queryKeys } from '@org/api-client';
import { agentService } from '../services/agentService.js';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PageSection,
  StatCard,
  AIModelBadge,
  toast,
  CodeInput,
  Input,
  SegmentedControl,
  ToggleGroup,
  ToggleGroupItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  ErrorState,
} from '@org/ui';
import { StudioHome, useAgentFavorites } from '@org/web-automations';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  DollarSign,
  Gauge,
  Grid,
  Layers,
  LayoutList,
  Pin,
  Plus,
  Search,
  Sparkles,
  Trophy,
  Upload,
  Wand2,
  Wrench,
  Home,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { formatRelative } from '@org/utils';
import { Link, useNavigate } from '../router.js';
import { useStudioSession } from '../session-guard.js';
import { StudioPage } from '../components/studio-page.js';

/** Tools arrive as an array once normalized, or as the API's JSON string. */
function countTools(tools: string | unknown[] | null | undefined): number {
  if (!tools) return 0;
  if (Array.isArray(tools)) return tools.length;
  try {
    const parsed: unknown = JSON.parse(tools);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

const DAY_MS = 86_400_000;
// The rate the platform's credit ledger charges (AIRuntimeService).
const COST_PER_TOKEN = 0.000002;

const formatTokens = (v: number) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(1)}M`
    : v >= 1000
      ? `${(v / 1000).toFixed(1)}k`
      : String(v);

/**
 * The single Studio landing page: the plan-first home (greeting + "plan it" box,
 * running / needs-you / coming up) followed by workspace-wide performance and the
 * agent directory.
 */
export function StudioHomePage() {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  return (
    <StudioPage
        icon={<Home />}
        title="Studio Home"
        description={`What your agents are doing in ${activeWorkspace.name} — and what to build next.`}
        className="space-y-8"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/templates')}
              className="gap-1.5"
            >
              <Layers className="size-3.5" /> Templates
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/create')}
              className="gap-1.5"
            >
              <Wand2 className="size-3.5" /> Create with AI
            </Button>
          </>
        }
      >
      <StudioInsights home={<StudioHome showComposer={false} />} />
    </StudioPage>
  );
}

interface JourneyStep {
  id: string;
  title: string;
  hint: string;
  done: boolean;
  to: string;
  cta: string;
}

/** Create → test → publish, driven by what the workspace has actually done. */
function GettingStarted({ steps }: { steps: JourneyStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const nextId = steps.find((s) => !s.done)?.id;
  return (
    <section
      aria-labelledby="journey-heading"
      className="p-4 sm:p-5 rounded-xl border border-border bg-surface"
    >
      <div className="gap-2 flex items-center justify-between">
        <h2
          id="journey-heading"
          className="text-sm font-semibold text-foreground"
        >
          Get your first agent live
        </h2>
        <span className="text-xs text-muted-foreground">
          {doneCount} of {steps.length} done
        </span>
      </div>
      <ol className="mt-3 gap-2 sm:grid-cols-3 grid">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className={`gap-2 p-3 flex flex-col justify-between rounded-xl border ${
              step.id === nextId
                ? 'border-foreground/30 bg-selected'
                : 'border-border/60 bg-surface-raised/40'
            }`}
          >
            <div className="gap-2 flex items-start">
              {step.done ? (
                <CheckCircle2
                  className="mt-0.5 size-4 shrink-0 text-success"
                  aria-hidden
                />
              ) : (
                <span
                  className="mt-0.5 size-4 font-semibold flex shrink-0 items-center justify-center rounded-full border border-border text-2xs text-muted-foreground"
                  aria-hidden
                >
                  {i + 1}
                </span>
              )}
              <div className="min-w-0">
                <div
                  className={`text-xs font-semibold ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                >
                  {step.title}
                  <span className="sr-only">{step.done ? ' — done' : ''}</span>
                </div>
                <p className="text-xs text-muted-foreground">{step.hint}</p>
              </div>
            </div>
            {!step.done && (
              <Button
                size="xs"
                variant={step.id === nextId ? 'primary' : 'outline'}
                asChild
                className="self-start"
              >
                <Link to={step.to}>
                  {step.cta} <ArrowRight className="size-3" />
                </Link>
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** `home` (today's activity) sits under the getting-started checklist, so a new workspace sees its next step first. */
function StudioInsights({ home }: { home: React.ReactNode }) {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'published' | 'draft' | 'archived'
  >('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  // Pins are the member's server-side agent favorites — shared with the in-app Studio, synced across devices.
  const { favorites: pinnedSet, toggle: toggleFavorite } = useAgentFavorites(
    activeWorkspace.id,
  );
  const pinnedAgentIds = useMemo(() => [...pinnedSet], [pinnedSet]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  const {
    data: agents = [],
    isLoading: isLoadingAgents,
    isError: agentsFailed,
    refetch: refetchAgents,
  } = useQuery({
    queryKey: ['agents', activeWorkspace.id],
    queryFn: () => agentsApi.list(activeWorkspace.id),
  });

  const { data: plannedAgents = [], isLoading: isLoadingPlanned } = useQuery({
    queryKey: queryKeys.agentStudio.list(activeWorkspace.id),
    queryFn: () => agentStudioApi.list(activeWorkspace.id),
  });

  const {
    data: logs = [],
    isLoading: isLoadingLogs,
    isError: logsFailed,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['workspace-logs', activeWorkspace.id],
    queryFn: () => agentsApi.workspaceLogs(activeWorkspace.id),
  });

  const togglePinAgent = (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast.success(
      pinnedSet.has(agentId) ? 'Agent unpinned' : 'Agent pinned to top',
    );
    toggleFavorite(agentId);
  };

  const statusOf = (a: (typeof agents)[number]): string =>
    (a.configuration as any)?.status ?? 'draft';
  const publishedAgents = agents.filter((a) => statusOf(a) === 'published');
  const archivedAgents = agents.filter((a) => statusOf(a) === 'archived');
  const draftAgents =
    agents.length - publishedAgents.length - archivedAgents.length;

  // Agents made from the planner or a template live in the plan-first library, not
  // in `agents`; the journey has to count both or it never moves past step one.
  const plannedLive = plannedAgents.filter((a) => !a.archivedAt);
  const plannedFirst = plannedLive.find((a) => !a.isActive) ?? plannedLive[0];
  const firstDraft =
    agents.find(
      (a) => statusOf(a) !== 'published' && statusOf(a) !== 'archived',
    ) ?? agents[0];
  const draftHref = firstDraft
    ? `/agents/${firstDraft.id}`
    : plannedFirst
      ? `/studio/${plannedFirst.id}`
      : null;
  const journey: JourneyStep[] = [
    {
      id: 'create',
      title: 'Create an agent',
      hint: 'Describe it in plain words — Studio plans and builds it.',
      done: agents.length > 0 || plannedLive.length > 0,
      to: '/create',
      cta: 'Create with AI',
    },
    {
      id: 'test',
      title: 'Run a test',
      hint: 'Watch each step run before anything goes live.',
      done:
        logs.length > 0 ||
        plannedLive.some((a) => a.runCount > 0 || a.lastRun !== null),
      to: firstDraft
        ? `/agents/${firstDraft.id}?copilot=1&test=1`
        : plannedFirst
          ? `/studio/${plannedFirst.id}?tab=runs`
          : '/create',
      cta: 'Run a test',
    },
    {
      id: 'publish',
      title: plannedFirst && !firstDraft ? 'Switch it on' : 'Publish it',
      hint:
        plannedFirst && !firstDraft
          ? 'Let it run on its schedule or trigger, not just when you test it.'
          : 'Make it callable by API, widget or schedule.',
      done:
        publishedAgents.length > 0 ||
        plannedLive.some((a) => a.isActive || a.publishedVersion !== null),
      to: draftHref ?? '/create',
      cta: 'Open the agent',
    },
  ];

  const totalTokens = logs.reduce((acc, l) => acc + (l.tokensUsed || 0), 0);
  const successfulRuns = logs.filter((l) => l.status === 'SUCCESS').length;
  const failedRuns = logs.filter((l) => l.status === 'FAILED').length;
  // No runs yet is "no rate", not 100%.
  const successRate =
    logs.length > 0
      ? `${Math.round((successfulRuns / logs.length) * 100)}%`
      : '—';
  const avgTokens = logs.length > 0 ? Math.round(totalTokens / logs.length) : 0;

  // Runs per day for the last 7 days (oldest → newest).
  const weekly = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getTime() - (6 - i) * DAY_MS);
      return {
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        from: d.getTime(),
        ok: 0,
        failed: 0,
      };
    });
    for (const l of logs) {
      const t = new Date(l.executedAt).getTime();
      const day = days.find((d) => t >= d.from && t < d.from + DAY_MS);
      if (!day) continue;
      if (l.status === 'SUCCESS') day.ok += 1;
      else if (l.status === 'FAILED') day.failed += 1;
    }
    return days;
  }, [logs]);
  const weekMax = Math.max(1, ...weekly.map((d) => d.ok + d.failed));
  const weekTotal = weekly.reduce((n, d) => n + d.ok + d.failed, 0);

  // Per-agent usage, busiest first.
  const perAgent = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        runs: number;
        ok: number;
        tokens: number;
        last: string;
      }
    >();
    for (const l of logs) {
      const id = l.agent?.id ?? l.agentId;
      const row = map.get(id) ?? {
        id,
        name: l.agent?.name ?? 'Deleted agent',
        runs: 0,
        ok: 0,
        tokens: 0,
        last: l.executedAt,
      };
      row.runs += 1;
      if (l.status === 'SUCCESS') row.ok += 1;
      row.tokens += l.tokensUsed || 0;
      if (l.executedAt > row.last) row.last = l.executedAt;
      map.set(id, row);
    }
    return [...map.values()].sort((a, b) => b.runs - a.runs);
  }, [logs]);
  const lastRunByAgent = useMemo(
    () => new Map(perAgent.map((r) => [r.id, r])),
    [perAgent],
  );

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents
      .filter((a) => {
        const status = (a.configuration as any)?.status ?? 'draft';
        if (statusFilter !== 'all' && status !== statusFilter) return false;
        if (
          q &&
          !a.name.toLowerCase().includes(q) &&
          !(a.description || '').toLowerCase().includes(q) &&
          !(a.role || '').toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          Number(pinnedAgentIds.includes(b.id)) -
          Number(pinnedAgentIds.includes(a.id)),
      );
  }, [agents, statusFilter, search, pinnedAgentIds]);

  const handleImportJson = async () => {
    try {
      const parsed = JSON.parse(importJsonText);
      const importedName = parsed.name || 'Imported Agent Workflow';
      const newAgent = await agentService.createAgent(activeWorkspace.id, {
        name: importedName,
        role: 'Imported Agent',
        description: `Imported on ${new Date().toLocaleDateString()}`,
        graphJson: JSON.stringify({
          nodes: parsed.nodes || [],
          edges: parsed.edges || [],
        }),
      });
      queryClient.invalidateQueries({
        queryKey: ['agents', activeWorkspace.id],
      });
      setIsImportModalOpen(false);
      setImportJsonText('');
      toast.success(`Imported "${importedName}"!`);
      navigate(`/agents/${newAgent.id}`);
    } catch {
      toast.error('Invalid JSON format');
    }
  };

  return (
    <div className="space-y-8">
      {agentsFailed && (
        <ErrorState
          title="Couldn’t load your agents"
          description="The platform didn’t answer. Try again in a moment."
          onRetry={() => void refetchAgents()}
        />
      )}
      {!isLoadingAgents && !isLoadingPlanned && !agentsFailed && (
        <GettingStarted steps={journey} />
      )}
      {home}
      <div className="gap-6 lg:grid-cols-3 grid grid-cols-1">
        <div className="space-y-4 lg:col-span-2">
          <PageSection
            title="Your agents"
            description={`${filteredAgents.length} of ${agents.length} shown`}
            actions={
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportModalOpen(true)}
                  className="gap-1.5"
                >
                  <Upload className="size-3.5" /> Import JSON
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate('/agents?create=blank')}
                  className="gap-1.5"
                >
                  <Plus className="size-3.5" /> New Agent
                </Button>
              </>
            }
          >
            <div className="gap-3 p-3 flex flex-wrap items-center justify-between rounded-xl border border-border bg-surface">
              <div className="gap-2 flex min-w-[200px] flex-1 items-center">
                <Search
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  type="search"
                  aria-label="Search agents"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search agents by name, role, or description…"
                  className="text-xs"
                />
              </div>
              <div className="gap-1.5 pl-3 flex items-center border-l border-border">
                <SegmentedControl
                  aria-label="Filter by status"
                  size="sm"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'published', label: 'Published' },
                    { value: 'draft', label: 'Draft' },
                    { value: 'archived', label: 'Archived' },
                  ]}
                />
                <div className="mx-1 h-4 w-px bg-border" />
                <ToggleGroup
                  type="single"
                  size="sm"
                  aria-label="View mode"
                  value={viewMode}
                  onValueChange={(v) => v && setViewMode(v as 'grid' | 'list')}
                >
                  <ToggleGroupItem
                    value="grid"
                    aria-label="Grid view"
                    title="Grid View"
                  >
                    <Grid className="size-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="list"
                    aria-label="List view"
                    title="List View"
                  >
                    <LayoutList className="size-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            <div className="mt-4">
              {filteredAgents.length === 0 ? (
                <div className="p-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 text-center text-muted-foreground">
                  <Bot
                    className="mb-2 size-12 text-muted-foreground/30"
                    aria-hidden
                  />
                  {agents.length === 0 && plannedLive.length > 0 ? (
                    <>
                      <div className="text-sm font-semibold text-foreground">
                        No canvas agents yet
                      </div>
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                        {plannedLive.length === 1
                          ? 'Your agent built from a plan is under Agents & Workflows → Planned.'
                          : `Your ${plannedLive.length} agents built from a plan are under Agents & Workflows → Planned.`}
                      </p>
                      <div className="mt-4 gap-2 flex flex-wrap justify-center">
                        <Button size="sm" asChild className="gap-1.5">
                          <Link to={`/w/${activeWorkspace.slug}/ai/agents`}>
                            <Sparkles className="size-3.5" /> Open planned
                            agents
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('/agents?create=blank')}
                          className="gap-1.5"
                        >
                          <Plus className="size-3.5" /> New canvas agent
                        </Button>
                      </div>
                    </>
                  ) : agents.length === 0 ? (
                    <>
                      <div className="text-sm font-semibold text-foreground">
                        No agents yet
                      </div>
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                        Describe what you want done and Studio will plan and
                        build the agent — or start from a template.
                      </p>
                      <div className="mt-4 gap-2 flex flex-wrap justify-center">
                        <Button
                          size="sm"
                          onClick={() => navigate('/create')}
                          className="gap-1.5"
                        >
                          <Wand2 className="size-3.5" /> Create with AI
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate('/templates')}
                          className="gap-1.5"
                        >
                          <Layers className="size-3.5" /> Browse templates
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-foreground">
                        No agents match
                      </div>
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                        Nothing fits the current search or status filter.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSearch('');
                          setStatusFilter('all');
                        }}
                        className="mt-4"
                      >
                        Clear filters
                      </Button>
                    </>
                  )}
                </div>
              ) : viewMode === 'grid' ? (
                <div className="gap-3 sm:grid-cols-2 grid grid-cols-1">
                  {filteredAgents.map((agent) => {
                    const config = (agent.configuration as any) || {};
                    const isPublished = config.status === 'published';
                    const isArchived = config.status === 'archived';
                    const version = config.currentVersion
                      ? `v${config.currentVersion}.0.0`
                      : 'v1.0.0-draft';
                    const toolsCount = countTools(agent.tools);
                    const isPinned = pinnedAgentIds.includes(agent.id);
                    const usage = lastRunByAgent.get(agent.id);

                    return (
                      <article
                        key={agent.id}
                        aria-labelledby={`agent-card-${agent.id}`}
                        className="group p-4 relative flex flex-col justify-between rounded-xl border border-border bg-surface transition-all focus-within:border-border-strong hover:border-border-strong hover:bg-surface-raised/40 hover:shadow-md"
                      >
                        <div>
                          <div className="gap-2 flex items-start justify-between">
                            <div className="gap-2.5 flex items-center">
                              <div
                                className="size-8 font-bold flex items-center justify-center rounded-lg bg-primary/10 text-primary"
                                aria-hidden
                              >
                                <Bot className="size-4" />
                              </div>
                              <div>
                                <h3 className="gap-1.5 text-xs font-bold flex items-center text-foreground transition-colors group-hover:text-primary">
                                  <Link
                                    id={`agent-card-${agent.id}`}
                                    to={`/agents/${agent.id}`}
                                    className="after:inset-0 rounded-sm after:absolute after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
                                  >
                                    {agent.name}
                                  </Link>
                                  {isPinned && (
                                    <>
                                      <Pin
                                        className="size-3 fill-warning text-warning"
                                        aria-hidden
                                      />
                                      <span className="sr-only">(pinned)</span>
                                    </>
                                  )}
                                </h3>
                                <div className="text-xs text-muted-foreground">
                                  {agent.role || 'Assistant'}
                                </div>
                              </div>
                            </div>
                            <div className="gap-1 flex items-center">
                              <button
                                type="button"
                                onClick={(e) => togglePinAgent(agent.id, e)}
                                title={isPinned ? 'Unpin' : 'Pin to top'}
                                aria-label={
                                  isPinned
                                    ? `Unpin ${agent.name}`
                                    : `Pin ${agent.name} to top`
                                }
                                aria-pressed={isPinned}
                                className={`size-6 p-1 relative z-10 cursor-pointer rounded-md transition-colors focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none ${
                                  isPinned
                                    ? 'text-warning hover:bg-warning/10'
                                    : 'text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-surface-raised hover:text-foreground'
                                }`}
                              >
                                <Pin className="size-3.5" aria-hidden />
                              </button>
                              <Badge
                                variant={isPublished ? 'success' : 'outline'}
                                className="text-2xs"
                              >
                                {isPublished
                                  ? 'Published'
                                  : isArchived
                                    ? 'Archived'
                                    : 'Draft'}
                              </Badge>
                            </div>
                          </div>
                          <p className="mt-3 text-xs line-clamp-2 text-muted-foreground">
                            {agent.description ||
                              agent.systemPrompt ||
                              'No description set'}
                          </p>
                        </div>

                        <div className="mt-4 space-y-2 pt-3 text-xs border-t border-border/60 text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>
                              {usage
                                ? `${usage.runs} ${usage.runs === 1 ? 'run' : 'runs'} · ${Math.round((usage.ok / usage.runs) * 100)}% ok · ${formatTokens(usage.tokens)} tokens`
                                : 'Never run'}
                            </span>
                            {usage && (
                              <span>
                                {new Date(usage.last).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono">{version}</span>
                            <div className="gap-2 flex items-center">
                              <span>
                                {toolsCount}{' '}
                                {toolsCount === 1 ? 'tool' : 'tools'}
                              </span>
                              <AIModelBadge
                                modelId={agent.model || 'llama3'}
                                variant="subtle"
                                size="xs"
                              />
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="px-4 py-3">Agent</TableHead>
                        <TableHead className="px-4 py-3">Status</TableHead>
                        <TableHead className="px-4 py-3">Model</TableHead>
                        <TableHead className="px-4 py-3">Tools</TableHead>
                        <TableHead className="px-4 py-3">Runs</TableHead>
                        <TableHead className="px-4 py-3">Success</TableHead>
                        <TableHead className="px-4 py-3">Tokens</TableHead>
                        <TableHead className="px-4 py-3 text-right">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAgents.map((agent) => {
                        const status = statusOf(agent);
                        const usage = lastRunByAgent.get(agent.id);
                        return (
                          <TableRow
                            key={agent.id}
                            onClick={() => navigate(`/agents/${agent.id}`)}
                            className="cursor-pointer transition-colors hover:bg-surface-raised/50"
                          >
                            <TableCell className="px-4 py-3">
                              <div className="gap-1.5 font-semibold flex items-center text-foreground">
                                <span>{agent.name}</span>
                                {pinnedAgentIds.includes(agent.id) && (
                                  <>
                                    <Pin
                                      className="size-3 fill-warning text-warning"
                                      aria-hidden
                                    />
                                    <span className="sr-only">(pinned)</span>
                                  </>
                                )}
                              </div>
                              <div className="max-w-xs text-xs truncate text-muted-foreground">
                                {agent.description ||
                                  agent.role ||
                                  'Workflow agent'}
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <Badge
                                variant={
                                  status === 'published' ? 'success' : 'outline'
                                }
                                className="text-2xs"
                              >
                                {status === 'published'
                                  ? 'Published'
                                  : status === 'archived'
                                    ? 'Archived'
                                    : 'Draft'}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <AIModelBadge
                                modelId={agent.model || 'llama3'}
                                variant="subtle"
                                size="xs"
                              />
                            </TableCell>
                            <TableCell className="px-4 py-3 text-muted-foreground">
                              {countTools(agent.tools)}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-muted-foreground">
                              {usage?.runs ?? 0}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-muted-foreground">
                              {usage
                                ? `${Math.round((usage.ok / usage.runs) * 100)}%`
                                : '—'}
                            </TableCell>
                            <TableCell className="px-4 py-3 font-mono text-muted-foreground">
                              {usage ? formatTokens(usage.tokens) : '—'}
                            </TableCell>
                            <TableCell className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/agents/${agent.id}`);
                                }}
                                aria-label={`Open ${agent.name} on the canvas`}
                                className="text-primary hover:text-primary"
                              >
                                Open{' '}
                                <ArrowRight className="size-3" aria-hidden />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </PageSection>

          <PageSection
            title="Recent executions"
            actions={
              <Link
                to="/executions"
                className="text-xs text-primary hover:underline"
              >
                View all executions ({logs.length})
              </Link>
            }
          >
            <div className="space-y-1.5 p-3 rounded-xl border border-border bg-surface">
              {isLoadingLogs ? (
                <div className="py-6 text-xs text-center text-muted-foreground">
                  Loading recent executions…
                </div>
              ) : logsFailed ? (
                <ErrorState
                  title="Couldn’t load recent executions"
                  onRetry={() => void refetchLogs()}
                />
              ) : logs.length === 0 ? (
                <div className="py-6 text-xs text-center text-muted-foreground">
                  No runs yet. Run a test from any agent and it shows up here.
                </div>
              ) : (
                <ul className="space-y-1.5" aria-label="Latest runs">
                  {logs.slice(0, 8).map((log) => {
                    const ok = log.status === 'SUCCESS';
                    return (
                      <li key={log.id}>
                        <Link
                          to={`/agents/${log.agent?.id ?? log.agentId}`}
                          className="gap-3 p-2.5 text-xs flex items-center justify-between rounded-lg border border-border/60 bg-surface-raised/40 transition-colors hover:border-border-strong hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          <span className="min-w-0 gap-2.5 flex items-center">
                            <span
                              className={`size-2 shrink-0 rounded-full ${ok ? 'bg-success' : 'bg-destructive'}`}
                              aria-hidden
                            />
                            <span className="font-semibold truncate text-foreground">
                              {log.agent?.name || 'Deleted agent'}
                            </span>
                            <span className="sm:inline hidden truncate text-muted-foreground">
                              {log.promptText || 'Test run'}
                            </span>
                          </span>
                          <span className="gap-3 flex shrink-0 items-center text-muted-foreground">
                            <time
                              dateTime={String(log.executedAt)}
                              title={new Date(log.executedAt).toLocaleString()}
                              className="sm:inline hidden"
                            >
                              {formatRelative(log.executedAt)}
                            </time>
                            <span className="font-mono tabular-nums">
                              {(log.tokensUsed ?? 0).toLocaleString()} tokens
                            </span>
                            <Badge
                              variant={ok ? 'success' : 'destructive'}
                              className="text-2xs"
                            >
                              {ok
                                ? 'Succeeded'
                                : log.status === 'FAILED'
                                  ? 'Failed'
                                  : String(log.status).charAt(0) +
                                    String(log.status).slice(1).toLowerCase()}
                            </Badge>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </PageSection>
        </div>

        <div className="space-y-4">
          <div className="space-y-2 p-4 rounded-xl border border-border bg-surface">
            <h3 className="gap-2 text-xs font-semibold flex items-center text-foreground">
              <Wrench className="size-3.5 text-primary" aria-hidden />
              Developer Resources
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Call any published agent via the REST API or deploy it as an
              embedded chat widget onto your website.
            </p>
            <div className="gap-1.5 pt-1 flex flex-col">
              <Link
                to="/developer"
                className="text-xs font-medium flex items-center justify-between text-primary hover:underline"
              >
                <span>API Keys & SDK Snippets</span>
                <ArrowRight className="size-3" aria-hidden />
              </Link>
              <Link
                to="/mcp"
                className="text-xs font-medium flex items-center justify-between text-primary hover:underline"
              >
                <span>Model Context Protocol (MCP)</span>
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <PageSection
        title="Performance"
        description={`All recorded runs in ${activeWorkspace.name}.`}
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/analytics">
              Full analytics <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        }
      >
        <div className="gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6 grid grid-cols-2">
          <StatCard
            label="Total agents"
            value={agents.length}
            icon={Bot}
            accent="green"
            hint={`${publishedAgents.length} published · ${draftAgents} drafts${archivedAgents.length ? ` · ${archivedAgents.length} archived` : ''}`}
          />
          <StatCard
            label="Total runs"
            value={logs.length}
            icon={Activity}
            accent="indigo"
            hint={`${weekTotal} in the last 7 days`}
          />
          <StatCard
            label="Success rate"
            value={successRate}
            icon={Gauge}
            accent="blue"
            hint={`${successfulRuns} succeeded · ${failedRuns} failed`}
          />
          <StatCard
            label="Tokens used"
            value={totalTokens}
            format={formatTokens}
            icon={Coins}
            accent="violet"
            hint={`~${formatTokens(avgTokens)} per run`}
          />
          <StatCard
            label="Est. cost"
            value={`$${(totalTokens * COST_PER_TOKEN).toFixed(2)}`}
            icon={DollarSign}
            accent="amber"
            hint="At the credit ledger's rate"
          />
          <StatCard
            label="Avg. cost / run"
            value={`$${(avgTokens * COST_PER_TOKEN).toFixed(4)}`}
            icon={Clock}
            accent="teal"
            hint="Across recorded runs"
          />
        </div>

        <div className="mt-4 gap-4 lg:grid-cols-3 grid grid-cols-1">
          <div className="p-4 lg:col-span-2 rounded-xl border border-border bg-surface">
            <div className="flex items-center justify-between">
              <h3 className="gap-2 text-xs font-semibold flex items-center text-foreground">
                <Activity className="size-4 text-accent-blue" aria-hidden />{' '}
                Runs — last 7 days
              </h3>
              <div className="gap-3 text-xs flex items-center text-muted-foreground">
                <span className="gap-1 flex items-center">
                  <span
                    className="size-2 rounded-full bg-success"
                    aria-hidden
                  />{' '}
                  Succeeded
                </span>
                <span className="gap-1 flex items-center">
                  <span
                    className="size-2 rounded-full bg-destructive"
                    aria-hidden
                  />{' '}
                  Failed
                </span>
              </div>
            </div>
            <div
              className="mt-4 h-32 gap-2 flex items-end"
              role="img"
              aria-label={`${weekTotal} runs in the last 7 days. ${weekly.map((d) => `${d.label}: ${d.ok} succeeded, ${d.failed} failed`).join('; ')}.`}
            >
              {weekly.map((d) => {
                const total = d.ok + d.failed;
                return (
                  <div
                    key={d.from}
                    className="gap-1 flex h-full flex-1 flex-col items-center justify-end"
                    title={`${d.label}: ${d.ok} succeeded, ${d.failed} failed`}
                  >
                    <span className="text-2xs text-muted-foreground tabular-nums">
                      {total || ''}
                    </span>
                    <div
                      className="max-w-10 flex w-full flex-col justify-end overflow-hidden rounded-t-md bg-surface-raised"
                      style={{
                        height: `${Math.max(4, (total / weekMax) * 100)}%`,
                      }}
                    >
                      {d.failed > 0 && (
                        <div
                          className="bg-destructive"
                          style={{ flexGrow: d.failed }}
                        />
                      )}
                      {d.ok > 0 && (
                        <div
                          className="bg-success"
                          style={{ flexGrow: d.ok }}
                        />
                      )}
                    </div>
                    <span className="text-2xs text-muted-foreground">
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border bg-surface">
            <h3 className="gap-2 text-xs font-semibold flex items-center text-foreground">
              <Trophy className="size-4 text-warning" aria-hidden /> Busiest
              agents
            </h3>
            {perAgent.length === 0 ? (
              <p className="py-6 text-xs text-center text-muted-foreground">
                No runs recorded yet.
              </p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {perAgent.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link
                      to={`/agents/${r.id}`}
                      className="gap-2 text-xs flex items-center justify-between rounded-sm hover:text-primary focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      <span className="font-semibold truncate text-foreground">
                        {r.name}
                      </span>
                      <span className="text-xs shrink-0 font-mono text-muted-foreground">
                        {r.runs} runs · {Math.round((r.ok / r.runs) * 100)}%
                      </span>
                    </Link>
                    <div
                      className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-raised"
                      aria-hidden
                    >
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${(r.runs / perAgent[0].runs) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="mt-0.5 text-2xs text-muted-foreground">
                      {formatTokens(r.tokens)} tokens
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </PageSection>

      <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="gap-2 flex items-center text-foreground">
              <Upload className="size-5 text-primary" />
              Import Workflow Graph JSON
            </DialogTitle>
            <DialogDescription>
              Paste exported workflow JSON or upload an agent configuration file
              to instantiate it in your workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3 py-4">
            <CodeInput
              language="json"
              minRows={8}
              maxRows={16}
              value={importJsonText}
              onChange={setImportJsonText}
              placeholder="Paste workflow JSON here (containing nodes and edges array)…"
            />
          </DialogBody>
          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => setIsImportModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportJson}
              disabled={!importJsonText.trim()}
              className="gap-1.5"
            >
              <CheckCircle2 className="size-4" />
              Import to Canvas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

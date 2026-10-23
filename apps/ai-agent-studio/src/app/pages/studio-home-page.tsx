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
  Page,
  PageHeader,
  PageSection,
  StatCard,
  AIModelBadge,
  toast,
  Textarea,
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
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from '../router.js';
import { useStudioTemplates } from '../services/templates.js';
import { useStudioSession } from '../session-guard.js';

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

const formatTokens = (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));

/**
 * The single Studio landing page: the plan-first home (greeting + "plan it" box,
 * running / needs-you / coming up) followed by workspace-wide performance and the
 * agent directory.
 */
export function StudioHomePage() {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  return (
    <Page className="space-y-8">
      <PageHeader
        title="Studio Home"
        description={`What your agents are doing in ${activeWorkspace.name} — and what to build next.`}
        icon={<Sparkles className="size-5" />}
        accent="violet"
        className="mb-0"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/templates')} className="gap-1.5">
              <Layers className="size-3.5" /> Templates
            </Button>
            <Button size="sm" onClick={() => navigate('/create')} className="gap-1.5">
              <Wand2 className="size-3.5" /> Create with AI
            </Button>
          </>
        }
      />
      <StudioHome planHref={(prompt) => `/create?prompt=${encodeURIComponent(prompt)}&go=1`} />
      <StudioInsights />
    </Page>
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
    <section aria-labelledby="journey-heading" className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 id="journey-heading" className="text-sm font-bold text-foreground">
          Get your first agent live
        </h2>
        <span className="text-xs text-muted-foreground">{doneCount} of {steps.length} done</span>
      </div>
      <ol className="mt-3 grid gap-2 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className={`flex flex-col justify-between gap-2 rounded-xl border p-3 ${
              step.id === nextId ? 'border-foreground/30 bg-selected' : 'border-border/60 bg-surface-raised/40'
            }`}
          >
            <div className="flex items-start gap-2">
              {step.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-2xs font-semibold text-muted-foreground" aria-hidden>
                  {i + 1}
                </span>
              )}
              <div className="min-w-0">
                <div className={`text-xs font-semibold ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                  {step.title}
                  <span className="sr-only">{step.done ? ' — done' : ''}</span>
                </div>
                <p className="text-xs text-muted-foreground">{step.hint}</p>
              </div>
            </div>
            {!step.done && (
              <Button size="xs" variant={step.id === nextId ? 'primary' : 'outline'} asChild className="self-start">
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

function StudioInsights() {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  // Pins are the member's server-side agent favorites — shared with the in-app Studio, synced across devices.
  const { favorites: pinnedSet, toggle: toggleFavorite } = useAgentFavorites(activeWorkspace.id);
  const pinnedAgentIds = useMemo(() => [...pinnedSet], [pinnedSet]);
  const { templates } = useStudioTemplates();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  const { data: agents = [], isLoading: isLoadingAgents, isError: agentsFailed, refetch: refetchAgents } = useQuery({
    queryKey: ['agents', activeWorkspace.id],
    queryFn: () => agentsApi.list(activeWorkspace.id),
  });

  const { data: plannedAgents = [], isLoading: isLoadingPlanned } = useQuery({
    queryKey: queryKeys.agentStudio.list(activeWorkspace.id),
    queryFn: () => agentStudioApi.list(activeWorkspace.id),
  });

  const { data: logs = [], isLoading: isLoadingLogs, isError: logsFailed, refetch: refetchLogs } = useQuery({
    queryKey: ['workspace-logs', activeWorkspace.id],
    queryFn: () => agentsApi.workspaceLogs(activeWorkspace.id),
  });

  const togglePinAgent = (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    toast.success(pinnedSet.has(agentId) ? 'Agent unpinned' : 'Agent pinned to top');
    toggleFavorite(agentId);
  };

  const statusOf = (a: (typeof agents)[number]): string => (a.configuration as any)?.status ?? 'draft';
  const publishedAgents = agents.filter((a) => statusOf(a) === 'published');
  const archivedAgents = agents.filter((a) => statusOf(a) === 'archived');
  const draftAgents = agents.length - publishedAgents.length - archivedAgents.length;

  // Agents made from the planner or a template live in the plan-first library, not
  // in `agents`; the journey has to count both or it never moves past step one.
  const plannedLive = plannedAgents.filter((a) => !a.archivedAt);
  const plannedFirst = plannedLive.find((a) => !a.isActive) ?? plannedLive[0];
  const firstDraft = agents.find((a) => statusOf(a) !== 'published' && statusOf(a) !== 'archived') ?? agents[0];
  const draftHref = firstDraft ? `/agents/${firstDraft.id}` : plannedFirst ? `/studio/${plannedFirst.id}` : null;
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
      done: logs.length > 0 || plannedLive.some((a) => a.runCount > 0 || a.lastRun !== null),
      to: firstDraft ? `/agents/${firstDraft.id}?copilot=1&test=1` : plannedFirst ? `/studio/${plannedFirst.id}?tab=runs` : '/create',
      cta: 'Run a test',
    },
    {
      id: 'publish',
      title: plannedFirst && !firstDraft ? 'Switch it on' : 'Publish it',
      hint: plannedFirst && !firstDraft ? 'Let it run on its schedule or trigger, not just when you test it.' : 'Make it callable by API, widget or schedule.',
      done: publishedAgents.length > 0 || plannedLive.some((a) => a.isActive || a.publishedVersion !== null),
      to: draftHref ?? '/create',
      cta: 'Open the agent',
    },
  ];

  const totalTokens = logs.reduce((acc, l) => acc + (l.tokensUsed || 0), 0);
  const successfulRuns = logs.filter((l) => l.status === 'SUCCESS').length;
  const failedRuns = logs.filter((l) => l.status === 'FAILED').length;
  // No runs yet is "no rate", not 100%.
  const successRate = logs.length > 0 ? `${Math.round((successfulRuns / logs.length) * 100)}%` : '—';
  const avgTokens = logs.length > 0 ? Math.round(totalTokens / logs.length) : 0;

  // Runs per day for the last 7 days (oldest → newest).
  const weekly = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getTime() - (6 - i) * DAY_MS);
      return { label: d.toLocaleDateString(undefined, { weekday: 'short' }), from: d.getTime(), ok: 0, failed: 0 };
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
    const map = new Map<string, { id: string; name: string; runs: number; ok: number; tokens: number; last: string }>();
    for (const l of logs) {
      const id = l.agent?.id ?? l.agentId;
      const row = map.get(id) ?? { id, name: l.agent?.name ?? 'Deleted agent', runs: 0, ok: 0, tokens: 0, last: l.executedAt };
      row.runs += 1;
      if (l.status === 'SUCCESS') row.ok += 1;
      row.tokens += l.tokensUsed || 0;
      if (l.executedAt > row.last) row.last = l.executedAt;
      map.set(id, row);
    }
    return [...map.values()].sort((a, b) => b.runs - a.runs);
  }, [logs]);
  const lastRunByAgent = useMemo(() => new Map(perAgent.map((r) => [r.id, r])), [perAgent]);

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
      .sort((a, b) => Number(pinnedAgentIds.includes(b.id)) - Number(pinnedAgentIds.includes(a.id)));
  }, [agents, statusFilter, search, pinnedAgentIds]);

  const handleImportJson = async () => {
    try {
      const parsed = JSON.parse(importJsonText);
      const importedName = parsed.name || 'Imported Agent Workflow';
      const newAgent = await agentService.createAgent(activeWorkspace.id, {
        name: importedName,
        role: 'Imported Agent',
        description: `Imported on ${new Date().toLocaleDateString()}`,
        graphJson: JSON.stringify({ nodes: parsed.nodes || [], edges: parsed.edges || [] }),
      });
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
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
        <ErrorState title="Couldn’t load your agents" description="The platform didn’t answer. Try again in a moment." onRetry={() => void refetchAgents()} />
      )}
      {!isLoadingAgents && !isLoadingPlanned && !agentsFailed && <GettingStarted steps={journey} />}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PageSection
            title="Your agents"
            description={`${filteredAgents.length} of ${agents.length} shown`}
            actions={
              <>
                <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(true)} className="gap-1.5">
                  <Upload className="size-3.5" /> Import JSON
                </Button>
                <Button size="sm" onClick={() => navigate('/agents?create=blank')} className="gap-1.5">
                  <Plus className="size-3.5" /> New Agent
                </Button>
              </>
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
              <div className="flex min-w-[200px] flex-1 items-center gap-2">
                <Search className="size-4 shrink-0 text-muted-foreground" />
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search agents by name, role, or description…"
                  className="text-xs"
                />
              </div>
              <div className="flex items-center gap-1.5 border-l border-border pl-3">
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
                  <ToggleGroupItem value="grid" aria-label="Grid view" title="Grid View">
                    <Grid className="size-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="List view" title="List View">
                    <LayoutList className="size-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            <div className="mt-4">
              {filteredAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 p-10 text-center text-muted-foreground">
                  <Bot className="mb-2 size-12 text-muted-foreground/30" />
                  {agents.length === 0 && plannedLive.length > 0 ? (
                    <>
                      <div className="text-sm font-semibold text-foreground">No canvas agents yet</div>
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                        {plannedLive.length === 1
                          ? 'Your agent built from a plan lives in Planned Agents.'
                          : `Your ${plannedLive.length} agents built from a plan live in Planned Agents.`}
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Button size="sm" asChild className="gap-1.5">
                          <Link to={`/w/${activeWorkspace.slug}/ai/agents`}>
                            <Sparkles className="size-3.5" /> Open Planned Agents
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => navigate('/agents?create=blank')} className="gap-1.5">
                          <Plus className="size-3.5" /> New canvas agent
                        </Button>
                      </div>
                    </>
                  ) : agents.length === 0 ? (
                    <>
                      <div className="text-sm font-semibold text-foreground">No agents yet</div>
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                        Describe what you want done and Studio will plan and build the agent — or start from a template.
                      </p>
                      <div className="mt-4 flex flex-wrap justify-center gap-2">
                        <Button size="sm" onClick={() => navigate('/create')} className="gap-1.5">
                          <Wand2 className="size-3.5" /> Create with AI
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => navigate('/templates')} className="gap-1.5">
                          <Layers className="size-3.5" /> Browse templates
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm font-semibold text-foreground">No agents match</div>
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground">Nothing fits the current search or status filter.</p>
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {filteredAgents.map((agent) => {
                    const config = (agent.configuration as any) || {};
                    const isPublished = config.status === 'published';
                    const isArchived = config.status === 'archived';
                    const version = config.currentVersion ? `v${config.currentVersion}.0.0` : 'v1.0.0-draft';
                    const toolsCount = countTools(agent.tools);
                    const isPinned = pinnedAgentIds.includes(agent.id);
                    const usage = lastRunByAgent.get(agent.id);

                    return (
                      <div
                        key={agent.id}
                        onClick={() => navigate(`/agents/${agent.id}`)}
                        className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-border bg-surface p-4 transition-all hover:border-border-strong hover:bg-surface-raised/40 hover:shadow-md"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                                <Bot className="size-4" />
                              </div>
                              <div>
                                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground transition-colors group-hover:text-primary">
                                  <span>{agent.name}</span>
                                  {isPinned && <Pin className="size-3 fill-warning text-warning" />}
                                </div>
                                <div className="text-xs text-muted-foreground">{agent.role || 'Assistant'}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => togglePinAgent(agent.id, e)}
                                title={isPinned ? 'Unpin' : 'Pin to top'}
                                className={`size-6 rounded-md p-1 transition-colors ${
                                  isPinned ? 'text-warning hover:bg-warning/10' : 'text-muted-foreground opacity-0 hover:bg-surface-raised hover:text-foreground group-hover:opacity-100'
                                }`}
                              >
                                <Pin className="size-3.5" />
                              </button>
                              <Badge variant={isPublished ? 'success' : 'outline'} className="text-2xs">
                                {isPublished ? 'Published' : isArchived ? 'Archived' : 'Draft'}
                              </Badge>
                            </div>
                          </div>
                          <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">
                            {agent.description || agent.systemPrompt || 'No description set'}
                          </p>
                        </div>

                        <div className="mt-4 space-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                          <div className="flex items-center justify-between">
                            <span>
                              {usage
                                ? `${usage.runs} ${usage.runs === 1 ? 'run' : 'runs'} · ${Math.round((usage.ok / usage.runs) * 100)}% ok · ${formatTokens(usage.tokens)} tokens`
                                : 'Never run'}
                            </span>
                            {usage && <span>{new Date(usage.last).toLocaleDateString()}</span>}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="font-mono">{version}</span>
                            <div className="flex items-center gap-2">
                              <span>{toolsCount} {toolsCount === 1 ? 'tool' : 'tools'}</span>
                              <AIModelBadge modelId={agent.model || 'llama3'} variant="subtle" size="xs" />
                            </div>
                          </div>
                        </div>
                      </div>
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
                        <TableHead className="px-4 py-3 text-right">Action</TableHead>
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
                              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                <span>{agent.name}</span>
                                {pinnedAgentIds.includes(agent.id) && <Pin className="size-3 fill-warning text-warning" />}
                              </div>
                              <div className="max-w-xs truncate text-xs text-muted-foreground">
                                {agent.description || agent.role || 'Workflow agent'}
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <Badge variant={status === 'published' ? 'success' : 'outline'} className="text-2xs">
                                {status === 'published' ? 'Published' : status === 'archived' ? 'Archived' : 'Draft'}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 py-3">
                              <AIModelBadge modelId={agent.model || 'llama3'} variant="subtle" size="xs" />
                            </TableCell>
                            <TableCell className="px-4 py-3 text-muted-foreground">{countTools(agent.tools)}</TableCell>
                            <TableCell className="px-4 py-3 text-muted-foreground">{usage?.runs ?? 0}</TableCell>
                            <TableCell className="px-4 py-3 text-muted-foreground">{usage ? `${Math.round((usage.ok / usage.runs) * 100)}%` : '—'}</TableCell>
                            <TableCell className="px-4 py-3 font-mono text-muted-foreground">{usage ? formatTokens(usage.tokens) : '—'}</TableCell>
                            <TableCell className="px-4 py-3 text-right">
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/agents/${agent.id}`);
                                }}
                                className="text-primary hover:text-primary"
                              >
                                Open Canvas →
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
              <Link to="/executions" className="text-xs text-primary hover:underline">
                View all executions ({logs.length})
              </Link>
            }
          >
            <div className="space-y-1.5 rounded-xl border border-border bg-surface p-3">
              {isLoadingLogs ? (
                <div className="py-6 text-center text-xs text-muted-foreground">Loading recent executions…</div>
              ) : logsFailed ? (
                <ErrorState title="Couldn’t load recent executions" onRetry={() => void refetchLogs()} />
              ) : logs.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No execution logs recorded yet. Run a test turn to populate telemetry.
                </div>
              ) : (
                logs.slice(0, 8).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-surface-raised/40 p-2.5 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className={`size-2 shrink-0 rounded-full ${log.status === 'SUCCESS' ? 'bg-success' : 'bg-destructive'}`} />
                      <span className="truncate font-semibold text-foreground">{log.agent?.name || 'Agent Run'}</span>
                      <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                        {log.promptText || 'Manual test prompt'}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 font-mono text-xs text-muted-foreground">
                      <span className="hidden sm:inline">{new Date(log.executedAt).toLocaleString()}</span>
                      <span>{log.tokensUsed?.toLocaleString() || 0} tokens</span>
                      <Badge variant={log.status === 'SUCCESS' ? 'success' : 'destructive'} className="text-2xs">
                        {log.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </PageSection>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-warning" />
              <h2 className="text-sm font-bold text-foreground">Featured Templates</h2>
            </div>
            <Link to="/templates" className="text-xs font-medium text-primary hover:underline">
              Browse All ({templates.length})
            </Link>
          </div>

          <div className="space-y-3">
            {templates.slice(0, 5).map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => navigate(`/templates?use=${tpl.id}`)}
                className="group flex cursor-pointer flex-col rounded-xl border border-border bg-surface p-3.5 transition-all hover:border-border-strong hover:bg-surface-raised/40 hover:shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground transition-colors group-hover:text-primary">{tpl.name}</span>
                  <Badge variant="outline" className="text-2xs">{tpl.tags[0]}</Badge>
                </div>
                <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{tpl.description}</p>
                <div className="mt-2.5 flex items-center justify-between font-mono text-2xs text-muted-foreground">
                  <span>{tpl.nodes.length} nodes · {tpl.edges.length} edges</span>
                  <span className="font-semibold text-primary group-hover:underline">Use Template →</span>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
            <h3 className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Wrench className="size-3.5 text-primary" />
              Developer Resources
            </h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Call any published agent via the REST API or deploy it as an embedded chat widget onto your website.
            </p>
            <div className="flex flex-col gap-1.5 pt-1">
              <Link to="/developer" className="flex items-center justify-between text-xs font-medium text-primary hover:underline">
                <span>API Keys & SDK Snippets</span>
                <ArrowRight className="size-3" />
              </Link>
              <Link to="/mcp" className="flex items-center justify-between text-xs font-medium text-primary hover:underline">
                <span>Model Context Protocol (MCP)</span>
                <ArrowRight className="size-3" />
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
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Total agents"
            value={agents.length}
            icon={Bot}
            accent="green"
            hint={`${publishedAgents.length} published · ${draftAgents} drafts${archivedAgents.length ? ` · ${archivedAgents.length} archived` : ''}`}
          />
          <StatCard label="Total runs" value={logs.length} icon={Activity} accent="indigo" hint={`${weekTotal} in the last 7 days`} />
          <StatCard
            label="Success rate"
            value={successRate}
            icon={Gauge}
            accent="blue"
            hint={`${successfulRuns} succeeded · ${failedRuns} failed`}
          />
          <StatCard label="Tokens used" value={totalTokens} format={formatTokens} icon={Coins} accent="violet" hint={`~${formatTokens(avgTokens)} per run`} />
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

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-surface p-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Activity className="size-4 text-accent-blue" /> Runs — last 7 days
              </h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-success" /> Succeeded</span>
                <span className="flex items-center gap-1"><span className="size-2 rounded-full bg-destructive" /> Failed</span>
              </div>
            </div>
            <div className="mt-4 flex h-32 items-end gap-2" role="img" aria-label={`${weekTotal} runs in the last 7 days`}>
              {weekly.map((d) => {
                const total = d.ok + d.failed;
                return (
                  <div key={d.from} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.label}: ${d.ok} succeeded, ${d.failed} failed`}>
                    <span className="text-2xs tabular-nums text-muted-foreground">{total || ''}</span>
                    <div className="flex w-full max-w-10 flex-col justify-end overflow-hidden rounded-t-md bg-surface-raised" style={{ height: `${Math.max(4, (total / weekMax) * 100)}%` }}>
                      {d.failed > 0 && <div className="bg-destructive" style={{ flexGrow: d.failed }} />}
                      {d.ok > 0 && <div className="bg-success" style={{ flexGrow: d.ok }} />}
                    </div>
                    <span className="text-2xs text-muted-foreground">{d.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-surface p-4">
            <h3 className="flex items-center gap-2 text-xs font-bold text-foreground">
              <Trophy className="size-4 text-warning" /> Busiest agents
            </h3>
            {perAgent.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No runs recorded yet.</p>
            ) : (
              <ul className="mt-3 space-y-2.5">
                {perAgent.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link to={`/agents/${r.id}`} className="flex items-center justify-between gap-2 text-xs hover:text-primary">
                      <span className="truncate font-semibold text-foreground">{r.name}</span>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{r.runs} runs · {Math.round((r.ok / r.runs) * 100)}%</span>
                    </Link>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-raised">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(r.runs / perAgent[0].runs) * 100}%` }} />
                    </div>
                    <div className="mt-0.5 text-2xs text-muted-foreground">{formatTokens(r.tokens)} tokens</div>
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
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Upload className="size-5 text-primary" />
              Import Workflow Graph JSON
            </DialogTitle>
            <DialogDescription>
              Paste exported workflow JSON or upload an agent configuration file to instantiate it in your workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3 py-4">
            <Textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste workflow JSON here (containing nodes and edges array)…"
              className="font-mono text-xs"
            />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setIsImportModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImportJson} disabled={!importJsonText.trim()} className="gap-1.5">
              <CheckCircle2 className="size-4" />
              Import to Canvas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

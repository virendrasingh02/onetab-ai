import { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  aiStudioApi,
  knowledgeApi,
  aiAppsApi,
  aiExecutionsApi,
  mcpApi,
  aiFeedbackApi,
  queryKeys,
} from '@org/api-client';
import { AI_MODELS } from '../ai-models.js';
import { useCurrentWorkspace, WorkspacePreferencesEffects } from '@org/web-workspace';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  KbdShortcut,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Bot,
  ChevronDown,
  ChevronRight,
  Clock,
  Cpu,
  FileText,
  Flame,
  Layers,
  LayoutGrid,
  Library,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Terminal,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  UserCheck,
  Workflow,
  X,
} from 'lucide-react';
import type {
  AIApp,
  AIAppType,
  AIExecution,
  KnowledgeBase,
  KnowledgeRetrievalResult,
} from '@org/types';

export interface StudioNavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  keywords?: string;
}

export interface StudioNavGroup {
  id: string;
  title: string;
  items: StudioNavItem[];
}

export const STUDIO_NAV_GROUPS: StudioNavGroup[] = [
  {
    id: 'core',
    title: 'Core & Overview',
    items: [
      { id: 'overview', label: 'Overview & Status', icon: LayoutGrid, badge: 'CORE', keywords: 'home dashboard summary stats welcome quick create' },
      { id: 'analytics', label: 'Analytics & Usage', icon: TrendingUp, keywords: 'metrics performance tokens costs graphs feedback satisfaction latency' },
      { id: 'executions', label: 'Execution Center', icon: Clock, keywords: 'runs logs execution history tracing latency status events' },
    ],
  },
  {
    id: 'entities',
    title: 'Intelligent Entities',
    items: [
      { id: 'agents', label: 'Autonomous Agents', icon: Bot, badge: 'AGENTS', keywords: 'agents autonomous bots multi-agent tasks' },
      { id: 'coworkers', label: 'AI Coworkers', icon: UserCheck, badge: 'TEAM', keywords: 'colleagues persona memory team teammates persistent' },
      { id: 'apps', label: 'AI Applications', icon: Sparkles, badge: 'APPS', keywords: 'apps chat search extraction summarizer assistants tools' },
    ],
  },
  {
    id: 'automations',
    title: 'Automations & Pipelines',
    items: [
      { id: 'workflows', label: 'Visual Workflows', icon: Workflow, badge: 'FLOW', keywords: 'canvas pipelines dag automation steps nodes execution' },
    ],
  },
  {
    id: 'knowledge',
    title: 'Knowledge & Prompts',
    items: [
      { id: 'knowledge', label: 'Knowledge / RAG', icon: BookOpen, badge: 'RAG', keywords: 'knowledge embeddings vector rag documents search chunks' },
      { id: 'prompts', label: 'Prompt Library', icon: Library, keywords: 'system prompts templates instructions reusable' },
    ],
  },
  {
    id: 'ecosystem',
    title: 'Ecosystem & Tools',
    items: [
      { id: 'tools', label: 'Tool Registry', icon: Terminal, keywords: 'functions tools schema web search calculator bash code execution' },
      { id: 'models', label: 'Model Hub', icon: Cpu, badge: 'LLM', keywords: 'models providers openai anthropic gemini llama deepseek mistral' },
      { id: 'mcp', label: 'Model Context Protocol', icon: Plug, badge: 'MCP', keywords: 'mcp protocol servers integrations stdio sse clients' },
    ],
  },
];

const COLLAPSE_STORAGE_KEY = 'onetab_ai_studio_nav_collapsed';

function readCollapsed(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function AIStudioView() {
  const currentWorkspace = useCurrentWorkspace();
  const workspaceId = currentWorkspace.workspaceId;
  const navigate = useNavigate();
  const { tab: routeTab } = useParams<{ tab?: string }>();
  const [searchParams] = useSearchParams();
  const activeTab = routeTab || searchParams.get('tab') || 'overview';

  const [searchQuery, setSearchQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsed);

  const backUrl = `/w/${currentWorkspace.slug}`;

  const setTab = (tab: string) => {
    navigate(`/w/${currentWorkspace.slug}/studio/${tab}`);
  };

  useEffect(() => {
    try {
      window.localStorage.setItem(
        COLLAPSE_STORAGE_KEY,
        JSON.stringify(collapsed),
      );
    } catch {
      // storage unavailable
    }
  }, [collapsed]);

  // Keep active section un-collapsed
  const activeGroupId = useMemo(
    () =>
      STUDIO_NAV_GROUPS.find((group) =>
        group.items.some((item) => item.id === activeTab),
      )?.id,
    [activeTab],
  );

  useEffect(() => {
    if (!activeGroupId) return;
    setCollapsed((current) =>
      current[activeGroupId] ? { ...current, [activeGroupId]: false } : current,
    );
  }, [activeGroupId]);

  // Handle Escape to exit AI Studio back to workspace
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (document.querySelector('[role="dialog"], [data-state="open"]')) return;
      navigate(backUrl);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, backUrl]);

  const needle = searchQuery.trim().toLowerCase();
  const isSearching = needle.length > 0;

  const matches = (item: StudioNavItem) =>
    !needle ||
    item.label.toLowerCase().includes(needle) ||
    (item.keywords ?? '').toLowerCase().includes(needle);

  const groupsToRender = STUDIO_NAV_GROUPS.map((group) => ({
    group,
    items: group.items.filter(matches),
  })).filter(({ items }) => items.length > 0);

  const toggleGroup = (id: string) =>
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));

  const activeItem = useMemo(() => {
    for (const group of STUDIO_NAV_GROUPS) {
      const match = group.items.find((item) => item.id === activeTab);
      if (match) return match;
    }
    return null;
  }, [activeTab]);

  if (!workspaceId) {
    return <LoadingState label="Loading AI Studio..." fullPage />;
  }

  return (
    <div className="gap-1.5 p-1.5 flex h-screen w-screen flex-col overflow-hidden bg-background font-sans text-foreground">
      {/* Live-apply preferences so theme & font size preview */}
      <WorkspacePreferencesEffects workspaceId={workspaceId} />

      {/* Main Studio Card Box */}
      <div className="min-h-0 flex h-full w-full flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs">
        {/* Top Header Bar */}
        <header className="h-12 backdrop-blur-md px-4 sm:px-6 flex shrink-0 items-center justify-between border-b border-border/70 bg-surface/60">
          <div className="gap-2.5 text-xs flex items-center">
            <button
              type="button"
              onClick={() => navigate(backUrl)}
              className="gap-1.5 font-medium px-2 py-1 inline-flex items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back</span>
            </button>
            <span className="text-muted-foreground/50">/</span>
            <div className="gap-2 flex items-center">
              <span className="font-semibold text-foreground">AI Studio</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary capitalize">
                {activeItem?.label || activeTab.replace(/-/g, ' ')}
              </span>
            </div>
            {currentWorkspace.workspace?.name ? (
              <Badge
                variant="neutral"
                className="sm:inline-flex font-medium hidden text-xs text-foreground/80"
              >
                {currentWorkspace.workspace.name}
              </Badge>
            ) : null}
          </div>

          <div className="gap-2 flex items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/w/${currentWorkspace.slug}/automations/builder`)}
              leadingIcon={<Workflow className="size-3.5" />}
              className="h-8 text-xs hidden sm:inline-flex"
            >
              Workflow Builder
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/w/${currentWorkspace.slug}/agents/builder`)}
              leadingIcon={<Bot className="size-3.5" />}
              className="h-8 text-xs hidden sm:inline-flex"
            >
              Agent Builder
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close AI Studio"
              onClick={() => navigate(backUrl)}
              className="h-8 gap-1.5 px-2.5 text-xs rounded-lg text-muted-foreground hover:text-foreground"
            >
              <span>Close</span>
              <KbdShortcut
                keys={['Escape']}
                size="xs"
                variant="muted"
                responsive
              />
              <X className="size-3.5" />
            </Button>
          </div>
        </header>

        {/* Inner Content Area: Dedicated Sidebar + Main Scrollable Area */}
        <div className="min-h-0 flex flex-1 overflow-hidden">
          {/* Left Dedicated Studio Sidebar */}
          <aside className="w-64 sm:w-72 flex h-full shrink-0 flex-col border-r border-border bg-surface-muted/50 select-none">
            {/* Search Input */}
            <div className="p-3">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search AI Studio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leadingIcon={<Search className="size-3.5 text-muted-foreground" />}
                  className="h-8 text-xs rounded-lg border-border bg-surface-inset placeholder:text-muted-foreground pr-7"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Nav Items */}
            <div className="min-h-0 py-1 px-3 flex-1 overflow-y-auto overflow-x-hidden space-y-3 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
              {groupsToRender.length === 0 ? (
                <div className="px-2.5 py-10 text-center">
                  <Search className="size-5 mx-auto mb-2 text-muted-foreground/60" />
                  <p className="text-xs text-muted-foreground">
                    No sections match “{searchQuery}”.
                  </p>
                </div>
              ) : (
                groupsToRender.map(({ group, items }) => {
                  const isCollapsed = !isSearching && collapsed[group.id];

                  return (
                    <div key={group.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        aria-expanded={!isCollapsed}
                        className="group/hdr px-2.5 py-1 flex w-full items-center justify-between rounded-md text-left transition-colors hover:bg-accent/40"
                      >
                        <span className="gap-1.5 flex items-center font-bold tracking-wider text-[10.5px] text-muted-foreground uppercase">
                          {group.title}
                          <span className="font-semibold tabular-nums text-[10px] text-muted-foreground/60 normal-case">
                            {items.length}
                          </span>
                        </span>
                        {!isSearching ? (
                          <ChevronDown
                            className={cn(
                              'size-3.5 text-muted-foreground/60 transition-transform group-hover/hdr:text-muted-foreground',
                              isCollapsed && '-rotate-90',
                            )}
                          />
                        ) : null}
                      </button>

                      {!isCollapsed ? (
                        <div className="space-y-0.5">
                          {items.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => setTab(item.id)}
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(
                                  'px-2.5 py-1.5 font-medium flex w-full items-center justify-between rounded-xl text-left text-[13px] transition-all cursor-pointer',
                                  isActive
                                    ? 'font-semibold shadow-2xs bg-accent text-foreground'
                                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                                )}
                              >
                                <div className="gap-2.5 min-w-0 flex items-center">
                                  <Icon
                                    className={cn(
                                      'size-4 shrink-0',
                                      isActive
                                        ? 'text-primary'
                                        : 'text-muted-foreground',
                                    )}
                                  />
                                  <span className="truncate">{item.label}</span>
                                </div>
                                {item.badge ? (
                                  <Badge
                                    variant="neutral"
                                    className="px-1.5 py-0 font-semibold text-[10px]"
                                  >
                                    {item.badge}
                                  </Badge>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer Status */}
            <div className="p-3 border-t border-border/70 bg-surface/30">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-medium text-foreground">AI Engine Online</span>
                </div>
                <span className="text-[10px] text-muted-foreground/70">v2.0</span>
              </div>
            </div>
          </aside>

          {/* Main Studio Content Area */}
          <main className="min-h-0 flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-surface-inset/20 p-6 md:p-8 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
            <div className="w-full max-w-6xl mx-auto space-y-6">
              {activeTab === 'overview' && <OverviewTab workspaceId={workspaceId} onSelectTab={setTab} />}
              {activeTab === 'agents' && <AgentsTab workspaceId={workspaceId} />}
              {activeTab === 'coworkers' && <CoworkersTab workspaceId={workspaceId} />}
              {activeTab === 'workflows' && <WorkflowsTab workspaceId={workspaceId} />}
              {activeTab === 'apps' && <AppsTab workspaceId={workspaceId} />}
              {activeTab === 'knowledge' && <KnowledgeTab workspaceId={workspaceId} />}
              {activeTab === 'tools' && <ToolsTab workspaceId={workspaceId} />}
              {activeTab === 'models' && <ModelsTab workspaceId={workspaceId} />}
              {activeTab === 'prompts' && <PromptsTab workspaceId={workspaceId} />}
              {activeTab === 'mcp' && <MCPTab workspaceId={workspaceId} />}
              {activeTab === 'executions' && <ExecutionsTab workspaceId={workspaceId} />}
              {activeTab === 'analytics' && <AnalyticsTab workspaceId={workspaceId} />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 1. OVERVIEW TAB
// ==========================================
function OverviewTab({
  workspaceId,
  onSelectTab,
}: {
  workspaceId: string;
  onSelectTab: (tab: string) => void;
}) {
  const currentWorkspace = useCurrentWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [createType, setCreateType] = useState('agent');
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');

  const { data: overview, isLoading } = useQuery({
    queryKey: queryKeys.aiStudio.overview(workspaceId),
    queryFn: () => aiStudioApi.getOverview(workspaceId),
  });

  const quickCreateMutation = useMutation({
    mutationFn: (data: { name: string; type: string; description?: string }) =>
      aiStudioApi.quickCreate(workspaceId, data),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiStudio.overview(workspaceId) });
      toast.success(`Created new ${res.type}`);
      setQuickCreateOpen(false);
      setCreateName('');
      setCreateDesc('');
      if (res.type === 'workflow') {
        navigate(`/w/${currentWorkspace.slug}/automations/builder?id=${res.id}`);
      } else if (res.type === 'agent') {
        navigate(`/w/${currentWorkspace.slug}/agents/builder?agentId=${res.id}`);
      } else {
        onSelectTab(res.type === 'app' ? 'apps' : res.type === 'knowledge' ? 'knowledge' : 'agents');
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to create resource');
    },
  });

  if (isLoading) return <LoadingState label="Loading AI Studio overview..." />;

  const stats = [
    { label: 'Active Agents', value: overview?.totalAgents ?? 0, icon: Bot, tone: 'text-accent-cyan bg-accent-cyan/10' },
    { label: 'AI Coworkers', value: overview?.totalCoworkers ?? 0, icon: UserCheck, tone: 'text-accent-pink bg-accent-pink/10' },
    { label: 'Workflows', value: overview?.totalWorkflows ?? 0, icon: Workflow, tone: 'text-accent-purple bg-accent-purple/10' },
    { label: 'AI Apps', value: overview?.totalApps ?? 0, icon: Sparkles, tone: 'text-accent-green bg-accent-green/10' },
    { label: 'Knowledge Bases', value: overview?.totalKnowledgeBases ?? 0, icon: BookOpen, tone: 'text-accent-blue bg-accent-blue/10' },
    { label: 'Total Executions', value: overview?.totalExecutions ?? 0, icon: Clock, tone: 'text-accent-amber bg-accent-amber/10' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome / Summary banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-border/80 bg-gradient-to-r from-primary/5 via-background to-accent-violet/5 p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Flame className="size-4 text-primary" />
            <h2 className="text-base font-bold text-foreground">Welcome to Unified AI Studio</h2>
          </div>
          <p className="text-xs text-muted-foreground max-w-xl">
            Orchestrate native AI capabilities with seamless tenancy, shared model runtimes, universal tools, and instant app distribution.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setQuickCreateOpen(true)}
          leadingIcon={<Plus className="size-4" />}
        >
          Quick Create
        </Button>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-4 bg-surface/60 border-border/60">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">{s.label}</span>
                <div className={cn('p-1.5 rounded-md', s.tone)}>
                  <Icon className="size-3.5" />
                </div>
              </div>
              <div className="mt-2 text-xl font-bold tracking-tight text-foreground">{s.value}</div>
            </Card>
          );
        })}
      </div>

      {/* Bottom 2-column: Recent Executions & Published Resources */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Traces */}
        <Card className="p-5 bg-surface/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Recent Executions</h3>
            </div>
            <button
              onClick={() => onSelectTab('executions')}
              className="text-xs text-primary hover:underline"
            >
              View all
            </button>
          </div>

          {!overview?.recentExecutions?.length ? (
            <p className="text-xs text-muted-foreground py-6 text-center italic">
              No executions yet. Run an agent, coworker or workflow to see live trace logs.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {overview.recentExecutions.slice(0, 5).map((exec: any) => (
                <div key={exec.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        exec.status === 'COMPLETED'
                          ? 'success'
                          : exec.status === 'RUNNING'
                          ? 'primary'
                          : 'destructive'
                      }
                      className="text-[10px] px-1.5 py-0"
                    >
                      {exec.status}
                    </Badge>
                    <span className="font-medium text-foreground">{exec.entityType}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{exec.id.slice(0, 8)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{exec.tokensUsed} tokens</span>
                    <span>{exec.latencyMs}ms</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Published & Drafts */}
        <Card className="p-5 bg-surface/60">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Published AI Resources</h3>
            </div>
            <Badge variant="outline" className="text-[11px]">
              {overview?.publishedResources?.length ?? 0} Published
            </Badge>
          </div>

          {!overview?.publishedResources?.length ? (
            <p className="text-xs text-muted-foreground py-6 text-center italic">
              No published AI items. Deploy an agent or workflow to make it available.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {overview.publishedResources.slice(0, 6).map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background p-2.5 text-xs"
                >
                  <div className="truncate font-medium text-foreground">{item.name}</div>
                  <Badge variant="secondary" className="text-[9px] uppercase">
                    {item.type}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Quick Create Dialog */}
      <Dialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Create AI Resource</DialogTitle>
            <DialogDescription>
              Deploy a new AI asset powered by the unified runtime.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Resource Type</label>
              <Select value={createType} onValueChange={setCreateType}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agent">Autonomous Agent</SelectItem>
                  <SelectItem value="coworker">AI Coworker (Teammate)</SelectItem>
                  <SelectItem value="workflow">Visual Workflow</SelectItem>
                  <SelectItem value="app">AI Application</SelectItem>
                  <SelectItem value="knowledge">Knowledge Base (RAG)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                placeholder="e.g. Code Reviewer, Support Bot, Daily Summary"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
              <Textarea
                placeholder="What does this AI resource do?"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!createName.trim() || quickCreateMutation.isPending}
              onClick={() =>
                quickCreateMutation.mutate({
                  name: createName,
                  type: createType,
                  description: createDesc,
                })
              }
            >
              {quickCreateMutation.isPending ? 'Creating...' : 'Create Resource'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// 2. KNOWLEDGE BASE TAB (RAG)
// ==========================================
function KnowledgeTab({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);
  const [createKbOpen, setCreateKbOpen] = useState(false);
  const [ingestOpen, setIngestOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [docName, setDocName] = useState('');
  const [docText, setDocText] = useState('');
  const [retrievalQuery, setRetrievalQuery] = useState('');
  const [retrievalResults, setRetrievalResults] = useState<KnowledgeRetrievalResult[]>([]);

  const { data: knowledgeBases = [], isLoading } = useQuery({
    queryKey: queryKeys.knowledge.list(workspaceId),
    queryFn: () => knowledgeApi.list(workspaceId),
  });

  const { data: documents = [] } = useQuery({
    queryKey: queryKeys.knowledge.documents(workspaceId, selectedKb?.id ?? ''),
    queryFn: () => (selectedKb ? knowledgeApi.listDocuments(workspaceId, selectedKb.id) : []),
    enabled: Boolean(selectedKb),
  });

  const createKbMutation = useMutation({
    mutationFn: (data: { name: string; description?: string }) =>
      knowledgeApi.create(workspaceId, data),
    onSuccess: (newKb: any) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.list(workspaceId) });
      toast.success('Knowledge Base created');
      setCreateKbOpen(false);
      setName('');
      setDesc('');
      setSelectedKb(newKb as KnowledgeBase);
    },
  });

  const ingestMutation = useMutation({
    mutationFn: (data: { name: string; rawText: string; sourceType: 'MANUAL' | 'FILE' }) =>
      knowledgeApi.ingestDocument(workspaceId, selectedKb!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.knowledge.documents(workspaceId, selectedKb!.id),
      });
      toast.success('Document ingested and chunked');
      setIngestOpen(false);
      setDocName('');
      setDocText('');
    },
  });

  const testRetrievalMutation = useMutation({
    mutationFn: (query: string) =>
      knowledgeApi.testRetrieval(workspaceId, selectedKb!.id, { query, topK: 3 }),
    onSuccess: (res: any) => {
      setRetrievalResults(res as KnowledgeRetrievalResult[]);
      toast.success(`Retrieved ${res.length} relevant chunks`);
    },
  });

  if (isLoading) return <LoadingState label="Loading knowledge bases..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Knowledge Bases & RAG Pipeline</h2>
          <p className="text-xs text-muted-foreground">
            Ingest company documents, PDFs, manuals and policies to provide accurate retrieval for agents and workflows.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateKbOpen(true)} leadingIcon={<Plus className="size-4" />}>
          New Knowledge Base
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Knowledge Base List */}
        <div className="space-y-3 lg:col-span-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Repositories ({knowledgeBases.length})
          </span>
          {knowledgeBases.map((kb: any) => (
            <Card
              key={kb.id}
              onClick={() => {
                setSelectedKb(kb);
                setRetrievalResults([]);
              }}
              className={cn(
                'p-4 cursor-pointer transition-all',
                selectedKb?.id === kb.id
                  ? 'border-primary ring-1 ring-primary bg-primary/5'
                  : 'hover:border-border-hover bg-surface',
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-sm font-semibold text-foreground">{kb.name}</h4>
                <Badge variant="outline" className="text-[10px]">
                  {kb._count?.documents ?? 0} docs
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{kb.description || 'No description'}</p>
            </Card>
          ))}
        </div>

        {/* Selected Knowledge Base Detail */}
        <div className="space-y-4 lg:col-span-2">
          {selectedKb ? (
            <Card className="p-5 bg-surface space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">{selectedKb.name}</h3>
                  <p className="text-xs text-muted-foreground">{selectedKb.description}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIngestOpen(true)}
                  leadingIcon={<Plus className="size-4" />}
                >
                  Add Document
                </Button>
              </div>

              {/* Ingested Documents Table */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Documents ({documents.length})
                </h4>
                {!documents.length ? (
                  <p className="text-xs text-muted-foreground italic py-4">
                    No documents uploaded. Add markdown, notes, or texts to start building this knowledge base.
                  </p>
                ) : (
                  <div className="divide-y divide-border rounded-lg border border-border bg-background">
                    {documents.map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between p-3 text-xs">
                        <div className="flex items-center gap-2">
                          <FileText className="size-4 text-primary" />
                          <span className="font-medium text-foreground">{d.name}</span>
                          <Badge variant="success" className="text-[9px]">
                            {d.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground text-[11px]">
                          <span>{d.chunkCount} chunks</span>
                          <span>{d.tokenCount} tokens</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Retrieval Testing Playground */}
              <div className="border-t border-border pt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Semantic & Keyword Retrieval Playground
                </h4>
                <div className="flex gap-2">
                  <Input
                    placeholder="Test a search query against this knowledge base..."
                    value={retrievalQuery}
                    onChange={(e) => setRetrievalQuery(e.target.value)}
                    className="text-xs"
                  />
                  <Button
                    size="sm"
                    disabled={!retrievalQuery.trim() || testRetrievalMutation.isPending}
                    onClick={() => testRetrievalMutation.mutate(retrievalQuery)}
                    leadingIcon={<Search className="size-4" />}
                  >
                    Test RAG
                  </Button>
                </div>

                {retrievalResults.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <span className="text-[11px] font-semibold text-muted-foreground">Retrieved Chunks:</span>
                    {retrievalResults.map((r, i) => (
                      <div key={i} className="rounded-lg border border-border bg-background p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-primary">{r.citation}</span>
                          <Badge variant="outline" className="text-[10px]">
                            Score: {r.score}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground font-mono text-[11px] leading-relaxed">
                          {r.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-8 text-center bg-surface">
              <BookOpen className="size-8 text-muted-foreground mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-foreground">Select a Knowledge Base</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Choose a repository from the left or create a new one to inspect documents, chunks, and test RAG retrieval.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Create KB Dialog */}
      <Dialog open={createKbOpen} onOpenChange={setCreateKbOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Knowledge Base</DialogTitle>
            <DialogDescription>
              A knowledge base stores chunked vector documents and powers RAG retrieval for agents.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                placeholder="e.g. Engineering Handbook, Product Docs"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea
                placeholder="What documentation does this repository hold?"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateKbOpen(false)}>Cancel</Button>
            <Button
              disabled={!name.trim() || createKbMutation.isPending}
              onClick={() => createKbMutation.mutate({ name, description: desc })}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ingest Document Dialog */}
      <Dialog open={ingestOpen} onOpenChange={setIngestOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ingest Document into {selectedKb?.name}</DialogTitle>
            <DialogDescription>
              Text will be extracted, cleaned, chunked into tokens, and indexed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Document Title</label>
              <Input
                placeholder="e.g. API Guidelines v2"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Content (Markdown or Plain Text)</label>
              <Textarea
                placeholder="Paste the document text or policy markdown here..."
                value={docText}
                onChange={(e) => setDocText(e.target.value)}
                className="mt-1 font-mono text-xs"
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIngestOpen(false)}>Cancel</Button>
            <Button
              disabled={!docName.trim() || !docText.trim() || ingestMutation.isPending}
              onClick={() =>
                ingestMutation.mutate({
                  name: docName,
                  rawText: docText,
                  sourceType: 'MANUAL',
                })
              }
            >
              {ingestMutation.isPending ? 'Ingesting...' : 'Ingest & Chunk'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// 3. AI APPS TAB
// ==========================================
function AppsTab({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [appType, setAppType] = useState<AIAppType>('CHAT_APP');
  const [desc, setDesc] = useState('');
  const [testApp, setTestApp] = useState<AIApp | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);

  const { data: apps = [], isLoading } = useQuery({
    queryKey: queryKeys.aiApps.list(workspaceId),
    queryFn: () => aiAppsApi.list(workspaceId),
  });

  const createAppMutation = useMutation({
    mutationFn: (data: any) => aiAppsApi.create(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiApps.list(workspaceId) });
      toast.success('AI App created');
      setCreateOpen(false);
      setName('');
      setDesc('');
    },
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      aiAppsApi.publish(workspaceId, id, isPublished),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.aiApps.list(workspaceId) });
      toast.success('App publishing state updated');
    },
  });

  const executeAppMutation = useMutation({
    mutationFn: (appId: string) =>
      aiAppsApi.execute(workspaceId, appId, { input: 'Test run payload' }),
    onSuccess: (res: any) => {
      setTestResult(String(res.result));
      toast.success('App executed successfully');
    },
  });

  if (isLoading) return <LoadingState label="Loading AI apps..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">AI Applications</h2>
          <p className="text-xs text-muted-foreground">
            Package autonomous agents, workflows, knowledge bases, and prompts into standalone published apps.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} leadingIcon={<Plus className="size-4" />}>
          New AI App
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {apps.map((app: any) => (
          <Card key={app.id} className="p-5 bg-surface space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="size-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{app.name}</h4>
                  <span className="font-mono text-[10px] text-muted-foreground">/{app.slug}</span>
                </div>
              </div>
              <Badge variant={app.isPublished ? 'success' : 'outline'} className="text-[10px]">
                {app.isPublished ? 'Published' : 'Draft'}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2">
              {app.description || 'Configured AI Application'}
            </p>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <Badge variant="secondary" className="text-[10px]">
                {app.appType.replace('_', ' ')}
              </Badge>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTestApp(app);
                    executeAppMutation.mutate(app.id);
                  }}
                  leadingIcon={<Play className="size-3" />}
                >
                  Test Run
                </Button>
                <Button
                  size="sm"
                  variant={app.isPublished ? 'secondary' : 'primary'}
                  onClick={() =>
                    togglePublishMutation.mutate({
                      id: app.id,
                      isPublished: !app.isPublished,
                    })
                  }
                >
                  {app.isPublished ? 'Unpublish' : 'Publish'}
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Test App Modal */}
      {testApp && (
        <Dialog open={Boolean(testApp)} onOpenChange={() => setTestApp(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Test Run: {testApp.name}</DialogTitle>
              <DialogDescription>Executing application via the unified AI Runtime.</DialogDescription>
            </DialogHeader>
            <div className="py-2">
              {executeAppMutation.isPending ? (
                <LoadingState label="Running app..." />
              ) : (
                <div className="rounded-lg border border-border bg-background p-4 font-mono text-xs text-foreground">
                  {testResult || 'Ready'}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setTestApp(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create App Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create AI App</DialogTitle>
            <DialogDescription>
              Build an AI application that can be used across channels, DMs, or standalone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">App Name</label>
              <Input
                placeholder="e.g. Support Copilot, Ticket Router"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">App Type</label>
              <Select value={appType} onValueChange={(v: any) => setAppType(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CHAT_APP">Chat Application</SelectItem>
                  <SelectItem value="WORKFLOW_APP">Workflow Application</SelectItem>
                  <SelectItem value="AGENT_APP">Agent Application</SelectItem>
                  <SelectItem value="CUSTOM_UI">Custom UI Widget</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea
                placeholder="What does this app do?"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={!name.trim() || createAppMutation.isPending}
              onClick={() => createAppMutation.mutate({ name, appType, description: desc })}
            >
              Create App
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// 4. EXECUTIONS TAB
// ==========================================
function ExecutionsTab({ workspaceId }: { workspaceId: string }) {
  const [selectedExec, setSelectedExec] = useState<AIExecution | null>(null);

  const { data: executions = [], isLoading } = useQuery({
    queryKey: queryKeys.aiExecutions.list(workspaceId),
    queryFn: () => aiExecutionsApi.list(workspaceId),
  });

  const feedbackMutation = useMutation({
    mutationFn: ({ executionId, rating }: { executionId: string; rating: 1 | -1 }) =>
      aiFeedbackApi.submit(workspaceId, { executionId, rating }),
    onSuccess: () => {
      toast.success('Feedback recorded. Thank you!');
    },
  });

  if (isLoading) return <LoadingState label="Loading execution logs..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Unified Execution Center</h2>
          <p className="text-xs text-muted-foreground">
            Audit, inspect, and monitor every run across Agents, Coworkers, Workflows, and Apps.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Executions Table */}
        <div className="space-y-3 lg:col-span-2">
          {!executions.length ? (
            <Card className="p-8 text-center bg-surface">
              <Clock className="size-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">No executions found</p>
              <p className="text-xs text-muted-foreground mt-1">Run an agent or workflow to generate execution traces.</p>
            </Card>
          ) : (
            <div className="divide-y divide-border rounded-xl border border-border bg-surface overflow-hidden">
              {executions.map((exec: any) => (
                <div
                  key={exec.id}
                  onClick={() => setSelectedExec(exec)}
                  className={cn(
                    'flex items-center justify-between p-4 cursor-pointer transition-colors',
                    selectedExec?.id === exec.id ? 'bg-primary/5' : 'hover:bg-muted/40',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={
                        exec.status === 'COMPLETED'
                          ? 'success'
                          : exec.status === 'RUNNING'
                          ? 'primary'
                          : 'destructive'
                      }
                      className="text-[10px]"
                    >
                      {exec.status}
                    </Badge>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{exec.entityType}</span>
                        <span className="font-mono text-[11px] text-muted-foreground">{exec.id.slice(0, 8)}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Started: {new Date(exec.startedAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{exec.latencyMs} ms</span>
                    <span>{exec.tokensUsed} tokens</span>
                    <ChevronRight className="size-4" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trace Details Inspector */}
        <div className="lg:col-span-1">
          {selectedExec ? (
            <Card className="p-5 bg-surface space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h4 className="text-xs font-bold text-foreground">Execution Trace</h4>
                  <span className="font-mono text-[10px] text-muted-foreground">{selectedExec.id}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => feedbackMutation.mutate({ executionId: selectedExec.id, rating: 1 })}
                  >
                    <ThumbsUp className="size-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => feedbackMutation.mutate({ executionId: selectedExec.id, rating: -1 })}
                  >
                    <ThumbsDown className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-semibold text-foreground">{selectedExec.status}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Latency:</span>
                  <span className="font-semibold text-foreground">{selectedExec.latencyMs} ms</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Tokens Used:</span>
                  <span className="font-semibold text-foreground">{selectedExec.tokensUsed}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">Estimated Cost:</span>
                  <span className="font-semibold text-foreground">${selectedExec.totalCost}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-muted-foreground block mb-2">Input / State</span>
                <pre className="p-2.5 rounded-lg bg-background border border-border text-[10px] font-mono overflow-x-auto text-foreground">
                  {JSON.stringify(selectedExec.stateJson, null, 2)}
                </pre>
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center bg-surface text-xs text-muted-foreground">
              Select an execution to inspect its step breakdown and telemetry.
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 5. MCP TAB
// ==========================================
function MCPTab({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const { data: connections = [], isLoading } = useQuery({
    queryKey: queryKeys.mcp.connections(workspaceId),
    queryFn: () => mcpApi.listConnections(workspaceId),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => mcpApi.createConnection(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcp.connections(workspaceId) });
      toast.success('MCP server registered');
      setCreateOpen(false);
      setName('');
      setUrl('');
    },
  });

  const syncMutation = useMutation({
    mutationFn: (id: string) => mcpApi.syncTools(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mcp.connections(workspaceId) });
      toast.success('MCP tools synchronized');
    },
  });

  if (isLoading) return <LoadingState label="Loading MCP connections..." />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Model Context Protocol (MCP)</h2>
          <p className="text-xs text-muted-foreground">
            Connect standard MCP servers to discover remote tools and data sources for your agents.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} leadingIcon={<Plus className="size-4" />}>
          Connect MCP Server
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {connections.map((conn: any) => (
          <Card key={conn.id} className="p-5 bg-surface space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Plug className="size-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{conn.name}</h4>
                  <span className="font-mono text-[10px] text-muted-foreground truncate block max-w-44">
                    {conn.serverUrl}
                  </span>
                </div>
              </div>
              <Badge variant="success" className="text-[10px]">
                {conn.status}
              </Badge>
            </div>

            <div className="space-y-1 text-xs">
              <span className="text-muted-foreground">Discovered Tools:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(conn.discoveredToolsJson as any[])?.map((t: any, i: number) => (
                  <Badge key={i} variant="outline" className="text-[9px] font-mono">
                    {t.name}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end pt-2 border-t border-border">
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMutation.mutate(conn.id)}
                leadingIcon={<RefreshCw className="size-3" />}
              >
                Sync Tools
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Connect MCP Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect MCP Server</DialogTitle>
            <DialogDescription>
              Provide the endpoint of your MCP server (SSE or HTTP transport).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Server Name</label>
              <Input
                placeholder="e.g. GitHub MCP, Postgres MCP"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Server URL</label>
              <Input
                placeholder="https://mcp.internal.company.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              disabled={!name.trim() || !url.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate({ name, serverUrl: url })}
            >
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==========================================
// 6. MODELS TAB (MODEL HUB)
// ==========================================
function ModelsTab({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">Centralized Model Hub</h2>
        <p className="text-xs text-muted-foreground">
          Pluggable providers: Chat, Reasoning, Vision, Embeddings, Reranking, and Audio.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AI_MODELS.map((m: any) => (
          <Card key={m.value} className="p-4 bg-surface space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground">{m.label}</span>
              <Badge variant="outline" className="text-[10px] uppercase font-mono">
                {m.category}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{m.description || m.label}</p>
            {m.badge ? (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {m.badge}
              </Badge>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}

// ==========================================
// PLACEHOLDER WRAPPERS ROUTING TO EXISTING VIEWS
// ==========================================
function AgentsTab({ workspaceId }: { workspaceId: string }) {
  const currentWorkspace = useCurrentWorkspace();
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Autonomous Agents</h2>
        <Button
          size="sm"
          onClick={() => navigate(`/w/${currentWorkspace.slug}/agents/builder`)}
          leadingIcon={<Plus className="size-4" />}
        >
          Open Agent Builder
        </Button>
      </div>
      <Card className="p-6 text-center bg-surface">
        <Bot className="size-8 text-primary mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground">Agent Management</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Create and test autonomous agents equipped with tools, memory, knowledge bases, and behavioral guards.
        </p>
        <Button
          size="sm"
          className="mt-4"
          onClick={() => navigate(`/w/${currentWorkspace.slug}/agents/builder`)}
        >
          Launch Agent Studio
        </Button>
      </Card>
    </div>
  );
}

function CoworkersTab({ workspaceId }: { workspaceId: string }) {
  const currentWorkspace = useCurrentWorkspace();
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">AI Coworkers</h2>
        <Button
          size="sm"
          onClick={() => navigate(`/w/${currentWorkspace.slug}/coworkers`)}
        >
          Open Coworker Directory
        </Button>
      </div>
      <Card className="p-6 text-center bg-surface">
        <UserCheck className="size-8 text-primary mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground">Persistent AI Teammates</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Coworkers participate directly in channels, DMs, and scheduled work, sharing the same unified AI Runtime.
        </p>
      </Card>
    </div>
  );
}

function WorkflowsTab({ workspaceId }: { workspaceId: string }) {
  const currentWorkspace = useCurrentWorkspace();
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Visual Workflows</h2>
        <Button
          size="sm"
          onClick={() => navigate(`/w/${currentWorkspace.slug}/automations/builder`)}
          leadingIcon={<Plus className="size-4" />}
        >
          Launch Workflow Builder
        </Button>
      </div>
      <Card className="p-6 text-center bg-surface">
        <Workflow className="size-8 text-primary mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground">Node-Based Automation Engine</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Build multi-step AI pipelines supporting 35+ node types, universal variables, branching, loops, and human approval.
        </p>
      </Card>
    </div>
  );
}

function ToolsTab({ workspaceId }: { workspaceId: string }) {
  const defaultTools = [
    { name: 'search_docs', desc: 'Search workspace documentation and knowledge base', type: 'Platform' },
    { name: 'create_doc', desc: 'Create a new document, note or specification', type: 'Platform' },
    { name: 'create_task', desc: 'Create an agile task on Kanban board', type: 'Platform' },
    { name: 'send_channel_message', desc: 'Post a notification or message to a channel', type: 'Communication' },
    { name: 'web_request', desc: 'Fetch external HTTP API data', type: 'Network' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Universal Tool Registry</h2>
        <p className="text-xs text-muted-foreground">
          Reusable tools available across Agents, Coworkers, Workflows, and Composer.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {defaultTools.map((t) => (
          <Card key={t.name} className="p-4 bg-surface space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold text-foreground">{t.name}</span>
              <Badge variant="secondary" className="text-[10px]">{t.type}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t.desc}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PromptsTab({ workspaceId }: { workspaceId: string }) {
  const currentWorkspace = useCurrentWorkspace();
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Prompt Library</h2>
        <Button
          size="sm"
          onClick={() => navigate(`/w/${currentWorkspace.slug}/ai/prompts`)}
        >
          Open Full Library
        </Button>
      </div>
      <Card className="p-6 text-center bg-surface">
        <Library className="size-8 text-primary mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground">Prompt Engineering & Versioning</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
          Manage reusable system instructions, prompt templates with variables, and test them with diverse inputs.
        </p>
      </Card>
    </div>
  );
}

function AnalyticsTab({ workspaceId }: { workspaceId: string }) {
  const currentWorkspace = useCurrentWorkspace();
  const navigate = useNavigate();
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">AI Observability & Analytics</h2>
        <Button
          size="sm"
          onClick={() => navigate(`/w/${currentWorkspace.slug}/settings/analytics`)}
        >
          Full Analytics
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 bg-surface">
          <span className="text-xs text-muted-foreground">Tokens / 24h</span>
          <div className="text-xl font-bold text-foreground mt-1">24,850</div>
        </Card>
        <Card className="p-4 bg-surface">
          <span className="text-xs text-muted-foreground">Average Latency</span>
          <div className="text-xl font-bold text-foreground mt-1">840 ms</div>
        </Card>
        <Card className="p-4 bg-surface">
          <span className="text-xs text-muted-foreground">Estimated Cost</span>
          <div className="text-xl font-bold text-foreground mt-1">$0.049</div>
        </Card>
      </div>
    </div>
  );
}

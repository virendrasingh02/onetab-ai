import { agentsApi } from '@org/api-client';
import { agentService } from '../services/agentService.js';
import { executionService } from '../services/executionService.js';
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
  Input,
  LoadingState,
  toast,
} from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  DollarSign,
  Download,
  FileCode,
  Filter,
  Grid,
  Heart,
  Layers,
  LayoutList,
  Pin,
  Play,
  Plus,
  Search,
  Sparkles,
  Upload,
  Wand2,
  Wrench,
  Zap,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { STUDIO_TEMPLATES } from '../data/templates.js';
import { useStudioSession } from '../session-guard.js';

function countTools(tools: string | null | undefined): number {
  if (!tools) return 0;
  try {
    const parsed: unknown = JSON.parse(tools);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function OverviewPage() {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft' | 'archived'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [pinnedAgentIds, setPinnedAgentIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(`pinned_agents_${activeWorkspace.id}`) || '[]');
    } catch {
      return [];
    }
  });

  // Modals
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [isGeneratingPromptAgent, setIsGeneratingPromptAgent] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  // Load workspace agents
  const { data: agents = [], isLoading: isLoadingAgents } = useQuery({
    queryKey: ['agents', activeWorkspace.id],
    queryFn: async () => {
      try {
        const live = await agentsApi.list(activeWorkspace.id);
        if (live && live.length > 0) return live;
      } catch {
        // Fallback
      }
      return agentService.getAgents(activeWorkspace.id);
    },
  });

  // Load workspace execution logs
  const { data: logs = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ['workspace-logs', activeWorkspace.id],
    queryFn: async () => {
      try {
        const live = await agentsApi.workspaceLogs(activeWorkspace.id);
        if (live && live.length > 0) return live;
      } catch {
        // Fallback
      }
      return executionService.getExecutions();
    },
  });

  const togglePinAgent = (agentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedAgentIds((prev) => {
      const next = prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId];
      localStorage.setItem(`pinned_agents_${activeWorkspace.id}`, JSON.stringify(next));
      toast.success(next.includes(agentId) ? 'Agent pinned to top' : 'Agent unpinned');
      return next;
    });
  };

  // Metrics calculation
  const publishedAgents = agents.filter(
    (a) => (a.configuration as any)?.status === 'published',
  );
  const draftAgents = agents.filter(
    (a) => (a.configuration as any)?.status !== 'published' && (a.configuration as any)?.status !== 'archived',
  );
  const archivedAgents = agents.filter(
    (a) => (a.configuration as any)?.status === 'archived',
  );

  const totalTokens = logs.reduce((acc, l) => acc + (l.tokensUsed || 0), 0);
  const estimatedCost = ((totalTokens / 1000) * 0.003).toFixed(2);
  const successfulRuns = logs.filter((l) => l.status === 'SUCCESS').length;
  const failedRuns = logs.filter((l) => l.status === 'FAILED').length;
  const successRate = logs.length > 0 ? Math.round((successfulRuns / logs.length) * 100) : 100;
  const avgLatencyMs = logs.length > 0
    ? Math.round(logs.reduce((acc, l) => acc + (l.durationMs || 420), 0) / logs.length)
    : 420;

  // Filter and sort agents
  const filteredAgents = useMemo(() => {
    return agents
      .filter((a) => {
        const config = (a.configuration as any) || {};
        if (statusFilter === 'published' && config.status !== 'published') return false;
        if (statusFilter === 'draft' && (config.status === 'published' || config.status === 'archived')) return false;
        if (statusFilter === 'archived' && config.status !== 'archived') return false;
        if (
          search.trim() &&
          !a.name.toLowerCase().includes(search.toLowerCase()) &&
          !(a.description || '').toLowerCase().includes(search.toLowerCase()) &&
          !(a.role || '').toLowerCase().includes(search.toLowerCase())
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        const aPinned = pinnedAgentIds.includes(a.id) ? 1 : 0;
        const bPinned = pinnedAgentIds.includes(b.id) ? 1 : 0;
        return bPinned - aPinned;
      });
  }, [agents, statusFilter, search, pinnedAgentIds]);

  // Create with Natural Language
  const handleGenerateFromPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim()) return;
    setIsGeneratingPromptAgent(true);
    try {
      const generatedName = promptText.split(' ').slice(0, 3).join(' ') + ' Agent';
      const newAgent = await agentService.createAgent(activeWorkspace.id, {
        name: generatedName,
        role: 'Autonomous Specialist',
        description: promptText,
        systemPrompt: `You are an AI Agent created to execute the following task: "${promptText}". Use available tools to solve user queries diligently.`,
        model: 'gpt-4o',
      });
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      setIsPromptModalOpen(false);
      setPromptText('');
      toast.success(`Agent "${generatedName}" generated from prompt!`);
      navigate(`/agents/${newAgent.id}`);
    } catch {
      toast.error('Failed to generate agent');
    } finally {
      setIsGeneratingPromptAgent(false);
    }
  };

  // Import Workflow JSON
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
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      setIsImportModalOpen(false);
      setImportJsonText('');
      toast.success(`Imported "${importedName}"!`);
      navigate(`/agents/${newAgent.id}`);
    } catch {
      toast.error('Invalid JSON format');
    }
  };

  if (isLoadingAgents) {
    return <LoadingState label="Loading Agent Studio dashboard…" />;
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-linear-to-r from-primary/10 via-primary/5 to-transparent p-6 shadow-xs">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            <span>AI Agent Studio — Enterprise Orchestration & Visual Builder</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Build, Test & Deploy Intelligent Autonomous Agents
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Construct visual node workflows, attach Firecrawl web extraction and MCP tools, implement human approval checkpoints, and publish immutable agent versions to <strong>{activeWorkspace.name}</strong>.
          </p>
          <div className="flex flex-wrap items-center gap-2.5 pt-3">
            <Button
              size="sm"
              onClick={() => navigate('/agents?create=blank')}
              className="gap-1.5 font-semibold"
            >
              <Plus className="size-4" /> Create Blank Agent
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPromptModalOpen(true)}
              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            >
              <Wand2 className="size-4" /> Build with AI Prompt
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="gap-1.5"
            >
              <Upload className="size-4" /> Import Workflow JSON
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/templates')}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Layers className="size-4" /> Explore 14+ Templates
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Row: 4 key KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* Total Agents */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Agents</span>
            <Bot className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {agents.length}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {publishedAgents.length} published · {draftAgents.length} drafts
          </div>
        </div>

        {/* Executions & Success Rate */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Runs & Success Rate</span>
            <Activity className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {successRate}%
          </div>
          <div className="mt-1 text-[11px] text-emerald-500 font-medium">
            {successfulRuns} succeeded · {failedRuns} failed ({logs.length} total)
          </div>
        </div>

        {/* Token Consumption */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Token Usage</span>
            <Coins className="size-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {totalTokens > 1000 ? `${(totalTokens / 1000).toFixed(1)}k` : totalTokens}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Tokens processed this month
          </div>
        </div>

        {/* Cost & Latency */}
        <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Est. Cost & Latency</span>
            <DollarSign className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            ${estimatedCost}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Avg response time: {avgLatencyMs}ms
          </div>
        </div>
      </div>

      {/* Main Grid: Agents Section (2 cols) + Templates / Quick Help (1 col) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 Cols: Agents Directory */}
        <div className="space-y-4 lg:col-span-2">
          {/* Controls Bar: Search, Filters, View Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
            <div className="flex flex-1 items-center gap-2 min-w-[200px]">
              <Search className="size-4 text-muted-foreground shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search agents by name, role, or description…"
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-1.5 border-l border-border pl-3">
              {(['all', 'published', 'draft', 'archived'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    statusFilter === tab
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
                  }`}
                >
                  {tab}
                </button>
              ))}

              <div className="h-4 w-px bg-border mx-1" />

              <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-raised p-0.5">
                <button
                  onClick={() => setViewMode('grid')}
                  title="Grid View"
                  className={`size-6 rounded p-1 transition-colors ${
                    viewMode === 'grid' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Grid className="size-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  title="List View"
                  className={`size-6 rounded p-1 transition-colors ${
                    viewMode === 'list' ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LayoutList className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 p-10 text-center text-muted-foreground">
              <Bot className="size-12 text-muted-foreground/30 mb-2" />
              <div className="text-sm font-semibold text-foreground">
                No Agents Found
              </div>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                No agents match your active filters. Create a new agent from scratch or generate one with natural language.
              </p>
              <Button
                size="sm"
                onClick={() => navigate('/agents?create=blank')}
                className="mt-4 gap-1.5"
              >
                <Plus className="size-3.5" /> Create Agent
              </Button>
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

                return (
                  <div
                    key={agent.id}
                    onClick={() => navigate(`/agents/${agent.id}`)}
                    className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-border bg-surface p-4 transition-all hover:border-primary/50 hover:shadow-md hover:bg-surface-raised/40"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold">
                            <Bot className="size-4" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                              <span>{agent.name}</span>
                              {isPinned && (
                                <Pin className="size-3 text-amber-500 fill-amber-500" />
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {agent.role || 'Assistant'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => togglePinAgent(agent.id, e)}
                            title={isPinned ? 'Unpin' : 'Pin to top'}
                            className={`size-6 rounded-md p-1 transition-colors ${
                              isPinned ? 'text-amber-500 hover:bg-amber-500/10' : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            <Pin className="size-3.5" />
                          </button>
                          <Badge
                            variant={isPublished ? 'success' : isArchived ? 'outline' : 'outline'}
                            className="text-[10px]"
                          >
                            {isPublished ? 'Published' : isArchived ? 'Archived' : 'Draft'}
                          </Badge>
                        </div>
                      </div>

                      <p className="mt-3 text-xs text-muted-foreground line-clamp-2">
                        {agent.description || agent.systemPrompt || 'No description set'}
                      </p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground font-mono">
                      <span>{version}</span>
                      <span>
                        {toolsCount} {toolsCount === 1 ? 'tool' : 'tools'} · {agent.model || 'llama3'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Table / List View */
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-surface-raised text-[11px] font-semibold text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Model</th>
                    <th className="px-4 py-3">Tools</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAgents.map((agent) => {
                    const config = (agent.configuration as any) || {};
                    const isPublished = config.status === 'published';
                    const toolsCount = countTools(agent.tools);

                    return (
                      <tr
                        key={agent.id}
                        onClick={() => navigate(`/agents/${agent.id}`)}
                        className="cursor-pointer hover:bg-surface-raised/50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground flex items-center gap-1.5">
                            <span>{agent.name}</span>
                            {pinnedAgentIds.includes(agent.id) && (
                              <Pin className="size-3 text-amber-500 fill-amber-500" />
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                            {agent.description || agent.role || 'Workflow agent'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={isPublished ? 'success' : 'outline'} className="text-[10px]">
                            {isPublished ? 'Published' : 'Draft'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                          {agent.model || 'llama3'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {toolsCount} tools
                        </td>
                        <td className="px-4 py-3 text-right">
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent Executions Log Preview */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="size-4 text-sky-500" />
                <h3 className="text-xs font-bold text-foreground">
                  Recent Executions Telemetry
                </h3>
              </div>
              <Link
                to="/executions"
                className="text-xs text-primary hover:underline"
              >
                View all executions ({logs.length})
              </Link>
            </div>

            {isLoadingLogs ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Loading recent executions…
              </div>
            ) : logs.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No execution logs recorded yet. Run a test turn to populate telemetry.
              </div>
            ) : (
              <div className="space-y-1.5">
                {logs.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-surface-raised/40 p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className={`size-2 rounded-full ${
                          log.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-destructive'
                        }`}
                      />
                      <span className="font-semibold text-foreground truncate">
                        {log.agent?.name || 'Agent Run'}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                        {log.promptText || 'Manual test prompt'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                      <span>{log.durationMs || 340}ms</span>
                      <span>{log.tokensUsed?.toLocaleString() || 0} tokens</span>
                      <Badge
                        variant={log.status === 'SUCCESS' ? 'success' : 'destructive'}
                        className="text-[10px]"
                      >
                        {log.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Recommended Templates & Quick Actions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-amber-500" />
              <h2 className="text-sm font-bold text-foreground">
                Featured Templates
              </h2>
            </div>
            <Link
              to="/templates"
              className="text-xs font-medium text-primary hover:underline"
            >
              Browse All ({STUDIO_TEMPLATES.length})
            </Link>
          </div>

          <div className="space-y-3">
            {STUDIO_TEMPLATES.slice(0, 5).map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => navigate(`/templates?use=${tpl.id}`)}
                className="group flex cursor-pointer flex-col rounded-xl border border-border bg-surface p-3.5 transition-all hover:border-primary/50 hover:bg-surface-raised/40 hover:shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    {tpl.name}
                  </span>
                  <Badge variant="outline" className="text-[9px]">
                    {tpl.tags[0]}
                  </Badge>
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                  {tpl.description}
                </p>
                <div className="mt-2.5 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                  <span>{tpl.nodes.length} nodes · {tpl.edges.length} edges</span>
                  <span className="text-primary font-semibold group-hover:underline">
                    Use Template →
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Setup Card */}
          <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <Wrench className="size-3.5 text-primary" />
              Developer Resources
            </h3>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Call any published agent via the REST API or deploy it as an embedded chat widget onto your website.
            </p>
            <div className="flex flex-col gap-1.5 pt-1">
              <Link
                to="/developer"
                className="text-xs text-primary font-medium hover:underline flex items-center justify-between"
              >
                <span>API Keys & SDK Snippets</span>
                <ArrowRight className="size-3" />
              </Link>
              <Link
                to="/mcp"
                className="text-xs text-primary font-medium hover:underline flex items-center justify-between"
              >
                <span>Model Context Protocol (MCP)</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL 1: Natural Language Prompt-to-Agent Creation */}
      <Dialog open={isPromptModalOpen} onOpenChange={setIsPromptModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Wand2 className="size-5 text-primary" />
              Generate Agent with Natural Language
            </DialogTitle>
            <DialogDescription>
              Describe the business task or autonomous workflow you want to create. AI will configure the nodes, model instructions, and tool bindings automatically.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleGenerateFromPrompt}>
            <DialogBody className="space-y-3 py-4">
              <textarea
                rows={5}
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder="e.g. Create a Customer Support Agent that handles refund inquiries, searches knowledge base docs, verifies purchase orders via database, and requests human manager approval if refund is over $200."
                className="w-full rounded-lg border border-border bg-surface-raised p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                required
              />
              <div className="flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                <span className="font-semibold text-foreground">Try asking for:</span>
                <button
                  type="button"
                  onClick={() => setPromptText('Create a Competitor Research Agent that scrapes web pricing via Firecrawl, compares tier features, and writes an executive markdown brief.')}
                  className="rounded bg-surface px-1.5 py-0.5 border border-border hover:border-primary transition-colors"
                >
                  Competitor Research
                </button>
                <button
                  type="button"
                  onClick={() => setPromptText('Create an Inbound Lead Qualification agent that scores company size, checks CRM records, and notifies sales in Slack.')}
                  className="rounded bg-surface px-1.5 py-0.5 border border-border hover:border-primary transition-colors"
                >
                  Lead Qualifier
                </button>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                variant="outline"
                type="button"
                onClick={() => setIsPromptModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={isGeneratingPromptAgent}
                disabled={!promptText.trim()}
                className="gap-1.5"
              >
                <Sparkles className="size-4" />
                Generate Agent
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Import Workflow JSON */}
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
            <textarea
              rows={8}
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste workflow JSON here (containing nodes and edges array)…"
              className="w-full font-mono rounded-lg border border-border bg-surface-raised p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
  Input,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  Bot,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Flame,
  GitBranch,
  Layers,
  MoreVertical,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { agentService } from '../services/agentService.js';
import { naturalLanguageService } from '../services/naturalLanguageService.js';
import { useStudioSession } from '../session-guard.js';

export function WorkflowsPage() {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [filterTrigger, setFilterTrigger] = useState('ALL');
  const [viewMode, setViewMode] = useState('grid');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAiCreateOpen, setIsAiCreateOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  // New workflow form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTrigger, setNewTrigger] = useState('MANUAL');

  // Load agents / workflows
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents', activeWorkspace.id],
    queryFn: () => agentService.getAgents(activeWorkspace.id),
  });

  const createMutation = useMutation({
    mutationFn: (data) => agentService.createAgent(activeWorkspace.id, data),
    onSuccess: (newWorkflow) => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      setIsCreateOpen(false);
      setIsAiCreateOpen(false);
      setNewTitle('');
      setNewDesc('');
      toast.success(`Workflow "${newWorkflow.name}" created! Opening builder...`);
      navigate(`/agents/${newWorkflow.id}`);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (agentId) => agentService.duplicateAgent(activeWorkspace.id, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      toast.success('Workflow duplicated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (agentId) => agentService.deleteAgent(activeWorkspace.id, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      toast.success('Workflow deleted');
    },
  });

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    createMutation.mutate({
      name: newTitle.trim(),
      role: 'Workflow Automator',
      description: newDesc.trim() || 'Visual multi-node execution graph',
      tools: ['knowledge_search', 'firecrawl_search'],
    });
  };

  const handleAiGenerateSubmit = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setIsGeneratingAi(true);
    try {
      const generated = await naturalLanguageService.generateWorkflowFromPrompt(aiPrompt);
      createMutation.mutate({
        name: generated.agentName,
        role: generated.role,
        description: generated.description,
        model: generated.model,
        graphJson: JSON.stringify({ nodes: generated.nodes, edges: generated.edges }),
      });
    } catch {
      toast.error('Failed to generate workflow from prompt');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const filteredWorkflows = useMemo(() => {
    return agents.filter((w) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search.trim() ||
        w.name.toLowerCase().includes(q) ||
        (w.description && w.description.toLowerCase().includes(q));
      return matchesSearch;
    });
  }, [agents, search]);

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Visual Workflows
            </h1>
            <Badge variant="outline" className="text-xs">
              {agents.length} workflows
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Multi-step graph pipelines, automated triggers, conditional branching, and human approval steps.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsAiCreateOpen(true)}
            className="gap-1.5 text-xs text-primary border-primary/30 bg-primary/5 hover:bg-primary/10"
          >
            <Sparkles className="size-3.5" />
            Build with AI Prompt
          </Button>

          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-3.5" />
            New Workflow
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search workflows by name or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-surface p-1 text-xs">
            {['ALL', 'SCHEDULE', 'WEBHOOK', 'CHAT'].map((trig) => (
              <button
                key={trig}
                onClick={() => setFilterTrigger(trig)}
                className={cn(
                  'rounded px-2.5 py-1 font-medium transition-colors',
                  filterTrigger === trig
                    ? 'bg-primary/15 text-primary'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {trig === 'ALL' ? 'All Triggers' : trig}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-lg border border-border bg-surface p-1 text-xs">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'rounded px-2.5 py-1 font-medium',
                viewMode === 'grid' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground',
              )}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'rounded px-2.5 py-1 font-medium',
                viewMode === 'list' ? 'bg-card text-foreground shadow-2xs' : 'text-muted-foreground',
              )}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredWorkflows.map((workflow) => {
            const isPub = workflow.status === 'published';
            let nodeCount = 3;
            try {
              if (workflow.graphJson) {
                const parsed = JSON.parse(workflow.graphJson);
                nodeCount = parsed.nodes?.length || 3;
              }
            } catch {
              // fallback
            }

            return (
              <div
                key={workflow.id}
                className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-2xs transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                        <GitBranch className="size-4.5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {workflow.name}
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                          {nodeCount} nodes • {workflow.model || 'gpt-4o'}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant={isPub ? 'default' : 'outline'}
                      className={cn(
                        'text-[10px] px-1.5 py-0.2 uppercase tracking-wide',
                        isPub ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' : 'text-muted-foreground',
                      )}
                    >
                      {isPub ? 'Published' : 'Draft'}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {workflow.description || 'No description provided.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Clock className="size-3 text-muted-foreground" />
                    <span>Updated {new Date(workflow.updatedAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => duplicateMutation.mutate(workflow.id)}
                      title="Duplicate workflow"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        const json = agentService.exportAgent(workflow);
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${workflow.name.toLowerCase().replace(/\s+/g, '_')}_workflow.json`;
                        a.click();
                        toast.success('Workflow exported as JSON');
                      }}
                      title="Export JSON"
                    >
                      <Download className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        if (confirm(`Delete workflow "${workflow.name}"?`)) {
                          deleteMutation.mutate(workflow.id);
                        }
                      }}
                      className="text-destructive hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                    <Button
                      size="xs"
                      onClick={() => navigate(`/agents/${workflow.id}`)}
                      className="gap-1 ml-1"
                    >
                      <span>Open Canvas</span>
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-raised text-[11px] font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Workflow Name</th>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Executions</th>
                <th className="px-4 py-3">Last Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredWorkflows.map((workflow) => (
                <tr key={workflow.id} className="hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <GitBranch className="size-4 text-primary shrink-0" />
                      <div>
                        <div>{workflow.name}</div>
                        <div className="text-[11px] text-muted-foreground line-clamp-1">{workflow.description}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{workflow.model || 'gpt-4o'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={workflow.status === 'published' ? 'success' : 'outline'} className="text-[10px]">
                      {workflow.status || 'draft'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {workflow.stats?.totalRuns || 0} runs ({workflow.stats?.successRate || 100}%)
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(workflow.updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="xs" onClick={() => navigate(`/agents/${workflow.id}`)}>
                      Open Canvas
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Blank Workflow Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Visual Workflow</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            <DialogBody className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-foreground">Workflow Title</label>
                <Input
                  placeholder="e.g. Lead Enrichment & Slack Alerts"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 text-xs"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Description (Optional)</label>
                <Input
                  placeholder="What business process does this automate?"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground">Primary Trigger</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  {[
                    { id: 'MANUAL', label: 'Manual Run', icon: Play },
                    { id: 'CHAT', label: 'Chat Message', icon: Bot },
                    { id: 'SCHEDULE', label: 'Recurring Cron', icon: Clock },
                    { id: 'WEBHOOK', label: 'HTTP Webhook', icon: Zap },
                  ].map((trig) => (
                    <button
                      key={trig.id}
                      type="button"
                      onClick={() => setNewTrigger(trig.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border p-2 text-xs font-medium text-left transition-colors',
                        newTrigger === trig.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-surface text-muted-foreground hover:bg-surface-raised hover:text-foreground',
                      )}
                    >
                      <trig.icon className="size-3.5" />
                      <span>{trig.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </DialogBody>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending}>
                Create & Open Builder
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AI Prompt Workflow Generator Dialog */}
      <Dialog open={isAiCreateOpen} onOpenChange={setIsAiCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Sparkles className="size-4" />
              </div>
              <DialogTitle>Generate Workflow with AI Prompt</DialogTitle>
            </div>
          </DialogHeader>
          <form onSubmit={handleAiGenerateSubmit}>
            <DialogBody className="space-y-3 py-2">
              <p className="text-xs text-muted-foreground">
                Describe the autonomous workflow you want to construct in plain English. The AI builder will generate the nodes, connect edges, configure models, and map variables automatically.
              </p>
              <textarea
                rows={4}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Scrape pricing pages from 3 competitor websites daily using Firecrawl, synthesize key differences into an executive summary, and ask for supervisor approval before posting to Slack."
                className="w-full rounded-lg border border-border bg-surface p-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                required
              />
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase">Try Examples:</div>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Competitor pricing crawl with Firecrawl & Slack',
                    'Customer support RAG with refund supervisor sign-off',
                    'GitHub PR code audit with security checks',
                  ].map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setAiPrompt(ex)}
                      className="rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </DialogBody>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAiCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={isGeneratingAi} className="gap-1.5 font-semibold">
                <Sparkles className="size-3.5" />
                Generate Workflow
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

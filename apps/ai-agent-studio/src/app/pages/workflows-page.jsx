import { useState, useMemo } from 'react';
import { useNavigate } from '../router.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FilterChips,
  Badge,
  confirm,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
  EmptyState,
  ErrorState,
  LoadingState,
  Input,
  SearchInput,
  AIModelBadge,
  toast,
  Label,
  Textarea,
  SegmentedControl,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Bot,
  Clock,
  Copy,
  Download,
  GitBranch,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { agentService } from '../services/agentService.js';
import { SectionHeader } from '../components/section-tabs.js';
import { ListToolbar } from '../components/list-toolbar.js';
import { useStudioSession } from '../session-guard.js';

export function WorkflowsPage() {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAiCreateOpen, setIsAiCreateOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  // New workflow form state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTrigger, setNewTrigger] = useState('MANUAL');

  // Load agents / workflows
  const { data: agents = [], isLoading, isError, refetch } = useQuery({
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

  // Planned for real against the workspace's tools and apps by "Create with one prompt".
  const handleAiGenerateSubmit = (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    navigate(`/create?prompt=${encodeURIComponent(aiPrompt.trim())}&go=1`);
  };

  const filteredWorkflows = useMemo(() => {
    return agents.filter((w) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search.trim() ||
        w.name.toLowerCase().includes(q) ||
        (w.description && w.description.toLowerCase().includes(q));
      const isPub = w.status === 'published';
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'published' ? isPub : !isPub);
      return matchesSearch && matchesStatus;
    });
  }, [agents, search, statusFilter]);

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <SectionHeader
        section="agents"
        counts={{ workflows: agents.length }}
        actions={
          <>
            <Button size="sm" variant="outline" leadingIcon={<Sparkles />} onClick={() => setIsAiCreateOpen(true)}>
              Build with AI
            </Button>
            <Button size="sm" variant="primary" leadingIcon={<Plus />} onClick={() => setIsCreateOpen(true)}>
              New workflow
            </Button>
          </>
        }
      />

      <div className="flex-1 p-4 sm:p-6 space-y-4">
      <ListToolbar
        aria-label="Filter workflows"
        end={
          <SegmentedControl
            aria-label="View mode"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'grid', label: 'Grid' },
              { value: 'list', label: 'List' },
            ]}
          />
        }
      >
        <SearchInput
          value={search}
          onValueChange={setSearch}
          placeholder="Search by name or description…"
          aria-label="Search workflows"
          wrapperClassName="w-full sm:w-64"
        />
        <FilterChips
          aria-label="Filter by status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All', count: agents.length },
            { value: 'published', label: 'Published', count: agents.filter((w) => w.status === 'published').length },
            { value: 'draft', label: 'Draft', count: agents.filter((w) => w.status !== 'published').length },
          ]}
        />
      </ListToolbar>

      {/* Grid View */}
      {isLoading ? (
        <LoadingState label="Loading workflows..." />
      ) : isError ? (
        <ErrorState title="Couldn’t load workflows" description="The platform didn’t answer. Try again in a moment." onRetry={() => void refetch()} />
      ) : filteredWorkflows.length === 0 ? (
        <EmptyState
          icon={<GitBranch />}
          title={agents.length ? 'No workflows match' : 'No workflows yet'}
          description={agents.length ? 'Try another search or status.' : 'Build one on the canvas, or describe it and let AI draft it.'}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredWorkflows.map((workflow) => {
            const isPub = workflow.status === 'published';
            let nodeCount = 0;
            try {
              if (workflow.graphJson) {
                const parsed = JSON.parse(workflow.graphJson);
                nodeCount = parsed.nodes?.length ?? 0;
              }
            } catch {
              // An unreadable graph shows as empty rather than with an invented count.
            }

            return (
              <div
                key={workflow.id}
                className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-4 shadow-2xs transition-all hover:border-primary/40 hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                        <GitBranch className="size-4.5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {workflow.name}
                        </h3>
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-xs text-muted-foreground">{nodeCount} nodes</span>
                          <AIModelBadge modelId={workflow.model || 'gpt-4o'} variant="subtle" size="xs" />
                        </div>
                      </div>
                    </div>

                    <Badge
                      variant={isPub ? 'default' : 'outline'}
                      className={cn(
                        'shrink-0 text-2xs px-1.5 py-0.2 uppercase tracking-wide',
                        isPub ? 'bg-success/15 text-success border-success/30' : 'text-muted-foreground',
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
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Delete “${workflow.name}”?`,
                          description: 'The workflow and its run history are removed. This can’t be undone.',
                          destructive: true,
                        });
                        if (ok) deleteMutation.mutate(workflow.id);
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
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead className="px-4 py-3">Workflow Name</TableHead>
                <TableHead className="px-4 py-3">Model</TableHead>
                <TableHead className="px-4 py-3">Status</TableHead>
                <TableHead className="px-4 py-3">Executions</TableHead>
                <TableHead className="px-4 py-3">Last Updated</TableHead>
                <TableHead className="px-4 py-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredWorkflows.map((workflow) => (
                <TableRow key={workflow.id} className="hover:bg-surface-raised transition-colors">
                  <TableCell className="px-4 py-3 font-medium text-foreground">
                    <div className="flex items-center gap-2">
                      <GitBranch className="size-4 text-primary shrink-0" />
                      <div>
                        <div>{workflow.name}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{workflow.description}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <AIModelBadge modelId={workflow.model || 'gpt-4o'} variant="subtle" size="xs" />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <Badge variant={workflow.status === 'published' ? 'success' : 'outline'} className="text-2xs">
                      {workflow.status || 'draft'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {workflow.stats?.totalRuns || 0} runs ({workflow.stats?.successRate || 100}%)
                  </TableCell>
                  <TableCell className="px-4 py-3 text-muted-foreground">
                    {new Date(workflow.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <Button size="xs" onClick={() => navigate(`/agents/${workflow.id}`)}>
                      Open Canvas
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
                <Label className="text-xs font-semibold text-foreground">Workflow Title</Label>
                <Input
                  placeholder="e.g. Lead Enrichment & Slack Alerts"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="mt-1 text-xs"
                  required
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-foreground">Description (Optional)</Label>
                <Input
                  placeholder="What business process does this automate?"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-foreground">Primary Trigger</Label>
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
              <Textarea rows={4} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="e.g. Scrape pricing pages from 3 competitor websites daily using Firecrawl, synthesize key differences into an executive summary, and ask for supervisor approval before posting to Slack." className="text-xs" required />
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-muted-foreground uppercase">Try Examples:</div>
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
                      className="rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
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
              <Button type="submit" size="sm" className="gap-1.5 font-semibold">
                <Sparkles className="size-3.5" />
                Generate Workflow
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}

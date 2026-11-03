import { useState, useMemo } from 'react';
import { useNavigate } from '../router.js';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { agentsApi } from '@org/api-client';
import {
  FilterChips,
  confirm,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  LoadingState,
  Input,
  SearchInput,
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
import { cn, formatRelative } from '@org/utils';
import {
  ArrowRight,
  Bot,
  Clock,
  Copy,
  Download,
  GitBranch,
  MessageSquare,
  MoreVertical,
  Play,
  Plus,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import { agentService, normalizeAgent } from '../services/agentService.js';
import { AgentAvatar } from '../data/agent-metadata.js';
import {
  AIEntityModel,
  AIEntityStatusBadge,
  plural,
} from '../components/common/ai-entity-summary.js';
import { EntityCard, EntityCount } from '../components/common/entity-card.js';
import { SectionHeader } from '../components/section-tabs.js';
import { ListToolbar } from '../components/list-toolbar.js';
import { useStudioSession } from '../session-guard.js';

const STATUS_FILTERS = [
  'all',
  'published',
  'testing',
  'draft',
  'paused',
  'archived',
];
const KNOWN_STATUSES = new Set(STATUS_FILTERS);

/** The lifecycle status the badge can show; anything unrecognised reads as a draft. */
function workflowStatus(workflow) {
  return KNOWN_STATUSES.has(workflow.status) ? workflow.status : 'draft';
}

function countNodes(workflow) {
  try {
    return workflow.graphJson
      ? (JSON.parse(workflow.graphJson).nodes?.length ?? 0)
      : 0;
  } catch {
    // An unreadable graph shows as empty rather than with an invented count.
    return 0;
  }
}

/** Live workflows only: Trash is managed from the Agents tab. */
function selectLiveWorkflows(list) {
  return list
    .map(normalizeAgent)
    .filter((w) => !w.deletedAt && w.status !== 'deleted');
}

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
  // Same cache entry as the Agents tab (the raw API list), normalised here, so neither page overwrites the other's shape.
  const {
    data: agents = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['agents', activeWorkspace.id],
    queryFn: () => agentsApi.list(activeWorkspace.id),
    select: selectLiveWorkflows,
  });

  const createMutation = useMutation({
    mutationFn: (data) => agentService.createAgent(activeWorkspace.id, data),
    onSuccess: (newWorkflow) => {
      queryClient.invalidateQueries({
        queryKey: ['agents', activeWorkspace.id],
      });
      setIsCreateOpen(false);
      setIsAiCreateOpen(false);
      setNewTitle('');
      setNewDesc('');
      toast.success(
        `Workflow "${newWorkflow.name}" created! Opening builder...`,
      );
      navigate(`/agents/${newWorkflow.id}`);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (agentId) =>
      agentService.duplicateAgent(activeWorkspace.id, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['agents', activeWorkspace.id],
      });
      toast.success('Workflow duplicated');
    },
    onError: (err) =>
      toast.error('Could not duplicate workflow', {
        description: err?.message,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (agentId) =>
      agentService.deleteAgent(activeWorkspace.id, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['agents', activeWorkspace.id],
      });
      toast.success('Workflow moved to Trash', {
        description: 'Restore it from Trash on the Agents tab.',
      });
    },
    onError: (err) =>
      toast.error('Could not move workflow to Trash', {
        description: err?.message,
      }),
  });

  const exportWorkflow = (workflow) => {
    const json = agentService.exportAgent(workflow);
    const url = URL.createObjectURL(
      new Blob([json], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.name.toLowerCase().replace(/\s+/g, '_')}_workflow.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Workflow exported as JSON');
  };

  const trashWorkflow = async (workflow) => {
    const ok = await confirm({
      title: `Move “${workflow.name}” to Trash?`,
      description:
        'It stops running immediately. You can restore it from Trash on the Agents tab.',
      confirmLabel: 'Move to Trash',
      tone: 'warning',
    });
    if (ok) deleteMutation.mutate(workflow.id);
  };

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
      const matchesStatus =
        statusFilter === 'all' || workflowStatus(w) === statusFilter;
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
            <Button
              size="sm"
              variant="outline"
              leadingIcon={<Sparkles />}
              onClick={() => setIsAiCreateOpen(true)}
            >
              Build with AI
            </Button>
            <Button
              size="sm"
              variant="primary"
              leadingIcon={<Plus />}
              onClick={() => setIsCreateOpen(true)}
            >
              New workflow
            </Button>
          </>
        }
      />

      <div className="p-4 sm:p-6 space-y-4 flex-1">
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
            options={STATUS_FILTERS.map((value) => ({
              value,
              label:
                value === 'all'
                  ? 'All'
                  : value[0].toUpperCase() + value.slice(1),
              count:
                value === 'all'
                  ? agents.length
                  : agents.filter((w) => workflowStatus(w) === value).length,
            }))}
          />
        </ListToolbar>

        {/* Grid View */}
        {isLoading ? (
          <LoadingState label="Loading workflows..." />
        ) : isError ? (
          <ErrorState
            title="Couldn’t load workflows"
            description="The platform didn’t answer. Try again in a moment."
            onRetry={() => void refetch()}
          />
        ) : filteredWorkflows.length === 0 ? (
          <EmptyState
            icon={<GitBranch />}
            title={agents.length ? 'No workflows match' : 'No workflows yet'}
            description={
              agents.length
                ? 'Try another search or status.'
                : 'Build one on the canvas, or describe it and let AI draft it.'
            }
          />
        ) : viewMode === 'grid' ? (
          <div className="gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 grid grid-cols-1">
            {filteredWorkflows.map((workflow) => {
              const nodeCount = countNodes(workflow);
              const openCanvas = () => navigate(`/agents/${workflow.id}`);
              return (
                <EntityCard
                  key={workflow.id}
                  name={workflow.name}
                  avatar={<AgentAvatar agent={workflow} size="lg" />}
                  status={
                    <AIEntityStatusBadge status={workflowStatus(workflow)} />
                  }
                  subtitle={
                    workflow.updatedAt
                      ? `Updated ${formatRelative(workflow.updatedAt)}`
                      : null
                  }
                  description={workflow.description}
                  owner={workflow.owner}
                  onOpen={openCanvas}
                  openLabel={`Open ${workflow.name} on the canvas`}
                  facts={
                    <>
                      <AIEntityModel
                        model={workflow.model || null}
                        provider={workflow.provider || null}
                        className="min-w-0 shrink"
                      />
                      <EntityCount
                        icon={<GitBranch />}
                        count={nodeCount}
                        label={plural(nodeCount, 'node')}
                      />
                    </>
                  }
                  actions={
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={openCanvas}
                      className="gap-1 text-xs"
                    >
                      Open{' '}
                      <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  }
                  menu={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Actions for ${workflow.name}`}
                          className="size-7 text-muted-foreground hover:text-foreground"
                        >
                          <MoreVertical className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 text-xs">
                        <DropdownMenuItem onClick={openCanvas}>
                          <GitBranch className="mr-2 size-3.5 text-primary" />{' '}
                          Open canvas
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => navigate(`/chat/${workflow.id}`)}
                        >
                          <MessageSquare className="mr-2 size-3.5" /> Test in
                          chat
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => duplicateMutation.mutate(workflow.id)}
                        >
                          <Copy className="mr-2 size-3.5" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => exportWorkflow(workflow)}
                        >
                          <Download className="mr-2 size-3.5" /> Export JSON
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => void trashWorkflow(workflow)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 size-3.5" /> Move to Trash
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                />
              );
            })}
          </div>
        ) : (
          /* List View */
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4 py-3">Workflow Name</TableHead>
                  <TableHead className="px-4 py-3">Model</TableHead>
                  <TableHead className="px-4 py-3">Status</TableHead>
                  <TableHead className="px-4 py-3">Executions</TableHead>
                  <TableHead className="px-4 py-3">Last Updated</TableHead>
                  <TableHead className="px-4 py-3 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWorkflows.map((workflow) => (
                  <TableRow
                    key={workflow.id}
                    className="transition-colors hover:bg-surface-raised"
                  >
                    <TableCell className="px-4 py-3 font-medium text-foreground">
                      <div className="gap-2 flex items-center">
                        <AgentAvatar agent={workflow} size="sm" />
                        <div className="min-w-0">
                          <div>{workflow.name}</div>
                          <div className="text-xs line-clamp-1 text-muted-foreground">
                            {workflow.description}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <AIEntityModel
                        model={workflow.model || null}
                        provider={workflow.provider || null}
                      />
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <AIEntityStatusBadge status={workflowStatus(workflow)} />
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {/* No runs means no success rate, not a made-up 100%. */}
                      {workflow.stats?.totalRuns
                        ? `${workflow.stats.totalRuns} ${plural(workflow.stats.totalRuns, 'run')} · ${workflow.stats.successRate}% ok`
                        : 'Not run yet'}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-muted-foreground">
                      {workflow.updatedAt
                        ? formatRelative(workflow.updatedAt)
                        : '—'}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-right">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => navigate(`/agents/${workflow.id}`)}
                        className="gap-1"
                      >
                        Open <ArrowRight className="size-3" />
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
                  <Label className="text-xs font-semibold text-foreground">
                    Workflow Title
                  </Label>
                  <Input
                    placeholder="e.g. Lead Enrichment & Slack Alerts"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="mt-1 text-xs"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">
                    Description (Optional)
                  </Label>
                  <Input
                    placeholder="What business process does this automate?"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-foreground">
                    Primary Trigger
                  </Label>
                  <div className="gap-2 mt-1.5 grid grid-cols-2">
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
                          'gap-2 p-2 text-xs font-medium flex items-center rounded-lg border text-left transition-colors',
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={createMutation.isPending}
                >
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
              <div className="gap-2 flex items-center">
                <div className="size-7 flex items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Sparkles className="size-4" />
                </div>
                <DialogTitle>Generate Workflow with AI Prompt</DialogTitle>
              </div>
            </DialogHeader>
            <form onSubmit={handleAiGenerateSubmit}>
              <DialogBody className="space-y-3 py-2">
                <p className="text-xs text-muted-foreground">
                  Describe the autonomous workflow you want to construct in
                  plain English. The AI builder will generate the nodes, connect
                  edges, configure models, and map variables automatically.
                </p>
                <Textarea
                  rows={4}
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g. Scrape pricing pages from 3 competitor websites daily using Firecrawl, synthesize key differences into an executive summary, and ask for supervisor approval before posting to Slack."
                  className="text-xs"
                  required
                />
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-muted-foreground uppercase">
                    Try Examples:
                  </div>
                  <div className="gap-1.5 flex flex-wrap">
                    {[
                      'Competitor pricing crawl with Firecrawl & Slack',
                      'Customer support RAG with refund supervisor sign-off',
                      'GitHub PR code audit with security checks',
                    ].map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        onClick={() => setAiPrompt(ex)}
                        className="px-2.5 py-1 text-xs rounded-full border border-border bg-surface text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                </div>
              </DialogBody>
              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAiCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="gap-1.5 font-semibold"
                >
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

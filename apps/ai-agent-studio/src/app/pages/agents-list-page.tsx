import { agentsApi } from '@org/api-client';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  LoadingState,
  toast,
} from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Copy,
  Edit2,
  ExternalLink,
  Flame,
  Layers,
  MoreVertical,
  Play,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { STUDIO_TEMPLATES } from '../data/templates.js';
import { useStudioSession } from '../session-guard.js';

export function AgentsListPage() {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'published' | 'draft'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(
    searchParams.get('create') === 'blank' || searchParams.get('create') === 'true',
  );

  // Form state for creating agent
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Assistant');
  const [newDesc, setNewDesc] = useState('');
  const [newPrompt, setNewPrompt] = useState('You are an intelligent autonomous AI employee.');
  const [newModel, setNewModel] = useState('llama3:latest');

  // Load agents
  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents', activeWorkspace.id],
    queryFn: () => agentsApi.list(activeWorkspace.id),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (input: any) => agentsApi.create(activeWorkspace.id, input),
    onSuccess: (newAgent) => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      setIsCreateOpen(false);
      toast.success(`Agent "${newAgent.name}" created!`);
      navigate(`/agents/${newAgent.id}`);
    },
    onError: (err: any) => {
      toast.error('Could not create agent', { description: err?.message });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (agentId: string) => agentsApi.remove(activeWorkspace.id, agentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      toast.success('Agent deleted');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    // Create default initial Start -> Agent -> End graph
    const initialGraph = {
      nodes: [
        {
          id: 'start-1',
          type: 'START',
          position: { x: 80, y: 200 },
          data: { label: 'Start Entry', subtitle: 'User prompt' },
        },
        {
          id: 'agent-1',
          type: 'AGENT',
          position: { x: 380, y: 200 },
          data: {
            label: newName,
            subtitle: newRole,
            config: {
              instructions: newPrompt,
              model: newModel,
              temperature: 0.7,
              tools: ['search_docs'],
            },
          },
        },
        {
          id: 'end-1',
          type: 'END',
          position: { x: 680, y: 200 },
          data: { label: 'Complete', subtitle: 'Output' },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'start-1', target: 'agent-1' },
        { id: 'e2-3', source: 'agent-1', target: 'end-1' },
      ],
    };

    createMutation.mutate({
      name: newName.trim(),
      role: newRole.trim(),
      description: newDesc.trim() || undefined,
      systemPrompt: newPrompt,
      model: newModel,
      provider: 'ollama',
      tools: ['search_docs'],
      graphJson: JSON.stringify(initialGraph),
    });
  };

  const handleDuplicate = (agent: any) => {
    createMutation.mutate({
      name: `${agent.name} (Copy)`,
      role: agent.role,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      model: agent.model,
      provider: agent.provider,
      tools: agent.tools ? JSON.parse(agent.tools) : [],
      graphJson: agent.graphJson,
    });
  };

  const filteredAgents = agents.filter((agent) => {
    const config = (agent.configuration as any) || {};
    const isPublished = config.status === 'published';

    if (filterTab === 'published' && !isPublished) return false;
    if (filterTab === 'draft' && isPublished) return false;

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      agent.name.toLowerCase().includes(q) ||
      (agent.role || '').toLowerCase().includes(q) ||
      (agent.description || '').toLowerCase().includes(q)
    );
  });

  if (isLoading) {
    return <LoadingState label="Loading workspace agents…" />;
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      {/* Header bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            My Agents
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage, configure and monitor autonomous workflows in {activeWorkspace.name}.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/templates')}
            className="gap-1.5 text-xs"
          >
            <Layers className="size-3.5" /> From Template
          </Button>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="size-4" /> New Blank Agent
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Filter Tabs */}
        <div className="flex items-center rounded-lg border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              filterTab === 'all'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({agents.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('published')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              filterTab === 'published'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Published ({agents.filter((a) => (a.configuration as any)?.status === 'published').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('draft')}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
              filterTab === 'draft'
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Drafts ({agents.filter((a) => (a.configuration as any)?.status !== 'published').length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search agents by name or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Grid of Agent Cards */}
      {filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 p-12 text-center text-muted-foreground">
          <Bot className="size-12 text-muted-foreground/30 mb-2" />
          <div className="text-sm font-semibold text-foreground">
            No Agents Matching Criteria
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {search ? 'Try clearing your search keyword.' : 'Create an agent to get started.'}
          </p>
          <Button
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="mt-4 gap-1.5"
          >
            <Plus className="size-3.5" /> Create Agent
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredAgents.map((agent) => {
            const config = (agent.configuration as any) || {};
            const isPublished = config.status === 'published';
            const version = config.currentVersion
              ? `v${config.currentVersion}.0.0`
              : 'v1.0.0-draft';
            let toolsCount = 0;
            try {
              toolsCount = agent.tools ? JSON.parse(agent.tools).length : 0;
            } catch {
              toolsCount = 0;
            }

            return (
              <div
                key={agent.id}
                className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-4 transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold">
                        <Bot className="size-5" />
                      </div>
                      <div>
                        <div
                          onClick={() => navigate(`/agents/${agent.id}`)}
                          className="cursor-pointer text-xs font-bold text-foreground hover:text-primary transition-colors line-clamp-1"
                        >
                          {agent.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {agent.role || 'Assistant'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Badge
                        variant={isPublished ? 'success' : 'outline'}
                        className="text-[10px]"
                      >
                        {isPublished ? 'Published' : 'Draft'}
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="size-7 text-muted-foreground hover:text-foreground"
                          >
                            <MoreVertical className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36 text-xs">
                          <DropdownMenuItem onClick={() => navigate(`/agents/${agent.id}`)}>
                            <Edit2 className="size-3.5 mr-2" /> Open Builder
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/agents/${agent.id}?tab=test`)}>
                            <Play className="size-3.5 mr-2 text-emerald-500" /> Run Test
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDuplicate(agent)}>
                            <Copy className="size-3.5 mr-2" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteMutation.mutate(agent.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                    {agent.description || agent.systemPrompt || 'No description provided'}
                  </p>
                </div>

                <div className="mt-4 border-t border-border/60 pt-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1">
                      <span>{version}</span>
                    </span>
                    <span>{agent.model || 'llama3'}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">
                      {toolsCount} tool{toolsCount === 1 ? '' : 's'} connected
                    </span>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => navigate(`/agents/${agent.id}`)}
                      className="text-xs"
                    >
                      Open Studio
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Blank Agent Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bot className="size-4" />
                </div>
                <div>
                  <DialogTitle className="text-sm font-bold">
                    Create New Agent
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Configure agent metadata and launch the visual workflow builder.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-3.5 py-4 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">
                  Agent Name *
                </label>
                <Input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Market Research Bot"
                  className="h-8 text-xs"
                  autoFocus
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">
                  Role / Specialization
                </label>
                <Input
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="e.g. Senior Research Analyst"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">
                  Description
                </label>
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Briefly describe what this agent does…"
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">
                  Instructions / System Instructions
                </label>
                <textarea
                  rows={3}
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  className="w-full rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-foreground">
                  Default Reasoning Model
                </label>
                <select
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="llama3:latest">Llama 3 (Fast Local)</option>
                  <option value="gpt-4o">OpenAI GPT-4o</option>
                  <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="gemini-1.5-pro">Google Gemini 1.5 Pro</option>
                </select>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
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
                loading={createMutation.isPending}
                disabled={!newName.trim()}
              >
                Create & Open Studio
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

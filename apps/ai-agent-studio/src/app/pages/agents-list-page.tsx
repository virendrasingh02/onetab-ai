import { agentsApi } from '@org/api-client';
import { agentService } from '../services/agentService.js';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  LoadingState,
  Page,
  PageHeader,
  toast,
  AppSelect,
  Label,
  Textarea,
  AiEntityIdentityPicker,
  confirm,
  formatAiEntityIconAvatar,
  parseAiEntityAvatar,
} from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bot,
  Copy,
  Download,
  Edit2,
  MessageSquare,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Tag,
  Trash2,
  Upload,
  Wand2,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from '../router.js';
import { AgentAvatar, DEFAULT_CATEGORIES } from '../data/agent-metadata.js';
import { useStudioSession } from '../session-guard.js';
import { AIEntityFacts, AIEntityHeader, AIEntityOwner, plural } from '../components/common/ai-entity-summary.js';
import { useAiModels, useModelOptions } from '../components/workflow-canvas/agent-config/use-agent-config-data.js';

/** Platform default (NVIDIA Nemotron 3 Super) — matches AI_DEFAULT_MODEL. */
const DEFAULT_AGENT_MODEL = 'nvidia/nemotron-3-super-120b-a12b';

type AgentStatus = 'draft' | 'testing' | 'published' | 'paused' | 'archived';
type AgentEnvironment = 'development' | 'staging' | 'production';

const DEFAULT_IDENTITY = formatAiEntityIconAvatar('bot', 'emerald');

/** `configuration.icon` / `theme` / `avatar`, which older readers still look at. */
function legacyIdentityFields(avatarUrl: string): { icon?: string; theme?: string; avatar: string } {
  const parsed = parseAiEntityAvatar(avatarUrl);
  if (parsed.type === 'icon') return { icon: parsed.icon, ...(parsed.color ? { theme: parsed.color } : {}), avatar: '' };
  return { avatar: parsed.type === 'photo' ? parsed.src : '' };
}

const ENV_LABEL: Record<AgentEnvironment, string> = { development: 'Development', staging: 'Staging', production: 'Production' };

function countTools(tools: string | null | undefined): number {
  if (!tools) return 0;
  try {
    const parsed: unknown = typeof tools === 'string' ? JSON.parse(tools) : tools;
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function AgentsListPage() {
  const { activeWorkspace, user } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'published' | 'testing' | 'draft' | 'paused' | 'archived' | 'trash'>('all');
  const [environmentFilter, setEnvironmentFilter] = useState<'all' | 'development' | 'staging' | 'production'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(
    searchParams.get('create') === 'blank' || searchParams.get('create') === 'true',
  );

  // Create Form State
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Assistant');
  const [newCategory, setNewCategory] = useState('Customer Support');
  const [isCreatingCustomCategory, setIsCreatingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrompt, setNewPrompt] = useState('You are an intelligent autonomous AI employee.');
  const [newModel, setNewModel] = useState(DEFAULT_AGENT_MODEL);
  const modelOptions = useModelOptions(newModel);
  const modelCatalog = useAiModels();
  /** Provider that owns the chosen model, so the agent isn't saved under the wrong one. */
  const providerForModel = (model: string): string | undefined =>
    modelCatalog.data?.find((m) => m.model === model || m.id === model)?.provider ??
    (model.startsWith('nvidia/') ? 'nvidia' : undefined);
  const [newEnvironment, setNewEnvironment] = useState<AgentEnvironment>('development');
  // One identity value (photo URL or `icon:<icon>:<color>`), the same shape coworkers use.
  const [newIdentity, setNewIdentity] = useState(DEFAULT_IDENTITY);
  const [newTags, setNewTags] = useState('support, autonomous');

  // Rename Modal
  const [renameAgentTarget, setRenameAgentTarget] = useState<any | null>(null);
  const [renameNameInput, setRenameNameInput] = useState('');

  // Import JSON Modal
  const [isImportOpen, setIsImportOpen] = useState(searchParams.get('import') === '1');
  const [importJson, setImportJson] = useState('');

  // Load agents
  const { data: rawAgents = [], isLoading } = useQuery({
    queryKey: ['agents', activeWorkspace.id],
    queryFn: () => agentsApi.list(activeWorkspace.id),
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (input: any) => agentsApi.create(activeWorkspace.id, input),
    onSuccess: (newAgent) => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      setIsCreateOpen(false);
      resetForm();
      toast.success(`Agent "${newAgent.name}" created successfully!`);
      navigate(`/agents/${newAgent.id}`);
    },
    onError: (err: any) => {
      toast.error('Could not create agent', { description: err?.message });
    },
  });

  // Rename Mutation
  const renameMutation = useMutation({
    mutationFn: ({ agentId, name }: { agentId: string; name: string }) =>
      agentService.renameAgent(activeWorkspace.id, agentId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      setRenameAgentTarget(null);
      toast.success('Agent renamed');
    },
    onError: (err: any) => {
      toast.error('Could not rename agent', { description: err?.message });
    },
  });

  // Status Change Mutation (Draft, Testing, Published, Paused, Archived)
  const updateStatusMutation = useMutation({
    // `agentService` merges onto the saved configuration; the API replaces it wholesale.
    mutationFn: ({ agentId, status }: { agentId: string; status: AgentStatus }) =>
      agentService.updateAgent(activeWorkspace.id, agentId, { configuration: { status } }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      toast.success(`Status updated to "${vars.status}"`);
    },
    onError: (err: any) => {
      toast.error('Could not update status', { description: err?.message });
    },
  });

  // Soft Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (agentId: string) => {
      return agentService.deleteAgent(activeWorkspace.id, agentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      toast.success('Agent moved to Trash');
    },
    onError: (err: any) => {
      toast.error('Could not move agent to Trash', { description: err?.message });
    },
  });

  // Restore Mutation
  const restoreMutation = useMutation({
    mutationFn: async (agentId: string) => {
      return agentService.restoreAgent(activeWorkspace.id, agentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      toast.success('Agent restored from Trash');
    },
    onError: (err: any) => {
      toast.error('Could not restore agent', { description: err?.message });
    },
  });

  // Permanent Delete Mutation
  const permanentDeleteMutation = useMutation({
    mutationFn: async (agentId: string) => {
      return agentService.permanentDeleteAgent(activeWorkspace.id, agentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      toast.success('Agent permanently deleted');
    },
    onError: (err: any) => {
      toast.error('Could not delete agent', { description: err?.message });
    },
  });

  const resetForm = () => {
    setNewName('');
    setNewRole('Assistant');
    setNewCategory('Customer Support');
    setIsCreatingCustomCategory(false);
    setCustomCategoryInput('');
    setNewDesc('');
    setNewPrompt('You are an intelligent autonomous AI employee.');
    setNewModel(DEFAULT_AGENT_MODEL);
    setNewEnvironment('development');
    setNewIdentity(DEFAULT_IDENTITY);
    setNewTags('support, autonomous');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!newName.trim()) return;
    const initialGraph = {
      nodes: [
        {
          id: 'start-1',
          type: 'START',
          position: { x: 80, y: 200 },
          data: { label: 'Start Entry', subtitle: 'User prompt', config: { triggerType: 'MANUAL' } },
        },
        {
          id: 'agent-1',
          type: 'AGENT',
          position: { x: 380, y: 190 },
          data: {
            label: newName,
            subtitle: newRole,
            config: {
              instructions: newPrompt,
              model: newModel,
              temperature: 0.7,
              tools: ['firecrawl_search', 'kb_search'],
            },
          },
        },
        {
          id: 'end-1',
          type: 'END',
          position: { x: 680, y: 200 },
          data: { label: 'Complete', subtitle: 'Final Output' },
        },
      ],
      edges: [
        { id: 'e1-2', source: 'start-1', target: 'agent-1', animated: true },
        { id: 'e2-3', source: 'agent-1', target: 'end-1' },
      ],
    };

    createMutation.mutate({
      name: newName.trim(),
      role: newRole.trim(),
      description: newDesc.trim() || undefined,
      systemPrompt: newPrompt,
      model: newModel,
      provider: providerForModel(newModel),
      avatarUrl: newIdentity,
      tools: ['firecrawl_search', 'kb_search'],
      graphJson: JSON.stringify(initialGraph),
      configuration: {
        category: newCategory,
        environment: newEnvironment,
        status: 'draft',
        // Kept for readers of the older per-field shape.
        ...legacyIdentityFields(newIdentity),
        tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
      },
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
      tools: agent.tools ? (typeof agent.tools === 'string' ? JSON.parse(agent.tools) : agent.tools) : [],
      graphJson: agent.graphJson,
      configuration: {
        ...(agent.configuration || {}),
        status: 'draft',
      },
    });
  };

  const handleExportAgent = (agent: any) => {
    const exportData = {
      schemaVersion: 'onetab.agent.v1',
      exportedAt: new Date().toISOString(),
      agent: {
        name: agent.name,
        role: agent.role,
        description: agent.description,
        model: agent.model,
        systemPrompt: agent.systemPrompt,
        graphJson: agent.graphJson,
        configuration: agent.configuration,
      },
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.name.toLowerCase().replace(/\s+/g, '-')}-config.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Agent configuration exported');
  };

  const handleImportSubmit = async () => {
    try {
      const parsed = JSON.parse(importJson);
      const data = parsed.agent || parsed;
      createMutation.mutate({
        name: data.name || 'Imported Agent',
        role: data.role || 'Specialist',
        description: data.description || 'Imported from JSON configuration',
        systemPrompt: data.systemPrompt || 'Execute workflow tasks.',
        model: data.model || DEFAULT_AGENT_MODEL,
        graphJson: data.graphJson || JSON.stringify({ nodes: data.nodes || [], edges: data.edges || [] }),
        configuration: {
          status: 'draft',
          environment: 'development',
          category: data.configuration?.category || 'General',
          theme: data.configuration?.theme || 'emerald',
          tags: data.configuration?.tags || ['imported'],
        },
      });
      setIsImportOpen(false);
      setImportJson('');
    } catch {
      toast.error('Invalid JSON configuration file');
    }
  };

  // Filter Agents based on tabs & filters
  const filteredAgents = useMemo(() => {
    return rawAgents.filter((agent: any) => {
      const config = agent.configuration || {};
      const status: AgentStatus = config.status || 'draft';
      const env: AgentEnvironment = config.environment || 'development';
      const isDeleted = Boolean(agent.deletedAt) || status === ('deleted' as any);

      // Trash tab
      if (filterTab === 'trash') {
        return isDeleted;
      }

      // If viewing active tabs, hide deleted items
      if (isDeleted) return false;

      // Status filters
      if (filterTab === 'published' && status !== 'published') return false;
      if (filterTab === 'testing' && status !== 'testing') return false;
      if (filterTab === 'draft' && status !== 'draft') return false;
      if (filterTab === 'paused' && status !== 'paused') return false;
      if (filterTab === 'archived' && status !== 'archived') return false;

      // Environment filter
      if (environmentFilter !== 'all' && env !== environmentFilter) return false;

      // Category filter
      if (categoryFilter !== 'all' && config.category !== categoryFilter) return false;

      // Search keyword
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const tagsStr = (config.tags || []).join(' ').toLowerCase();
      return (
        agent.name.toLowerCase().includes(q) ||
        (agent.role || '').toLowerCase().includes(q) ||
        (agent.description || '').toLowerCase().includes(q) ||
        tagsStr.includes(q)
      );
    });
  }, [rawAgents, filterTab, environmentFilter, categoryFilter, search]);

  const availableCategories = useMemo(() => {
    const fromAgents = rawAgents
      .map((a: any) => a.configuration?.category || a.category)
      .filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromAgents]));
  }, [rawAgents]);

  const deletedAgentsCount = rawAgents.filter((a: any) => Boolean(a.deletedAt) || a.configuration?.status === 'deleted').length;

  if (isLoading) {
    return <LoadingState label="Loading workspace agents…" />;
  }

  return (
    <Page width="full" className="space-y-6">
      {/* Header bar matching Admin */}
      <PageHeader
        title="Agent Lifecycle Management"
        description={`Build, test, deploy, pause, archive, and manage autonomous AI agents across environments in ${activeWorkspace.name}.`}
        icon={<Bot className="size-5" />}
        accent="blue"
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => navigate('/create')}
              className="gap-1.5 text-xs font-semibold shadow-sm"
            >
              <Wand2 className="size-3.5" /> Create with one prompt
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsImportOpen(true)}
              className="gap-1.5 text-xs"
            >
              <Upload className="size-3.5" /> Import JSON
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setIsCreateOpen(true)}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="size-4" /> Create New AI Agent
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-surface/60 px-4 py-2.5 text-xs text-muted-foreground">
        <span>
          Agents made with <strong className="text-foreground">Create with AI</strong> or a template are plan-first agents. They are listed under Planned Agents, not here.
        </span>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => navigate(`/w/${activeWorkspace.slug}/ai/agents`)}>
          Open Planned Agents
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
        {/* Status Filter Tabs (Draft, Testing, Published, Paused, Archived, Trash) */}
        <div className="flex flex-wrap items-center gap-1">
          {(['all', 'published', 'testing', 'draft', 'paused', 'archived'] as const).map((tab) => {
            const count = rawAgents.filter((a: any) => {
              if (a.deletedAt) return false;
              if (tab === 'all') return true;
              return (a.configuration?.status || 'draft') === tab;
            }).length;

            return (
              <Button
                key={tab}
                type="button"
                variant={filterTab === tab ? 'secondary' : 'ghost'}
                size="sm"
                aria-pressed={filterTab === tab}
                onClick={() => setFilterTab(tab)}
                className="rounded-lg capitalize"
              >
                {tab} ({count})
              </Button>
            );
          })}

          <div className="h-4 w-px bg-border mx-1" />

          {/* Trash / Deleted Tab */}
          <button
            type="button"
            onClick={() => setFilterTab('trash')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${
              filterTab === 'trash'
                ? 'bg-destructive/15 text-destructive font-semibold'
                : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
            }`}
          >
            <Trash2 className="size-3" />
            <span>Trash ({deletedAgentsCount})</span>
          </button>
        </div>

        {/* Filters: Category & Environment & Search */}
        <div className="flex items-center gap-2">
          {/* Environment */}
          <AppSelect
            value={environmentFilter}
            onValueChange={(v) => setEnvironmentFilter(v as any)}
            options={[
              { value: 'all', label: 'All Environments' },
              { value: 'development', label: 'Development' },
              { value: 'staging', label: 'Staging' },
              { value: 'production', label: 'Production' },
            ]}
          />

          {/* Category */}
          <AppSelect
            value={categoryFilter}
            onValueChange={setCategoryFilter}
            aria-label="Filter by category"
            className="w-auto min-w-40"
            options={[
              { value: 'all', label: 'All Categories' },
              ...availableCategories.map((cat) => ({ value: cat, label: cat })),
            ]}
          />

          {/* Search Input */}
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, tags, role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-3 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Grid of Agent Cards */}
      {filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 p-12 text-center text-muted-foreground">
          <Bot className="size-12 text-muted-foreground/30 mb-2" />
          <div className="text-sm font-semibold text-foreground">
            {filterTab === 'trash' ? 'Trash is Empty' : 'No Agents Matching Filters'}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {filterTab === 'trash'
              ? 'No deleted agents in this workspace.'
              : search
              ? 'Try modifying your search keywords or clear active filters.'
              : 'Create your first autonomous agent from scratch, templates, or natural language.'}
          </p>
          {filterTab !== 'trash' && (
            <Button
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
            >
              <Plus className="size-3.5" /> Create New AI Agent
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredAgents.map((agent: any) => {
            const config = agent.configuration || {};
            const status: AgentStatus = config.status || 'draft';
            const env: AgentEnvironment = config.environment || 'development';
            const tags = config.tags || [];
            // The creator's real profile from the API; the free-text name only covers older agents.
            const owner = agent.owner || (config.owner?.name ? { name: config.owner.name } : null);
            const isDeleted = Boolean(agent.deletedAt) || status === ('deleted' as any);
            const toolsCount = countTools(agent.tools);

            return (
              <div
                key={agent.id}
                className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-4 transition-all hover:border-border-strong hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    {/* Same identity block as an AI Coworker card. */}
                    <AIEntityHeader
                      avatar={<AgentAvatar agent={agent} size="lg" />}
                      name={agent.name}
                      kind="Agent"
                      role={agent.role || 'Assistant'}
                      meta={[ENV_LABEL[env]]}
                      status={isDeleted ? 'trash' : status}
                      model={agent.model || null}
                      provider={agent.provider || null}
                    />

                    <div className="flex shrink-0 items-center gap-1">
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
                        <DropdownMenuContent align="end" className="w-48 text-xs">
                          {!isDeleted ? (
                            <>
                              <DropdownMenuItem onClick={() => navigate(`/agents/${agent.id}`)}>
                                <Edit2 className="size-3.5 mr-2 text-primary" /> Open Canvas Builder
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/chat/${agent.id}`)}>
                                <MessageSquare className="size-3.5 mr-2 text-accent-blue" /> Open Chat Interface
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setRenameAgentTarget(agent);
                                  setRenameNameInput(agent.name);
                                }}
                              >
                                <Tag className="size-3.5 mr-2" /> Rename Agent
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(agent)}>
                                <Copy className="size-3.5 mr-2" /> Duplicate Agent
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleExportAgent(agent)}>
                                <Download className="size-3.5 mr-2" /> Export JSON
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />

                              {/* Status Sub-menu */}
                              <div className="px-2 py-1 text-2xs font-semibold text-muted-foreground uppercase">
                                Change Status
                              </div>
                              <DropdownMenuItem
                                onClick={() => updateStatusMutation.mutate({ agentId: agent.id, status: 'draft' })}
                              >
                                Mark as Draft
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateStatusMutation.mutate({ agentId: agent.id, status: 'testing' })}
                              >
                                Mark as Testing
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: `Publish “${agent.name}”?`,
                                    description: 'Published agents go live and can be called by anyone with access, including via API keys and webhooks.',
                                    confirmLabel: 'Publish',
                                    tone: 'warning',
                                  });
                                  if (ok) updateStatusMutation.mutate({ agentId: agent.id, status: 'published' });
                                }}
                              >
                                Publish Agent
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: `Pause “${agent.name}”?`,
                                    description: 'It will stop responding to chats, schedules and triggers until you resume it.',
                                    confirmLabel: 'Pause agent',
                                    tone: 'warning',
                                  });
                                  if (ok) updateStatusMutation.mutate({ agentId: agent.id, status: 'paused' });
                                }}
                              >
                                Pause Agent
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: `Archive “${agent.name}”?`,
                                    description: 'It will stop running and be hidden from the active list. You can bring it back later.',
                                    confirmLabel: 'Archive',
                                    tone: 'warning',
                                  });
                                  if (ok) updateStatusMutation.mutate({ agentId: agent.id, status: 'archived' });
                                }}
                              >
                                Archive Agent
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: `Move “${agent.name}” to Trash?`,
                                    description: 'It stops running immediately. You can restore it from Trash until it is deleted permanently.',
                                    confirmLabel: 'Move to Trash',
                                    tone: 'warning',
                                  });
                                  if (ok) deleteMutation.mutate(agent.id);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="size-3.5 mr-2" /> Move to Trash
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              <DropdownMenuItem onClick={() => restoreMutation.mutate(agent.id)}>
                                <RotateCcw className="size-3.5 mr-2 text-success" /> Restore Agent
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  const ok = await confirm({
                                    title: `Permanently delete “${agent.name}”?`,
                                    description: 'Its configuration, runs and history are erased. This can’t be undone.',
                                    confirmLabel: 'Delete permanently',
                                    destructive: true,
                                    requireText: agent.name,
                                  });
                                  if (ok) permanentDeleteMutation.mutate(agent.id);
                                }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="size-3.5 mr-2" /> Delete Permanently
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
                    {agent.description || agent.systemPrompt || 'No description provided'}
                  </p>

                  {/* Tags & Category */}
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {config.category && (
                      <span className="rounded-md bg-surface-raised px-2 py-0.5 text-2xs font-medium text-foreground border border-border/60">
                        {config.category}
                      </span>
                    )}
                    {tags.slice(0, 2).map((t: string, idx: number) => (
                      <span
                        key={idx}
                        className="rounded-md bg-muted/40 px-1.5 py-0.5 text-2xs text-muted-foreground"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 border-t border-border/60 pt-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                    <AIEntityFacts
                      facts={[{ label: plural(toolsCount, 'tool'), value: toolsCount, muted: !toolsCount }]}
                    />
                    <AIEntityOwner owner={owner} />
                  </div>

                  <div className="mt-3 flex items-center justify-end">
                    {!isDeleted ? (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => navigate(`/agents/${agent.id}`)}
                        className="text-xs text-primary hover:text-primary"
                      >
                        Open Studio →
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => restoreMutation.mutate(agent.id)}
                        className="text-xs text-success hover:text-success/80 gap-1"
                      >
                        <RotateCcw className="size-3" /> Restore
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE NEW AI AGENT MODAL: Matching Image 1 Pixel-for-Pixel + Image 2 Lifecycle Spec */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent
          className="sm:max-w-lg"
          // Focus without scrolling: a mount-time autoFocus fires before the
          // dialog has settled and scrolls its header out of view.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement)
              .querySelector<HTMLElement>('[data-initial-focus]')
              ?.focus({ preventScroll: true });
          }}
        >
          {/* Capped to the dialog's height so only the body scrolls; header + footer stay put */}
          <form onSubmit={handleCreateSubmit} className="flex max-h-[calc(90dvh-2px)] flex-col">
            <DialogHeader className="shrink-0 space-y-1 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-success/15 text-success border border-success/30">
                  <Bot className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                    Create New AI Agent
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Name your agent and set its basics — you’ll build the workflow on the canvas.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <DialogBody className="min-h-0 flex-1 space-y-3.5 overflow-y-auto overscroll-contain py-4 text-xs">
              {/* Agent Name * */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Agent Name *
                </Label>
                <Input
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Sales Qualification Specialist"
                  className="h-9 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-success rounded-lg"
                  data-initial-focus
                />
              </div>

              {/* 2-Column: Role / Title + Category */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Role / Title
                  </Label>
                  <Input
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    placeholder="Assistant"
                    className="h-9 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-success rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">
                      Category
                    </Label>
                    <Button
                      variant="link"
                      size="xs"
                      type="button"
                      onClick={() => setIsCreatingCustomCategory(!isCreatingCustomCategory)}
                      className="h-auto text-2xs text-success"
                    >
                      {isCreatingCustomCategory ? 'Choose Existing' : '+ New Category'}
                    </Button>
                  </div>
                  {isCreatingCustomCategory ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        placeholder="Enter category name…"
                        className="h-9 text-xs bg-background border-border text-foreground focus:border-success rounded-lg flex-1"
                        autoFocus
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={!customCategoryInput.trim()}
                        onClick={() => {
                          if (!customCategoryInput.trim()) return;
                          setNewCategory(customCategoryInput.trim());
                          setIsCreatingCustomCategory(false);
                          toast.success(`Category "${customCategoryInput.trim()}" selected`);
                        }}
                        className="h-9 px-3 text-xs bg-success hover:bg-success/90 text-success-foreground"
                      >
                        Set
                      </Button>
                    </div>
                  ) : (
                    <AppSelect
                      value={newCategory}
                      onValueChange={(v) => {
                        if (v === '__new__') {
                          setIsCreatingCustomCategory(true);
                        } else {
                          setNewCategory(v);
                        }
                      }}
                      aria-label="Category"
                      options={[
                        ...availableCategories.map((cat) => ({ value: cat, label: cat })),
                        { value: '__new__', label: '+ Create new category…' },
                      ]}
                    />
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Description
                </Label>
                <Input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Briefly describe what task this agent performs..."
                  className="h-9 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-success rounded-lg"
                />
              </div>

              <AiEntityIdentityPicker name={newName} kind="agent" value={newIdentity} onChange={setNewIdentity} label="Icon & colour" />

              {/* System Instructions */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  System Instructions
                </Label>
                <Textarea rows={3} value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} className="text-xs" />
              </div>

              {/* 2-Column: Reasoning Model + Target Environment */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Reasoning Model
                  </Label>
                  <AppSelect
                    searchable
                    value={newModel}
                    loading={modelOptions.isLoading}
                    onValueChange={(v) => setNewModel(v)}
                    options={modelOptions.groups}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Target Environment
                  </Label>
                  <AppSelect
                    value={newEnvironment}
                    onValueChange={(v) => setNewEnvironment(v as any)}
                    options={[
                      { value: 'development', label: 'Development' },
                      { value: 'staging', label: 'Staging' },
                      { value: 'production', label: 'Production' },
                    ]}
                  />
                </div>
              </div>

              {/* The creator owns the agent; shown here so it isn't a surprise on the card. */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-foreground">Owner</span>
                <AIEntityOwner owner={user ? { id: user.id, name: user.name, avatarUrl: user.avatarUrl } : null} />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">
                  Tags (comma-separated)
                </Label>
                <Input
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  placeholder="support, autonomous, gpt-4o"
                  className="h-9 text-xs bg-background border-border text-foreground"
                />
              </div>
            </DialogBody>

            {/* Modal Footer (Exact Image 1 Buttons) */}
            <DialogFooter className="flex shrink-0 items-center justify-end gap-2 pt-3 border-t border-border bg-popover">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsCreateOpen(false)}
                className="bg-muted hover:bg-muted/70 text-foreground h-9 px-4 rounded-lg text-xs font-medium"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                loading={createMutation.isPending}
                disabled={!newName.trim()}
                className="bg-success hover:bg-success/90 text-success-foreground font-semibold h-9 px-4 rounded-lg text-xs shadow-md transition-colors"
              >
                Create & Open Canvas
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* RENAME MODAL */}
      <Dialog open={Boolean(renameAgentTarget)} onOpenChange={(open) => !open && setRenameAgentTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!renameNameInput.trim() || !renameAgentTarget) return;
              renameMutation.mutate({ agentId: renameAgentTarget.id, name: renameNameInput.trim() });
            }}
          >
            <DialogHeader>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                <Tag className="size-4 text-primary" /> Rename Agent
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update the display title for "{renameAgentTarget?.name}".
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="py-4 text-xs">
              <Label className="text-xs font-semibold text-foreground block mb-1">
                New Agent Title *
              </Label>
              <Input
                required
                value={renameNameInput}
                onChange={(e) => setRenameNameInput(e.target.value)}
                className="h-8 text-xs"
                autoFocus
              />
            </DialogBody>

            <DialogFooter>
              <Button type="button" variant="outline" size="sm" onClick={() => setRenameAgentTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={renameMutation.isPending}>
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* IMPORT CONFIGURATION JSON MODAL */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <Upload className="size-4 text-primary" />
              Import Agent Configuration JSON
            </DialogTitle>
            <DialogDescription className="text-xs">
              Import an exported Agent Studio JSON configuration to instantiate the agent in {activeWorkspace.name}.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3 py-3">
            <Textarea rows={8} value={importJson} onChange={(e) => setImportJson(e.target.value)} placeholder="Paste agent configuration JSON here…" className="font-mono text-xs" />
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsImportOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleImportSubmit} disabled={!importJson.trim()}>
              Import Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </Page>
  );
}

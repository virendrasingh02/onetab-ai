import { agentsApi } from '@org/api-client';
import {
  agentLifecycleStatus,
  agentService,
  DEFAULT_AGENT_MODEL,
} from '../services/agentService.js';
import {
  FilterChips,
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
  SearchInput,
  toast,
  AppSelect,
  Label,
  Textarea,
  CodeInput,
  AiEntityIdentityPicker,
  confirm,
  formatAiEntityIconAvatar,
  parseAiEntityAvatar,
} from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  Copy,
  Download,
  Edit2,
  MessageSquare,
  MoreVertical,
  Plus,
  RotateCcw,
  Tag,
  Trash2,
  Upload,
  Wand2,
  Wrench,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from '../router.js';
import { AgentAvatar, DEFAULT_CATEGORIES } from '../data/agent-metadata.js';
import { useStudioSession } from '../session-guard.js';
import {
  AIEntityModel,
  AIEntityOwner,
  AIEntityStatusBadge,
  plural,
} from '../components/common/ai-entity-summary.js';
import {
  useAiModels,
  useModelOptions,
} from '../components/workflow-canvas/agent-config/use-agent-config-data.js';
import { SectionHeader } from '../components/section-tabs.js';
import { ListToolbar } from '../components/list-toolbar.js';
import {
  EntityCard,
  EntityChips,
  EntityCount,
} from '../components/common/entity-card.js';

const STATUS_FILTERS = [
  'all',
  'published',
  'testing',
  'draft',
  'paused',
  'archived',
] as const;

type AgentStatus = 'draft' | 'testing' | 'published' | 'paused' | 'archived';
type AgentEnvironment = 'development' | 'staging' | 'production';

const DEFAULT_SYSTEM_PROMPT = 'You are an intelligent autonomous AI employee.';
const DEFAULT_IDENTITY = formatAiEntityIconAvatar('bot', 'emerald');

/** `configuration.icon` / `theme` / `avatar`, which older readers still look at. */
function legacyIdentityFields(avatarUrl: string): {
  icon?: string;
  theme?: string;
  avatar: string;
} {
  const parsed = parseAiEntityAvatar(avatarUrl);
  if (parsed.type === 'icon')
    return {
      icon: parsed.icon,
      ...(parsed.color ? { theme: parsed.color } : {}),
      avatar: '',
    };
  return { avatar: parsed.type === 'photo' ? parsed.src : '' };
}

const ENV_LABEL: Record<AgentEnvironment, string> = {
  development: 'Development',
  staging: 'Staging',
  production: 'Production',
};

/** What the card says the agent does: its description, else its own prompt (the stock one says nothing). */
function agentSummary(agent: {
  description?: string | null;
  systemPrompt?: string | null;
}): string {
  const description = agent.description?.trim();
  if (description) return description;
  const prompt = agent.systemPrompt?.trim();
  return prompt && prompt !== DEFAULT_SYSTEM_PROMPT ? prompt : '';
}

/** In Trash: soft-deleted agents carry `deletedAt` (top level or in configuration) or status "deleted". */
function isAgentDeleted(agent: any): boolean {
  const config = agent.configuration || {};
  return (
    Boolean(agent.deletedAt || config.deletedAt) || config.status === 'deleted'
  );
}

function countTools(tools: string | null | undefined): number {
  if (!tools) return 0;
  try {
    const parsed: unknown =
      typeof tools === 'string' ? JSON.parse(tools) : tools;
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
  const [filterTab, setFilterTab] = useState<
    'all' | 'published' | 'testing' | 'draft' | 'paused' | 'archived' | 'trash'
  >('all');
  const [environmentFilter, setEnvironmentFilter] = useState<
    'all' | 'development' | 'staging' | 'production'
  >('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(
    searchParams.get('create') === 'blank' ||
      searchParams.get('create') === 'true',
  );

  // Create Form State
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Assistant');
  const [newCategory, setNewCategory] = useState('Customer Support');
  const [isCreatingCustomCategory, setIsCreatingCustomCategory] =
    useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrompt, setNewPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [newModel, setNewModel] = useState(DEFAULT_AGENT_MODEL);
  const modelOptions = useModelOptions(newModel);
  const modelCatalog = useAiModels();
  /** Provider that owns the chosen model, so the agent isn't saved under the wrong one. */
  const providerForModel = (model: string): string | undefined =>
    modelCatalog.data?.find((m) => m.model === model || m.id === model)
      ?.provider ?? (model.startsWith('nvidia/') ? 'nvidia' : undefined);
  const [newEnvironment, setNewEnvironment] =
    useState<AgentEnvironment>('development');
  // One identity value (photo URL or `icon:<icon>:<color>`), the same shape coworkers use.
  const [newIdentity, setNewIdentity] = useState(DEFAULT_IDENTITY);
  const [newTags, setNewTags] = useState('support, autonomous');

  // Rename Modal
  const [renameAgentTarget, setRenameAgentTarget] = useState<any | null>(null);
  const [renameNameInput, setRenameNameInput] = useState('');

  // Import JSON Modal
  const [isImportOpen, setIsImportOpen] = useState(
    searchParams.get('import') === '1',
  );
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
      queryClient.invalidateQueries({
        queryKey: ['agents', activeWorkspace.id],
      });
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
      queryClient.invalidateQueries({
        queryKey: ['agents', activeWorkspace.id],
      });
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
    mutationFn: ({
      agentId,
      status,
    }: {
      agentId: string;
      status: AgentStatus;
    }) =>
      agentService.updateAgent(activeWorkspace.id, agentId, {
        configuration: { status },
      }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({
        queryKey: ['agents', activeWorkspace.id],
      });
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
      queryClient.invalidateQueries({
        queryKey: ['agents', activeWorkspace.id],
      });
      toast.success('Agent moved to Trash');
    },
    onError: (err: any) => {
      toast.error('Could not move agent to Trash', {
        description: err?.message,
      });
    },
  });

  // Restore Mutation
  const restoreMutation = useMutation({
    mutationFn: async (agentId: string) => {
      return agentService.restoreAgent(activeWorkspace.id, agentId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['agents', activeWorkspace.id],
      });
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
      queryClient.invalidateQueries({
        queryKey: ['agents', activeWorkspace.id],
      });
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
    setNewPrompt(DEFAULT_SYSTEM_PROMPT);
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
          data: {
            label: 'Start Entry',
            subtitle: 'User prompt',
            config: { triggerType: 'MANUAL' },
          },
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
        tags: newTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
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
      tools: agent.tools
        ? typeof agent.tools === 'string'
          ? JSON.parse(agent.tools)
          : agent.tools
        : [],
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
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
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
        graphJson:
          data.graphJson ||
          JSON.stringify({ nodes: data.nodes || [], edges: data.edges || [] }),
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
      const status = agentLifecycleStatus(agent) as AgentStatus;
      const env: AgentEnvironment = config.environment || 'development';
      const isDeleted = isAgentDeleted(agent);

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
      if (environmentFilter !== 'all' && env !== environmentFilter)
        return false;

      // Category filter
      if (categoryFilter !== 'all' && config.category !== categoryFilter)
        return false;

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

  // Trash counts on its own; "All" and the header count only what's live.
  const deletedAgentsCount = rawAgents.filter(isAgentDeleted).length;
  const liveAgents = rawAgents.filter((a: any) => !isAgentDeleted(a));

  if (isLoading) {
    return <LoadingState label="Loading workspace agents…" />;
  }

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <SectionHeader
        section="agents"
        counts={{ 'my-agents': liveAgents.length }}
        actions={
          <>
            <Button
              size="sm"
              variant="outline"
              leadingIcon={<Wand2 />}
              onClick={() => navigate('/create')}
            >
              Build with AI
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon-sm"
                  variant="outline"
                  aria-label="More ways to add an agent"
                  title="More"
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onSelect={() => setIsImportOpen(true)}
                  className="gap-2 text-xs"
                >
                  <Upload className="size-3.5" /> Import JSON
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="sm"
              variant="primary"
              leadingIcon={<Plus />}
              onClick={() => setIsCreateOpen(true)}
            >
              New agent
            </Button>
          </>
        }
      />

      <div className="p-4 sm:p-6 space-y-4 flex-1">
        <ListToolbar
          aria-label="Filter agents"
          end={
            <>
              <AppSelect
                value={environmentFilter}
                onValueChange={(v) => setEnvironmentFilter(v as any)}
                aria-label="Filter by environment"
                className="min-w-36 w-auto"
                options={[
                  { value: 'all', label: 'All environments' },
                  { value: 'development', label: 'Development' },
                  { value: 'staging', label: 'Staging' },
                  { value: 'production', label: 'Production' },
                ]}
              />
              <AppSelect
                value={categoryFilter}
                onValueChange={setCategoryFilter}
                aria-label="Filter by category"
                className="min-w-36 w-auto"
                options={[
                  { value: 'all', label: 'All categories' },
                  ...availableCategories.map((cat) => ({
                    value: cat,
                    label: cat,
                  })),
                ]}
              />
            </>
          }
        >
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Search by name, tag or role…"
            aria-label="Search agents"
            wrapperClassName="w-full sm:w-64"
          />
          <FilterChips
            aria-label="Filter by status"
            value={filterTab}
            onChange={setFilterTab}
            options={[
              ...STATUS_FILTERS.map((tab) => ({
                value: tab,
                label:
                  tab === 'all' ? 'All' : tab[0].toUpperCase() + tab.slice(1),
                count:
                  tab === 'all'
                    ? liveAgents.length
                    : liveAgents.filter(
                        (a: any) => agentLifecycleStatus(a) === tab,
                      ).length,
              })),
              ...(deletedAgentsCount > 0 || filterTab === 'trash'
                ? [
                    {
                      value: 'trash' as const,
                      label: 'Trash',
                      count: deletedAgentsCount,
                      icon: <Trash2 />,
                      tone: 'destructive' as const,
                    },
                  ]
                : []),
            ]}
          />
        </ListToolbar>

        {/* Grid of Agent Cards */}
        {filteredAgents.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 text-center text-muted-foreground">
            <Bot className="size-12 mb-2 text-muted-foreground/30" />
            <div className="text-sm font-semibold text-foreground">
              {filterTab === 'trash'
                ? 'Trash is Empty'
                : 'No Agents Matching Filters'}
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
                variant="primary"
                leadingIcon={<Plus />}
                onClick={() => setIsCreateOpen(true)}
                className="mt-4"
              >
                New agent
              </Button>
            )}
          </div>
        ) : (
          <div className="gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 grid grid-cols-1">
            {filteredAgents.map((agent: any) => {
              const config = agent.configuration || {};
              const status = agentLifecycleStatus(agent) as AgentStatus;
              const env: AgentEnvironment = config.environment || 'development';
              const tags = config.tags || [];
              // The creator's real profile from the API; the free-text name only covers older agents.
              const owner =
                agent.owner ||
                (config.owner?.name ? { name: config.owner.name } : null);
              const isDeleted = isAgentDeleted(agent);
              const toolsCount = countTools(agent.tools);

              return (
                <EntityCard
                  key={agent.id}
                  name={agent.name}
                  avatar={<AgentAvatar agent={agent} size="lg" />}
                  status={
                    <AIEntityStatusBadge
                      status={isDeleted ? 'trash' : status}
                    />
                  }
                  subtitle={`${agent.role || 'Assistant'} · ${ENV_LABEL[env]}`}
                  description={agentSummary(agent)}
                  chips={<EntityChips category={config.category} tags={tags} />}
                  owner={owner}
                  onOpen={
                    isDeleted
                      ? undefined
                      : () => navigate(`/agents/${agent.id}`)
                  }
                  openLabel={`Open ${agent.name} in Studio`}
                  dimmed={isDeleted}
                  facts={
                    <>
                      <AIEntityModel
                        model={agent.model || null}
                        provider={agent.provider || null}
                        className="min-w-0 shrink"
                      />
                      <EntityCount
                        icon={<Wrench />}
                        count={toolsCount}
                        label={plural(toolsCount, 'tool')}
                      />
                    </>
                  }
                  actions={
                    !isDeleted ? (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => navigate(`/agents/${agent.id}`)}
                        className="gap-1 text-xs"
                      >
                        Open{' '}
                        <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                      </Button>
                    ) : (
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => restoreMutation.mutate(agent.id)}
                        className="gap-1 text-xs text-success hover:text-success/80"
                      >
                        <RotateCcw className="size-3" /> Restore
                      </Button>
                    )
                  }
                  menu={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Actions for ${agent.name}`}
                          className="size-7 text-muted-foreground hover:text-foreground"
                        >
                          <MoreVertical className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 text-xs">
                        {!isDeleted ? (
                          <>
                            <DropdownMenuItem
                              onClick={() => navigate(`/agents/${agent.id}`)}
                            >
                              <Edit2 className="size-3.5 mr-2 text-primary" />{' '}
                              Open Canvas Builder
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/chat/${agent.id}`)}
                            >
                              <MessageSquare className="size-3.5 mr-2 text-accent-blue" />{' '}
                              Open Chat Interface
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setRenameAgentTarget(agent);
                                setRenameNameInput(agent.name);
                              }}
                            >
                              <Tag className="size-3.5 mr-2" /> Rename Agent
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDuplicate(agent)}
                            >
                              <Copy className="size-3.5 mr-2" /> Duplicate Agent
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleExportAgent(agent)}
                            >
                              <Download className="size-3.5 mr-2" /> Export JSON
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />

                            {/* Status Sub-menu */}
                            <div className="px-2 py-1 font-semibold text-2xs text-muted-foreground uppercase">
                              Change Status
                            </div>
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  agentId: agent.id,
                                  status: 'draft',
                                })
                              }
                            >
                              Mark as Draft
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  agentId: agent.id,
                                  status: 'testing',
                                })
                              }
                            >
                              Mark as Testing
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                const ok = await confirm({
                                  title: `Publish “${agent.name}”?`,
                                  description:
                                    'Published agents go live and can be called by anyone with access, including via API keys and webhooks.',
                                  confirmLabel: 'Publish',
                                  tone: 'warning',
                                });
                                if (ok)
                                  updateStatusMutation.mutate({
                                    agentId: agent.id,
                                    status: 'published',
                                  });
                              }}
                            >
                              Publish Agent
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                const ok = await confirm({
                                  title: `Pause “${agent.name}”?`,
                                  description:
                                    'It will stop responding to chats, schedules and triggers until you resume it.',
                                  confirmLabel: 'Pause agent',
                                  tone: 'warning',
                                });
                                if (ok)
                                  updateStatusMutation.mutate({
                                    agentId: agent.id,
                                    status: 'paused',
                                  });
                              }}
                            >
                              Pause Agent
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                const ok = await confirm({
                                  title: `Archive “${agent.name}”?`,
                                  description:
                                    'It will stop running and be hidden from the active list. You can bring it back later.',
                                  confirmLabel: 'Archive',
                                  tone: 'warning',
                                });
                                if (ok)
                                  updateStatusMutation.mutate({
                                    agentId: agent.id,
                                    status: 'archived',
                                  });
                              }}
                            >
                              Archive Agent
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={async () => {
                                const ok = await confirm({
                                  title: `Move “${agent.name}” to Trash?`,
                                  description:
                                    'It stops running immediately. You can restore it from Trash until it is deleted permanently.',
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
                            <DropdownMenuItem
                              onClick={() => restoreMutation.mutate(agent.id)}
                            >
                              <RotateCcw className="size-3.5 mr-2 text-success" />{' '}
                              Restore Agent
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                const ok = await confirm({
                                  title: `Permanently delete “${agent.name}”?`,
                                  description:
                                    'Its configuration, runs and history are erased. This can’t be undone.',
                                  confirmLabel: 'Delete permanently',
                                  destructive: true,
                                  requireText: agent.name,
                                });
                                if (ok)
                                  permanentDeleteMutation.mutate(agent.id);
                              }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="size-3.5 mr-2" /> Delete
                              Permanently
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                />
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
            <form
              onSubmit={handleCreateSubmit}
              className="flex max-h-[calc(90dvh-2px)] flex-col"
            >
              <DialogHeader className="space-y-1 pb-2 shrink-0">
                <div className="gap-3 flex items-center">
                  <div className="size-9 flex items-center justify-center rounded-xl border border-success/30 bg-success/15 text-success">
                    <Bot className="size-5" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold tracking-tight text-foreground">
                      Create New AI Agent
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-0.5 text-muted-foreground">
                      Name your agent and set its basics — you’ll build the
                      workflow on the canvas.
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <DialogBody className="min-h-0 space-y-3.5 py-4 text-xs flex-1 overflow-y-auto overscroll-contain">
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
                    className="h-9 text-xs rounded-lg border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-success"
                    data-initial-focus
                  />
                </div>

                {/* 2-Column: Role / Title + Category */}
                <div className="gap-3 grid grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground">
                      Role / Title
                    </Label>
                    <Input
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      placeholder="Assistant"
                      className="h-9 text-xs rounded-lg border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-success"
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
                        onClick={() =>
                          setIsCreatingCustomCategory(!isCreatingCustomCategory)
                        }
                        className="h-auto text-2xs text-success"
                      >
                        {isCreatingCustomCategory
                          ? 'Choose Existing'
                          : '+ New Category'}
                      </Button>
                    </div>
                    {isCreatingCustomCategory ? (
                      <div className="gap-1.5 flex items-center">
                        <Input
                          value={customCategoryInput}
                          onChange={(e) =>
                            setCustomCategoryInput(e.target.value)
                          }
                          placeholder="Enter category name…"
                          className="h-9 text-xs flex-1 rounded-lg border-border bg-background text-foreground focus:border-success"
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
                            toast.success(
                              `Category "${customCategoryInput.trim()}" selected`,
                            );
                          }}
                          className="h-9 px-3 text-xs bg-success text-success-foreground hover:bg-success/90"
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
                          ...availableCategories.map((cat) => ({
                            value: cat,
                            label: cat,
                          })),
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
                    className="h-9 text-xs rounded-lg border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-success"
                  />
                </div>

                <AiEntityIdentityPicker
                  name={newName}
                  kind="agent"
                  value={newIdentity}
                  onChange={setNewIdentity}
                  label="Icon & colour"
                />

                {/* System Instructions */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    System Instructions
                  </Label>
                  <Textarea
                    rows={3}
                    value={newPrompt}
                    onChange={(e) => setNewPrompt(e.target.value)}
                    className="text-xs"
                  />
                </div>

                {/* 2-Column: Reasoning Model + Target Environment */}
                <div className="gap-3 grid grid-cols-2">
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
                <div className="gap-2 text-xs flex items-center">
                  <span className="font-semibold text-foreground">Owner</span>
                  <AIEntityOwner
                    owner={
                      user
                        ? {
                            id: user.id,
                            name: user.name,
                            avatarUrl: user.avatarUrl,
                          }
                        : null
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-foreground">
                    Tags (comma-separated)
                  </Label>
                  <Input
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="support, autonomous, gpt-4o"
                    className="h-9 text-xs border-border bg-background text-foreground"
                  />
                </div>
              </DialogBody>

              {/* Modal Footer (Exact Image 1 Buttons) */}
              <DialogFooter className="gap-2 pt-3 flex shrink-0 items-center justify-end border-t border-border bg-popover">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateOpen(false)}
                  className="h-9 px-4 text-xs font-medium rounded-lg bg-muted text-foreground hover:bg-muted/70"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={createMutation.isPending}
                  disabled={!newName.trim()}
                  className="font-semibold h-9 px-4 text-xs rounded-lg bg-success text-success-foreground shadow-md transition-colors hover:bg-success/90"
                >
                  Create & Open Canvas
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* RENAME MODAL */}
        <Dialog
          open={Boolean(renameAgentTarget)}
          onOpenChange={(open) => !open && setRenameAgentTarget(null)}
        >
          <DialogContent className="sm:max-w-md">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!renameNameInput.trim() || !renameAgentTarget) return;
                renameMutation.mutate({
                  agentId: renameAgentTarget.id,
                  name: renameNameInput.trim(),
                });
              }}
            >
              <DialogHeader>
                <DialogTitle className="text-sm font-bold gap-2 flex items-center">
                  <Tag className="size-4 text-primary" /> Rename Agent
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Update the display title for "{renameAgentTarget?.name}".
                </DialogDescription>
              </DialogHeader>

              <DialogBody className="py-4 text-xs">
                <Label className="text-xs font-semibold mb-1 block text-foreground">
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRenameAgentTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={renameMutation.isPending}
                >
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
              <DialogTitle className="gap-2 flex items-center text-foreground">
                <Upload className="size-4 text-primary" />
                Import Agent Configuration JSON
              </DialogTitle>
              <DialogDescription className="text-xs">
                Import an exported Agent Studio JSON configuration to
                instantiate the agent in {activeWorkspace.name}.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-3 py-3">
              <CodeInput
                language="json"
                minRows={8}
                maxRows={16}
                value={importJson}
                onChange={setImportJson}
                placeholder="Paste agent configuration JSON here…"
              />
            </DialogBody>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsImportOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleImportSubmit}
                disabled={!importJson.trim()}
              >
                Import Agent
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

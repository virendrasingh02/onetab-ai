import { agentsApi } from '@org/api-client';
import { agentService } from '../services/agentService.js';
import {
  Badge,
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
} from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  Bot,
  CheckCircle2,
  Copy,
  Download,
  Edit2,
  MessageSquare,
  MoreVertical,
  Pause,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  User,
  Wand2,
  Zap,
} from 'lucide-react';
import React, { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AGENT_ICONS,
  AgentAvatar,
  DEFAULT_CATEGORIES,
  THEME_COLORS,
} from '../data/agent-metadata.js';
import { STUDIO_TEMPLATES } from '../data/templates.js';
import { useStudioSession } from '../session-guard.js';
import { AIModeAgentBuilder } from '../components/ai-mode/ai-mode-agent-builder.js';

type AgentStatus = 'draft' | 'testing' | 'published' | 'paused' | 'archived';
type AgentEnvironment = 'development' | 'staging' | 'production';

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
  const { activeWorkspace, session } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'published' | 'testing' | 'draft' | 'paused' | 'archived' | 'trash'>('all');
  const [environmentFilter, setEnvironmentFilter] = useState<'all' | 'development' | 'staging' | 'production'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Create Modal & Tabs
  const [isCreateOpen, setIsCreateOpen] = useState(
    searchParams.get('create') === 'blank' || searchParams.get('create') === 'true',
  );
  const [createMode, setCreateMode] = useState<'scratch' | 'prompt' | 'template' | 'existing'>('scratch');
  const [isAiModeOpen, setIsAiModeOpen] = useState(false);

  // Create Form State
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Assistant');
  const [newCategory, setNewCategory] = useState('Customer Support');
  const [isCreatingCustomCategory, setIsCreatingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrompt, setNewPrompt] = useState('You are an intelligent autonomous AI employee.');
  const [newModel, setNewModel] = useState('OpenAI GPT-4o');
  const [newEnvironment, setNewEnvironment] = useState<AgentEnvironment>('development');
  const [newTheme, setNewTheme] = useState('emerald');
  const [newIcon, setNewIcon] = useState('Bot');
  const [newAvatarUrl, setNewAvatarUrl] = useState('');
  const [avatarMode, setAvatarMode] = useState<'icon' | 'upload' | 'url'>('icon');
  const [newTags, setNewTags] = useState('support, autonomous');
  const [newOwnerName, setNewOwnerName] = useState(session?.user?.name || 'Workspace Owner');
  const [newOwnerEmail, setNewOwnerEmail] = useState(session?.user?.email || 'owner@onetab.ai');

  // Natural Language & Template & Existing Workflow States
  const [nlPrompt, setNlPrompt] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState(STUDIO_TEMPLATES[0]?.id || '');
  const [selectedExistingAgentId, setSelectedExistingAgentId] = useState('');

  // Rename Modal
  const [renameAgentTarget, setRenameAgentTarget] = useState<any | null>(null);
  const [renameNameInput, setRenameNameInput] = useState('');

  // Import JSON Modal
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importJson, setImportJson] = useState('');

  // Load agents
  const { data: rawAgents = [], isLoading } = useQuery({
    queryKey: ['agents', activeWorkspace.id],
    queryFn: async () => {
      try {
        const live = await agentsApi.list(activeWorkspace.id);
        if (live && live.length > 0) return live;
      } catch {
        // Fallback to local storage
      }
      return agentService.getAgents(activeWorkspace.id);
    },
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (input: any) => {
      try {
        return await agentsApi.create(activeWorkspace.id, input);
      } catch {
        return agentService.createAgent(activeWorkspace.id, input);
      }
    },
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
    mutationFn: async ({ agentId, name }: { agentId: string; name: string }) => {
      try {
        return await agentsApi.update(activeWorkspace.id, agentId, { name });
      } catch {
        return agentService.renameAgent(activeWorkspace.id, agentId, name);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      setRenameAgentTarget(null);
      toast.success('Agent renamed');
    },
  });

  // Status Change Mutation (Draft, Testing, Published, Paused, Archived)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ agentId, status }: { agentId: string; status: AgentStatus }) => {
      try {
        return await agentsApi.update(activeWorkspace.id, agentId, {
          configuration: { status },
        });
      } catch {
        return agentService.updateAgent(activeWorkspace.id, agentId, {
          configuration: { status },
        });
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      toast.success(`Status updated to "${vars.status}"`);
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
  });

  const resetForm = () => {
    setNewName('');
    setNewRole('Assistant');
    setNewCategory('Customer Support');
    setIsCreatingCustomCategory(false);
    setCustomCategoryInput('');
    setNewDesc('');
    setNewPrompt('You are an intelligent autonomous AI employee.');
    setNewModel('OpenAI GPT-4o');
    setNewEnvironment('development');
    setNewTheme('emerald');
    setNewIcon('Bot');
    setNewAvatarUrl('');
    setAvatarMode('icon');
    setNewTags('support, autonomous');
    setNewOwnerName(session?.user?.name || 'Workspace Owner');
    setNewOwnerEmail(session?.user?.email || 'owner@onetab.ai');
    setNlPrompt('');
    setSelectedExistingAgentId('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const ownerObj = {
      name: newOwnerName.trim() || session?.user?.name || 'Workspace Owner',
      email: newOwnerEmail.trim() || session?.user?.email || 'owner@onetab.ai',
    };

    // 1. Natural Language Creation
    if (createMode === 'prompt') {
      if (!nlPrompt.trim()) return;
      const autoName = nlPrompt.split(' ').slice(0, 3).join(' ') + ' Agent';
      createMutation.mutate({
        name: autoName,
        role: 'Autonomous Specialist',
        description: nlPrompt,
        systemPrompt: `You are an AI Agent with the directive: "${nlPrompt}". Reason step-by-step and call appropriate tools.`,
        model: newModel,
        avatarUrl: newAvatarUrl || null,
        configuration: {
          category: newCategory,
          environment: newEnvironment,
          status: 'draft',
          theme: newTheme,
          icon: newIcon,
          avatar: newAvatarUrl || '',
          tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
          owner: ownerObj,
        },
      });
      return;
    }

    // 2. From Starter Template
    if (createMode === 'template') {
      const tpl = STUDIO_TEMPLATES.find((t) => t.id === selectedTemplateId) || STUDIO_TEMPLATES[0];
      createMutation.mutate({
        name: tpl.name,
        role: tpl.tags[0] || 'Specialist',
        description: tpl.description,
        systemPrompt: 'Execute template workflow diligently.',
        model: newModel,
        avatarUrl: newAvatarUrl || null,
        graphJson: JSON.stringify({ nodes: tpl.nodes, edges: tpl.edges }),
        configuration: {
          category: tpl.tags[0] || newCategory,
          environment: newEnvironment,
          status: 'draft',
          theme: newTheme,
          icon: newIcon,
          avatar: newAvatarUrl || '',
          tags: tpl.tags,
          owner: ownerObj,
        },
      });
      return;
    }

    // 3. From Existing Workflow
    if (createMode === 'existing') {
      if (!selectedExistingAgentId) return;
      const targetAgent = rawAgents.find((a: any) => a.id === selectedExistingAgentId);
      createMutation.mutate({
        name: newName.trim() || `${targetAgent?.name || 'Workflow'} (Cloned)`,
        role: targetAgent?.role || newRole,
        description: newDesc.trim() || targetAgent?.description,
        systemPrompt: targetAgent?.systemPrompt || newPrompt,
        model: newModel,
        avatarUrl: newAvatarUrl || targetAgent?.avatarUrl || null,
        graphJson: targetAgent?.graphJson,
        tools: targetAgent?.tools,
        configuration: {
          category: newCategory,
          environment: newEnvironment,
          status: 'draft',
          theme: newTheme,
          icon: newIcon,
          avatar: newAvatarUrl || '',
          tags: ['cloned', newCategory.toLowerCase()],
          owner: ownerObj,
        },
      });
      return;
    }

    // 4. Blank Canvas Creation (Image 1 Layout)
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
      provider: 'openai',
      avatarUrl: newAvatarUrl || null,
      tools: ['firecrawl_search', 'kb_search'],
      graphJson: JSON.stringify(initialGraph),
      configuration: {
        category: newCategory,
        environment: newEnvironment,
        status: 'draft',
        theme: newTheme,
        icon: newIcon,
        avatar: newAvatarUrl || '',
        tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
        owner: ownerObj,
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
        model: data.model || 'OpenAI GPT-4o',
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

  const _activeAgentsCount = rawAgents.filter((a: any) => !a.deletedAt).length;
  const deletedAgentsCount = rawAgents.filter((a: any) => Boolean(a.deletedAt) || a.configuration?.status === 'deleted').length;

  if (isLoading) {
    return <LoadingState label="Loading workspace agents…" />;
  }

  return (
    <Page width="wide" padding="none" className="space-y-6 w-full">
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
              onClick={() => setIsAiModeOpen(true)}
              className="gap-1.5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            >
              <Wand2 className="size-3.5" /> AI Mode (Agent Builder)
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
              onClick={() => {
                setCreateMode('scratch');
                setIsCreateOpen(true);
              }}
              className="gap-1.5 text-xs font-semibold"
            >
              <Plus className="size-4" /> Create New AI Agent
            </Button>
          </div>
        }
      />

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
              <button
                key={tab}
                type="button"
                onClick={() => setFilterTab(tab)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                  filterTab === tab
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground'
                }`}
              >
                {tab} ({count})
              </button>
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
          <select
            value={environmentFilter}
            onChange={(e) => setEnvironmentFilter(e.target.value as any)}
            className="h-8 rounded-lg border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="all">All Environments</option>
            <option value="development">Development</option>
            <option value="staging">Staging</option>
            <option value="production">Production</option>
          </select>

          {/* Category */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 rounded-lg border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
          >
            <option value="all">All Categories</option>
            {availableCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Search Input */}
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, tags, role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-full rounded-lg border border-border bg-surface-raised pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Grid of Agent Cards */}
      {filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 p-12 text-center text-muted-foreground">
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
            const themeKey = config.theme || 'emerald';
            const _theme = THEME_COLORS[themeKey] || THEME_COLORS.emerald;
            const tags = config.tags || [];
            const owner = config.owner || { name: 'Workspace Admin', email: 'admin@onetab.ai' };
            const isDeleted = Boolean(agent.deletedAt) || status === ('deleted' as any);
            const toolsCount = countTools(agent.tools);

            // Status Badge Variant
            const getStatusBadge = () => {
              if (status === 'published') {
                return (
                  <Badge variant="success" className="text-[10px] gap-1">
                    <CheckCircle2 className="size-2.5" /> PUBLISHED
                  </Badge>
                );
              }
              if (status === 'testing') {
                return (
                  <Badge className="bg-warning/15 text-warning border border-warning/30 text-[10px] gap-1">
                    <Zap className="size-2.5" /> TESTING
                  </Badge>
                );
              }
              if (status === 'paused') {
                return (
                  <Badge className="bg-accent-blue/15 text-accent-blue border border-accent-blue/30 text-[10px] gap-1">
                    <Pause className="size-2.5" /> PAUSED
                  </Badge>
                );
              }
              if (status === 'archived') {
                return (
                  <Badge className="bg-muted-foreground/15 text-muted-foreground border border-muted-foreground/30 text-[10px] gap-1">
                    <Archive className="size-2.5" /> ARCHIVED
                  </Badge>
                );
              }
              return (
                <Badge variant="outline" className="text-[10px]">
                  DRAFT
                </Badge>
              );
            };

            return (
              <div
                key={agent.id}
                className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface p-4 transition-all hover:border-primary/50 hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      {/* Avatar & Icon with custom theme styling */}
                      <AgentAvatar agent={agent} size="md" />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <div
                            onClick={() => !isDeleted && navigate(`/agents/${agent.id}`)}
                            className={`text-xs font-bold text-foreground transition-colors line-clamp-1 ${
                              !isDeleted ? 'cursor-pointer hover:text-primary' : ''
                            }`}
                          >
                            {agent.name}
                          </div>
                          {!isDeleted && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenameAgentTarget(agent);
                                setRenameNameInput(agent.name);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-muted-foreground hover:text-foreground transition-opacity"
                              title="Rename agent"
                            >
                              <Edit2 className="size-3" />
                            </button>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span>{agent.role || 'Assistant'}</span>
                          <span>•</span>
                          <span className="font-mono text-[10px] uppercase text-muted-foreground/80">
                            {env}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      {getStatusBadge()}

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
                              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
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
                                onClick={() => updateStatusMutation.mutate({ agentId: agent.id, status: 'published' })}
                              >
                                Publish Agent
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateStatusMutation.mutate({ agentId: agent.id, status: 'paused' })}
                              >
                                Pause Agent
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateStatusMutation.mutate({ agentId: agent.id, status: 'archived' })}
                              >
                                Archive Agent
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => deleteMutation.mutate(agent.id)}
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
                                onClick={() => permanentDeleteMutation.mutate(agent.id)}
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
                      <span className="rounded-md bg-surface-raised px-2 py-0.5 text-[10px] font-medium text-foreground border border-border/60">
                        {config.category}
                      </span>
                    )}
                    {tags.slice(0, 2).map((t: string, idx: number) => (
                      <span
                        key={idx}
                        className="rounded-md bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 border-t border-border/60 pt-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <span className="flex items-center gap-1 text-[10px]">
                      <User className="size-3 text-muted-foreground" />
                      <span>{owner.name}</span>
                    </span>
                    <span>{agent.model || 'OpenAI GPT-4o'}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">
                      {toolsCount} tool{toolsCount === 1 ? '' : 's'} connected
                    </span>
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
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader className="space-y-1 pb-2">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-success/15 text-success border border-success/30">
                  <Bot className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                    Create New AI Agent
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    Choose your creation method: blank canvas, natural language prompt, or pre-built template.
                  </DialogDescription>
                </div>
              </div>

              {/* Mode Switcher Tabs (Matching Image 1 Pill Switcher) */}
              <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-background p-1 text-xs border border-border">
                <button
                  type="button"
                  onClick={() => setCreateMode('scratch')}
                  className={`rounded-lg py-1.5 font-medium transition-all text-center ${
                    createMode === 'scratch'
                      ? 'bg-muted text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Blank Canvas
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('prompt')}
                  className={`rounded-lg py-1.5 font-medium transition-all flex items-center justify-center gap-1.5 ${
                    createMode === 'prompt'
                      ? 'bg-muted text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Wand2 className="size-3.5 text-success" />
                  <span>Natural Language</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreateMode('template')}
                  className={`rounded-lg py-1.5 font-medium transition-all text-center ${
                    createMode === 'template'
                      ? 'bg-muted text-foreground shadow-xs font-semibold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  From Template
                </button>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-3.5 py-4 text-xs">
              {/* TAB 1: BLANK CANVAS (Exact Image 1 fields) */}
              {createMode === 'scratch' && (
                <>
                  {/* Agent Name * */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-foreground">
                      Agent Name *
                    </label>
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
                      <label className="text-[11px] font-semibold text-foreground">
                        Role / Title
                      </label>
                      <Input
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        placeholder="Assistant"
                        className="h-9 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-success rounded-lg"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-foreground">
                          Category
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCreatingCustomCategory(!isCreatingCustomCategory)}
                          className="text-[10px] text-success hover:underline"
                        >
                          {isCreatingCustomCategory ? 'Choose Existing' : '+ New Category'}
                        </button>
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
                        <select
                          value={newCategory}
                          onChange={(e) => {
                            if (e.target.value === '__new__') {
                              setIsCreatingCustomCategory(true);
                            } else {
                              setNewCategory(e.target.value);
                            }
                          }}
                          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-success focus:outline-none"
                        >
                          {availableCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                          <option value="__new__">+ Create new category…</option>
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-foreground">
                      Description
                    </label>
                    <Input
                      value={newDesc}
                      onChange={(e) => setNewDesc(e.target.value)}
                      placeholder="Briefly describe what task this agent performs..."
                      className="h-9 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-success rounded-lg"
                    />
                  </div>

                  {/* Agent Icon, Custom Avatar & Theme (Module 1.2 Specs) */}
                  <div className="rounded-xl border border-border bg-background p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-foreground">
                        Agent Icon, Avatar & Theme
                      </span>
                      {/* Avatar Mode switcher: Icon vs Custom Image */}
                      <div className="flex rounded-lg bg-muted p-0.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => setAvatarMode('icon')}
                          className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                            avatarMode === 'icon' ? 'bg-muted text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Icon Library
                        </button>
                        <button
                          type="button"
                          onClick={() => setAvatarMode('upload')}
                          className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                            avatarMode === 'upload' ? 'bg-muted text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Upload File
                        </button>
                        <button
                          type="button"
                          onClick={() => setAvatarMode('url')}
                          className={`px-2 py-0.5 rounded-md font-medium transition-all ${
                            avatarMode === 'url' ? 'bg-muted text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          Image URL
                        </button>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      {/* Live Preview Avatar */}
                      <div className="flex flex-col items-center gap-1.5 shrink-0">
                        <AgentAvatar
                          icon={newIcon}
                          avatarUrl={newAvatarUrl}
                          theme={newTheme}
                          size="lg"
                        />
                        <span className="text-[10px] text-muted-foreground font-mono">Live Preview</span>
                      </div>

                      <div className="flex-1 space-y-2.5">
                        {/* Icon Picker Mode */}
                        {avatarMode === 'icon' && (
                          <div>
                            <label className="text-[10px] text-muted-foreground block mb-1">
                              Choose Built-in Icon:
                            </label>
                            <div className="grid grid-cols-10 gap-1.5 max-h-24 overflow-y-auto pr-1">
                              {AGENT_ICONS.map((item) => {
                                const IconComp = item.icon;
                                const isSelected = newIcon.toLowerCase() === item.id.toLowerCase() && !newAvatarUrl;
                                return (
                                  <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => {
                                      setNewIcon(item.id);
                                      setNewAvatarUrl('');
                                    }}
                                    title={item.label}
                                    className={`size-7 rounded-lg flex items-center justify-center border transition-all ${
                                      isSelected
                                        ? 'border-success bg-success/20 text-success ring-1 ring-success'
                                        : 'border-border bg-background text-muted-foreground hover:text-foreground hover:border-border-strong'
                                    }`}
                                  >
                                    <IconComp className="size-3.5" />
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* File Upload Mode */}
                        {avatarMode === 'upload' && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] text-muted-foreground block">
                              Upload custom avatar image (PNG, JPG, SVG):
                            </label>
                            <div className="flex items-center gap-2">
                              <input
                                type="file"
                                id="agent-avatar-file-upload"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    if (file.size > 2 * 1024 * 1024) {
                                      toast.error('Avatar file must be under 2MB');
                                      return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = (loadEvt) => {
                                      const result = loadEvt.target?.result as string;
                                      setNewAvatarUrl(result);
                                      toast.success('Custom avatar uploaded');
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                              />
                              <label
                                htmlFor="agent-avatar-file-upload"
                                className="h-8 px-3 rounded-lg border border-border bg-muted hover:bg-muted/70 text-foreground text-xs flex items-center gap-1.5 cursor-pointer font-medium transition-colors"
                              >
                                <Upload className="size-3.5 text-success" />
                                <span>Choose Image…</span>
                              </label>
                              {newAvatarUrl && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setNewAvatarUrl('')}
                                  className="h-8 text-xs text-destructive hover:text-destructive"
                                >
                                  Clear Avatar
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* URL Mode */}
                        {avatarMode === 'url' && (
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground block">
                              Avatar Image URL:
                            </label>
                            <div className="flex items-center gap-1.5">
                              <Input
                                value={newAvatarUrl}
                                onChange={(e) => setNewAvatarUrl(e.target.value)}
                                placeholder="https://example.com/avatar.png"
                                className="h-8 text-xs bg-background border-border text-foreground"
                              />
                              {newAvatarUrl && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setNewAvatarUrl('')}
                                  className="h-8 text-xs text-destructive hover:text-destructive"
                                >
                                  Clear
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Theme Color Row */}
                        <div className="pt-1 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground font-medium">Theme Color:</span>
                          <div className="flex items-center gap-1.5">
                            {Object.keys(THEME_COLORS).map((color) => {
                              const item = THEME_COLORS[color];
                              return (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() => setNewTheme(color)}
                                  style={{ backgroundColor: item.colorHex }}
                                  className={`size-5 rounded-full transition-all ${
                                    newTheme === color ? 'ring-2 ring-white scale-125' : 'opacity-70 hover:opacity-100 hover:scale-110'
                                  }`}
                                  title={color}
                                />
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* System Instructions */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-foreground">
                      System Instructions
                    </label>
                    <textarea
                      rows={3}
                      value={newPrompt}
                      onChange={(e) => setNewPrompt(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-success focus:outline-none"
                    />
                  </div>

                  {/* 2-Column: Reasoning Model + Target Environment */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-foreground">
                        Reasoning Model
                      </label>
                      <select
                        value={newModel}
                        onChange={(e) => setNewModel(e.target.value)}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-success focus:outline-none"
                      >
                        <option value="OpenAI GPT-4o">OpenAI GPT-4o</option>
                        <option value="OpenAI GPT-4o Mini">OpenAI GPT-4o Mini</option>
                        <option value="Anthropic Claude 3.5 Sonnet">Anthropic Claude 3.5 Sonnet</option>
                        <option value="Google Gemini 1.5 Pro">Google Gemini 1.5 Pro</option>
                        <option value="Ollama Llama 3">Ollama Llama 3</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-foreground">
                        Target Environment
                      </label>
                      <select
                        value={newEnvironment}
                        onChange={(e) => setNewEnvironment(e.target.value as any)}
                        className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs text-foreground focus:border-success focus:outline-none"
                      >
                        <option value="development">Development</option>
                        <option value="staging">Staging</option>
                        <option value="production">Production</option>
                      </select>
                    </div>
                  </div>

                  {/* Owner & Tags */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-foreground">
                        Owner / Lead Name
                      </label>
                      <Input
                        value={newOwnerName}
                        onChange={(e) => setNewOwnerName(e.target.value)}
                        placeholder="e.g. Jane Doe"
                        className="h-9 text-xs bg-background border-border text-foreground"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-foreground">
                        Owner Email
                      </label>
                      <Input
                        value={newOwnerEmail}
                        onChange={(e) => setNewOwnerEmail(e.target.value)}
                        placeholder="owner@onetab.ai"
                        className="h-9 text-xs bg-background border-border text-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-foreground">
                      Tags (comma-separated)
                    </label>
                    <Input
                      value={newTags}
                      onChange={(e) => setNewTags(e.target.value)}
                      placeholder="support, autonomous, gpt-4o"
                      className="h-9 text-xs bg-background border-border text-foreground"
                    />
                  </div>
                </>
              )}

              {/* TAB 2: NATURAL LANGUAGE CREATION */}
              {createMode === 'prompt' && (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="size-4 text-primary shrink-0" />
                      <div className="text-xs">
                        <span className="font-bold text-foreground">Interactive AI Mode: </span>
                        <span className="text-muted-foreground">Autonomous planning, requirements & Chat integration</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="xs"
                      onClick={() => {
                        setIsCreateOpen(false);
                        setIsAiModeOpen(true);
                      }}
                      className="gap-1 text-xs bg-primary text-primary-foreground font-semibold"
                    >
                      <Wand2 className="size-3" />
                      <span>Launch AI Mode</span>
                    </Button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-foreground">
                      Or quick-create with directive:
                    </label>
                    <textarea
                      rows={4}
                      value={nlPrompt}
                      onChange={(e) => setNlPrompt(e.target.value)}
                      placeholder="e.g. Build an autonomous Gmail agent that checks for urgent emails and drafts replies..."
                      className="w-full rounded-lg border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-success focus:outline-none"
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-foreground">Reasoning Model</label>
                      <select
                        value={newModel}
                        onChange={(e) => setNewModel(e.target.value)}
                        className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
                      >
                        <option value="OpenAI GPT-4o">OpenAI GPT-4o</option>
                        <option value="Anthropic Claude 3.5 Sonnet">Claude 3.5 Sonnet</option>
                        <option value="Google Gemini 1.5 Pro">Gemini 1.5 Pro</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-foreground">Environment</label>
                      <select
                        value={newEnvironment}
                        onChange={(e) => setNewEnvironment(e.target.value as any)}
                        className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs text-foreground"
                      >
                        <option value="development">Development</option>
                        <option value="staging">Staging</option>
                        <option value="production">Production</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: FROM STARTER TEMPLATE */}
              {createMode === 'template' && (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-foreground">
                    Select a Template to Instantiate:
                  </label>
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {STUDIO_TEMPLATES.map((tpl) => (
                      <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplateId(tpl.id)}
                        className={`cursor-pointer rounded-xl border p-3 transition-all ${
                          selectedTemplateId === tpl.id
                            ? 'border-success bg-success/10'
                            : 'border-border bg-background hover:border-success/40'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                          <span>{tpl.name}</span>
                          <span className="text-[10px] text-muted-foreground font-mono">{tpl.nodes.length} nodes</span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                          {tpl.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </DialogBody>

            {/* Modal Footer (Exact Image 1 Buttons) */}
            <DialogFooter className="flex items-center justify-end gap-2 pt-3 border-t border-border">
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
                disabled={createMode === 'scratch' ? !newName.trim() : createMode === 'prompt' ? !nlPrompt.trim() : false}
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
              <label className="text-[11px] font-semibold text-foreground block mb-1">
                New Agent Title *
              </label>
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
            <textarea
              rows={8}
              value={importJson}
              onChange={(e) => setImportJson(e.target.value)}
              placeholder="Paste agent configuration JSON here…"
              className="w-full font-mono rounded-lg border border-border bg-surface-raised p-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
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

      {/* AI MODE AGENTIC APP BUILDER */}
      <AIModeAgentBuilder
        workspaceId={activeWorkspace.id}
        isOpen={isAiModeOpen}
        onClose={() => setIsAiModeOpen(false)}
        onAgentCreated={(agentId) => {
          queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
          navigate(`/agents/${agentId}`);
        }}
      />
    </Page>
  );
}

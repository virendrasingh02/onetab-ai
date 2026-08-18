import type { AIAgentDetail } from '@org/types';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogClose,
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
  EmptyState,
  ErrorState,
  Hint,
  Input,
  Label,
  Page,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SkeletonList,
  Switch,
  Textarea,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Activity,
  AlertTriangle,
  Bot,
  Brain,
  Code2,
  Copy,
  Edit3,
  Globe,
  Layers,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Power,
  Rocket,
  Search,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAgentMutations, useAgents } from './use-agents.js';

interface AgentTemplate {
  id: string;
  name: string;
  role: string;
  description: string;
  category: string;
  model: string;
  avatarUrl?: string;
  tools: string[];
}

const PRESET_ICONS = [
  { id: 'icon:bot', label: 'Bot', icon: Bot, color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20' },
  { id: 'icon:brain', label: 'Brain', icon: Brain, color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20' },
  { id: 'icon:code', label: 'Code', icon: Code2, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  { id: 'icon:spark', label: 'Spark', icon: Sparkles, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  { id: 'icon:shield', label: 'Shield', icon: Shield, color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { id: 'icon:search', label: 'Search', icon: Search, color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' },
  { id: 'icon:chat', label: 'Chat', icon: MessageSquare, color: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  { id: 'icon:rocket', label: 'Rocket', icon: Rocket, color: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  { id: 'icon:globe', label: 'Globe', icon: Globe, color: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' },
  { id: 'icon:layers', label: 'Layers', icon: Layers, color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' },
];

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'tpl_code_reviewer',
    name: 'Code Reviewer Agent',
    role: 'Engineering Assistant',
    description:
      'Analyzes pull requests for code quality, security vulnerabilities, and test coverage.',
    category: 'Engineering',
    model: 'gpt-4o',
    avatarUrl: 'icon:code',
    tools: ['GitHub Integration', 'Code Analysis', 'Channel Alert'],
  },
  {
    id: 'tpl_support_bot',
    name: 'Support Triage Bot',
    role: 'Customer Support',
    description:
      'Classifies incoming support tickets, drafts responses, and escalates urgent issues.',
    category: 'Support',
    model: 'claude-3-5-sonnet',
    avatarUrl: 'icon:chat',
    tools: ['Inbox Triage', 'KB Search', 'Auto Responder'],
  },
  {
    id: 'tpl_researcher',
    name: 'Deep Research Agent',
    role: 'Research & Intelligence',
    description:
      'Gathers web & document research, extracts insights, and formats structured summaries.',
    category: 'Research',
    model: 'gpt-4o',
    avatarUrl: 'icon:search',
    tools: ['Web Search', 'Document Parser', 'Doc Generator'],
  },
  {
    id: 'tpl_standup_bot',
    name: 'Standup Digest Agent',
    role: 'Operations',
    description:
      'Collects daily updates from team members and compiles concise standup summaries.',
    category: 'Operations',
    model: 'gpt-4o-mini',
    avatarUrl: 'icon:spark',
    tools: ['Cron Scheduler', 'Activity Tracker', 'Channel Digest'],
  },
];

const AVAILABLE_MODELS = [
  { value: 'gpt-4o', label: 'OpenAI GPT-4o (Omni)' },
  { value: 'gpt-4o-mini', label: 'OpenAI GPT-4o Mini (Fast)' },
  { value: 'claude-3-5-sonnet', label: 'Anthropic Claude 3.5 Sonnet' },
  { value: 'gemini-1.5-pro', label: 'Google Gemini 1.5 Pro' },
  { value: 'gemini-1.5-flash', label: 'Google Gemini 1.5 Flash' },
];

type AgentTab = 'all' | 'templates' | 'mine';

export function AgentMarketplaceView() {
  const { workspaceId } = useCurrentWorkspace();
  const agents = useAgents(workspaceId);
  const { create, update, remove } = useAgentMutations(workspaceId);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') as AgentTab | null;
  const [tab, setTab] = useState<AgentTab>(urlTab ?? 'all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    role: 'Assistant',
    description: '',
    systemPrompt: '',
    model: 'gpt-4o',
    avatarUrl: 'icon:bot',
  });

  const [deletingAgent, setDeletingAgent] = useState<AIAgentDetail | null>(null);
  const [editingAgent, setEditingAgent] = useState<AIAgentDetail | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    role: '',
    systemPrompt: '',
    model: 'gpt-4o',
    avatarUrl: 'icon:bot',
    isActive: true,
  });

  const navigate = useNavigate();

  useEffect(() => {
    if (urlTab && urlTab !== tab) {
      setTab(urlTab);
    }
  }, [urlTab, tab]);

  const handleTabChange = (nextTab: AgentTab) => {
    setTab(nextTab);
    setSearchParams({ tab: nextTab });
  };

  const openBuilder = (agentId?: string, name?: string) => {
    if (agentId) {
      navigate(`builder?agentId=${agentId}&name=${encodeURIComponent(name || '')}`);
    } else {
      navigate('builder');
    }
  };

  const installed = agents.data ?? [];

  // Filtered agents and templates based on search query
  const query = searchQuery.trim().toLowerCase();

  const filteredInstalled = useMemo(() => {
    if (!query) return installed;
    return installed.filter(
      (a) =>
        a.name.toLowerCase().includes(query) ||
        (a.role && a.role.toLowerCase().includes(query)) ||
        (a.description && a.description.toLowerCase().includes(query)) ||
        (a.model && a.model.toLowerCase().includes(query)),
    );
  }, [installed, query]);

  const filteredTemplates = useMemo(() => {
    if (!query) return AGENT_TEMPLATES;
    return AGENT_TEMPLATES.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.role.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.category.toLowerCase().includes(query) ||
        t.tools.some((tool) => tool.toLowerCase().includes(query)),
    );
  }, [query]);

  const handleUseTemplate = (template: AgentTemplate) => {
    create.mutate(
      {
        name: template.name,
        role: template.role,
        systemPrompt: template.description,
        avatarUrl: template.avatarUrl,
        isMarketplace: true,
        model: template.model,
      },
      {
        onSuccess: () => {
          toast.success(`Template deployed`, {
            description: `"${template.name}" is now ready in your workspace.`,
          });
          handleTabChange('mine');
        },
        onError: () => {
          toast.error('Failed to create agent from template');
        },
      },
    );
  };

  const handleCreateAgent = () => {
    const finalName = createForm.name.trim() || 'New Agent';
    create.mutate(
      {
        name: finalName,
        role: createForm.role.trim() || 'Assistant',
        description: createForm.description.trim() || undefined,
        systemPrompt: createForm.systemPrompt.trim() || undefined,
        avatarUrl: createForm.avatarUrl || null,
        model: createForm.model,
        isMarketplace: false,
      },
      {
        onSuccess: (newAgent) => {
          toast.success('Agent created', {
            description: `"${finalName}" is now ready.`,
          });
          setIsCreateOpen(false);
          setCreateForm({
            name: '',
            role: 'Assistant',
            description: '',
            systemPrompt: '',
            model: 'gpt-4o',
            avatarUrl: 'icon:bot',
          });
          handleTabChange('mine');
        },
        onError: () => {
          toast.error('Failed to create agent');
        },
      },
    );
  };

  const handleDuplicate = (agent: AIAgentDetail) => {
    create.mutate(
      {
        name: `${agent.name} (Copy)`,
        role: agent.role,
        description: agent.description || undefined,
        systemPrompt: agent.systemPrompt,
        avatarUrl: agent.avatarUrl,
        model: agent.model || 'gpt-4o',
        isMarketplace: false,
      },
      {
        onSuccess: () => {
          toast.success('Agent duplicated', {
            description: `Created "${agent.name} (Copy)"`,
          });
        },
        onError: () => {
          toast.error('Failed to duplicate agent');
        },
      },
    );
  };

  const handleToggleActive = (agent: AIAgentDetail) => {
    const nextState = !agent.isActive;
    update.mutate(
      {
        agentId: agent.id,
        input: { isActive: nextState },
      },
      {
        onSuccess: () => {
          toast.success(nextState ? `"${agent.name}" activated` : `"${agent.name}" paused`);
        },
        onError: () => {
          toast.error('Failed to update agent status');
        },
      },
    );
  };

  const openQuickEdit = (agent: AIAgentDetail) => {
    setEditingAgent(agent);
    setEditForm({
      name: agent.name,
      role: agent.role || '',
      systemPrompt: agent.systemPrompt || '',
      model: agent.model || 'gpt-4o',
      avatarUrl: agent.avatarUrl || 'icon:bot',
      isActive: agent.isActive,
    });
  };

  const handleSaveQuickEdit = () => {
    if (!editingAgent) return;
    update.mutate(
      {
        agentId: editingAgent.id,
        input: {
          name: editForm.name.trim() || editingAgent.name,
          role: editForm.role.trim(),
          systemPrompt: editForm.systemPrompt,
          avatarUrl: editForm.avatarUrl || null,
          model: editForm.model,
          isActive: editForm.isActive,
        },
      },
      {
        onSuccess: () => {
          toast.success('Agent updated', {
            description: `"${editForm.name}" details were saved.`,
          });
          setEditingAgent(null);
        },
        onError: () => {
          toast.error('Failed to update agent details');
        },
      },
    );
  };

  const handleConfirmDelete = () => {
    if (!deletingAgent) return;
    const name = deletingAgent.name;
    remove.mutate(deletingAgent.id, {
      onSuccess: () => {
        toast.info('Agent deleted', {
          description: `"${name}" was removed from the workspace.`,
        });
        setDeletingAgent(null);
      },
      onError: () => {
        toast.error('Failed to delete agent');
      },
    });
  };

  return (
    <Page>
      {/* Header section matching Channels design */}
      <div className="mb-6 border-b border-border/60 pb-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent-violet-soft text-accent-violet shadow-2xs">
              <Bot className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  AI Agents
                </h1>
                <Badge variant="neutral" className="text-xs font-normal">
                  {installed.length} deployed
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Manage, build, and deploy autonomous intelligent agents across your workspace.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="h-9 cursor-pointer items-center gap-1.5 rounded-md border-0 bg-[#059669] px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#047857] sm:text-sm"
            >
              <Plus className="size-4" />
              <span>New Agent</span>
            </Button>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-9 text-muted-foreground hover:text-foreground"
                  aria-label="More options"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setIsCreateOpen(true)} className="gap-2 text-xs">
                  <Plus className="size-3.5 text-muted-foreground" />
                  <span>Create with wizard</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openBuilder()} className="gap-2 text-xs">
                  <Wrench className="size-3.5 text-muted-foreground" />
                  <span>Open visual builder</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate('logs')} className="gap-2 text-xs">
                  <Activity className="size-3.5 text-muted-foreground" />
                  <span>Activity logs</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleTabChange('templates')}
                  className="gap-2 text-xs"
                >
                  <Sparkles className="size-3.5 text-muted-foreground" />
                  <span>Browse templates</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tab strip & Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex items-center gap-6 text-sm font-medium">
            <button
              type="button"
              onClick={() => handleTabChange('all')}
              className={cn(
                'relative pb-3 transition-colors',
                tab === 'all'
                  ? 'border-b-2 border-primary font-semibold text-foreground'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              All Agents ({installed.length + AGENT_TEMPLATES.length})
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('mine')}
              className={cn(
                'relative pb-3 transition-colors',
                tab === 'mine'
                  ? 'border-b-2 border-primary font-semibold text-foreground'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              Managed by you ({installed.length})
            </button>

            <button
              type="button"
              onClick={() => handleTabChange('templates')}
              className={cn(
                'relative pb-3 transition-colors',
                tab === 'templates'
                  ? 'border-b-2 border-primary font-semibold text-foreground'
                  : 'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              Templates ({AGENT_TEMPLATES.length})
            </button>
          </div>

          <div className="relative mb-2 w-full sm:w-64">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter agents by name, role..."
              leadingIcon={<Search className="size-3.5 text-muted-foreground" />}
              className="h-8 text-xs pr-7"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {agents.isLoading ? (
        <SkeletonList rows={3} />
      ) : agents.isError ? (
        <ErrorState
          title="Could not load your agents"
          description="Something went wrong reaching the server."
          onRetry={() => agents.refetch()}
        />
      ) : tab === 'all' ? (
        <div className="space-y-8">
          {filteredInstalled.length > 0 ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Workspace Agents ({filteredInstalled.length})
                </h2>
              </div>
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredInstalled.map((agent) => (
                  <li key={agent.id}>
                    <ManagedAgentCard
                      agent={agent}
                      onEditBuilder={() => openBuilder(agent.id, agent.name)}
                      onQuickEdit={() => openQuickEdit(agent)}
                      onDuplicate={() => handleDuplicate(agent)}
                      onToggleActive={() => handleToggleActive(agent)}
                      onLogs={() => navigate('logs')}
                      onDelete={() => setDeletingAgent(agent)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : installed.length === 0 ? (
            <EmptyState
              icon={<Bot />}
              title="No agents deployed yet"
              description="Build a custom autonomous agent with custom avatar icons or pick a template below."
              action={
                <Button leadingIcon={<Plus />} onClick={() => setIsCreateOpen(true)}>
                  Create your first agent
                </Button>
              }
            />
          ) : null}

          {filteredTemplates.length > 0 ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Templates catalogue ({filteredTemplates.length})
                </h2>
              </div>
              <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredTemplates.map((template) => (
                  <li key={template.id}>
                    <AgentTemplateCard
                      template={template}
                      onUse={() => handleUseTemplate(template)}
                      isCreating={create.isPending}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : tab === 'mine' ? (
        filteredInstalled.length === 0 ? (
          <EmptyState
            icon={<Bot />}
            title={searchQuery ? 'No matching agents found' : 'No agents deployed yet'}
            description={
              searchQuery
                ? `No managed agents matched "${searchQuery}".`
                : 'Create a new agent with custom icons or open the visual builder.'
            }
            action={
              <Button leadingIcon={<Plus />} onClick={() => setIsCreateOpen(true)}>
                Create agent
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredInstalled.map((agent) => (
              <li key={agent.id}>
                <ManagedAgentCard
                  agent={agent}
                  onEditBuilder={() => openBuilder(agent.id, agent.name)}
                  onQuickEdit={() => openQuickEdit(agent)}
                  onDuplicate={() => handleDuplicate(agent)}
                  onToggleActive={() => handleToggleActive(agent)}
                  onLogs={() => navigate('logs')}
                  onDelete={() => setDeletingAgent(agent)}
                />
              </li>
            ))}
          </ul>
        )
      ) : filteredTemplates.length === 0 ? (
        <EmptyState
          icon={<Sparkles />}
          title="No matching templates"
          description={`No pre-built templates matched "${searchQuery}".`}
          action={<Button onClick={() => setSearchQuery('')}>Clear filter</Button>}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((template) => (
            <li key={template.id}>
              <AgentTemplateCard
                template={template}
                onUse={() => handleUseTemplate(template)}
                isCreating={create.isPending}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Create New Agent Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-500" />
              Create New AI Agent
            </DialogTitle>
            <DialogDescription>
              Configure name, role, model parameters, and customize avatar/media icon.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Avatar / Icon Picker */}
            <div className="space-y-1.5">
              <Label>Agent Avatar & Media Icon</Label>
              <AgentAvatarPicker
                value={createForm.avatarUrl}
                onChange={(avatar) =>
                  setCreateForm((prev) => ({ ...prev, avatarUrl: avatar }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="create-agent-name">Agent Name *</Label>
                <Input
                  id="create-agent-name"
                  value={createForm.name}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Documentation Assistant"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-agent-role">Role / Job Title</Label>
                <Input
                  id="create-agent-role"
                  value={createForm.role}
                  onChange={(e) =>
                    setCreateForm((prev) => ({ ...prev, role: e.target.value }))
                  }
                  placeholder="e.g. Technical Writer"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-agent-model">AI Model Provider</Label>
              <Select
                value={createForm.model}
                onValueChange={(val) =>
                  setCreateForm((prev) => ({ ...prev, model: val }))
                }
              >
                <SelectTrigger id="create-agent-model">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-agent-prompt">System Prompt / Instructions</Label>
              <Textarea
                id="create-agent-prompt"
                rows={3}
                value={createForm.systemPrompt}
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    systemPrompt: e.target.value,
                  }))
                }
                placeholder="Describe how this agent reasons, constraints, and tasks..."
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 flex-wrap sm:flex-nowrap justify-between">
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setIsCreateOpen(false);
                openBuilder();
              }}
              leadingIcon={<Wrench className="size-3.5" />}
            >
              Open in Visual Builder
            </Button>

            <div className="flex items-center gap-2">
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                variant="primary"
                onClick={handleCreateAgent}
                loading={create.isPending}
                leadingIcon={<Plus className="size-4" />}
              >
                Create Agent
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deletingAgent)}
        onOpenChange={(open) => {
          if (!open) setDeletingAgent(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Delete Agent
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{' '}
              <strong className="text-foreground">{deletingAgent?.name}</strong>? This will
              permanently remove its capabilities, configurations, and scheduled runs.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              loading={remove.isPending}
              leadingIcon={<Trash2 className="size-4" />}
            >
              Delete Agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Edit Dialog */}
      <Dialog
        open={Boolean(editingAgent)}
        onOpenChange={(open) => {
          if (!open) setEditingAgent(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-primary" />
              Edit Agent Details
            </DialogTitle>
            <DialogDescription>
              Update basic information, avatar icon, primary role, and model parameters.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Avatar / Icon Picker */}
            <div className="space-y-1.5">
              <Label>Agent Avatar & Media Icon</Label>
              <AgentAvatarPicker
                value={editForm.avatarUrl}
                onChange={(avatar) =>
                  setEditForm((prev) => ({ ...prev, avatarUrl: avatar }))
                }
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="agent-name">Agent Name</Label>
                <Input
                  id="agent-name"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Code Reviewer Agent"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="agent-role">Role / Job Title</Label>
                <Input
                  id="agent-role"
                  value={editForm.role}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                  placeholder="e.g. Engineering Assistant"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-model">AI Model Provider</Label>
              <Select
                value={editForm.model}
                onValueChange={(val) => setEditForm((prev) => ({ ...prev, model: val }))}
              >
                <SelectTrigger id="agent-model">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="agent-prompt">System Prompt / Instructions</Label>
              <Textarea
                id="agent-prompt"
                rows={3}
                value={editForm.systemPrompt}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, systemPrompt: e.target.value }))
                }
                placeholder="Define how this agent behaves, reasoning constraints, and output format..."
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-raised p-3">
              <div>
                <Label htmlFor="agent-active" className="font-medium cursor-pointer">
                  Agent Active Status
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  When active, this agent can be triggered and respond to events.
                </p>
              </div>
              <Switch
                id="agent-active"
                checked={editForm.isActive}
                onCheckedChange={(checked) =>
                  setEditForm((prev) => ({ ...prev, isActive: checked }))
                }
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="primary"
              onClick={handleSaveQuickEdit}
              loading={update.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

/* --------------------------------------------------------------- avatar ---- */

export function AgentAvatar({
  avatarUrl,
  name,
  className,
  size = 'md',
}: {
  avatarUrl?: string | null;
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'size-7 text-xs',
    md: 'size-9 text-sm',
    lg: 'size-12 text-base',
  };

  const iconSizes = {
    sm: 'size-3.5',
    md: 'size-4.5',
    lg: 'size-6',
  };

  if (avatarUrl && (avatarUrl.startsWith('data:image/') || avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://'))) {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-lg border border-border/80 bg-surface shadow-2xs shrink-0',
          sizeClasses[size],
          className,
        )}
      >
        <img src={avatarUrl} alt={name} className="size-full object-cover" />
      </div>
    );
  }

  const preset = PRESET_ICONS.find((p) => p.id === avatarUrl) || PRESET_ICONS[0];
  const IconComponent = preset.icon;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border shadow-2xs transition-transform',
        preset.color,
        sizeClasses[size],
        className,
      )}
    >
      <IconComponent className={iconSizes[size]} aria-hidden />
    </div>
  );
}

function AgentAvatarPicker({
  value,
  onChange,
}: {
  value?: string | null;
  onChange: (val: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image file too large (max 2MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      onChange(dataUrl);
      toast.success('Custom avatar uploaded');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-2.5 rounded-lg border border-border bg-surface-raised p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <AgentAvatar avatarUrl={value} name="Agent" size="lg" />
          <div>
            <p className="text-xs font-semibold text-foreground">Selected Avatar</p>
            <p className="text-[11px] text-muted-foreground">
              Choose from media presets below or upload an image file.
            </p>
          </div>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            leadingIcon={<Upload className="size-3.5" />}
          >
            Upload image
          </Button>
        </div>
      </div>

      {/* Preset Icons Selection */}
      <div className="space-y-1.5 pt-1 border-t border-border/60">
        <span className="text-[11px] font-medium text-muted-foreground">Media & Bot Presets:</span>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_ICONS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = value === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange(preset.id)}
                className={cn(
                  'flex size-8 items-center justify-center rounded-lg border transition-all',
                  preset.color,
                  isSelected
                    ? 'ring-2 ring-primary ring-offset-1 border-primary shadow-xs scale-105'
                    : 'opacity-70 hover:opacity-100 hover:scale-105',
                )}
                title={preset.label}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- cards ---- */

interface ManagedAgentCardProps {
  agent: AIAgentDetail;
  onEditBuilder: () => void;
  onQuickEdit: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onLogs: () => void;
  onDelete: () => void;
}

function ManagedAgentCard({
  agent,
  onEditBuilder,
  onQuickEdit,
  onDuplicate,
  onToggleActive,
  onLogs,
  onDelete,
}: ManagedAgentCardProps) {
  const fromCatalogue = agent.isMarketplace;

  return (
    <Card className="group relative flex h-full flex-col justify-between p-4 transition-all duration-200 hover:border-border-strong hover:shadow-sm">
      <div>
        {/* Card Header: Avatar, Name, Status Pill & Context Menu */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2.5">
            <AgentAvatar avatarUrl={agent.avatarUrl} name={agent.name} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className="truncate text-sm font-semibold tracking-tight text-foreground">
                  {agent.name}
                </h3>
              </div>
              <p className="truncate text-xs text-muted-foreground">{agent.role || 'Autonomous Agent'}</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Hint label={agent.isActive ? 'Agent is active (click to pause)' : 'Agent is paused (click to activate)'}>
              <button
                type="button"
                onClick={onToggleActive}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors',
                  agent.isActive
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                    : 'bg-muted text-muted-foreground border border-border',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    agent.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground',
                  )}
                />
                {agent.isActive ? 'Active' : 'Paused'}
              </button>
            </Hint>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="Agent options"
                >
                  <MoreHorizontal className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={onEditBuilder} className="gap-2 text-xs">
                  <Wrench className="size-3.5 text-muted-foreground" />
                  <span>Open in Builder</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onQuickEdit} className="gap-2 text-xs">
                  <Edit3 className="size-3.5 text-muted-foreground" />
                  <span>Quick Edit Details</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate} className="gap-2 text-xs">
                  <Copy className="size-3.5 text-muted-foreground" />
                  <span>Duplicate Agent</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleActive} className="gap-2 text-xs">
                  <Power className="size-3.5 text-muted-foreground" />
                  <span>{agent.isActive ? 'Pause Agent' : 'Activate Agent'}</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLogs} className="gap-2 text-xs">
                  <Activity className="size-3.5 text-muted-foreground" />
                  <span>Execution Logs</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onDelete} variant="destructive" className="gap-2 text-xs">
                  <Trash2 className="size-3.5" />
                  <span>Delete Agent</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Model & Source tags */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <Badge variant="neutral" className="text-[10px] px-1.5 py-0 font-mono">
            {agent.model || 'gpt-4o'}
          </Badge>
          <Badge variant={fromCatalogue ? 'neutral' : 'primary'} className="text-[10px] px-1.5 py-0">
            {fromCatalogue ? 'Template' : 'Custom'}
          </Badge>
        </div>

        {/* Description / System Prompt snippet */}
        {agent.description || agent.systemPrompt ? (
          <p className="mb-4 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {agent.description || agent.systemPrompt}
          </p>
        ) : (
          <p className="mb-4 text-xs italic text-muted-foreground/60">
            No system prompt configured.
          </p>
        )}
      </div>

      {/* Card Actions Footer */}
      <div className="flex items-center gap-2 pt-2 border-t border-border/60">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={onEditBuilder}
          leadingIcon={<Pencil className="size-3.5" />}
        >
          Edit in Builder
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 text-xs"
          onClick={onLogs}
          leadingIcon={<Activity className="size-3.5" />}
        >
          Activity
        </Button>
        <Hint label="Delete agent">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            aria-label={`Delete ${agent.name}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </Hint>
      </div>
    </Card>
  );
}

function AgentTemplateCard({
  template,
  onUse,
  isCreating,
}: {
  template: AgentTemplate;
  onUse: () => void;
  isCreating: boolean;
}) {
  return (
    <Card className="group relative flex h-full flex-col justify-between p-4 transition-all duration-200 hover:border-border-strong hover:shadow-sm">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <Badge variant="neutral" className="text-[10px]">
            {template.category}
          </Badge>
          <Badge variant="primary" className="text-[10px]">
            {template.model}
          </Badge>
        </div>

        <div className="flex items-start gap-2.5 mb-2">
          <AgentAvatar avatarUrl={template.avatarUrl} name={template.name} size="sm" />
          <div>
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {template.name}
            </h3>
            <p className="text-xs font-medium text-muted-foreground">
              {template.role}
            </p>
          </div>
        </div>

        <p className="mb-4 text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {template.description}
        </p>

        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {template.tools.map((tool) => (
            <span
              key={tool}
              className="rounded-md border border-border bg-surface-inset px-2 py-0.5 text-[10px] text-muted-foreground font-mono"
            >
              {tool}
            </span>
          ))}
        </div>
      </div>

      <Button
        variant="primary"
        size="sm"
        className="w-full text-xs"
        onClick={onUse}
        loading={isCreating}
        leadingIcon={<Zap className="size-3.5 text-amber-400" />}
      >
        Use Template
      </Button>
    </Card>
  );
}

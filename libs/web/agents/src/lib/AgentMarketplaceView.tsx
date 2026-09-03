import type { Accent } from '@org/design-system';
import type { AIAgentDetail } from '@org/types';
import {
  accentClasses,
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
  PageSection,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SkeletonList,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
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

/*
 * The picker's swatches. `accent` names a design-system token rather than a
 * raw Tailwind hue: these used to be hand-written `bg-x-500/10 text-x-600
 * dark:text-x-400` triples, which is the same idea the `accentClasses` map
 * already expresses — and the tokens carry the dark-mode lift with them, so
 * the pairing cannot drift out of contrast on one theme.
 */
const PRESET_ICONS: {
  id: string;
  label: string;
  icon: typeof Bot;
  accent: Accent;
}[] = [
  { id: 'icon:bot', label: 'Bot', icon: Bot, accent: 'violet' },
  { id: 'icon:brain', label: 'Brain', icon: Brain, accent: 'pink' },
  { id: 'icon:code', label: 'Code', icon: Code2, accent: 'blue' },
  { id: 'icon:spark', label: 'Spark', icon: Sparkles, accent: 'amber' },
  { id: 'icon:shield', label: 'Shield', icon: Shield, accent: 'green' },
  { id: 'icon:search', label: 'Search', icon: Search, accent: 'cyan' },
  { id: 'icon:chat', label: 'Chat', icon: MessageSquare, accent: 'indigo' },
  { id: 'icon:rocket', label: 'Rocket', icon: Rocket, accent: 'rose' },
  { id: 'icon:globe', label: 'Globe', icon: Globe, accent: 'teal' },
  { id: 'icon:layers', label: 'Layers', icon: Layers, accent: 'orange' },
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
  {
    value: 'nvidia/nemotron-3-super-120b-a12b',
    label: 'NVIDIA Nemotron 3 Super (Default)',
  },
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
    model: 'nvidia/nemotron-3-super-120b-a12b',
    avatarUrl: 'icon:bot',
  });

  const [deletingAgent, setDeletingAgent] = useState<AIAgentDetail | null>(
    null,
  );
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
      navigate(
        `builder?agentId=${agentId}&name=${encodeURIComponent(name || '')}`,
      );
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
        onSuccess: () => {
          toast.success('Agent created', {
            description: `"${finalName}" is now ready.`,
          });
          setIsCreateOpen(false);
          setCreateForm({
            name: '',
            role: 'Assistant',
            description: '',
            systemPrompt: '',
            model: 'nvidia/nemotron-3-super-120b-a12b',
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
          toast.success(
            nextState ? `"${agent.name}" activated` : `"${agent.name}" paused`,
          );
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
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <Bot
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                AI Agents
              </h2>
              <Badge
                variant="neutral"
                className="px-1.5 py-0 h-4.5 text-[11px]"
              >
                {installed.length} deployed
              </Badge>
            </div>

            {/* <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            <p className="hidden min-w-0 max-w-[48ch] truncate text-xs text-muted-foreground sm:block">
              Manage, build, and deploy autonomous intelligent agents
            </p> */}
          </div>

          <div className="gap-2 flex items-center">
            <SearchInput
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Filter agents…"
              className="h-7 text-xs"
              wrapperClassName="w-36 sm:w-48"
            />

            <Button
              onClick={() => setIsCreateOpen(true)}
              size="sm"
              className="h-7 text-xs gap-1"
              leadingIcon={<Plus className="size-3.5" />}
            >
              New Agent
            </Button>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  aria-label="More agent options"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onSelect={() => setIsCreateOpen(true)}
                  className="gap-2 text-xs"
                >
                  <Plus className="size-3.5 text-muted-foreground" />
                  <span>Create with wizard</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => openBuilder()}
                  className="gap-2 text-xs"
                >
                  <Wrench className="size-3.5 text-muted-foreground" />
                  <span>Open visual builder</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => navigate('logs')}
                  className="gap-2 text-xs"
                >
                  <Activity className="size-3.5 text-muted-foreground" />
                  <span>Activity logs</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => handleTabChange('templates')}
                  className="gap-2 text-xs"
                >
                  <Sparkles className="size-3.5 text-muted-foreground" />
                  <span>Browse templates</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-3 sm:px-6 border-t border-border/40 bg-surface-muted/30">
          <Tabs
            value={tab}
            onValueChange={(next) => handleTabChange(next as AgentTab)}
          >
            <TabsList variant="underline" size="sm" className="border-b-0">
              <TabsTrigger
                value="all"
                count={installed.length + AGENT_TEMPLATES.length}
              >
                All Agents
              </TabsTrigger>
              <TabsTrigger value="mine" count={installed.length}>
                Managed by you
              </TabsTrigger>
              <TabsTrigger value="templates" count={AGENT_TEMPLATES.length}>
                Templates
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="min-h-0 p-4 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {agents.isLoading ? (
            <SkeletonList rows={3} />
          ) : agents.isError ? (
            <ErrorState
              title="Could not load your agents"
              description="Something went wrong reaching the server."
              onRetry={() => agents.refetch()}
            />
          ) : tab === 'all' ? (
            <>
              {filteredInstalled.length > 0 ? (
                <PageSection
                  title={`Workspace Agents (${filteredInstalled.length})`}
                >
                  <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
                    {filteredInstalled.map((agent) => (
                      <li key={agent.id}>
                        <ManagedAgentCard
                          agent={agent}
                          onChat={() => navigate(`chat?id=${agent.id}`)}
                          onEditBuilder={() =>
                            openBuilder(agent.id, agent.name)
                          }
                          onQuickEdit={() => openQuickEdit(agent)}
                          onDuplicate={() => handleDuplicate(agent)}
                          onToggleActive={() => handleToggleActive(agent)}
                          onLogs={() => navigate('logs')}
                          onDelete={() => setDeletingAgent(agent)}
                        />
                      </li>
                    ))}
                  </ul>
                </PageSection>
              ) : installed.length === 0 ? (
                <EmptyState
                  icon={<Bot />}
                  title="No agents deployed yet"
                  description="Build a custom autonomous agent with custom avatar icons or pick a template below."
                  action={
                    <Button
                      leadingIcon={<Plus />}
                      onClick={() => setIsCreateOpen(true)}
                    >
                      Create your first agent
                    </Button>
                  }
                />
              ) : null}

              {filteredTemplates.length > 0 ? (
                <PageSection
                  title={`Templates catalogue (${filteredTemplates.length})`}
                >
                  <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
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
                </PageSection>
              ) : null}
            </>
          ) : tab === 'mine' ? (
            filteredInstalled.length === 0 ? (
              <EmptyState
                icon={<Bot />}
                title={
                  searchQuery
                    ? 'No matching agents found'
                    : 'No agents deployed yet'
                }
                description={
                  searchQuery
                    ? `No managed agents matched "${searchQuery}".`
                    : 'Create a new agent with custom icons or open the visual builder.'
                }
                action={
                  <Button
                    leadingIcon={<Plus />}
                    onClick={() => setIsCreateOpen(true)}
                  >
                    Create agent
                  </Button>
                }
              />
            ) : (
              <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
                {filteredInstalled.map((agent) => (
                  <li key={agent.id}>
                    <ManagedAgentCard
                      agent={agent}
                      onChat={() => navigate(`chat?id=${agent.id}`)}
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
              action={
                <Button onClick={() => setSearchQuery('')}>Clear filter</Button>
              }
            />
          ) : (
            <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
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
                <DialogTitle className="gap-2 flex items-center">
                  <Sparkles className="size-4 text-success-text" />
                  Create New AI Agent
                </DialogTitle>
                <DialogDescription>
                  Configure name, role, model parameters, and customize
                  avatar/media icon.
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

                <div className="sm:grid-cols-2 gap-3 grid grid-cols-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="create-agent-name">Agent Name *</Label>
                    <Input
                      id="create-agent-name"
                      value={createForm.name}
                      onChange={(e) =>
                        setCreateForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
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
                        setCreateForm((prev) => ({
                          ...prev,
                          role: e.target.value,
                        }))
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
                  <Label htmlFor="create-agent-prompt">
                    System Prompt / Instructions
                  </Label>
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

              <DialogFooter className="gap-2 sm:gap-0 sm:flex-nowrap flex-wrap justify-between">
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

                <div className="gap-2 flex items-center">
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
                <DialogTitle className="gap-2 flex items-center text-destructive">
                  <AlertTriangle className="size-5" />
                  Delete Agent
                </DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete{' '}
                  <strong className="text-foreground">
                    {deletingAgent?.name}
                  </strong>
                  ? This will permanently remove its capabilities,
                  configurations, and scheduled runs.
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
                <DialogTitle className="gap-2 flex items-center">
                  <Pencil className="size-4 text-primary" />
                  Edit Agent Details
                </DialogTitle>
                <DialogDescription>
                  Update basic information, avatar icon, primary role, and model
                  parameters.
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

                <div className="sm:grid-cols-2 gap-3 grid grid-cols-1">
                  <div className="space-y-1.5">
                    <Label htmlFor="agent-name">Agent Name</Label>
                    <Input
                      id="agent-name"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="e.g. Code Reviewer Agent"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="agent-role">Role / Job Title</Label>
                    <Input
                      id="agent-role"
                      value={editForm.role}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          role: e.target.value,
                        }))
                      }
                      placeholder="e.g. Engineering Assistant"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="agent-model">AI Model Provider</Label>
                  <Select
                    value={editForm.model}
                    onValueChange={(val) =>
                      setEditForm((prev) => ({ ...prev, model: val }))
                    }
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
                  <Label htmlFor="agent-prompt">
                    System Prompt / Instructions
                  </Label>
                  <Textarea
                    id="agent-prompt"
                    rows={3}
                    value={editForm.systemPrompt}
                    onChange={(e) =>
                      setEditForm((prev) => ({
                        ...prev,
                        systemPrompt: e.target.value,
                      }))
                    }
                    placeholder="Define how this agent behaves, reasoning constraints, and output format..."
                  />
                </div>

                <div className="p-3 flex items-center justify-between rounded-lg border border-border bg-surface-raised">
                  <div>
                    <Label
                      htmlFor="agent-active"
                      className="font-medium cursor-pointer"
                    >
                      Agent Active Status
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      When active, this agent can be triggered and respond to
                      events.
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
        </div>
      </div>
    </div>
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

  if (
    avatarUrl &&
    (avatarUrl.startsWith('data:image/') ||
      avatarUrl.startsWith('http://') ||
      avatarUrl.startsWith('https://'))
  ) {
    return (
      <div
        className={cn(
          'shadow-2xs relative shrink-0 overflow-hidden rounded-lg border border-border/80 bg-surface',
          sizeClasses[size],
          className,
        )}
      >
        <img src={avatarUrl} alt={name} className="size-full object-cover" />
      </div>
    );
  }

  const preset =
    PRESET_ICONS.find((p) => p.id === avatarUrl) || PRESET_ICONS[0];
  const IconComponent = preset.icon;

  return (
    <div
      className={cn(
        'shadow-2xs flex shrink-0 items-center justify-center rounded-lg border transition-transform',
        accentClasses[preset.accent].soft,
        accentClasses[preset.accent].border,
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
    <div className="space-y-2.5 p-3 rounded-lg border border-border bg-surface-raised">
      <div className="gap-3 flex items-center justify-between">
        <div className="gap-3 flex items-center">
          <AgentAvatar avatarUrl={value} name="Agent" size="lg" />
          <div>
            <p className="text-xs font-semibold text-foreground">
              Selected Avatar
            </p>
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
        <span className="font-medium text-[11px] text-muted-foreground">
          Media & Bot Presets:
        </span>
        <div className="gap-1.5 flex flex-wrap">
          {PRESET_ICONS.map((preset) => {
            const Icon = preset.icon;
            const isSelected = value === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onChange(preset.id)}
                className={cn(
                  'size-8 flex items-center justify-center rounded-lg border transition-all',
                  accentClasses[preset.accent].soft,
                  accentClasses[preset.accent].border,
                  isSelected
                    ? 'scale-105 border-primary shadow-xs ring-2 ring-primary ring-offset-1'
                    : 'opacity-70 hover:scale-105 hover:opacity-100',
                )}
                aria-label={`${preset.label} icon`}
                aria-pressed={isSelected}
                title={preset.label}
              >
                <Icon className="size-4" aria-hidden />
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
  onChat: () => void;
  onEditBuilder: () => void;
  onQuickEdit: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onLogs: () => void;
  onDelete: () => void;
}

function ManagedAgentCard({
  agent,
  onChat,
  onEditBuilder,
  onQuickEdit,
  onDuplicate,
  onToggleActive,
  onLogs,
  onDelete,
}: ManagedAgentCardProps) {
  const fromCatalogue = agent.isMarketplace;

  return (
    <Card className="group p-4 relative flex h-full flex-col justify-between transition-all duration-200 hover:border-border-strong hover:shadow-sm">
      <div>
        {/* Card Header: Avatar, Name, Status Pill & Context Menu */}
        <div className="mb-3 gap-2 flex items-start justify-between">
          <div className="min-w-0 gap-2.5 flex items-start">
            <AgentAvatar
              avatarUrl={agent.avatarUrl}
              name={agent.name}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="gap-1.5 flex items-center">
                <h3 className="text-sm font-semibold tracking-tight truncate text-foreground">
                  {agent.name}
                </h3>
              </div>
              <p className="text-xs truncate text-muted-foreground">
                {agent.role || 'Autonomous Agent'}
              </p>
            </div>
          </div>

          <div className="gap-1 flex items-center">
            <Hint
              label={
                agent.isActive
                  ? 'Agent is active (click to pause)'
                  : 'Agent is paused (click to activate)'
              }
            >
              <button
                type="button"
                onClick={onToggleActive}
                className={cn(
                  'gap-1 px-2 py-0.5 font-medium flex items-center rounded-full text-[10px] transition-colors',
                  agent.isActive
                    ? 'border border-success/20 bg-success/10 text-success-text'
                    : 'border border-border bg-muted text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    agent.isActive
                      ? 'animate-pulse bg-success'
                      : 'bg-muted-foreground',
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
                <DropdownMenuItem
                  onClick={onChat}
                  className="gap-2 text-xs font-semibold text-primary"
                >
                  <MessageSquare className="size-3.5" />
                  <span>Chat with Agent</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onEditBuilder}
                  className="gap-2 text-xs"
                >
                  <Wrench className="size-3.5 text-muted-foreground" />
                  <span>Open in Builder</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onQuickEdit}
                  className="gap-2 text-xs"
                >
                  <Edit3 className="size-3.5 text-muted-foreground" />
                  <span>Quick Edit Details</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onDuplicate}
                  className="gap-2 text-xs"
                >
                  <Copy className="size-3.5 text-muted-foreground" />
                  <span>Duplicate Agent</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={onToggleActive}
                  className="gap-2 text-xs"
                >
                  <Power className="size-3.5 text-muted-foreground" />
                  <span>
                    {agent.isActive ? 'Pause Agent' : 'Activate Agent'}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLogs} className="gap-2 text-xs">
                  <Activity className="size-3.5 text-muted-foreground" />
                  <span>Execution Logs</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  variant="destructive"
                  className="gap-2 text-xs"
                >
                  <Trash2 className="size-3.5" />
                  <span>Delete Agent</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Model & Source tags */}
        <div className="mb-3 gap-1.5 flex flex-wrap items-center">
          <Badge
            variant="neutral"
            className="px-1.5 py-0 font-mono text-[10px]"
          >
            {agent.model || 'gpt-4o'}
          </Badge>
          <Badge
            variant={fromCatalogue ? 'neutral' : 'primary'}
            className="px-1.5 py-0 text-[10px]"
          >
            {fromCatalogue ? 'Template' : 'Custom'}
          </Badge>
        </div>

        {/* Description / System Prompt snippet */}
        {agent.description || agent.systemPrompt ? (
          <p className="mb-4 text-xs leading-relaxed line-clamp-2 text-muted-foreground">
            {agent.description || agent.systemPrompt}
          </p>
        ) : (
          <p className="mb-4 text-xs text-muted-foreground/60 italic">
            No system prompt configured.
          </p>
        )}
      </div>

      {/* Card Actions Footer */}
      <div className="gap-2 pt-2 flex items-center border-t border-border/60">
        <Button
          variant="primary"
          size="sm"
          className="text-xs flex-1"
          onClick={onChat}
          leadingIcon={<MessageSquare className="size-3.5" />}
        >
          Chat
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs flex-1"
          onClick={onEditBuilder}
          leadingIcon={<Pencil className="size-3.5" />}
        >
          Builder
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="size-8 p-0"
          onClick={onLogs}
          title="Activity Logs"
        >
          <Activity className="size-3.5" />
        </Button>
        <Hint label="Delete agent">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            className="size-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
    <Card className="group p-4 relative flex h-full flex-col justify-between transition-all duration-200 hover:border-border-strong hover:shadow-sm">
      <div>
        <div className="mb-3 gap-2 flex items-center justify-between">
          <Badge variant="neutral" className="text-[10px]">
            {template.category}
          </Badge>
          <Badge variant="primary" className="text-[10px]">
            {template.model}
          </Badge>
        </div>

        <div className="gap-2.5 mb-2 flex items-start">
          <AgentAvatar
            avatarUrl={template.avatarUrl}
            name={template.name}
            size="sm"
          />
          <div>
            <h3 className="text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
              {template.name}
            </h3>
            <p className="text-xs font-medium text-muted-foreground">
              {template.role}
            </p>
          </div>
        </div>

        <p className="mb-4 text-xs leading-relaxed line-clamp-2 text-muted-foreground">
          {template.description}
        </p>

        <div className="mb-4 gap-1.5 flex flex-wrap items-center">
          {template.tools.map((tool) => (
            <span
              key={tool}
              className="px-2 py-0.5 rounded-md border border-border bg-surface-inset font-mono text-[10px] text-muted-foreground"
            >
              {tool}
            </span>
          ))}
        </div>
      </div>

      <Button
        variant="primary"
        size="sm"
        className="text-xs w-full"
        onClick={onUse}
        loading={isCreating}
        leadingIcon={<Zap className="size-3.5 text-accent-amber" />}
      >
        Use Template
      </Button>
    </Card>
  );
}

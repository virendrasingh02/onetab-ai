import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Hint,
  IconRenderer,
  type PromptDialog,
} from '@org/ui';
import { cn } from '@org/utils';
import { useAgentMutations, useAgents } from '@org/web-agents';
import { useWorkflowMutations, useWorkflows } from '@org/web-automations';
import { useIntegrationMutations, useIntegrations } from '@org/web-integrations';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Bell,
  Bot,
  Check,
  ChevronRight,
  Copy,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Star,
  Trash2,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  navActionClass,
  navIconClass,
  navRowClass,
  Section,
  type NavDepth,
} from './nav-primitives.js';
import { useSidebarFavorites } from './use-sidebar-favorites.js';

export interface ResourceItemData {
  id: string;
  name: string;
  icon?: string;
  detail?: string;
}

const PROVIDER_ICON: Record<string, string> = {
  GITHUB: 'Code',
  JIRA: 'Code',
  GDRIVE: 'HardDrive',
  GOOGLE_DRIVE: 'HardDrive',
  SLACK: 'FileText',
  NOTION: 'FileText',
  WEBHOOKS: 'Plug',
};

const TRIGGER_ICON: Record<string, string> = {
  WEBHOOK: 'Plug',
  CRON: 'Clock',
  EVENT: 'Zap',
};

function titleCaseProvider(provider: string): string {
  return provider
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function AgentNavRow({
  agent,
  workspaceSlug,
  isSelected,
  isFavorite,
  onToggleFavorite,
  onDelete,
  depth = 1,
}: {
  agent: ResourceItemData;
  workspaceSlug: string;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onDelete?: () => void;
  depth?: NavDepth;
}) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);

  const handleCopyLink = useCallback(
    (e?: React.MouseEvent | Event) => {
      e?.stopPropagation?.();
      const url = `${window.location.origin}/w/${workspaceSlug}/agents?agent=${agent.id}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [workspaceSlug, agent.id],
  );

  return (
    <li className="group/row relative">
      <NavLink
        to={`/w/${workspaceSlug}/agents?agent=${agent.id}`}
        className={navRowClass(isSelected, {
          depth,
          extra: 'pr-14',
        })}
        title={agent.detail ? `${agent.name} — ${agent.detail}` : agent.name}
      >
        <IconRenderer
          icon={agent.icon ?? 'Bot'}
          fallbackEmoji="🤖"
          sizeClassName={navIconClass(depth)}
        />
        <span className="flex-1 truncate">{agent.name}</span>
      </NavLink>

      <div
        className={cn(
          'right-1 gap-0.5 absolute top-1/2 flex -translate-y-1/2 items-center transition-opacity',
          isFavorite
            ? 'opacity-100'
            : 'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-within:opacity-100',
        )}
      >
        <Hint label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            aria-label={
              isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
            aria-pressed={isFavorite}
            className={cn(
              'size-5 p-0',
              isFavorite
                ? 'text-[#eab308] opacity-100'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Star className={cn('size-3.5', isFavorite && 'fill-current')} />
          </Button>
        </Hint>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Options for ${agent.name}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="size-5 p-0 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="w-64">
            <DropdownMenuItem
              onSelect={() =>
                navigate(`/w/${workspaceSlug}/agents?agent=${agent.id}&tab=studio`)
              }
              onClick={() =>
                navigate(`/w/${workspaceSlug}/agents?agent=${agent.id}&tab=studio`)
              }
              className="gap-2.5"
            >
              <Bot className="size-4" />
              <span>Open Studio</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={handleCopyLink}
              onClick={handleCopyLink}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                {copied ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span>{copied ? 'Link copied!' : 'Copy agent link'}</span>
              </div>
              <DropdownMenuShortcut>C</DropdownMenuShortcut>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={onToggleFavorite}
              onClick={onToggleFavorite}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-[#eab308]',
                  )}
                />
                <span>{isFavorite ? 'Remove Favorite' : 'Favorite'}</span>
              </div>
              <ChevronRight className="size-4 text-muted-foreground/70" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() =>
                navigate(`/w/${workspaceSlug}/agents?agent=${agent.id}`)
              }
              onClick={() =>
                navigate(`/w/${workspaceSlug}/agents?agent=${agent.id}`)
              }
              className="gap-2.5"
            >
              <Settings className="size-4" />
              <span>Agent settings & tools</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={() => setMuted((prev) => !prev)}
              onClick={() => setMuted((prev) => !prev)}
              className="gap-2.5"
            >
              <Bell className="size-4" />
              <span>{muted ? 'Unmute notifications' : 'Mute notifications'}</span>
            </DropdownMenuItem>

            {onDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={onDelete}
                  onClick={onDelete}
                  className="gap-2.5"
                >
                  <Trash2 className="size-4" />
                  <span>Delete agent</span>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

export function AppNavRow({
  app,
  workspaceSlug,
  isSelected,
  isFavorite,
  onToggleFavorite,
  onDisconnect,
  depth = 1,
}: {
  app: ResourceItemData;
  workspaceSlug: string;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onDisconnect?: () => void;
  depth?: NavDepth;
}) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [synced, setSynced] = useState(false);

  const handleCopyLink = useCallback(
    (e?: React.MouseEvent | Event) => {
      e?.stopPropagation?.();
      const url = `${window.location.origin}/w/${workspaceSlug}/integrations?app=${app.id}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [workspaceSlug, app.id],
  );

  const handleSync = useCallback((e?: React.MouseEvent | Event) => {
    e?.stopPropagation?.();
    setSynced(true);
    setTimeout(() => setSynced(false), 2000);
  }, []);

  return (
    <li className="group/row relative">
      <NavLink
        to={`/w/${workspaceSlug}/integrations?app=${app.id}`}
        className={navRowClass(isSelected, {
          depth,
          extra: 'pr-14',
        })}
        title={app.detail ? `${app.name} — ${app.detail}` : app.name}
      >
        <IconRenderer
          icon={app.icon}
          fallbackEmoji="🧩"
          sizeClassName={navIconClass(depth)}
        />
        <span className="flex-1 truncate">{app.name}</span>
      </NavLink>

      <div
        className={cn(
          'right-1 gap-0.5 absolute top-1/2 flex -translate-y-1/2 items-center transition-opacity',
          isFavorite
            ? 'opacity-100'
            : 'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-within:opacity-100',
        )}
      >
        <Hint label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            aria-label={
              isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
            aria-pressed={isFavorite}
            className={cn(
              'size-5 p-0',
              isFavorite
                ? 'text-[#eab308] opacity-100'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Star className={cn('size-3.5', isFavorite && 'fill-current')} />
          </Button>
        </Hint>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Options for ${app.name}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="size-5 p-0 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="w-64">
            <DropdownMenuItem
              onSelect={() =>
                navigate(`/w/${workspaceSlug}/integrations?app=${app.id}`)
              }
              onClick={() =>
                navigate(`/w/${workspaceSlug}/integrations?app=${app.id}`)
              }
              className="gap-2.5"
            >
              <Settings className="size-4" />
              <span>Manage integration</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={handleCopyLink}
              onClick={handleCopyLink}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                {copied ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span>{copied ? 'Link copied!' : 'Copy app link'}</span>
              </div>
              <DropdownMenuShortcut>C</DropdownMenuShortcut>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={handleSync}
              onClick={handleSync}
              className="gap-2.5"
            >
              {synced ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <span>{synced ? 'Synced successfully!' : 'Sync connection'}</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={onToggleFavorite}
              onClick={onToggleFavorite}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-[#eab308]',
                  )}
                />
                <span>{isFavorite ? 'Remove Favorite' : 'Favorite'}</span>
              </div>
              <ChevronRight className="size-4 text-muted-foreground/70" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() =>
                navigate(`/w/${workspaceSlug}/integrations?app=${app.id}`)
              }
              onClick={() =>
                navigate(`/w/${workspaceSlug}/integrations?app=${app.id}`)
              }
              className="gap-2.5"
            >
              <Shield className="size-4" />
              <span>Permissions & scopes</span>
            </DropdownMenuItem>

            {onDisconnect ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={onDisconnect}
                  onClick={onDisconnect}
                  className="gap-2.5"
                >
                  <Trash2 className="size-4" />
                  <span>Disconnect app</span>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

export function WorkflowNavRow({
  workflow,
  workspaceSlug,
  isSelected,
  isFavorite,
  onToggleFavorite,
  onDelete,
  depth = 1,
}: {
  workflow: ResourceItemData;
  workspaceSlug: string;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onDelete?: () => void;
  depth?: NavDepth;
}) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const handleCopyLink = useCallback(
    (e?: React.MouseEvent | Event) => {
      e?.stopPropagation?.();
      const url = `${window.location.origin}/w/${workspaceSlug}/automations?workflow=${workflow.id}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [workspaceSlug, workflow.id],
  );

  const handleRunWorkflow = useCallback((e?: React.MouseEvent | Event) => {
    e?.stopPropagation?.();
    setTriggered(true);
    setTimeout(() => setTriggered(false), 2000);
  }, []);

  return (
    <li className="group/row relative">
      <NavLink
        to={`/w/${workspaceSlug}/automations?workflow=${workflow.id}`}
        className={navRowClass(isSelected, {
          depth,
          extra: 'pr-14',
        })}
        title={
          workflow.detail
            ? `${workflow.name} — ${workflow.detail}`
            : workflow.name
        }
      >
        <IconRenderer
          icon={workflow.icon ?? 'Zap'}
          fallbackEmoji="⚡"
          sizeClassName={navIconClass(depth)}
        />
        <span className="flex-1 truncate">{workflow.name}</span>
      </NavLink>

      <div
        className={cn(
          'right-1 gap-0.5 absolute top-1/2 flex -translate-y-1/2 items-center transition-opacity',
          isFavorite
            ? 'opacity-100'
            : 'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-within:opacity-100',
        )}
      >
        <Hint label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            aria-label={
              isFavorite ? 'Remove from favorites' : 'Add to favorites'
            }
            aria-pressed={isFavorite}
            className={cn(
              'size-5 p-0',
              isFavorite
                ? 'text-[#eab308] opacity-100'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Star className={cn('size-3.5', isFavorite && 'fill-current')} />
          </Button>
        </Hint>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Options for ${workflow.name}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              className="size-5 p-0 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="bottom" className="w-64">
            <DropdownMenuItem
              onSelect={() =>
                navigate(
                  `/w/${workspaceSlug}/automations?workflow=${workflow.id}`,
                )
              }
              onClick={() =>
                navigate(
                  `/w/${workspaceSlug}/automations?workflow=${workflow.id}`,
                )
              }
              className="gap-2.5"
            >
              <Pencil className="size-4" />
              <span>Edit workflow</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={handleRunWorkflow}
              onClick={handleRunWorkflow}
              className="gap-2.5"
            >
              {triggered ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <Play className="size-4" />
              )}
              <span>{triggered ? 'Workflow triggered!' : 'Run workflow now'}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={handleCopyLink}
              onClick={handleCopyLink}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                {copied ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span>{copied ? 'Link copied!' : 'Copy link'}</span>
              </div>
              <DropdownMenuShortcut>C</DropdownMenuShortcut>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={onToggleFavorite}
              onClick={onToggleFavorite}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-[#eab308]',
                  )}
                />
                <span>{isFavorite ? 'Remove Favorite' : 'Favorite'}</span>
              </div>
              <ChevronRight className="size-4 text-muted-foreground/70" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() => setIsPaused((prev) => !prev)}
              onClick={() => setIsPaused((prev) => !prev)}
              className="gap-2.5"
            >
              {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
              <span>{isPaused ? 'Resume automation' : 'Pause automation'}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={() =>
                navigate(
                  `/w/${workspaceSlug}/automations?workflow=${workflow.id}`,
                )
              }
              onClick={() =>
                navigate(
                  `/w/${workspaceSlug}/automations?workflow=${workflow.id}`,
                )
              }
              className="gap-2.5"
            >
              <Settings className="size-4" />
              <span>Workflow settings</span>
            </DropdownMenuItem>

            {onDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={onDelete}
                  onClick={onDelete}
                  className="gap-2.5"
                >
                  <Trash2 className="size-4" />
                  <span>Delete workflow</span>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

export function AgentsSection({
  workspaceSlug,
  prompts,
}: {
  workspaceSlug: string;
  prompts?: PromptDialog;
}) {
  const location = useLocation();
  const { workspaceId } = useCurrentWorkspace();
  const agents = useAgents(workspaceId);
  const mutations = useAgentMutations(workspaceId);
  const { isFavorite, toggleFavorite } = useSidebarFavorites(workspaceId);

  const items: ResourceItemData[] = (agents.data ?? []).map((agent) => ({
    id: agent.id,
    name: agent.name,
    icon: 'Bot',
    detail: agent.role,
  }));

  const handleDelete = async (agent: ResourceItemData) => {
    if (prompts) {
      const confirmed = await prompts.confirmAction({
        title: `Delete “${agent.name}”?`,
        description:
          'The AI agent will be removed from this workspace. This action cannot be undone.',
        confirmLabel: 'Delete agent',
        destructive: true,
      });
      if (!confirmed) return;
    }
    mutations.remove.mutate(agent.id);
  };

  return (
    <Section
      title="AI Agents"
      count={items.length}
      emptyLabel={agents.isLoading ? 'Loading agents…' : 'No agents deployed yet.'}
      action={
        <Hint label="Add agent">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="Add agent"
            className="size-5 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <NavLink to={`/w/${workspaceSlug}/agents?tab=all`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {items.map((item) => {
        const isSelected =
          location.pathname.endsWith('/agents') &&
          location.search.includes(`agent=${item.id}`);

        return (
          <AgentNavRow
            key={item.id}
            agent={item}
            workspaceSlug={workspaceSlug}
            isSelected={isSelected}
            isFavorite={isFavorite('agent', item.id)}
            onToggleFavorite={() => toggleFavorite('agent', item.id)}
            onDelete={() => void handleDelete(item)}
            depth={1}
          />
        );
      })}

      <li>
        <NavLink
          to={`/w/${workspaceSlug}/agents?tab=all`}
          className={navActionClass({ depth: 1 })}
        >
          <Plus className={navIconClass(1)} aria-hidden />
          <span className="flex-1 truncate">Add agent</span>
        </NavLink>
      </li>
    </Section>
  );
}

export function AppsSection({
  workspaceSlug,
  prompts,
}: {
  workspaceSlug: string;
  prompts?: PromptDialog;
}) {
  const location = useLocation();
  const { workspaceId } = useCurrentWorkspace();
  const integrations = useIntegrations(workspaceId);
  const mutations = useIntegrationMutations(workspaceId);
  const { isFavorite, toggleFavorite } = useSidebarFavorites(workspaceId);

  const items: ResourceItemData[] = (integrations.data ?? [])
    .filter((integration) => integration.status === 'CONNECTED')
    .map((integration) => ({
      id: integration.provider,
      name: titleCaseProvider(integration.provider),
      icon: PROVIDER_ICON[integration.provider] ?? 'Plug',
      detail: 'Connected',
    }));

  const handleDisconnect = async (app: ResourceItemData) => {
    if (prompts) {
      const confirmed = await prompts.confirmAction({
        title: `Disconnect ${app.name}?`,
        description:
          'This integration will be removed from your workspace and webhooks will be disabled.',
        confirmLabel: 'Disconnect',
        destructive: true,
      });
      if (!confirmed) return;
    }
    mutations.disconnect.mutate(app.id);
  };

  return (
    <Section
      title="Apps"
      count={items.length}
      emptyLabel={integrations.isLoading ? 'Loading apps…' : 'No apps connected yet.'}
      action={
        <Hint label="Add app">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="Add app"
            className="size-5 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <NavLink to={`/w/${workspaceSlug}/integrations`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {items.map((item) => {
        const isSelected =
          location.pathname.endsWith('/integrations') &&
          location.search.includes(`app=${item.id}`);

        return (
          <AppNavRow
            key={item.id}
            app={item}
            workspaceSlug={workspaceSlug}
            isSelected={isSelected}
            isFavorite={isFavorite('app', item.id)}
            onToggleFavorite={() => toggleFavorite('app', item.id)}
            onDisconnect={() => void handleDisconnect(item)}
            depth={1}
          />
        );
      })}

      <li>
        <NavLink
          to={`/w/${workspaceSlug}/integrations`}
          className={navActionClass({ depth: 1 })}
        >
          <Plus className={navIconClass(1)} aria-hidden />
          <span className="flex-1 truncate">Add app</span>
        </NavLink>
      </li>
    </Section>
  );
}

export function WorkflowsSection({
  workspaceSlug,
  prompts,
}: {
  workspaceSlug: string;
  prompts?: PromptDialog;
}) {
  const location = useLocation();
  const { workspaceId } = useCurrentWorkspace();
  const workflows = useWorkflows(workspaceId);
  const mutations = useWorkflowMutations(workspaceId);
  const { isFavorite, toggleFavorite } = useSidebarFavorites(workspaceId);

  const items: ResourceItemData[] = (workflows.data ?? []).map((workflow) => ({
    id: workflow.id,
    name: workflow.name,
    icon: TRIGGER_ICON[workflow.triggerType] ?? 'Zap',
    detail: workflow.triggerType,
  }));

  const handleDelete = async (workflow: ResourceItemData) => {
    if (prompts) {
      const confirmed = await prompts.confirmAction({
        title: `Delete “${workflow.name}”?`,
        description:
          'This workflow automation will be permanently deleted for all members.',
        confirmLabel: 'Delete workflow',
        destructive: true,
      });
      if (!confirmed) return;
    }
    mutations.remove.mutate(workflow.id);
  };

  return (
    <Section
      title="Automations"
      count={items.length}
      emptyLabel={workflows.isLoading ? 'Loading automations…' : 'No workflows yet.'}
      action={
        <Hint label="Add workflow">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="Add workflow"
            className="size-5 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            <NavLink to={`/w/${workspaceSlug}/automations?tab=all`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {items.map((item) => {
        const isSelected =
          location.pathname.endsWith('/automations') &&
          location.search.includes(`workflow=${item.id}`);

        return (
          <WorkflowNavRow
            key={item.id}
            workflow={item}
            workspaceSlug={workspaceSlug}
            isSelected={isSelected}
            isFavorite={isFavorite('workflow', item.id)}
            onToggleFavorite={() => toggleFavorite('workflow', item.id)}
            onDelete={() => void handleDelete(item)}
            depth={1}
          />
        );
      })}

      <li>
        <NavLink
          to={`/w/${workspaceSlug}/automations?tab=all`}
          className={navActionClass({ depth: 1 })}
        >
          <Plus className={navIconClass(1)} aria-hidden />
          <span className="flex-1 truncate">Add workflow</span>
        </NavLink>
      </li>
    </Section>
  );
}

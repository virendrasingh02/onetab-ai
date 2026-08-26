import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  Hint,
  IconRenderer,
  type PromptDialog,
} from '@org/ui';
import { cn } from '@org/utils';
import { useAgentMutations, useAgents } from '@org/web-agents';
import { useWorkflowMutations, useWorkflows } from '@org/web-automations';
import {
  useIntegrationMutations,
  useIntegrations,
} from '@org/web-integrations';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Bot,
  Check,
  ChevronRight,
  Copy,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Star,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FavoriteToggle,
  navActionClass,
  navIconClass,
  navRowClass,
  NavRowActions,
  NavRowMenuTrigger,
  Section,
  useCopyLink,
  type NavDepth,
} from './nav-primitives.js';
import { useSidebarFavorites } from './use-sidebar-favorites.js';

export interface ResourceItemData {
  id: string;
  name: string;
  icon?: string;
  detail?: string;
  /**
   * The record's real backend id, when it differs from `id`. Apps route on
   * the provider slug (`id`), but mutations need the actual `ExternalIntegration`
   * row id — without this they'd disconnect/sync a row that doesn't exist.
   */
  resourceId?: string;
  /** Workflows only: whether the automation is currently enabled server-side. */
  isActive?: boolean;
}

export const APP_LOGOS: Record<string, string> = {
  github: 'https://cdn.simpleicons.org/github',
  gitlab: 'https://cdn.simpleicons.org/gitlab',
  jira: 'https://cdn.simpleicons.org/jira',
  linear: 'https://cdn.simpleicons.org/linear',
  figma: 'https://cdn.simpleicons.org/figma',
  gdrive: 'https://cdn.simpleicons.org/googledrive',
  google_drive: 'https://cdn.simpleicons.org/googledrive',
  gcal: 'https://cdn.simpleicons.org/googlecalendar',
  google_calendar: 'https://cdn.simpleicons.org/googlecalendar',
  outlook: 'https://cdn.simpleicons.org/microsoftoutlook',
  microsoft_outlook: 'https://cdn.simpleicons.org/microsoftoutlook',
  zendesk: 'https://cdn.simpleicons.org/zendesk',
  intercom: 'https://cdn.simpleicons.org/intercom',
  mixpanel: 'https://cdn.simpleicons.org/mixpanel',
  datadog: 'https://cdn.simpleicons.org/datadog',
  stripe: 'https://cdn.simpleicons.org/stripe',
  quickbooks: 'https://cdn.simpleicons.org/quickbooks',
  bamboohr: 'https://cdn.simpleicons.org/bamboohr',
  hubspot: 'https://cdn.simpleicons.org/hubspot',
  discord: 'https://cdn.simpleicons.org/discord',
  slack: 'https://cdn.simpleicons.org/slack',
  notion: 'https://cdn.simpleicons.org/notion',
  webhooks: 'https://cdn.simpleicons.org/webhooks',
};

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

export function AppLogo({
  providerId,
  name,
  className,
  sizeClassName,
  fallbackIcon,
}: {
  providerId: string;
  name?: string;
  className?: string;
  sizeClassName?: string;
  fallbackIcon?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const normalizedKey = providerId.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const logoUrl =
    APP_LOGOS[normalizedKey] ?? APP_LOGOS[providerId.toLowerCase()];

  if (!logoUrl || hasError) {
    return (
      <IconRenderer
        icon={fallbackIcon ?? PROVIDER_ICON[providerId.toUpperCase()] ?? 'Plug'}
        fallbackEmoji="🧩"
        sizeClassName={sizeClassName}
      />
    );
  }

  return (
    <span
      className={cn(
        'p-0.5 relative flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-accent/40',
        sizeClassName,
        className,
      )}
    >
      <img
        src={logoUrl}
        alt={name ?? providerId}
        className="size-full object-contain dark:brightness-110"
        loading="lazy"
        onError={() => setHasError(true)}
      />
    </span>
  );
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
  const { copied, copy } = useCopyLink(
    `${window.location.origin}/w/${workspaceSlug}/agents/chat?id=${agent.id}`,
  );

  return (
    <li className="group/row relative">
      <NavLink
        to={`/w/${workspaceSlug}/agents/chat?id=${agent.id}`}
        className={({ isActive }) =>
          navRowClass(isSelected || isActive, {
            depth,
            extra: 'pr-14',
          })
        }
        title={agent.detail ? `${agent.name} — ${agent.detail}` : agent.name}
      >
        <span
          className={navIconClass(
            depth,
            'relative flex items-center justify-center',
          )}
        >
          <IconRenderer
            icon={agent.icon ?? 'Bot'}
            fallbackEmoji="🤖"
            sizeClassName="size-4 text-primary"
          />
          <span
            className={cn(
              '-right-0.5 -bottom-0.5 size-2 absolute rounded-full border-2 border-sidebar bg-success',
            )}
          >
            <span className="sr-only">Active</span>
          </span>
        </span>
        <span className="flex-1 truncate">{agent.name}</span>
      </NavLink>

      <NavRowActions isPinned={isFavorite}>
        <FavoriteToggle isFavorite={isFavorite} onToggle={onToggleFavorite} />

        <DropdownMenu modal={false}>
          <NavRowMenuTrigger label={`Options for ${agent.name}`} />
          <DropdownMenuContent align="end" side="bottom" className="w-64">
            <DropdownMenuItem
              onSelect={() =>
                navigate(`/w/${workspaceSlug}/agents/chat?id=${agent.id}`)
              }
              className="gap-2.5"
            >
              <Bot className="size-4" />
              <span>Chat with Agent</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={() =>
                navigate(
                  `/w/${workspaceSlug}/agents/builder?agentId=${agent.id}`,
                )
              }
              className="gap-2.5"
            >
              <Wrench className="size-4" />
              <span>Open in Builder</span>
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={copy} className="justify-between">
              <div className="gap-2.5 flex items-center">
                {copied ? (
                  <Check className="size-4 text-success-text" />
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
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-accent-amber',
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
              className="gap-2.5"
            >
              <Settings className="size-4" />
              <span>Agent settings & tools</span>
            </DropdownMenuItem>

            {onDelete ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={onDelete}
                  className="gap-2.5"
                >
                  <Trash2 className="size-4" />
                  <span>Delete agent</span>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </NavRowActions>
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
  onSync,
  depth = 1,
}: {
  app: ResourceItemData;
  workspaceSlug: string;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onDisconnect?: () => void;
  onSync?: () => Promise<unknown>;
  depth?: NavDepth;
}) {
  const navigate = useNavigate();
  const [synced, setSynced] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { copied, copy } = useCopyLink(
    `${window.location.origin}/w/${workspaceSlug}/integrations?app=${app.id}`,
  );

  useEffect(() => () => clearTimeout(syncTimer.current), []);

  const handleSync = useCallback(async () => {
    if (!onSync || syncing) return;
    setSyncing(true);
    try {
      await onSync();
      setSynced(true);
      clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => setSynced(false), 2000);
    } catch {
      // The mutation surfaces its own error toast.
    } finally {
      setSyncing(false);
    }
  }, [onSync, syncing]);

  return (
    <li className="group/row relative">
      <NavLink
        to={`/w/${workspaceSlug}/apps/chat?app=${app.id}`}
        className={navRowClass(isSelected, {
          depth,
          extra: 'pr-14',
        })}
        title={app.detail ? `${app.name} — ${app.detail}` : app.name}
      >
        <AppLogo
          providerId={app.id}
          name={app.name}
          sizeClassName={navIconClass(depth)}
          fallbackIcon={app.icon}
        />
        <span className="flex-1 truncate">{app.name}</span>
      </NavLink>

      <NavRowActions isPinned={isFavorite}>
        <FavoriteToggle isFavorite={isFavorite} onToggle={onToggleFavorite} />

        <DropdownMenu modal={false}>
          <NavRowMenuTrigger label={`Options for ${app.name}`} />
          <DropdownMenuContent align="end" side="bottom" className="w-64">
            <DropdownMenuItem
              onSelect={() =>
                navigate(`/w/${workspaceSlug}/integrations?app=${app.id}`)
              }
              className="gap-2.5"
            >
              <Settings className="size-4" />
              <span>Manage integration</span>
            </DropdownMenuItem>

            <DropdownMenuItem onSelect={copy} className="justify-between">
              <div className="gap-2.5 flex items-center">
                {copied ? (
                  <Check className="size-4 text-success-text" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span>{copied ? 'Link copied!' : 'Copy app link'}</span>
              </div>
              <DropdownMenuShortcut>C</DropdownMenuShortcut>
            </DropdownMenuItem>

            {onSync ? (
              <DropdownMenuItem
                onSelect={handleSync}
                disabled={syncing}
                className="gap-2.5"
              >
                {synced ? (
                  <Check className="size-4 text-success-text" />
                ) : (
                  <RefreshCw className={cn('size-4', syncing && 'animate-spin')} />
                )}
                <span>
                  {synced
                    ? 'Synced successfully!'
                    : syncing
                      ? 'Syncing…'
                      : 'Sync connection'}
                </span>
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={onToggleFavorite}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-accent-amber',
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
                  className="gap-2.5"
                >
                  <Trash2 className="size-4" />
                  <span>Disconnect app</span>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </NavRowActions>
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
  onRun,
  onToggleActive,
  depth = 1,
}: {
  workflow: ResourceItemData;
  workspaceSlug: string;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onDelete?: () => void;
  onRun?: () => Promise<unknown>;
  onToggleActive?: () => void;
  depth?: NavDepth;
}) {
  const navigate = useNavigate();
  const [triggered, setTriggered] = useState(false);
  const [running, setRunning] = useState(false);
  const runTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { copied, copy } = useCopyLink(
    `${window.location.origin}/w/${workspaceSlug}/automations?workflow=${workflow.id}`,
  );
  const isActive = workflow.isActive ?? true;

  useEffect(() => () => clearTimeout(runTimer.current), []);

  const handleRunWorkflow = useCallback(async () => {
    if (!onRun || running) return;
    setRunning(true);
    try {
      await onRun();
      setTriggered(true);
      clearTimeout(runTimer.current);
      runTimer.current = setTimeout(() => setTriggered(false), 2000);
    } catch {
      // The mutation surfaces its own error toast.
    } finally {
      setRunning(false);
    }
  }, [onRun, running]);

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

      <NavRowActions isPinned={isFavorite}>
        <FavoriteToggle isFavorite={isFavorite} onToggle={onToggleFavorite} />

        <DropdownMenu modal={false}>
          <NavRowMenuTrigger label={`Options for ${workflow.name}`} />
          <DropdownMenuContent align="end" side="bottom" className="w-64">
            <DropdownMenuItem
              onSelect={() =>
                navigate(
                  `/w/${workspaceSlug}/automations?workflow=${workflow.id}`,
                )
              }
              className="gap-2.5"
            >
              <Pencil className="size-4" />
              <span>Edit workflow</span>
            </DropdownMenuItem>

            {onRun ? (
              <DropdownMenuItem
                onSelect={handleRunWorkflow}
                disabled={running}
                className="gap-2.5"
              >
                {triggered ? (
                  <Check className="size-4 text-success-text" />
                ) : (
                  <Play className="size-4" />
                )}
                <span>
                  {triggered
                    ? 'Workflow triggered!'
                    : running
                      ? 'Triggering…'
                      : 'Run workflow now'}
                </span>
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuItem onSelect={copy} className="justify-between">
              <div className="gap-2.5 flex items-center">
                {copied ? (
                  <Check className="size-4 text-success-text" />
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
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-accent-amber',
                  )}
                />
                <span>{isFavorite ? 'Remove Favorite' : 'Favorite'}</span>
              </div>
              <ChevronRight className="size-4 text-muted-foreground/70" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {onToggleActive ? (
              <DropdownMenuItem onSelect={onToggleActive} className="gap-2.5">
                {isActive ? (
                  <Pause className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
                <span>{isActive ? 'Pause automation' : 'Resume automation'}</span>
              </DropdownMenuItem>
            ) : null}

            <DropdownMenuItem
              onSelect={() =>
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
                  className="gap-2.5"
                >
                  <Trash2 className="size-4" />
                  <span>Delete workflow</span>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </NavRowActions>
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

  const agentList = agents.data ?? [];

  const items: ResourceItemData[] = agentList.map((agent) => ({
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
      emptyLabel={
        agents.isLoading ? 'Loading agents…' : 'No agents deployed yet.'
      }
      action={
        <Hint label="Add agent">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="Add agent"
            className="size-5 p-0 opacity-0 transition-opacity duration-150 group-focus-within/section:opacity-100 group-hover/section:opacity-100 focus-visible:opacity-100"
          >
            <NavLink to={`/w/${workspaceSlug}/agents?tab=all`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {items.map((item, index) => {
        const isSelected =
          (location.pathname.includes('/agents/chat') &&
            (location.search.includes(`id=${item.id}`) ||
              (!location.search.includes('id=') && index === 0))) ||
          (location.pathname.endsWith('/agents') &&
            location.search.includes(`agent=${item.id}`));

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

  const integrationList = (integrations.data ?? []).filter(
    (i) => i.status === 'CONNECTED',
  );

  const items: ResourceItemData[] = integrationList.map((integration) => ({
    id: integration.provider,
    resourceId: integration.id,
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
    mutations.disconnect.mutate(app.resourceId ?? app.id);
  };

  return (
    <Section
      title="Apps"
      count={items.length}
      emptyLabel={
        integrations.isLoading ? 'Loading apps…' : 'No apps connected yet.'
      }
      action={
        <Hint label="Add app">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="Add app"
            className="size-5 p-0 opacity-0 transition-opacity duration-150 group-focus-within/section:opacity-100 group-hover/section:opacity-100 focus-visible:opacity-100"
          >
            <NavLink to={`/w/${workspaceSlug}/integrations`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {items.map((item, index) => {
        const isSelected =
          (location.pathname.includes('/apps/chat') &&
            (location.search.includes(`app=${item.id}`) ||
              (!location.search.includes('app=') && index === 0))) ||
          (location.pathname.endsWith('/apps') &&
            location.search.includes(`app=${item.id}`)) ||
          (location.pathname.endsWith('/integrations') &&
            location.search.includes(`app=${item.id}`));

        return (
          <AppNavRow
            key={item.id}
            app={item}
            workspaceSlug={workspaceSlug}
            isSelected={isSelected}
            isFavorite={isFavorite('app', item.id)}
            onToggleFavorite={() => toggleFavorite('app', item.id)}
            onDisconnect={() => void handleDisconnect(item)}
            onSync={() =>
              mutations.sync.mutateAsync(item.resourceId ?? item.id)
            }
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
    isActive: workflow.isActive,
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
      emptyLabel={
        workflows.isLoading ? 'Loading automations…' : 'No workflows yet.'
      }
      action={
        <Hint label="Add workflow">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="Add workflow"
            className="size-5 p-0 opacity-0 transition-opacity duration-150 group-focus-within/section:opacity-100 group-hover/section:opacity-100 focus-visible:opacity-100"
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
            onRun={() =>
              mutations.trigger.mutateAsync({ workflowId: item.id, payload: {} })
            }
            onToggleActive={() =>
              mutations.update.mutate({
                workflowId: item.id,
                input: { isActive: !(item.isActive ?? true) },
              })
            }
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

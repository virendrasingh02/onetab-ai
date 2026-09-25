import {
  ActionDropdownMenu,
  Button,
  copyToClipboard,
  EntityContextMenu,
  entityUrl,
  Hint,
  IconRenderer,
  ResourceNavSkeleton,
  type EntityAction,
  type PromptDialog,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCoworkerMutations, useCoworkers, CoworkerAvatar } from '@org/web-coworkers';
import { useAgentMutations, useAgents } from '@org/web-agents';
import { useWorkflowMutations, useWorkflows } from '@org/web-automations';
import {
  useIntegrationMutations,
  useIntegrations,
} from '@org/web-integrations';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Bot,
  Link2,
  MessageSquare,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Star,
  Trash2,
  UserCheck,
  Wrench,
} from 'lucide-react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useId,
  useMemo,
  useState,
} from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  FavoriteToggle,
  navActionClass,
  navIconClass,
  navRowClass,
  NavRowActions,
  NavRowMenuButton,
  Section,
  type NavDepth,
} from './nav-primitives.js';
import { useSidebarStore } from './navigation/sidebar-store.js';
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
  gmail: 'https://cdn.simpleicons.org/gmail',
  github: 'https://cdn.simpleicons.org/github',
  gitlab: 'https://cdn.simpleicons.org/gitlab',
  jira: 'https://cdn.simpleicons.org/jira',
  linear: 'https://cdn.simpleicons.org/linear',
  figma: 'https://cdn.simpleicons.org/figma',
  trello: 'https://cdn.simpleicons.org/trello',
  gdrive: 'https://cdn.simpleicons.org/googledrive',
  google_drive: 'https://cdn.simpleicons.org/googledrive',
  gcal: 'https://cdn.simpleicons.org/googlecalendar',
  google_calendar: 'https://cdn.simpleicons.org/googlecalendar',
  google_docs: 'https://cdn.simpleicons.org/googledocs',
  google_sheets: 'https://cdn.simpleicons.org/googlesheets',
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

/**
 * The frame every resource row shares: a nav link, the favourite star, the
 * "⋯" menu and a right-click / long-press menu — the last two built from the
 * same `actions`, so they can't drift apart.
 */
function ResourceRowShell({
  to,
  name,
  title,
  isSelected,
  isFavorite,
  onToggleFavorite,
  actions,
  scope,
  entityType,
  entity,
  depth,
  children,
}: {
  to: string;
  name: string;
  title?: string;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  actions: EntityAction[];
  scope: string;
  entityType: string;
  entity: unknown;
  depth: NavDepth;
  children: React.ReactNode;
}) {
  return (
    <EntityContextMenu
      actions={actions}
      scope={scope}
      entityType={entityType}
      entity={entity}
      label={name}
    >
      <li className="group/row relative">
        <NavLink
          to={to}
          className={({ isActive }) =>
            navRowClass(isSelected || isActive, { depth, extra: 'pr-14' })
          }
          title={title}
        >
          {children}
        </NavLink>

        <NavRowActions isPinned={isFavorite}>
          <FavoriteToggle isFavorite={isFavorite} onToggle={onToggleFavorite} />
          <ActionDropdownMenu
            modal={false}
            actions={actions}
            scope={scope}
            entityType={entityType}
            entity={entity}
            contentClassName="w-64"
            trigger={<NavRowMenuButton label={`Options for ${name}`} />}
          />
        </NavRowActions>
      </li>
    </EntityContextMenu>
  );
}

function favoriteAction(isFavorite: boolean, onToggle: () => void): EntityAction {
  return {
    id: 'favorite',
    group: 'organize',
    label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
    icon: Star,
    shortcut: 'F',
    run: onToggle,
  };
}

function copyLinkAction(path: string, label = 'Copy link'): EntityAction {
  return {
    id: 'copy-link',
    group: 'organize',
    label,
    icon: Link2,
    shortcut: 'C',
    run: () => copyToClipboard(entityUrl(path)),
  };
}

export function CoworkerNavRow({
  coworker,
  workspaceSlug,
  isSelected,
  isFavorite,
  onToggleFavorite,
  onDelete,
  depth = 1,
}: {
  coworker: ResourceItemData & { avatarUrl?: string | null; status?: any };
  workspaceSlug: string;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onDelete?: () => void;
  depth?: NavDepth;
}) {
  const navigate = useNavigate();
  const path = `/w/${workspaceSlug}/coworkers/${coworker.id}`;

  const actions: EntityAction[] = [
    {
      id: 'open',
      group: 'open',
      label: 'Chat with coworker',
      icon: UserCheck,
      run: () => navigate(path),
    },
    {
      id: 'profile',
      group: 'open',
      label: 'Profile & settings',
      icon: Settings,
      run: () => navigate(`${path}?tab=profile`),
    },
    favoriteAction(isFavorite, onToggleFavorite),
    copyLinkAction(path, 'Copy coworker link'),
    {
      id: 'delete',
      group: 'danger',
      label: 'Delete coworker…',
      icon: Trash2,
      destructive: true,
      hidden: !onDelete,
      run: onDelete,
    },
  ];

  return (
    <ResourceRowShell
      to={path}
      name={coworker.name}
      title={coworker.detail ? `${coworker.name} — ${coworker.detail}` : coworker.name}
      isSelected={isSelected}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      actions={actions}
      scope={`coworker:${coworker.id}`}
      entityType="coworker"
      entity={coworker}
      depth={depth}
    >
      <span
        className={navIconClass(
          depth,
          'relative flex items-center justify-center shrink-0',
        )}
      >
        <CoworkerAvatar
          name={coworker.name}
          avatarUrl={coworker.avatarUrl}
          status={coworker.status ?? 'AVAILABLE'}
          size="xs"
        />
      </span>
      <span className="flex-1 truncate font-medium">{coworker.name}</span>
    </ResourceRowShell>
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
  const chatPath = `/w/${workspaceSlug}/agents/${agent.id}/chat`;

  const actions: EntityAction[] = [
    {
      id: 'open',
      group: 'open',
      label: 'Chat with agent',
      icon: Bot,
      run: () => navigate(chatPath),
    },
    {
      id: 'edit',
      group: 'open',
      label: 'Edit in builder',
      icon: Wrench,
      shortcut: 'E',
      run: () => navigate(`/w/${workspaceSlug}/agents/builder?agentId=${agent.id}`),
    },
    favoriteAction(isFavorite, onToggleFavorite),
    copyLinkAction(chatPath, 'Copy agent link'),
    {
      id: 'delete',
      group: 'danger',
      label: 'Delete agent…',
      icon: Trash2,
      destructive: true,
      hidden: !onDelete,
      run: onDelete,
    },
  ];

  return (
    <ResourceRowShell
      to={chatPath}
      name={agent.name}
      title={agent.detail ? `${agent.name} — ${agent.detail}` : agent.name}
      isSelected={isSelected}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      actions={actions}
      scope={`agent:${agent.id}`}
      entityType="agent"
      entity={agent}
      depth={depth}
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
    </ResourceRowShell>
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
  const chatPath = `/w/${workspaceSlug}/apps/${app.id}/chat`;
  const managePath = `/w/${workspaceSlug}/integrations?app=${app.id}`;

  const actions: EntityAction[] = [
    {
      id: 'open',
      group: 'open',
      label: 'Open app',
      icon: MessageSquare,
      run: () => navigate(chatPath),
    },
    {
      id: 'manage',
      group: 'open',
      label: 'Manage integration & permissions',
      icon: Settings,
      run: () => navigate(managePath),
    },
    {
      id: 'sync',
      group: 'open',
      label: 'Sync connection',
      icon: RefreshCw,
      hidden: !onSync,
      successMessage: `${app.name} synced`,
      // The mutation toasts its own failure.
      errorMessage: false,
      run: onSync,
    },
    favoriteAction(isFavorite, onToggleFavorite),
    copyLinkAction(managePath, 'Copy app link'),
    {
      id: 'disconnect',
      group: 'danger',
      label: 'Disconnect app…',
      icon: Trash2,
      destructive: true,
      hidden: !onDisconnect,
      run: onDisconnect,
    },
  ];

  return (
    <ResourceRowShell
      to={chatPath}
      name={app.name}
      title={app.detail ? `${app.name} — ${app.detail}` : app.name}
      isSelected={isSelected}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      actions={actions}
      scope={`app:${app.id}`}
      entityType="app"
      entity={app}
      depth={depth}
    >
      <AppLogo
        providerId={app.id}
        name={app.name}
        sizeClassName={navIconClass(depth)}
        fallbackIcon={app.icon}
      />
      <span className="flex-1 truncate">{app.name}</span>
    </ResourceRowShell>
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
  const path = `/w/${workspaceSlug}/automations?workflow=${workflow.id}`;
  const isActive = workflow.isActive ?? true;

  const actions: EntityAction[] = [
    {
      id: 'open',
      group: 'open',
      label: 'Open workflow',
      icon: Pencil,
      shortcut: 'E',
      run: () => navigate(path),
    },
    {
      id: 'run',
      group: 'run',
      label: 'Run now',
      icon: Play,
      hidden: !onRun,
      disabled: !isActive,
      disabledReason: 'Resume the automation to run it',
      successMessage: `“${workflow.name}” triggered`,
      errorMessage: false,
      run: onRun,
    },
    {
      id: 'toggle-active',
      group: 'run',
      label: isActive ? 'Disable automation' : 'Enable automation',
      icon: isActive ? Pause : Play,
      hidden: !onToggleActive,
      run: onToggleActive,
    },
    favoriteAction(isFavorite, onToggleFavorite),
    copyLinkAction(path),
    {
      id: 'delete',
      group: 'danger',
      label: 'Delete workflow…',
      icon: Trash2,
      destructive: true,
      hidden: !onDelete,
      run: onDelete,
    },
  ];

  return (
    <ResourceRowShell
      to={path}
      name={workflow.name}
      title={workflow.detail ? `${workflow.name} — ${workflow.detail}` : workflow.name}
      isSelected={isSelected}
      isFavorite={isFavorite}
      onToggleFavorite={onToggleFavorite}
      actions={actions}
      scope={`workflow:${workflow.id}`}
      entityType="workflow"
      entity={workflow}
      depth={depth}
    >
      <IconRenderer
        icon={workflow.icon ?? 'Zap'}
        fallbackEmoji="⚡"
        sizeClassName={cn(navIconClass(depth), !isActive && 'opacity-50')}
      />
      <span className="flex-1 truncate">{workflow.name}</span>
    </ResourceRowShell>
  );
}

export function SortableCoworkerNavRow(props: {
  coworker: ResourceItemData & { avatarUrl?: string | null; status?: any };
  workspaceSlug: string;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onDelete: () => void;
  depth?: NavDepth;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.coworker.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        isDragging &&
          'z-50 rounded-lg bg-surface-raised opacity-80 shadow-sm ring-1 ring-primary/40',
      )}
      {...attributes}
      {...listeners}
    >
      <CoworkerNavRow {...props} />
    </div>
  );
}

function SortableAgentNavRow(props: {
  agent: ResourceItemData;
  workspaceSlug: string;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onDelete: () => void;
  depth?: NavDepth;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.agent.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        isDragging &&
          'z-50 rounded-lg bg-surface-raised opacity-80 shadow-sm ring-1 ring-primary/40',
      )}
      {...attributes}
      {...listeners}
    >
      <AgentNavRow {...props} />
    </div>
  );
}

function SortableAppNavRow(props: {
  app: ResourceItemData;
  workspaceSlug: string;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onDisconnect: () => void;
  onSync: () => Promise<unknown>;
  depth?: NavDepth;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.app.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        isDragging &&
          'z-50 rounded-lg bg-surface-raised opacity-80 shadow-sm ring-1 ring-primary/40',
      )}
      {...attributes}
      {...listeners}
    >
      <AppNavRow {...props} />
    </div>
  );
}

function SortableWorkflowNavRow(props: {
  workflow: ResourceItemData;
  workspaceSlug: string;
  isSelected: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onRun: () => Promise<unknown>;
  onToggleActive: () => void;
  depth?: NavDepth;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.workflow.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        isDragging &&
          'z-50 rounded-lg bg-surface-raised opacity-80 shadow-sm ring-1 ring-primary/40',
      )}
      {...attributes}
      {...listeners}
    >
      <WorkflowNavRow {...props} />
    </div>
  );
}

export function CoworkersSection({
  workspaceSlug,
  prompts,
}: {
  workspaceSlug: string;
  prompts?: PromptDialog;
}) {
  const location = useLocation();
  const { workspaceId } = useCurrentWorkspace();
  const coworkers = useCoworkers(workspaceId);
  const mutations = useCoworkerMutations(workspaceId);
  const { isFavorite, toggleFavorite } = useSidebarFavorites(workspaceId);
  const dndId = useId();

  const resourceOrders = useSidebarStore((s) => s.resourceOrders);
  const moveResourceItem = useSidebarStore((s) => s.moveResourceItem);

  const coworkerList = coworkers.data ?? [];

  const rawItems = coworkerList.map((cw) => ({
    id: cw.id,
    name: cw.name,
    icon: 'UserCheck',
    detail: cw.role,
    avatarUrl: cw.avatarUrl,
    status: cw.status,
  }));

  const customOrder = workspaceId
    ? resourceOrders[workspaceId]?.coworkers
    : undefined;

  const items = useMemo(() => {
    if (!customOrder || customOrder.length === 0) {
      return rawItems;
    }
    const map = new Map(rawItems.map((c) => [c.id, c]));
    const result: typeof rawItems = [];

    for (const id of customOrder) {
      const c = map.get(id);
      if (c) {
        result.push(c);
        map.delete(id);
      }
    }

    for (const c of map.values()) {
      result.push(c);
    }

    return result;
  }, [rawItems, customOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !workspaceId) return;

    moveResourceItem(
      workspaceId,
      'coworkers',
      active.id as string,
      over.id as string,
      items.map((i) => i.id),
    );
  };

  const handleDelete = async (coworker: (typeof rawItems)[0]) => {
    if (prompts) {
      const confirmed = await prompts.confirmAction({
        title: `Delete “${coworker.name}”?`,
        description:
          'The AI coworker will be removed from this workspace. This action cannot be undone.',
        confirmLabel: 'Delete coworker',
        destructive: true,
      });
      if (!confirmed) return;
    }
    mutations.remove.mutate(coworker.id);
  };

  const showCoworkersSkeleton =
    (!coworkers.data || coworkers.data.length === 0) && coworkers.isLoading;

  return (
    <Section
      title="AI Coworkers"
      count={items.length}
      emptyLabel="No coworkers active yet."
      action={
        <Hint label="Add coworker">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="Add coworker"
            className="size-5 p-0 opacity-0 transition-opacity duration-150 group-focus-within/section:opacity-100 group-hover/section:opacity-100 focus-visible:opacity-100"
          >
            <NavLink to={`/w/${workspaceSlug}/coworkers`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {showCoworkersSkeleton ? (
        <ResourceNavSkeleton rows={3} shape="circle" />
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item) => {
              const isSelected =
                location.pathname.includes(`/coworkers/${item.id}`) ||
                (location.pathname.endsWith('/coworkers') &&
                  location.search.includes(`id=${item.id}`));

              return (
                <SortableCoworkerNavRow
                  key={item.id}
                  coworker={item}
                  workspaceSlug={workspaceSlug}
                  isSelected={isSelected}
                  isFavorite={isFavorite('coworker', item.id)}
                  onToggleFavorite={() => toggleFavorite('coworker', item.id)}
                  onDelete={() => void handleDelete(item)}
                  depth={1}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      )}

      <li>
        <NavLink
          to={`/w/${workspaceSlug}/coworkers`}
          className={navActionClass({ depth: 1 })}
        >
          <Plus className={navIconClass(1)} aria-hidden />
          <span className="flex-1 truncate">Add coworker</span>
        </NavLink>
      </li>
    </Section>
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
  const dndId = useId();

  const resourceOrders = useSidebarStore((s) => s.resourceOrders);
  const moveResourceItem = useSidebarStore((s) => s.moveResourceItem);

  const agentList = agents.data ?? [];

  const rawItems: ResourceItemData[] = agentList.map((agent) => ({
    id: agent.id,
    name: agent.name,
    icon: 'Bot',
    detail: agent.role,
  }));

  const customOrder = workspaceId
    ? resourceOrders[workspaceId]?.agents
    : undefined;

  const items = useMemo(() => {
    if (!customOrder || customOrder.length === 0) {
      return rawItems;
    }
    const map = new Map(rawItems.map((a) => [a.id, a]));
    const result: ResourceItemData[] = [];

    for (const id of customOrder) {
      const a = map.get(id);
      if (a) {
        result.push(a);
        map.delete(id);
      }
    }

    for (const a of map.values()) {
      result.push(a);
    }

    return result;
  }, [rawItems, customOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !workspaceId) return;

    moveResourceItem(
      workspaceId,
      'agents',
      active.id as string,
      over.id as string,
      items.map((i) => i.id),
    );
  };

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

  const showAgentsSkeleton =
    (!agents.data || agents.data.length === 0) && agents.isLoading;

  return (
    <Section
      title="AI Agents"
      count={items.length}
      emptyLabel="No agents deployed yet."
      action={
        <Hint label="Add agent">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="Add agent"
            className="size-5 p-0 opacity-0 transition-opacity duration-150 group-focus-within/section:opacity-100 group-hover/section:opacity-100 focus-visible:opacity-100"
          >
            <NavLink to={`/w/${workspaceSlug}/agents`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {showAgentsSkeleton ? (
        <ResourceNavSkeleton rows={3} shape="rounded" />
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map((item, index) => {
              const isSelected =
                (location.pathname.includes('/agents/chat') &&
                  (location.search.includes(`id=${item.id}`) ||
                    (!location.search.includes('id=') && index === 0))) ||
                (location.pathname.endsWith('/agents') &&
                  location.search.includes(`agent=${item.id}`));

              return (
                <SortableAgentNavRow
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
          </SortableContext>
        </DndContext>
      )}

      <li>
        <NavLink
          to={`/w/${workspaceSlug}/agents`}
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
  const dndId = useId();

  const resourceOrders = useSidebarStore((s) => s.resourceOrders);
  const moveResourceItem = useSidebarStore((s) => s.moveResourceItem);

  const integrationList = (integrations.data ?? []).filter(
    (i) => i.status === 'CONNECTED',
  );

  const rawItems: ResourceItemData[] = integrationList.map((integration) => ({
    id: integration.provider,
    resourceId: integration.id,
    name: titleCaseProvider(integration.provider),
    icon: PROVIDER_ICON[integration.provider] ?? 'Plug',
    detail: 'Connected',
  }));

  const customOrder = workspaceId
    ? resourceOrders[workspaceId]?.apps
    : undefined;

  const items = useMemo(() => {
    if (!customOrder || customOrder.length === 0) {
      return rawItems;
    }
    const map = new Map(rawItems.map((a) => [a.id, a]));
    const result: ResourceItemData[] = [];

    for (const id of customOrder) {
      const a = map.get(id);
      if (a) {
        result.push(a);
        map.delete(id);
      }
    }

    for (const a of map.values()) {
      result.push(a);
    }

    return result;
  }, [rawItems, customOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !workspaceId) return;

    moveResourceItem(
      workspaceId,
      'apps',
      active.id as string,
      over.id as string,
      items.map((i) => i.id),
    );
  };

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

  const showAppsSkeleton =
    (!integrations.data || integrations.data.length === 0) &&
    integrations.isLoading;

  return (
    <Section
      title="Apps"
      count={items.length}
      emptyLabel="No apps connected yet."
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
      {showAppsSkeleton ? (
        <ResourceNavSkeleton rows={3} shape="rounded" />
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((i) => i.id)}
            strategy={verticalListSortingStrategy}
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
                <SortableAppNavRow
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
          </SortableContext>
        </DndContext>
      )}

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
  const dndId = useId();

  const resourceOrders = useSidebarStore((s) => s.resourceOrders);
  const moveResourceItem = useSidebarStore((s) => s.moveResourceItem);

  const rawItems: ResourceItemData[] = (workflows.data ?? []).map(
    (workflow) => ({
      id: workflow.id,
      name: workflow.name,
      icon: TRIGGER_ICON[workflow.triggerType] ?? 'Zap',
      detail: workflow.triggerType,
      isActive: workflow.isActive,
    }),
  );

  const customOrder = workspaceId
    ? resourceOrders[workspaceId]?.workflows
    : undefined;

  const items = useMemo(() => {
    if (!customOrder || customOrder.length === 0) {
      return rawItems;
    }
    const map = new Map(rawItems.map((w) => [w.id, w]));
    const result: ResourceItemData[] = [];

    for (const id of customOrder) {
      const w = map.get(id);
      if (w) {
        result.push(w);
        map.delete(id);
      }
    }

    for (const w of map.values()) {
      result.push(w);
    }

    return result;
  }, [rawItems, customOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !workspaceId) return;

    moveResourceItem(
      workspaceId,
      'workflows',
      active.id as string,
      over.id as string,
      items.map((i) => i.id),
    );
  };

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
            <NavLink to={`/w/${workspaceSlug}/automations`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => {
            const isSelected =
              location.pathname.endsWith('/automations') &&
              location.search.includes(`workflow=${item.id}`);

            return (
              <SortableWorkflowNavRow
                key={item.id}
                workflow={item}
                workspaceSlug={workspaceSlug}
                isSelected={isSelected}
                isFavorite={isFavorite('workflow', item.id)}
                onToggleFavorite={() => toggleFavorite('workflow', item.id)}
                onDelete={() => void handleDelete(item)}
                onRun={() =>
                  mutations.trigger.mutateAsync({
                    workflowId: item.id,
                    payload: {},
                  })
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
        </SortableContext>
      </DndContext>

      <li>
        <NavLink
          to={`/w/${workspaceSlug}/automations`}
          className={navActionClass({ depth: 1 })}
        >
          <Plus className={navIconClass(1)} aria-hidden />
          <span className="flex-1 truncate">Add workflow</span>
        </NavLink>
      </li>
    </Section>
  );
}

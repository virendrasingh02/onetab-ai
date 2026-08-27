import {
  ActivityDot,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Hint,
  IconRenderer,
  ScrollArea,
  SkeletonList,
  usePromptDialog,
  type PromptDialog,
} from '@org/ui';
import type { ActivityIndicator } from '@org/notifications';
import { useMarkChannelUnread } from '@org/notifications';
import type { ChannelSummary } from '@org/types';
import { cn } from '@org/utils';
import { useAgents, useAgentMutations } from '@org/web-agents';
import { useWorkflows, useWorkflowMutations } from '@org/web-automations';
import {
  useArchiveChannel,
  useChannelPreferences,
  useGroupedChannels,
  useUpdateChannel,
} from '@org/web-channels';
import {
  useIntegrations,
  useIntegrationMutations,
} from '@org/web-integrations';
import {
  useDocsWorkspace,
  useProjectMutations,
  useProjects,
} from '@org/web-work-tools';
import { persistLastChannel } from '@org/web-workspace';
import {
  Activity,
  Archive,
  BellOff,
  Bookmark,
  Check,
  ChevronRight,
  Clock,
  Copy,
  HardDrive,
  Hash,
  Lock,
  Mail,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Share2,
  SlidersHorizontal,
  Star,
  Users,
  Video,
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
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { SidebarFooterActions } from './create-menu.js';
import { DirectMessagesSection } from './direct-messages-section.js';
import { DocNavRow, DocsTreeSection } from './docs-section.js';
import {
  FavoriteToggle,
  IconOnlyNavRow,
  navActionClass,
  navIconClass,
  navRowClass,
  NavRow,
  NavRowActions,
  NavRowMenuTrigger,
  Section,
  useCopyLink,
  type NavEntry,
} from './nav-primitives.js';
import { resolveNavigation } from './navigation/navigation-resolver.js';
import { SidebarCustomizerDialog } from './navigation/sidebar-customizer-dialog.js';
import {
  DEFAULT_SIDEBAR_SECTIONS,
  useSidebarStore,
} from './navigation/sidebar-store.js';
import { ProjectNavRow, ProjectsTreeSection } from './projects-section.js';
import {
  AgentNavRow,
  AgentsSection,
  AppNavRow,
  AppsSection,
  WorkflowNavRow,
  WorkflowsSection,
} from './resource-sections.js';
import { useSidebarFavorites } from './use-sidebar-favorites.js';

/** Secondary destinations that can be pinned to the primary sidebar or accessed via More. */
const MORE_DESTINATIONS: readonly NavEntry[] = [
  /* Saved was an icon in the channel header, so the list only existed while you
     stood in the channel it belonged to. It is a destination now. */
  { path: 'saved', label: 'Saved', icon: Bookmark },
  { path: 'meetings', label: 'Meetings', icon: Video },
  { path: 'pulse', label: 'Pulse', icon: Activity },
  { path: 'schedule', label: 'Schedule', icon: Clock },
  { path: 'directory', label: 'Team Directory', icon: Users },
  { path: 'files', label: 'Files', icon: HardDrive },
];

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

function ChannelRow({
  channel,
  workspaceId,
  workspaceSlug,
  activity,
  onToggleFavorite,
  onToggleMute,
  prompts,
}: {
  channel: ChannelSummary;
  workspaceId: string;
  workspaceSlug: string;
  activity?: ActivityIndicator;
  onToggleFavorite: (channel: ChannelSummary) => void;
  onToggleMute: (channel: ChannelSummary) => void;
  prompts: PromptDialog;
}) {
  const [unreadState, setUnreadState] = useState(false);
  const unreadTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const updateChannel = useUpdateChannel(workspaceId);
  const archiveChannel = useArchiveChannel(workspaceId);
  const markChannelUnread = useMarkChannelUnread(workspaceId);

  const isFavorite = channel.membership?.isFavorite ?? false;
  const isMuted = channel.membership?.isMuted ?? false;
  const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;

  /*
   * A muted channel keeps its mention dot but loses its ambient one. Muting
   * says "stop telling me about the chatter here", not "hide it when someone
   * asks for me by name" — Slack draws the same distinction, and the second
   * reading loses messages people are waiting on.
   */
  const level = isMuted
    ? activity?.level === 'mention'
      ? 'mention'
      : 'none'
    : (activity?.level ?? 'none');
  const hasUnread = level !== 'none';

  const channelUrl = `${window.location.origin}/w/${workspaceSlug}/c/${channel.slug}`;
  const { copied, copy: handleCopyLink } = useCopyLink(channelUrl);
  /* "Share" copies the same link; it only differs in the confirmation it shows. */
  const { copied: shared, copy: handleShare } = useCopyLink(channelUrl);

  useEffect(() => () => clearTimeout(unreadTimer.current), []);

  const handleMarkUnread = useCallback(() => {
    markChannelUnread(channel.id);
    setUnreadState(true);
    clearTimeout(unreadTimer.current);
    unreadTimer.current = setTimeout(() => setUnreadState(false), 2000);
  }, [channel.id, markChannelUnread]);

  const handleRename = useCallback(async () => {
    const name = await prompts.promptText({
      title: `Rename #${channel.name}`,
      label: 'Channel name',
      defaultValue: channel.name,
      confirmLabel: 'Rename',
    });
    if (!name || name === channel.name) return;
    updateChannel.mutate({ channelId: channel.id, input: { name } });
  }, [channel.id, channel.name, prompts, updateChannel]);

  const handleArchiveChannel = useCallback(async () => {
    const confirmed = await prompts.confirmAction({
      title: `Archive #${channel.name}?`,
      description:
        'The channel will be hidden from the sidebar and marked read-only. Its history is kept, and a workspace admin can unarchive it later.',
      confirmLabel: 'Archive Channel',
      destructive: true,
    });
    if (!confirmed) return;
    archiveChannel.mutate({ channelId: channel.id, archived: true });
  }, [archiveChannel, channel.id, channel.name, prompts]);

  return (
    <li className="group/row relative">
      <NavLink
        to={`/w/${workspaceSlug}/c/${channel.slug}`}
        className={({ isActive }) =>
          navRowClass(isActive, {
            depth: 1,
            extra: cn(
              channel.membership ? 'pr-14' : 'pr-8',
              channel.isArchived && 'opacity-65',
              isMuted && 'text-muted-foreground',
              // Unread rows read as bold in every chat client; without it the
              // dot is the only cue and it is four pixels wide.
              hasUnread && 'font-semibold text-foreground',
            ),
          })
        }
      >
        <Icon className={navIconClass(1)} aria-hidden />
        <span className="flex-1 truncate">{channel.name}</span>
        <ActivityDot
          level={level}
          count={activity?.mentionCount}
          label={
            level === 'mention'
              ? `You were mentioned in #${channel.name}`
              : `Unread activity in #${channel.name}`
          }
          className="mr-1"
        />
        {isMuted && (
          <Hint label="Notifications muted">
            <BellOff className="mr-1 size-3 shrink-0 text-muted-foreground/70" />
          </Hint>
        )}
      </NavLink>

      {channel.membership ? (
        <NavRowActions isPinned={isFavorite}>
          <FavoriteToggle
            isFavorite={isFavorite}
            onToggle={() => onToggleFavorite(channel)}
          />

          <DropdownMenu modal={false}>
            <NavRowMenuTrigger label={`Options for ${channel.name}`} />
            <DropdownMenuContent align="end" side="bottom" className="w-64">
              <DropdownMenuItem
                onSelect={handleMarkUnread}
                className="justify-between"
              >
                <div className="gap-2.5 flex items-center">
                  {unreadState ? (
                    <Check className="size-4 text-success-text" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                  <span>
                    {unreadState ? 'Marked as unread!' : 'Mark as unread'}
                  </span>
                </div>
                <DropdownMenuShortcut>U</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuItem onSelect={handleRename} className="gap-2.5">
                <Pencil className="size-4" />
                <span>Rename</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={handleCopyLink}
                className="justify-between"
              >
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
                onSelect={() => onToggleFavorite(channel)}
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
                onSelect={() => onToggleMute(channel)}
                description="Follow this Channel in the future to show it in your sidebar again."
              >
                <BellOff className="size-4" />
                <span>{isMuted ? 'Follow Channel' : 'Unfollow'}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem onSelect={handleShare} className="gap-2.5">
                {shared ? (
                  <Check className="size-4 text-success-text" />
                ) : (
                  <Share2 className="size-4" />
                )}
                <span>{shared ? 'Link copied!' : 'Sharing & Permissions'}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onSelect={handleArchiveChannel}
                variant="destructive"
                className="gap-2.5"
              >
                <Archive className="size-4" />
                <span>Archive Channel</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </NavRowActions>
      ) : null}
    </li>
  );
}

interface SortableChannelRowProps {
  channel: ChannelSummary;
  workspaceId: string;
  workspaceSlug: string;
  activity?: ActivityIndicator;
  onToggleFavorite: (channel: ChannelSummary) => void;
  onToggleMute: (channel: ChannelSummary) => void;
  prompts: PromptDialog;
}

function SortableChannelRow(props: SortableChannelRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.channel.id });

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
      <ChannelRow {...props} />
    </div>
  );
}

function SortableStarredItem({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

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
      {children}
    </div>
  );
}

export interface ChannelNavProps {
  workspaceId: string;
  workspaceSlug: string;
  channels: ChannelSummary[] | undefined;
  isLoading: boolean;
  /** Unread activity, shown on the Inbox row — the feed's only destination. */
  inboxUnread?: number;
  /** Unread state per channel id, for the rows' dots. */
  channelActivity?: Record<string, ActivityIndicator>;
  onCreateChannel: () => void;
  onBrowseChannels: () => void;
  /** Whether sidebar is in collapsed icon rail mode */
  isCollapsed?: boolean;
}

export function ChannelNav({
  workspaceId,
  workspaceSlug,
  channels,
  isLoading,
  inboxUnread = 0,
  channelActivity,
  onCreateChannel,
  onBrowseChannels,
  isCollapsed = false,
}: ChannelNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const groups = useGroupedChannels(channels);
  const preferences = useChannelPreferences(workspaceId);
  const prompts = usePromptDialog();

  // Queries and mutations for all sections
  const projectsQuery = useProjects(workspaceId);
  const projectMutations = useProjectMutations(workspaceId);
  const docsWorkspace = useDocsWorkspace(workspaceId);
  const agentsQuery = useAgents(workspaceId);
  const agentMutations = useAgentMutations(workspaceId);
  const integrationsQuery = useIntegrations(workspaceId);
  const integrationMutations = useIntegrationMutations(workspaceId);
  const workflowsQuery = useWorkflows(workspaceId);
  const workflowMutations = useWorkflowMutations(workspaceId);

  const {
    toggleFavorite: toggleResourceFavorite,
    favoriteProjectIds,
    favoriteDocIds,
    favoriteAgentIds,
    favoriteAppIds,
    favoriteWorkflowIds,
    toggleNavPinned,
    pinnedNavPaths,
  } = useSidebarFavorites(workspaceId);

  const toggleFavorite = useCallback(
    (channel: ChannelSummary) =>
      preferences.mutate({
        channelId: channel.id,
        input: { isFavorite: !channel.membership?.isFavorite },
      }),
    [preferences],
  );

  const toggleMute = useCallback(
    (channel: ChannelSummary) =>
      preferences.mutate({
        channelId: channel.id,
        input: { isMuted: !channel.membership?.isMuted },
      }),
    [preferences],
  );

  const startNewChat = useCallback(
    () => navigate(`/w/${workspaceSlug}/home`),
    [navigate, workspaceSlug],
  );

  const itemsPrefs = useSidebarStore((s) => s.items);
  const sectionsPrefs = useSidebarStore((s) => s.sections);
  const customizerOpen = useSidebarStore((s) => s.customizerOpen);
  const setCustomizerOpen = useSidebarStore((s) => s.setCustomizerOpen);

  const resolvedNav = useMemo(
    () =>
      resolveNavigation(itemsPrefs, {
        workspaceSlug,
        inboxUnread,
      }),
    [itemsPrefs, workspaceSlug, inboxUnread],
  );

  const activeSections = useMemo(() => {
    return [...DEFAULT_SIDEBAR_SECTIONS]
      .sort((a, b) => {
        const orderA = sectionsPrefs[a.id]?.order ?? a.order;
        const orderB = sectionsPrefs[b.id]?.order ?? b.order;
        return orderA - orderB;
      })
      .filter((sec) => sectionsPrefs[sec.id]?.visible ?? true);
  }, [sectionsPrefs]);

  const channelOrders = useSidebarStore((s) => s.channelOrders);
  const moveChannel = useSidebarStore((s) => s.moveChannel);
  const resourceOrders = useSidebarStore((s) => s.resourceOrders);
  const moveResourceItem = useSidebarStore((s) => s.moveResourceItem);
  const channelDndId = useId();
  const starredDndId = useId();

  const customChannelOrder = channelOrders[workspaceId];

  const orderedJoinedChannels = useMemo(() => {
    if (!customChannelOrder || customChannelOrder.length === 0) {
      return groups.joined;
    }
    const map = new Map(groups.joined.map((c) => [c.id, c]));
    const result: ChannelSummary[] = [];

    // First add channels in custom order if they are currently in joined
    for (const id of customChannelOrder) {
      const channel = map.get(id);
      if (channel) {
        result.push(channel);
        map.delete(id);
      }
    }

    // Then append any newly joined channels that weren't in the saved order
    for (const channel of map.values()) {
      result.push(channel);
    }

    return result;
  }, [groups.joined, customChannelOrder]);

  const channelSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const starredSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleChannelDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    moveChannel(
      workspaceId,
      active.id as string,
      over.id as string,
      orderedJoinedChannels.map((c) => c.id),
    );
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'o')
        return;

      const target = event.target as HTMLElement | null;
      if (
        target?.isContentEditable ||
        /^(input|textarea|select)$/i.test(target?.tagName ?? '')
      ) {
        return;
      }

      event.preventDefault();
      startNewChat();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [startNewChat]);

  useEffect(() => {
    const match = location.pathname.match(/\/w\/[^/]+\/c\/([^/]+)/);
    if (match && match[1] && workspaceId) {
      persistLastChannel(workspaceId, match[1]);
    }
  }, [location.pathname, workspaceId]);

  // Starred items across all sections
  const starredProjects = useMemo(
    () =>
      (projectsQuery.data ?? []).filter((p) =>
        favoriteProjectIds.includes(p.id),
      ),
    [projectsQuery.data, favoriteProjectIds],
  );

  const starredDocs = useMemo(
    () =>
      (docsWorkspace.docs ?? []).filter((d) => favoriteDocIds.includes(d.id)),
    [docsWorkspace.docs, favoriteDocIds],
  );

  const starredAgents = useMemo(
    () =>
      (agentsQuery.data ?? []).filter((a) => favoriteAgentIds.includes(a.id)),
    [agentsQuery.data, favoriteAgentIds],
  );

  const starredApps = useMemo(
    () =>
      (integrationsQuery.data ?? []).filter(
        (i) => i.status === 'CONNECTED' && favoriteAppIds.includes(i.provider),
      ),
    [integrationsQuery.data, favoriteAppIds],
  );

  const starredWorkflows = useMemo(
    () =>
      (workflowsQuery.data ?? []).filter((w) =>
        favoriteWorkflowIds.includes(w.id),
      ),
    [workflowsQuery.data, favoriteWorkflowIds],
  );

  const rowProps = useMemo(
    () => ({
      workspaceId,
      workspaceSlug,
      onToggleFavorite: toggleFavorite,
      onToggleMute: toggleMute,
      prompts,
    }),
    [workspaceId, workspaceSlug, toggleFavorite, toggleMute, prompts],
  );

  const rawStarredItems = useMemo(() => {
    const list: Array<{ id: string; render: () => React.ReactNode }> = [];

    groups.favorites.forEach((channel) => {
      list.push({
        id: `channel-${channel.id}`,
        render: () => (
          <ChannelRow
            key={channel.id}
            channel={channel}
            activity={channelActivity?.[channel.id]}
            {...rowProps}
          />
        ),
      });
    });

    starredProjects.forEach((project) => {
      const isSelected =
        location.pathname.includes('/tasks') &&
        location.search.includes(`project=${project.id}`);
      list.push({
        id: `project-${project.id}`,
        render: () => (
          <ProjectNavRow
            key={`starred-proj-${project.id}`}
            project={project}
            workspaceSlug={workspaceSlug}
            isSelected={isSelected}
            isFavorite={true}
            onToggleFavorite={() =>
              toggleResourceFavorite('project', project.id)
            }
            prompts={prompts}
            mutations={projectMutations}
            depth={1}
          />
        ),
      });
    });

    starredDocs.forEach((doc) => {
      const isSelected =
        location.pathname.includes('/docs') &&
        location.search.includes(`doc=${doc.id}`);
      list.push({
        id: `doc-${doc.id}`,
        render: () => (
          <DocNavRow
            key={`starred-doc-${doc.id}`}
            doc={doc}
            workspaceSlug={workspaceSlug}
            isSelected={isSelected}
            isFavorite={true}
            onToggleFavorite={() => toggleResourceFavorite('doc', doc.id)}
            onRename={async () => {
              const title = await prompts.promptText({
                title: 'Rename document',
                label: 'Document title',
                defaultValue: doc.title,
                confirmLabel: 'Rename',
              });
              if (!title) return;
              docsWorkspace.updateDocTitle(doc.id, title);
            }}
            onDuplicate={async () => {
              const docId = await docsWorkspace.duplicateDoc(doc.id);
              if (docId) navigate(`/w/${workspaceSlug}/docs?doc=${docId}`);
            }}
            onMoveToCompany={(targetCompanyId) =>
              docsWorkspace.moveDocToCompany(doc.id, targetCompanyId)
            }
            onDelete={async () => {
              const confirmed = await prompts.confirmAction({
                title: `Delete “${doc.title}”?`,
                description: 'This cannot be undone.',
                confirmLabel: 'Delete document',
                destructive: true,
              });
              if (!confirmed) return;
              docsWorkspace.deleteDoc(doc.id);
            }}
            companies={docsWorkspace.companies}
            depth={1}
          />
        ),
      });
    });

    starredAgents.forEach((agent) => {
      const isSelected =
        location.pathname.endsWith('/agents') &&
        location.search.includes(`agent=${agent.id}`);
      list.push({
        id: `agent-${agent.id}`,
        render: () => (
          <AgentNavRow
            key={`starred-agent-${agent.id}`}
            agent={{
              id: agent.id,
              name: agent.name,
              icon: 'Bot',
              detail: agent.role,
            }}
            workspaceSlug={workspaceSlug}
            isSelected={isSelected}
            isFavorite={true}
            onToggleFavorite={() => toggleResourceFavorite('agent', agent.id)}
            onDelete={async () => {
              const confirmed = await prompts.confirmAction({
                title: `Delete “${agent.name}”?`,
                description:
                  'The AI agent will be removed from this workspace. This action cannot be undone.',
                confirmLabel: 'Delete agent',
                destructive: true,
              });
              if (!confirmed) return;
              agentMutations.remove.mutate(agent.id);
            }}
            depth={1}
          />
        ),
      });
    });

    starredApps.forEach((app) => {
      const isSelected =
        location.pathname.endsWith('/integrations') &&
        location.search.includes(`app=${app.provider}`);
      list.push({
        id: `app-${app.provider}`,
        render: () => (
          <AppNavRow
            key={`starred-app-${app.provider}`}
            app={{
              id: app.provider,
              resourceId: app.id,
              name: titleCaseProvider(app.provider),
              icon: PROVIDER_ICON[app.provider] ?? 'Plug',
              detail: 'Connected',
            }}
            workspaceSlug={workspaceSlug}
            isSelected={isSelected}
            isFavorite={true}
            onToggleFavorite={() => toggleResourceFavorite('app', app.provider)}
            onDisconnect={async () => {
              const confirmed = await prompts.confirmAction({
                title: `Disconnect ${titleCaseProvider(app.provider)}?`,
                description:
                  'This integration will be removed from your workspace and webhooks will be disabled.',
                confirmLabel: 'Disconnect',
                destructive: true,
              });
              if (!confirmed) return;
              integrationMutations.disconnect.mutate(app.id);
            }}
            onSync={() => integrationMutations.sync.mutateAsync(app.id)}
            depth={1}
          />
        ),
      });
    });

    starredWorkflows.forEach((workflow) => {
      const isSelected =
        location.pathname.endsWith('/automations') &&
        location.search.includes(`workflow=${workflow.id}`);
      list.push({
        id: `workflow-${workflow.id}`,
        render: () => (
          <WorkflowNavRow
            key={`starred-wf-${workflow.id}`}
            workflow={{
              id: workflow.id,
              name: workflow.name,
              icon: TRIGGER_ICON[workflow.triggerType] ?? 'Zap',
              detail: workflow.triggerType,
              isActive: workflow.isActive,
            }}
            workspaceSlug={workspaceSlug}
            isSelected={isSelected}
            isFavorite={true}
            onToggleFavorite={() =>
              toggleResourceFavorite('workflow', workflow.id)
            }
            onDelete={async () => {
              const confirmed = await prompts.confirmAction({
                title: `Delete “${workflow.name}”?`,
                description:
                  'This workflow automation will be permanently deleted for all members.',
                confirmLabel: 'Delete workflow',
                destructive: true,
              });
              if (!confirmed) return;
              workflowMutations.remove.mutate(workflow.id);
            }}
            onRun={() =>
              workflowMutations.trigger.mutateAsync({
                workflowId: workflow.id,
                payload: {},
              })
            }
            onToggleActive={() =>
              workflowMutations.update.mutate({
                workflowId: workflow.id,
                input: { isActive: !workflow.isActive },
              })
            }
            depth={1}
          />
        ),
      });
    });

    return list;
  }, [
    groups.favorites,
    starredProjects,
    starredDocs,
    starredAgents,
    starredApps,
    starredWorkflows,
    channelActivity,
    rowProps,
    workspaceSlug,
    prompts,
    projectMutations,
    docsWorkspace,
    agentMutations,
    integrationMutations,
    workflowMutations,
    location,
    navigate,
    toggleResourceFavorite,
  ]);

  const customStarredOrder = workspaceId
    ? resourceOrders[workspaceId]?.starred
    : undefined;

  const orderedStarredItems = useMemo(() => {
    if (!customStarredOrder || customStarredOrder.length === 0) {
      return rawStarredItems;
    }
    const map = new Map(rawStarredItems.map((item) => [item.id, item]));
    const result: typeof rawStarredItems = [];

    for (const id of customStarredOrder) {
      const item = map.get(id);
      if (item) {
        result.push(item);
        map.delete(id);
      }
    }

    for (const item of map.values()) {
      result.push(item);
    }

    return result;
  }, [rawStarredItems, customStarredOrder]);

  const handleStarredDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !workspaceId) return;

    moveResourceItem(
      workspaceId,
      'starred',
      active.id as string,
      over.id as string,
      orderedStarredItems.map((i) => i.id),
    );
  };

  const totalStarredCount = orderedStarredItems.length;

  if (isLoading) {
    return (
      <div className="px-3 py-2">
        <SkeletonList rows={6} className="gap-2" />
      </div>
    );
  }

  // --- Collapsed Sidebar View (Icon rail with tooltips) ---
  if (isCollapsed) {
    return (
      <div className="min-h-0 py-2 flex h-full flex-col items-center justify-between">
        <ScrollArea
          className="min-h-0 px-1 w-full flex-1"
          contentClassName="flex flex-col items-center gap-1.5 py-1"
        >
          {resolvedNav.visibleItems.map((item) => (
            <IconOnlyNavRow
              key={item.id}
              entry={{
                path: item.href,
                label: item.label,
                icon: item.icon,
                badge: item.badge ?? undefined,
                end: item.href === '',
              }}
              workspaceSlug={workspaceSlug}
            />
          ))}
        </ScrollArea>

        <SidebarFooterActions
          workspaceSlug={workspaceSlug}
          onCreateChannel={onCreateChannel}
          onNewChat={startNewChat}
          onOpenCustomizer={() => setCustomizerOpen(true)}
          isCollapsed={true}
        />

        <SidebarCustomizerDialog
          open={customizerOpen}
          onOpenChange={setCustomizerOpen}
        />
        {prompts.dialog}
      </div>
    );
  }

  // --- Expanded Standard Sidebar View ---
  return (
    <div className="min-h-0 flex h-full flex-col overflow-hidden bg-background">
      <ScrollArea
        className="min-h-0 p-3 flex-1"
        contentClassName="p-2 space-y-4"
      >
        {/* Top Primary Navigation Items (Customizable via Dialog) */}
        <nav
          aria-label="Workspace navigation"
          className="space-y-0.5 pb-3 border-b border-border/60"
        >
          <div className="space-y-0.5">
            {resolvedNav.visibleItems.map((item) => (
              <NavRow
                key={item.id}
                entry={{
                  path: item.href,
                  label: item.label,
                  icon: item.icon,
                  badge: item.badge ?? undefined,
                  end: item.href === '',
                }}
                workspaceSlug={workspaceSlug}
                isActiveOverride={
                  item.id === 'channels'
                    ? location.pathname.includes('/c/')
                    : undefined
                }
              />
            ))}
          </div>

          <div className="pt-1.5 px-1 flex items-center justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More navigation destinations"
                  className="gap-1.5 px-2 py-1 text-xs inline-flex items-center rounded-md text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                >
                  <MoreHorizontal className="size-3.5" />
                  <span>More</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {MORE_DESTINATIONS.map((entry) => {
                  const isPinned = pinnedNavPaths.includes(entry.path);
                  return (
                    <DropdownMenuItem
                      key={entry.path}
                      onSelect={() =>
                        navigate(`/w/${workspaceSlug}${entry.path}`)
                      }
                      className="justify-between"
                    >
                      <div className="gap-2 flex items-center">
                        <IconRenderer
                          name={entry.icon}
                          className="size-4 text-muted-foreground"
                          fallback="FileText"
                        />
                        <span>{entry.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleNavPinned(entry.path);
                        }}
                        className={cn(
                          'p-1 transition-colors hover:text-foreground',
                          isPinned
                            ? 'text-primary'
                            : 'text-muted-foreground opacity-40 hover:opacity-100',
                        )}
                        title={
                          isPinned ? 'Unpin from sidebar' : 'Pin to sidebar'
                        }
                      >
                        <Pin className="size-3" />
                      </button>
                    </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => setCustomizerOpen(true)}
                  className="gap-2 text-xs"
                >
                  <SlidersHorizontal className="size-3.5" />
                  <span>Customize Sidebar</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Hint label="Customize navigation">
              <button
                type="button"
                onClick={() => setCustomizerOpen(true)}
                aria-label="Customize sidebar navigation"
                className="size-7 flex items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <SlidersHorizontal className="size-3.5" />
              </button>
            </Hint>
          </div>
        </nav>

        {/* Dynamic Resource Sections (Channels, DMs, Projects, Docs, AI Agents, Apps, Workflows, Starred) */}
        <div className="space-y-4">
          {activeSections.map((sec) => {
            switch (sec.id) {
              case 'starred':
                return (
                  <Section
                    key="starred"
                    title="Starred"
                    count={totalStarredCount}
                    emptyLabel="Drop an important item here to keep it handy."
                  >
                    <DndContext
                      id={starredDndId}
                      sensors={starredSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleStarredDragEnd}
                    >
                      <SortableContext
                        items={orderedStarredItems.map((i) => i.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {orderedStarredItems.map((item) => (
                          <SortableStarredItem key={item.id} id={item.id}>
                            {item.render()}
                          </SortableStarredItem>
                        ))}
                      </SortableContext>
                    </DndContext>
                  </Section>
                );

              case 'channels':
                return (
                  <Section
                    key="channels"
                    title="Channels"
                    count={orderedJoinedChannels.length}
                    emptyLabel="You have not joined any channels yet."
                    action={
                      <Hint label="Create a channel">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={onCreateChannel}
                          aria-label="Create a channel"
                          className="size-5 p-0 opacity-0 transition-opacity duration-150 group-focus-within/section:opacity-100 group-hover/section:opacity-100 focus-visible:opacity-100"
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </Hint>
                    }
                  >
                    <DndContext
                      id={channelDndId}
                      sensors={channelSensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleChannelDragEnd}
                    >
                      <SortableContext
                        items={orderedJoinedChannels.map((c) => c.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {orderedJoinedChannels.map((channel) => (
                          <SortableChannelRow
                            key={channel.id}
                            channel={channel}
                            activity={channelActivity?.[channel.id]}
                            {...rowProps}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                    <li>
                      <button
                        onClick={onBrowseChannels}
                        className={navActionClass({ depth: 1 })}
                      >
                        <Plus className={navIconClass(1)} aria-hidden />
                        <span className="flex-1 truncate">Browse channels</span>
                      </button>
                    </li>
                  </Section>
                );

              case 'dms':
                return (
                  <DirectMessagesSection
                    key="dms"
                    workspaceSlug={workspaceSlug}
                  />
                );

              case 'projects':
                return (
                  <ProjectsTreeSection
                    key="projects"
                    workspaceSlug={workspaceSlug}
                    prompts={prompts}
                  />
                );

              case 'docs':
                return (
                  <DocsTreeSection
                    key="docs"
                    workspaceSlug={workspaceSlug}
                    prompts={prompts}
                  />
                );

              case 'agents':
                return (
                  <AgentsSection
                    key="agents"
                    workspaceSlug={workspaceSlug}
                    prompts={prompts}
                  />
                );

              case 'apps':
                return (
                  <AppsSection
                    key="apps"
                    workspaceSlug={workspaceSlug}
                    prompts={prompts}
                  />
                );

              case 'workflows':
                return (
                  <WorkflowsSection
                    key="workflows"
                    workspaceSlug={workspaceSlug}
                    prompts={prompts}
                  />
                );

              default:
                return null;
            }
          })}
        </div>
      </ScrollArea>

      <div className="p-2.5 shrink-0 border-t border-border/70 bg-surface-muted/30">
        <SidebarFooterActions
          workspaceSlug={workspaceSlug}
          onCreateChannel={onCreateChannel}
          onNewChat={startNewChat}
          onOpenCustomizer={() => setCustomizerOpen(true)}
        />
      </div>

      <SidebarCustomizerDialog
        open={customizerOpen}
        onOpenChange={setCustomizerOpen}
      />

      {prompts.dialog}
    </div>
  );
}

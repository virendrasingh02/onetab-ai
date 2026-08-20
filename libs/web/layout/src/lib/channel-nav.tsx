import {
  ActivityDot,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Hint,
  ScrollArea,
  SkeletonList,
  usePromptDialog,
  type PromptDialog,
} from '@org/ui';
import type { ActivityIndicator } from '@org/notifications';
import type { ChannelSummary } from '@org/types';
import { cn } from '@org/utils';
import { useAgents, useAgentMutations } from '@org/web-agents';
import { useWorkflows, useWorkflowMutations } from '@org/web-automations';
import { useChannelPreferences, useGroupedChannels } from '@org/web-channels';
import {
  useIntegrations,
  useIntegrationMutations,
} from '@org/web-integrations';
import {
  useDocsWorkspace,
  useProjectMutations,
  useProjects,
} from '@org/web-work-tools';
import {
  Activity,
  Bell,
  BellOff,
  Bookmark,
  Check,
  ChevronRight,
  Clock,
  Copy,
  HardDrive,
  Hash,
  Home,
  Inbox,
  Lock,
  Mail,
  MessagesSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Share2,
  Star,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { SidebarFooterActions } from './create-menu.js';
import { DirectMessagesSection } from './direct-messages-section.js';
import { DocNavRow, DocsTreeSection } from './docs-section.js';
import {
  FavoriteToggle,
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

/** Fixed core destinations: Home, Inbox, Threads (permanent and never removable). */
const CORE_LINKS: readonly NavEntry[] = [
  { path: '', label: 'Home', icon: Home, end: true },
  { path: 'inbox', label: 'Inbox', icon: Inbox },
  { path: 'threads', label: 'Threads', icon: MessagesSquare },
];

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
  workspaceSlug,
  activity,
  onToggleFavorite,
  onToggleMute,
  prompts,
}: {
  channel: ChannelSummary;
  workspaceSlug: string;
  activity?: ActivityIndicator;
  onToggleFavorite: (channel: ChannelSummary) => void;
  onToggleMute: (channel: ChannelSummary) => void;
  prompts: PromptDialog;
}) {
  const [unreadState, setUnreadState] = useState(false);
  const unreadTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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
  const { copied: emailCopied, copy: handleEmailChannel } = useCopyLink(
    `${channel.slug}-${workspaceSlug}@onetab.ai`,
  );

  useEffect(() => () => clearTimeout(unreadTimer.current), []);

  const handleMarkUnread = useCallback(() => {
    setUnreadState(true);
    clearTimeout(unreadTimer.current);
    unreadTimer.current = setTimeout(() => setUnreadState(false), 2000);
  }, []);

  const handleRename = useCallback(async () => {
    const name = await prompts.promptText({
      title: `Rename #${channel.name}`,
      label: 'Channel name',
      defaultValue: channel.name,
      confirmLabel: 'Rename',
    });
    if (!name) return;
  }, [channel.name, prompts]);

  const handleDeleteChannel = useCallback(async () => {
    const confirmed = await prompts.confirmAction({
      title: `Delete #${channel.name}?`,
      description:
        'Are you sure you want to delete this channel? All messages and attachments will be removed.',
      confirmLabel: 'Delete Channel',
      destructive: true,
    });
    if (!confirmed) return;
  }, [channel.name, prompts]);

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
                onSelect={handleEmailChannel}
                className="gap-2.5"
              >
                {emailCopied ? (
                  <Check className="size-4 text-success-text" />
                ) : (
                  <Mail className="size-4" />
                )}
                <span>
                  {emailCopied ? 'Email address copied!' : 'Email to Channel'}
                </span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() => onToggleMute(channel)}
                className="gap-2.5"
              >
                <Bell className="size-4" />
                <span>Notification settings</span>
              </DropdownMenuItem>

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
                onSelect={handleDeleteChannel}
                variant="destructive"
                className="gap-2.5"
              >
                <Trash2 className="size-4" />
                <span>Delete Channel</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </NavRowActions>
      ) : null}
    </li>
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
    isNavPinned,
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

  const coreLinks = useMemo(
    () =>
      CORE_LINKS.map((entry) =>
        entry.path === 'inbox' && inboxUnread > 0
          ? { ...entry, badge: inboxUnread > 99 ? '99+' : inboxUnread }
          : entry,
      ),
    [inboxUnread],
  );

  const pinnedSecondaryLinks = useMemo(
    () =>
      MORE_DESTINATIONS.filter((entry) => pinnedNavPaths.includes(entry.path)),
    [pinnedNavPaths],
  );

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

  const totalStarredCount =
    groups.favorites.length +
    starredProjects.length +
    starredDocs.length +
    starredAgents.length +
    starredApps.length +
    starredWorkflows.length;

  if (isLoading) {
    return (
      <div className="px-3 py-2">
        <SkeletonList rows={6} className="gap-2" />
      </div>
    );
  }

  const rowProps = {
    workspaceSlug,
    onToggleFavorite: toggleFavorite,
    onToggleMute: toggleMute,
    prompts,
  };

  return (
    <div className="min-h-0 flex h-full flex-col">
      {/* Sticky Sidebar Navigation Header */}
      <div className="sticky top-0 z-10 shrink-0 px-3 pt-3 pb-2 border-b border-border/40 bg-surface-muted/95 backdrop-blur-md">
        <nav aria-label="Primary navigation" className="space-y-0.5">
          {coreLinks.map((entry) => (
            <NavRow
              key={entry.label}
              entry={entry}
              workspaceSlug={workspaceSlug}
            />
          ))}

          {pinnedSecondaryLinks.map((entry) => (
            <NavRow
              key={entry.label}
              entry={entry}
              workspaceSlug={workspaceSlug}
              onTogglePin={() => toggleNavPinned(entry.path)}
            />
          ))}

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                className={navActionClass()}
                aria-label="More destinations"
              >
                <MoreHorizontal className={navIconClass(0)} aria-hidden />
                <span className="flex-1 truncate">More</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="bottom"
              sideOffset={4}
              className="w-56 p-1.5"
            >
              <DropdownMenuLabel className="px-2.5 py-1 font-medium tracking-wide text-[11px] text-subtle uppercase">
                More destinations
              </DropdownMenuLabel>
              <div className="space-y-0.5 my-1">
                {MORE_DESTINATIONS.map((entry) => {
                  const Icon = entry.icon;
                  const isPinned = isNavPinned(entry.path);
                  return (
                    <div
                      key={entry.path}
                      className="group/more-row gap-1.5 px-2 py-1.5 flex items-center justify-between rounded-md text-xs text-muted-foreground hover:bg-surface-raised hover:text-foreground"
                    >
                      <NavLink
                        to={`/w/${workspaceSlug}/${entry.path}`}
                        className={({ isActive }) =>
                          cn(
                            'gap-2 flex flex-1 items-center outline-none',
                            isActive && 'font-semibold text-foreground',
                          )
                        }
                      >
                        <Icon className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{entry.label}</span>
                      </NavLink>
                      <Hint
                        side="right"
                        label={
                          isPinned ? 'Unpin from sidebar' : 'Pin to sidebar'
                        }
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleNavPinned(entry.path);
                          }}
                          aria-label={
                            isPinned
                              ? `Unpin ${entry.label}`
                              : `Pin ${entry.label}`
                          }
                          className={cn(
                            'size-6 flex items-center justify-center rounded-md transition-all',
                            isPinned
                              ? 'bg-accent/80 text-foreground opacity-100'
                              : 'text-muted-foreground opacity-0 group-focus-within/more-row:opacity-100 group-hover/more-row:opacity-100 hover:bg-accent hover:text-foreground',
                          )}
                        >
                          <Pin
                            className={cn(
                              'size-3.5',
                              isPinned &&
                                'rotate-45 fill-current text-foreground',
                            )}
                          />
                        </button>
                      </Hint>
                    </div>
                  );
                })}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>

      <ScrollArea className="min-h-0 flex-1" contentClassName="px-3 pt-2 pb-6">
        <div className="space-y-4">
          <div>
            <Section
              title="Starred"
              count={totalStarredCount}
              emptyLabel="Drop an important item here to keep it handy."
            >
              {groups.favorites.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  activity={channelActivity?.[channel.id]}
                  {...rowProps}
                />
              ))}

              {starredProjects.map((project) => {
                const isSelected =
                  location.pathname.includes('/tasks') &&
                  location.search.includes(`project=${project.id}`);
                return (
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
                );
              })}

              {starredDocs.map((doc) => {
                const isSelected =
                  location.pathname.includes('/docs') &&
                  location.search.includes(`doc=${doc.id}`);
                return (
                  <DocNavRow
                    key={`starred-doc-${doc.id}`}
                    doc={doc}
                    workspaceSlug={workspaceSlug}
                    isSelected={isSelected}
                    isFavorite={true}
                    onToggleFavorite={() =>
                      toggleResourceFavorite('doc', doc.id)
                    }
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
                      if (docId)
                        navigate(`/w/${workspaceSlug}/docs?doc=${docId}`);
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
                );
              })}

              {starredAgents.map((agent) => {
                const isSelected =
                  location.pathname.endsWith('/agents') &&
                  location.search.includes(`agent=${agent.id}`);
                return (
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
                    onToggleFavorite={() =>
                      toggleResourceFavorite('agent', agent.id)
                    }
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
                );
              })}

              {starredApps.map((app) => {
                const isSelected =
                  location.pathname.endsWith('/integrations') &&
                  location.search.includes(`app=${app.provider}`);
                return (
                  <AppNavRow
                    key={`starred-app-${app.provider}`}
                    app={{
                      id: app.provider,
                      name: titleCaseProvider(app.provider),
                      icon: PROVIDER_ICON[app.provider] ?? 'Plug',
                      detail: 'Connected',
                    }}
                    workspaceSlug={workspaceSlug}
                    isSelected={isSelected}
                    isFavorite={true}
                    onToggleFavorite={() =>
                      toggleResourceFavorite('app', app.provider)
                    }
                    onDisconnect={async () => {
                      const confirmed = await prompts.confirmAction({
                        title: `Disconnect ${titleCaseProvider(app.provider)}?`,
                        description:
                          'This integration will be removed from your workspace and webhooks will be disabled.',
                        confirmLabel: 'Disconnect',
                        destructive: true,
                      });
                      if (!confirmed) return;
                      integrationMutations.disconnect.mutate(app.provider);
                    }}
                    depth={1}
                  />
                );
              })}

              {starredWorkflows.map((workflow) => {
                const isSelected =
                  location.pathname.endsWith('/automations') &&
                  location.search.includes(`workflow=${workflow.id}`);
                return (
                  <WorkflowNavRow
                    key={`starred-wf-${workflow.id}`}
                    workflow={{
                      id: workflow.id,
                      name: workflow.name,
                      icon: TRIGGER_ICON[workflow.triggerType] ?? 'Zap',
                      detail: workflow.triggerType,
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
                    depth={1}
                  />
                );
              })}
            </Section>

            <Section
              title="Channels"
              count={groups.joined.length}
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
              {groups.joined.map((channel) => (
                <ChannelRow
                  key={channel.id}
                  channel={channel}
                  activity={channelActivity?.[channel.id]}
                  {...rowProps}
                />
              ))}
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

            <DirectMessagesSection workspaceSlug={workspaceSlug} />

            <ProjectsTreeSection
              workspaceSlug={workspaceSlug}
              prompts={prompts}
            />

            <DocsTreeSection workspaceSlug={workspaceSlug} prompts={prompts} />

            <AgentsSection workspaceSlug={workspaceSlug} prompts={prompts} />

            <AppsSection workspaceSlug={workspaceSlug} prompts={prompts} />

            <WorkflowsSection workspaceSlug={workspaceSlug} prompts={prompts} />
          </div>
        </div>
      </ScrollArea>

      <div className="p-3.5 shrink-0 border-t border-border/60 bg-transparent">
        <SidebarFooterActions
          workspaceSlug={workspaceSlug}
          onCreateChannel={onCreateChannel}
          onNewChat={startNewChat}
        />
      </div>

      {prompts.dialog}
    </div>
  );
}

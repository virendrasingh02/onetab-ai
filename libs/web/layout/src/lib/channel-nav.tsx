import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  Hint,
  ScrollArea,
  SkeletonList,
  usePromptDialog,
  type PromptDialog,
} from '@org/ui';
import type { ChannelSummary } from '@org/types';
import { cn } from '@org/utils';
import { useAgents, useAgentMutations } from '@org/web-agents';
import { useWorkflows, useWorkflowMutations } from '@org/web-automations';
import { useChannelPreferences, useGroupedChannels } from '@org/web-channels';
import { useIntegrations, useIntegrationMutations } from '@org/web-integrations';
import {
  useDocsWorkspace,
  useProjectMutations,
  useProjects,
} from '@org/web-work-tools';
import {
  Activity,
  Bell,
  BellOff,
  Check,
  ChevronRight,
  Clock,
  Copy,
  FileText,
  FolderKanban,
  HardDrive,
  Hash,
  Home,
  Inbox,
  Lock,
  Mail,
  MessagesSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Share2,
  Star,
  Trash2,
  Users,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { SidebarFooterActions } from './create-menu.js';
import { DirectMessagesSection } from './direct-messages-section.js';
import { DocNavRow, DocsTreeSection } from './docs-section.js';
import {
  navActionClass,
  navIconClass,
  navRowClass,
  NavRow,
  Section,
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

/** Shown directly — the destinations people reach for constantly. */
const MOST_USED_LINKS: readonly NavEntry[] = [
  { path: '', label: 'Home', icon: Home, end: true },
  { path: 'inbox', label: 'Inbox', icon: Inbox },
  { path: 'threads', label: 'Threads', icon: MessagesSquare },
  { path: 'meetings', label: 'Meetings', icon: Video },
];

/** Everything else, behind the "More" menu. */
const SECONDARY_LINKS: readonly NavEntry[] = [
  { path: 'pulse', label: 'Pulse', icon: Activity },
  { path: 'schedule', label: 'Schedule', icon: Clock },
  { path: 'tasks', label: 'Projects', icon: FolderKanban },
  { path: 'docs', label: 'Docs', icon: FileText },
  { path: 'directory', label: 'Team Directory', icon: Users },
  { path: 'files', label: 'Files', icon: HardDrive },
  { path: 'settings', label: 'Settings', icon: Settings },
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
  onToggleFavorite,
  onToggleMute,
  prompts,
}: {
  channel: ChannelSummary;
  workspaceSlug: string;
  onToggleFavorite: (channel: ChannelSummary) => void;
  onToggleMute: (channel: ChannelSummary) => void;
  prompts: PromptDialog;
}) {
  const [copied, setCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const [unreadState, setUnreadState] = useState(false);
  const [shared, setShared] = useState(false);

  const isFavorite = channel.membership?.isFavorite ?? false;
  const isMuted = channel.membership?.isMuted ?? false;
  const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;

  const handleCopyLink = useCallback(
    (e?: React.MouseEvent | Event) => {
      e?.stopPropagation?.();
      const url = `${window.location.origin}/w/${workspaceSlug}/c/${channel.slug}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    [workspaceSlug, channel.slug],
  );

  const handleEmailChannel = useCallback(
    (e?: React.MouseEvent | Event) => {
      e?.stopPropagation?.();
      const email = `${channel.slug}-${workspaceSlug}@onetab.ai`;
      navigator.clipboard.writeText(email);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    },
    [workspaceSlug, channel.slug],
  );

  const handleMarkUnread = useCallback((e?: React.MouseEvent | Event) => {
    e?.stopPropagation?.();
    setUnreadState(true);
    setTimeout(() => setUnreadState(false), 2000);
  }, []);

  const handleRename = useCallback(
    async (e?: React.MouseEvent | Event) => {
      e?.stopPropagation?.();
      const name = await prompts.promptText({
        title: `Rename #${channel.name}`,
        label: 'Channel name',
        defaultValue: channel.name,
        confirmLabel: 'Rename',
      });
      if (!name) return;
    },
    [channel.name, prompts],
  );

  const handleDeleteChannel = useCallback(
    async (e?: React.MouseEvent | Event) => {
      e?.stopPropagation?.();
      const confirmed = await prompts.confirmAction({
        title: `Delete #${channel.name}?`,
        description:
          'Are you sure you want to delete this channel? All messages and attachments will be removed.',
        confirmLabel: 'Delete Channel',
        destructive: true,
      });
      if (!confirmed) return;
    },
    [channel.name, prompts],
  );

  const handleShare = useCallback(
    (e?: React.MouseEvent | Event) => {
      e?.stopPropagation?.();
      const url = `${window.location.origin}/w/${workspaceSlug}/c/${channel.slug}`;
      navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    },
    [workspaceSlug, channel.slug],
  );

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
            ),
          })
        }
      >
        <Icon className={navIconClass(1)} aria-hidden />
        <span className="flex-1 truncate">{channel.name}</span>
        {isMuted && (
          <Hint label="Notifications muted">
            <BellOff className="mr-1 size-3 shrink-0 text-muted-foreground/70" />
          </Hint>
        )}
      </NavLink>

      {channel.membership ? (
        <div
          className={cn(
            'right-1 gap-0.5 absolute top-1/2 flex -translate-y-1/2 items-center transition-opacity',
            isFavorite
              ? 'opacity-100'
              : 'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-within:opacity-100',
          )}
        >
          <Hint
            label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(channel);
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
                aria-label="Channel options"
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
                onSelect={handleMarkUnread}
                onClick={handleMarkUnread}
                className="justify-between"
              >
                <div className="gap-2.5 flex items-center">
                  {unreadState ? (
                    <Check className="size-4 text-emerald-500" />
                  ) : (
                    <Mail className="size-4" />
                  )}
                  <span>
                    {unreadState ? 'Marked as unread!' : 'Mark as unread'}
                  </span>
                </div>
                <DropdownMenuShortcut>U</DropdownMenuShortcut>
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={handleRename}
                onClick={handleRename}
                className="gap-2.5"
              >
                <Pencil className="size-4" />
                <span>Rename</span>
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
                onSelect={() => onToggleFavorite(channel)}
                onClick={() => onToggleFavorite(channel)}
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
                onSelect={handleEmailChannel}
                onClick={handleEmailChannel}
                className="gap-2.5"
              >
                {emailCopied ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Mail className="size-4" />
                )}
                <span>
                  {emailCopied ? 'Email address copied!' : 'Email to Channel'}
                </span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() => onToggleMute(channel)}
                onClick={() => onToggleMute(channel)}
                className="gap-2.5"
              >
                <Bell className="size-4" />
                <span>Notification settings</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() => onToggleMute(channel)}
                onClick={() => onToggleMute(channel)}
                description="Follow this Channel in the future to show it in your sidebar again."
              >
                <BellOff className="size-4" />
                <span>{isMuted ? 'Follow Channel' : 'Unfollow'}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onSelect={handleShare}
                onClick={handleShare}
                className="gap-2.5"
              >
                {shared ? (
                  <Check className="size-4 text-emerald-500" />
                ) : (
                  <Share2 className="size-4" />
                )}
                <span>{shared ? 'Link copied!' : 'Sharing & Permissions'}</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onSelect={handleDeleteChannel}
                onClick={handleDeleteChannel}
                variant="destructive"
                className="gap-2.5"
              >
                <Trash2 className="size-4" />
                <span>Delete Channel</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
  onCreateChannel: () => void;
  onBrowseChannels: () => void;
}

export function ChannelNav({
  workspaceId,
  workspaceSlug,
  channels,
  isLoading,
  inboxUnread = 0,
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

  const primaryLinks = useMemo(
    () =>
      MOST_USED_LINKS.map((entry) =>
        entry.path === 'inbox' && inboxUnread > 0
          ? { ...entry, badge: inboxUnread > 99 ? '99+' : inboxUnread }
          : entry,
      ),
    [inboxUnread],
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
      (docsWorkspace.docs ?? []).filter((d) =>
        favoriteDocIds.includes(d.id),
      ),
    [docsWorkspace.docs, favoriteDocIds],
  );

  const starredAgents = useMemo(
    () =>
      (agentsQuery.data ?? []).filter((a) =>
        favoriteAgentIds.includes(a.id),
      ),
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
      <ScrollArea
        className="min-h-0 flex-1"
        contentClassName="px-3.5 pt-3 pb-6"
      >
        <div className="pb-4 p-2">
          <nav aria-label="Primary navigation" className="space-y-0.5">
            {primaryLinks.map((entry) => (
              <NavRow
                key={entry.label}
                entry={entry}
                workspaceSlug={workspaceSlug}
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
                className="w-52"
              >
                {SECONDARY_LINKS.map((entry) => {
                  const Icon = entry.icon;
                  return (
                    <DropdownMenuItem
                      key={entry.label}
                      asChild
                      className="gap-2.5 text-xs"
                    >
                      <NavLink
                        to={
                          entry.path
                            ? `/w/${workspaceSlug}/${entry.path}`
                            : `/w/${workspaceSlug}`
                        }
                        end={entry.end}
                      >
                        <Icon
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden
                        />
                        <span className="flex-1 truncate">{entry.label}</span>
                      </NavLink>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="mt-3 pt-2 border-t border-border">
            <Section
              title="Starred"
              count={totalStarredCount}
              emptyLabel="Drop an important item here to keep it handy."
            >
              {groups.favorites.map((channel) => (
                <ChannelRow key={channel.id} channel={channel} {...rowProps} />
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
                    className="size-5 p-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </Hint>
              }
            >
              {groups.joined.map((channel) => (
                <ChannelRow key={channel.id} channel={channel} {...rowProps} />
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

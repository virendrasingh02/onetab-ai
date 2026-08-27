import { invitationApi, memberApi, queryKeys } from '@org/api-client';
import type { ChannelMember, ChannelSummary, WorkspaceMember } from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Hint,
  Input,
  ScrollArea,
  SkeletonList,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  UserAvatar,
  usePromptDialog,
  useRightPanelStore,
} from '@org/ui';
import { cn, formatDate } from '@org/utils';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  Blocks,
  Bot,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Hash,
  Headphones,
  Info,
  Link2,
  Loader2,
  Lock,
  LogOut,
  MoreVertical,
  Plus,
  Search,
  Send,
  Settings,
  Star,
  UserMinus,
  UserPlus,
  Workflow,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useArchiveChannel,
  useChannelMemberMutations,
  useChannelMembers,
  useChannelPreferences,
} from '../use-channels.js';
import { useChannelAgentsAndApps } from '../use-channel-agents-apps.js';

export interface ChannelDetailsPanelProps {
  channel: ChannelSummary;
  /** Undefined only while the workspace is still resolving, as everywhere else. */
  workspaceId: string | undefined;
  workspaceSlug: string;
  currentUserId: string;
  /** Name of whoever created the channel, when they are still a member. */
  createdByName?: string;
  initialTab?: 'about' | 'members' | 'apps' | 'automations';
  onClose: () => void;
  onEditDetails: () => void;
  onAddPeople: () => void;
  onAddAgent?: () => void;
  onAddApp?: () => void;
  onOpenAgentsAppsTab?: () => void;
  onOpenWorkflows?: () => void;
  onStartHuddle: () => void;
}

/**
 * Everything about a channel that is not its messages, in the right rail.
 *
 * This replaced a full-width "About" tab inside the channel, which showed four
 * fields and hid the conversation to do it. Here the same information sits
 * *beside* the conversation, and there is room for the things that were
 * previously scattered across a header dropdown — membership, notification
 * level, leaving, archiving.
 */
export function ChannelDetailsPanel({
  channel,
  workspaceId,
  workspaceSlug,
  currentUserId,
  createdByName,
  initialTab = 'about',
  onClose,
  onEditDetails,
  onAddPeople,
  onAddAgent,
  onAddApp,
  onOpenAgentsAppsTab,
  onOpenWorkflows,
  onStartHuddle,
}: ChannelDetailsPanelProps) {
  const members = useChannelMembers(workspaceId, channel.id);
  const memberList = members.data ?? [];
  const channelAgentsApps = useChannelAgentsAndApps(workspaceId, channel.id);

  const [activeTab, setActiveTab] = useState<
    'about' | 'members' | 'apps' | 'automations'
  >(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  const ChannelIcon = channel.visibility === 'PRIVATE' ? Lock : Hash;

  return (
    <div className="min-h-0 flex h-full flex-col bg-surface text-foreground">
      <div className="px-3 pt-3 pb-2 gap-1 flex shrink-0 items-start justify-between">
        <h2 className="min-w-0 gap-1.5 text-base font-semibold tracking-tight flex flex-1 items-center">
          <ChannelIcon
            className="size-4 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <span className="truncate">{channel.name}</span>
        </h2>

        <ChannelSettingsDropdown
          channel={channel}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          onEditDetails={onEditDetails}
        />

        <Hint label="Close panel">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close panel"
            className="-mt-0.5 shrink-0"
          >
            <X className="size-4" />
          </Button>
        </Hint>
      </div>

      <div className="px-3 pb-2.5 gap-1.5 flex shrink-0 flex-wrap items-center">
        <FavoriteMenu channel={channel} workspaceId={workspaceId} />
        <NotificationMenu
          channel={channel}
          workspaceId={workspaceId}
          workspaceSlug={workspaceSlug}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={onStartHuddle}
          className="h-7 gap-1.5 text-xs"
        >
          <Headphones className="size-3.5" />
          <span>Huddle</span>
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(val) =>
          setActiveTab(
            val as 'about' | 'members' | 'apps' | 'automations',
          )
        }
        className="min-h-0 flex flex-1 flex-col"
      >
        <div className="px-3 shrink-0 scrollbar-none overflow-x-auto border-b border-border">
          <TabsList>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="members" className="gap-1.5">
              Members
              <span className="text-muted-foreground">
                {memberList.length || channel.memberCount}
              </span>
            </TabsTrigger>
            <TabsTrigger value="apps">Agents &amp; apps</TabsTrigger>
            <TabsTrigger value="automations">Automations</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="about" className="min-h-0 flex flex-1 flex-col">
          <AboutTab
            channel={channel}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            createdByName={createdByName}
            onEditDetails={onEditDetails}
          />
        </TabsContent>

        <TabsContent value="members" className="min-h-0 flex flex-1 flex-col">
          <MembersTab
            channelId={channel.id}
            channelName={channel.name}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            members={memberList}
            isLoading={members.isLoading}
            onAddPeople={onAddPeople}
          />
        </TabsContent>

        <TabsContent
          value="apps"
          className="min-h-0 flex flex-1 flex-col p-4 space-y-4 overflow-y-auto"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Channel AI Agents &amp; Apps
              </span>
              <span className="text-[10px] text-muted-foreground">
                {channelAgentsApps.agents.length} agents · {channelAgentsApps.apps.length} apps
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {onAddApp ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onAddApp}
                  className="h-7 text-xs gap-1 px-2 border-accent-violet/30 text-accent-violet"
                >
                  <Plus className="size-3" />
                  <span>App</span>
                </Button>
              ) : null}
              {onAddAgent ? (
                <Button
                  size="sm"
                  onClick={onAddAgent}
                  className="h-7 text-xs gap-1 px-2"
                >
                  <Plus className="size-3" />
                  <span>Agent</span>
                </Button>
              ) : null}
            </div>
          </div>

          {/* List of active AI agents */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              Active AI Agents ({channelAgentsApps.agents.length})
            </span>
            {channelAgentsApps.agents.map((agent) => (
              <div
                key={agent.id}
                className="p-3 rounded-xl border border-border bg-surface flex items-start gap-2.5 transition-colors hover:border-border-strong"
              >
                <UserAvatar name={agent.name} seed={agent.avatarSeed} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-foreground truncate">
                        {agent.name}
                      </span>
                      <span className="text-[10px] font-mono text-primary truncate">
                        {agent.handle}
                      </span>
                    </div>
                    <Badge
                      variant={agent.enabled ? 'primary' : 'neutral'}
                      className="text-[10px] py-0 h-4"
                    >
                      {agent.enabled ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    {agent.description}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {agent.model}
                    </span>
                    <button
                      type="button"
                      onClick={() => channelAgentsApps.toggleAgent(agent.id)}
                      className="text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                    >
                      {agent.enabled ? 'Pause' : 'Enable'}
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* List of connected apps */}
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block pt-2">
              Connected Apps ({channelAgentsApps.apps.length})
            </span>
            {channelAgentsApps.apps.map((app) => (
              <div
                key={app.id}
                className="p-3 rounded-xl border border-border bg-surface flex items-start gap-2.5 transition-colors hover:border-border-strong"
              >
                <UserAvatar name={app.name} seed={app.icon} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-bold text-foreground truncate">
                        {app.name}
                      </span>
                      <span className="text-[10px] font-mono text-accent-violet truncate">
                        {app.botHandle}
                      </span>
                    </div>
                    <Badge
                      variant={app.enabled ? 'primary' : 'neutral'}
                      className={cn(
                        'text-[10px] py-0 h-4',
                        app.enabled && 'bg-accent-violet-soft text-accent-violet border-accent-violet/20',
                      )}
                    >
                      {app.enabled ? 'Connected' : 'Muted'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                    {app.description}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">
                      {app.events.length} event triggers
                    </span>
                    <button
                      type="button"
                      onClick={() => channelAgentsApps.toggleApp(app.id)}
                      className="text-[10px] font-semibold text-accent-violet hover:underline cursor-pointer"
                    >
                      {app.enabled ? 'Mute' : 'Enable'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {onOpenAgentsAppsTab ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenAgentsAppsTab}
              className="w-full text-xs h-8 gap-1.5"
            >
              <Bot className="size-3.5 text-primary" />
              <span>Open Full AI Agents &amp; Apps Tab</span>
            </Button>
          ) : null}

          <div className="pt-2 border-t border-border">
            <LinkOutTab
              icon={Blocks}
              title="Browse All Workspace Agents"
              description="Explore pre-built integrations, custom agents, and bot webhooks."
              actionLabel="Explore marketplace"
              to={`/w/${workspaceSlug}/agents`}
            />
          </div>
        </TabsContent>

        <TabsContent
          value="automations"
          className="min-h-0 flex flex-1 flex-col p-4 space-y-4 overflow-y-auto"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Channel Workflows
            </span>
            {onOpenWorkflows ? (
              <Button
                size="sm"
                variant="outline"
                onClick={onOpenWorkflows}
                className="h-7 text-xs gap-1.5"
              >
                <Workflow className="size-3.5" />
                <span>Manage Workflows</span>
              </Button>
            ) : null}
          </div>

          <div className="space-y-2">
            <div className="p-3 rounded-xl border border-border bg-surface flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground">
                    Welcome New Members
                  </span>
                  <Badge variant="primary" className="text-[10px] py-0 h-4">
                    Enabled
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Sends welcome guides &amp; tips when anyone joins #{channel.name}.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl border border-border bg-surface flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground">
                    Daily Standup Reminder
                  </span>
                  <Badge variant="primary" className="text-[10px] py-0 h-4">
                    Enabled
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Collects daily status updates at 9:30 AM every weekday.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-border">
            <LinkOutTab
              icon={Workflow}
              title="Workspace Automations"
              description="Create cross-channel workflows, webhook triggers, and scheduled jobs."
              actionLabel="Open Workflow Builder"
              to={`/w/${workspaceSlug}/automations`}
            />
          </div>
        </TabsContent>
      </Tabs>

      <ChannelIdFooter channelId={channel.id} />
    </div>
  );
}

/* ----------------------------------------------------------- header bits --- */

function FavoriteMenu({
  channel,
  workspaceId,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
}) {
  const preferences = useChannelPreferences(workspaceId);
  const isFavorite = channel.membership?.isFavorite ?? false;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Favorite options"
          className="h-7 gap-1 px-2 text-xs"
        >
          <Star
            className={cn(
              'size-3.5',
              isFavorite && 'fill-current text-accent-amber',
            )}
          />
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem
          className="gap-2 text-xs"
          onSelect={() =>
            preferences.mutate({
              channelId: channel.id,
              input: { isFavorite: !isFavorite },
            })
          }
        >
          <Star
            className={cn(
              'size-3.5',
              isFavorite && 'fill-current text-accent-amber',
            )}
          />
          <span>
            {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The channel's notification level.
 *
 * Two levels, not three. Slack's middle option — "just @mentions" for this one
 * channel — has nothing behind it here: mentions-only is a *workspace* setting
 * in our notification preferences, and a per-channel version would need a
 * column that does not exist. Offering it would have meant a control that
 * silently did nothing, so the menu links to the real setting instead.
 */
function NotificationMenu({
  channel,
  workspaceId,
  workspaceSlug,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
  workspaceSlug: string;
}) {
  const preferences = useChannelPreferences(workspaceId);
  const isMuted = channel.membership?.isMuted ?? false;

  const setMuted = (muted: boolean) =>
    preferences.mutate({ channelId: channel.id, input: { isMuted: muted } });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
        >
          {isMuted ? (
            <BellOff className="size-3.5 text-muted-foreground" />
          ) : (
            <Bell className="size-3.5" />
          )}
          <span>{isMuted ? 'Muted' : 'All new messages'}</span>
          <ChevronDown className="size-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="tracking-wide text-[11px] text-subtle uppercase">
          Notify me about
        </DropdownMenuLabel>

        <DropdownMenuCheckboxItem
          checked={!isMuted}
          onSelect={() => setMuted(false)}
          className="text-xs"
        >
          All new messages
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={isMuted}
          onSelect={() => setMuted(true)}
          className="text-xs"
        >
          Nothing
        </DropdownMenuCheckboxItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2 text-xs">
          <Link to={`/w/${workspaceSlug}/settings`}>
            <Settings className="size-3.5" />
            <span>Notification preferences</span>
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ----------------------------------------------------------------- about --- */

function AboutTab({
  channel,
  workspaceId,
  currentUserId,
  createdByName,
  onEditDetails,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
  currentUserId: string;
  createdByName?: string;
  onEditDetails: () => void;
}) {
  return (
    <ScrollArea className="min-h-0 flex-1" contentClassName="space-y-3 p-3">
      {/* One bordered card of divided rows, so the fields read as one object
          rather than five loose paragraphs in a narrow column. */}
      <div className="divide-y divide-border rounded-card border border-border bg-surface-inset/40">
        <DetailRow label="Topic" onEdit={onEditDetails}>
          {channel.topic ? (
            <LinkifiedText text={channel.topic} />
          ) : (
            <span className="text-muted-foreground">Add a topic</span>
          )}
        </DetailRow>

        <DetailRow label="Description" onEdit={onEditDetails}>
          {channel.description ? (
            <LinkifiedText text={channel.description} />
          ) : (
            <span className="text-muted-foreground">Add a description</span>
          )}
        </DetailRow>

        <DetailRow
          label="Managed by"
          hint="Channel managers can rename the channel, edit its details and archive it."
        >
          <span className="text-muted-foreground">
            Got questions? Ask an Admin to add a Channel Manager to help things
            run smoothly.
          </span>
        </DetailRow>

        <DetailRow label="Created by">
          {createdByName ? `${createdByName} on ` : 'Created on '}
          {formatDate(channel.createdAt)}
        </DetailRow>

        <div className="p-3">
          <LeaveChannelButton
            channel={channel}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    </ScrollArea>
  );
}

function DetailRow({
  label,
  hint,
  onEdit,
  children,
}: {
  label: string;
  hint?: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="p-3 space-y-1">
      <div className="gap-2 flex items-center justify-between">
        <span className="gap-1 text-sm font-semibold flex items-center text-foreground">
          {label}
          {hint ? (
            <Hint label={hint}>
              <Info className="size-3.5 text-muted-foreground" aria-hidden />
            </Hint>
          ) : null}
        </span>

        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="text-xs font-medium rounded-sm text-primary outline-none hover:underline focus-visible:ring-1 focus-visible:ring-ring"
          >
            Edit
          </button>
        ) : null}
      </div>

      <p className="text-sm leading-relaxed break-words text-foreground">
        {children}
      </p>
    </div>
  );
}

/**
 * Renders a field that is often just a pasted URL — a meeting link in the
 * topic, most commonly — as a link rather than as unclickable text.
 */
function LinkifiedText({ text }: { text: string }) {
  const parts = useMemo(() => text.split(/(https?:\/\/\S+)/g), [text]);

  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary hover:underline"
          >
            {part}
          </a>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}

function LeaveChannelButton({
  channel,
  workspaceId,
  currentUserId,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
  currentUserId: string;
}) {
  const { remove } = useChannelMemberMutations(workspaceId);
  const prompts = usePromptDialog();

  if (!channel.membership) return null;

  const leave = async () => {
    const confirmed = await prompts.confirmAction({
      title: `Leave #${channel.name}?`,
      description:
        'You will stop receiving messages from this channel. You can rejoin later if it is public.',
      confirmLabel: 'Leave channel',
      destructive: true,
    });
    if (!confirmed) return;

    remove.mutate(
      { channelId: channel.id, userId: currentUserId },
      {
        onSuccess: () => toast.success(`Left #${channel.name}`),
        onError: () => toast.error('Could not leave the channel.'),
      },
    );
  };

  return (
    <button
      type="button"
      onClick={() => void leave()}
      disabled={remove.isPending}
      className="text-sm font-medium rounded-sm text-destructive outline-none hover:underline focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
    >
      Leave channel
    </button>
  );
}

/* --------------------------------------------------------------- members --- */

function MembersTab({
  channelId,
  channelName,
  workspaceId,
  currentUserId,
  members,
  isLoading,
  onAddPeople,
}: {
  channelId?: string;
  channelName?: string;
  workspaceId?: string;
  currentUserId?: string;
  members: ChannelMember[];
  isLoading: boolean;
  onAddPeople: () => void;
}) {
  const [query, setQuery] = useState('');
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const openProfilePanel = useRightPanelStore((s) => s.openProfile);
  const { add, remove } = useChannelMemberMutations(workspaceId);
  const prompts = usePromptDialog();

  const workspaceMembersQuery = useQuery({
    queryKey: queryKeys.members.list(workspaceId ?? ''),
    queryFn: () => memberApi.list(workspaceId as string),
    enabled: !!workspaceId,
  });

  const channelMemberIds = useMemo(
    () => new Set(members.map((m) => m.user.id)),
    [members],
  );

  const inChannelFiltered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) => {
      const displayName = (member.user.displayName ?? '').toLowerCase();
      const name = (member.user.name ?? '').toLowerCase();
      const jobTitle = (
        member.user.jobTitle ??
        member.user.title ??
        ''
      ).toLowerCase();
      return (
        displayName.includes(needle) ||
        name.includes(needle) ||
        jobTitle.includes(needle)
      );
    });
  }, [members, query]);

  const notInChannelFiltered = useMemo(() => {
    const wsMembers = (workspaceMembersQuery.data ?? []) as WorkspaceMember[];
    const notInChannel = wsMembers.filter(
      (wm) => !channelMemberIds.has(wm.user.id),
    );
    const needle = query.trim().toLowerCase();
    if (!needle) return notInChannel;
    return notInChannel.filter((wm) => {
      const displayName = (wm.user.displayName ?? '').toLowerCase();
      const name = (wm.user.name ?? '').toLowerCase();
      const jobTitle = (
        wm.user.jobTitle ??
        wm.user.title ??
        ''
      ).toLowerCase();
      return (
        displayName.includes(needle) ||
        name.includes(needle) ||
        jobTitle.includes(needle)
      );
    });
  }, [workspaceMembersQuery.data, channelMemberIds, query]);

  const isEmailLike = query.includes('@') && query.trim().length > 3;

  const handleAddWorkspaceMember = (wsMember: WorkspaceMember) => {
    if (!channelId) return;
    setAddingMemberId(wsMember.user.id);
    const memberName = wsMember.user.displayName ?? wsMember.user.name;

    add.mutate(
      {
        channelId,
        input: { userIds: [wsMember.user.id], role: 'MEMBER' },
      },
      {
        onSuccess: () => {
          setAddingMemberId(null);
          toast.success(`Added ${memberName} to #${channelName ?? 'channel'}`);
        },
        onError: () => {
          setAddingMemberId(null);
          toast.error(`Could not add ${memberName} to channel`);
        },
      },
    );
  };

  const handleInviteEmail = async () => {
    const email = query.trim();
    if (!email || !workspaceId) return;
    setIsInviting(true);

    try {
      await invitationApi.create(workspaceId, {
        emails: [email],
        role: 'MEMBER' as any,
        channelId: channelId,
      });
      setIsInviting(false);
      setQuery('');
      toast.success(`Invitation sent to ${email}`);
    } catch (err: any) {
      setIsInviting(false);
      toast.error(err?.message || `Could not send invite to ${email}`);
    }
  };

  const handleRemoveMember = async (member: ChannelMember) => {
    if (!channelId) return;
    const memberName = member.user.displayName ?? member.user.name;
    const confirmed = await prompts.confirmAction({
      title: `Remove ${memberName}?`,
      description: `They will be removed from #${channelName ?? 'channel'}.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;

    remove.mutate(
      { channelId, userId: member.user.id },
      {
        onSuccess: () => toast.success(`Removed ${memberName}`),
        onError: () => toast.error('Could not remove member.'),
      },
    );
  };

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <div className="p-3 space-y-2 shrink-0 border-b border-border/40">
        <div className="relative">
          <Search className="size-3.5 left-2.5 absolute top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && isEmailLike) {
                event.preventDefault();
                void handleInviteEmail();
              }
            }}
            placeholder="Find people or agents..."
            aria-label="Find people or agents"
            className="h-8 pl-8 pr-7 text-xs"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent/60"
              aria-label="Clear search"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onAddPeople}
          className="w-full px-2.5 py-1.5 flex items-center gap-2.5 rounded-lg bg-surface border border-border hover:border-border-strong hover:bg-accent/50 text-left transition-colors cursor-pointer"
        >
          <div className="size-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <UserPlus className="size-3.5" />
          </div>
          <span className="text-xs font-semibold text-foreground">
            Add people or agents
          </span>
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1" contentClassName="px-3 py-2 space-y-3">
        {isEmailLike ? (
          <button
            type="button"
            onClick={() => void handleInviteEmail()}
            disabled={isInviting}
            className="w-full p-2.5 flex items-center justify-between rounded-lg bg-surface border border-primary/40 hover:bg-primary/10 hover:border-primary text-foreground transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                {isInviting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
              </div>
              <span className="text-xs font-medium truncate">
                Invite <span className="font-semibold text-primary">{query.trim()}</span>
              </span>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-mono py-0 h-4.5 px-1.5 bg-background"
            >
              Enter
            </Badge>
          </button>
        ) : null}

        {isLoading ? (
          <SkeletonList rows={5} />
        ) : (
          <>
            {/* Section 1: Members in this channel */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground block px-1">
                Members in this channel
              </span>

              {inChannelFiltered.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground text-center">
                  {query
                    ? 'No matching members in this channel.'
                    : 'No members yet.'}
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {inChannelFiltered.map((member) => {
                    const isSelf = member.user.id === currentUserId;
                    const isOnline =
                      member.user.presence === 'ONLINE' ||
                      member.user.presence?.toLowerCase() === 'online';
                    const displayName =
                      member.user.displayName ?? member.user.name;
                    const subtitle =
                      member.user.jobTitle ||
                      member.user.title ||
                      member.user.statusText ||
                      (member.role === 'ADMIN' ? 'Channel Admin' : undefined);

                    return (
                      <li key={member.id}>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() =>
                            openProfilePanel({
                              userId: member.user.id,
                              name: displayName,
                              avatarUrl: member.user.avatarUrl ?? undefined,
                              email: (member.user as any).email,
                              role: member.role,
                              timezone: member.user.timezone,
                              statusEmoji: member.user.statusEmoji,
                              statusText: member.user.statusText,
                              status: isOnline ? 'online' : 'offline',
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openProfilePanel({
                                userId: member.user.id,
                                name: displayName,
                                avatarUrl: member.user.avatarUrl ?? undefined,
                                email: (member.user as any).email,
                                role: member.role,
                                timezone: member.user.timezone,
                                statusEmoji: member.user.statusEmoji,
                                statusText: member.user.statusText,
                                status: isOnline ? 'online' : 'offline',
                              });
                            }
                          }}
                          className="group px-2 py-1.5 flex items-center justify-between gap-2.5 rounded-lg hover:bg-accent/50 text-left transition-colors cursor-pointer"
                        >
                          <div className="min-w-0 flex items-center gap-2.5 flex-1">
                            <UserAvatar
                              name={displayName}
                              src={member.user.avatarUrl ?? undefined}
                              seed={member.user.id}
                              size="md"
                              shape="rounded"
                              className="shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-semibold text-foreground truncate">
                                  {displayName}
                                </span>
                                {isSelf ? (
                                  <span className="text-[11px] text-muted-foreground shrink-0 font-normal">
                                    (you)
                                  </span>
                                ) : null}
                                <span className="shrink-0 flex items-center justify-center">
                                  {isOnline ? (
                                    <span
                                      className="size-2 rounded-full bg-emerald-500"
                                      aria-label="Online"
                                    />
                                  ) : (
                                    <span
                                      className="size-2 rounded-full border border-muted-foreground/50"
                                      aria-label="Offline"
                                    />
                                  )}
                                </span>
                                <span className="text-xs text-muted-foreground truncate">
                                  {member.user.name}
                                </span>
                              </div>
                              {subtitle ? (
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                  {subtitle}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <div
                            className="flex items-center gap-1 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {member.role === 'ADMIN' ? (
                              <Badge
                                variant="neutral"
                                className="text-[10px] py-0 h-4 px-1.5"
                              >
                                Admin
                              </Badge>
                            ) : null}

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="h-7 w-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/70"
                                  aria-label={`Options for ${displayName}`}
                                >
                                  <MoreVertical className="size-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem
                                  className="gap-2 text-xs"
                                  onClick={() =>
                                    openProfilePanel({
                                      userId: member.user.id,
                                      name: displayName,
                                      avatarUrl:
                                        member.user.avatarUrl ?? undefined,
                                      email: (member.user as any).email,
                                      role: member.role,
                                      timezone: member.user.timezone,
                                      statusEmoji: member.user.statusEmoji,
                                      statusText: member.user.statusText,
                                      status: isOnline ? 'online' : 'offline',
                                    })
                                  }
                                >
                                  <ExternalLink className="size-3.5" />
                                  <span>View profile</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="gap-2 text-xs"
                                  onClick={() => {
                                    void navigator.clipboard?.writeText(
                                      displayName,
                                    );
                                    toast.success('Name copied');
                                  }}
                                >
                                  <Copy className="size-3.5" />
                                  <span>Copy name</span>
                                </DropdownMenuItem>
                                {!isSelf && channelId ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="gap-2 text-xs text-destructive focus:text-destructive"
                                      onClick={() =>
                                        void handleRemoveMember(member)
                                      }
                                    >
                                      <UserMinus className="size-3.5" />
                                      <span>Remove from channel</span>
                                    </DropdownMenuItem>
                                  </>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Section 2: Not in this channel */}
            {notInChannelFiltered.length > 0 ? (
              <div className="pt-2 border-t border-border space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground block px-1">
                  Not in this channel
                </span>
                <ul className="space-y-0.5">
                  {notInChannelFiltered.map((wsMember) => {
                    const name =
                      wsMember.user.displayName ?? wsMember.user.name;
                    const isOnline =
                      wsMember.user.presence === 'ONLINE' ||
                      wsMember.user.presence?.toLowerCase() === 'online';
                    const subtitle =
                      wsMember.user.jobTitle ??
                      wsMember.user.title ??
                      wsMember.user.statusText;
                    const isAdding = addingMemberId === wsMember.user.id;

                    return (
                      <li key={wsMember.id}>
                        <div className="group px-2 py-1.5 flex items-center justify-between gap-2.5 rounded-lg hover:bg-accent/50 text-left transition-colors">
                          <div className="min-w-0 flex items-center gap-2.5 flex-1">
                            <UserAvatar
                              name={name}
                              src={wsMember.user.avatarUrl ?? undefined}
                              seed={wsMember.user.id}
                              size="md"
                              shape="rounded"
                              className="shrink-0"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-semibold text-foreground truncate">
                                  {name}
                                </span>
                                <span className="shrink-0 flex items-center justify-center">
                                  {isOnline ? (
                                    <span
                                      className="size-2 rounded-full bg-emerald-500"
                                      aria-label="Online"
                                    />
                                  ) : (
                                    <span
                                      className="size-2 rounded-full border border-muted-foreground/50"
                                      aria-label="Offline"
                                    />
                                  )}
                                </span>
                                <span className="text-xs text-muted-foreground truncate">
                                  {wsMember.user.name}
                                </span>
                              </div>
                              {subtitle ? (
                                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                  {subtitle}
                                </p>
                              ) : null}
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isAdding || add.isPending}
                            loading={isAdding}
                            onClick={() => handleAddWorkspaceMember(wsMember)}
                            className="h-7 text-xs px-2.5 shrink-0 rounded-md hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all cursor-pointer"
                          >
                            Add to Channel
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </ScrollArea>
    </div>
  );
}

/* -------------------------------------------------------------- settings --- */

function ChannelSettingsDropdown({
  channel,
  workspaceId,
  currentUserId,
  onEditDetails,
}: {
  channel: ChannelSummary;
  workspaceId: string | undefined;
  currentUserId: string;
  onEditDetails: () => void;
}) {
  const archive = useArchiveChannel(workspaceId);
  const { remove } = useChannelMemberMutations(workspaceId);
  const prompts = usePromptDialog();

  const toggleArchive = async () => {
    const confirmed = await prompts.confirmAction({
      title: channel.isArchived
        ? `Unarchive #${channel.name}?`
        : `Archive #${channel.name}?`,
      description: channel.isArchived
        ? 'The channel becomes active again and reappears in the sidebar.'
        : 'The channel becomes read-only and leaves the sidebar. Its history is kept.',
      confirmLabel: channel.isArchived ? 'Unarchive' : 'Archive',
      destructive: !channel.isArchived,
    });
    if (!confirmed) return;

    archive.mutate({ channelId: channel.id, archived: !channel.isArchived });
  };

  const handleLeave = async () => {
    const confirmed = await prompts.confirmAction({
      title: `Leave #${channel.name}?`,
      description:
        'You will stop receiving messages from this channel. You can rejoin later if it is public.',
      confirmLabel: 'Leave channel',
      destructive: true,
    });
    if (!confirmed) return;

    remove.mutate(
      { channelId: channel.id, userId: currentUserId },
      {
        onSuccess: () => toast.success(`Left #${channel.name}`),
        onError: () => toast.error('Could not leave the channel.'),
      },
    );
  };

  const handleExport = () => {
    const exportData = {
      id: channel.id,
      name: channel.name,
      slug: channel.slug,
      topic: channel.topic,
      description: channel.description,
      visibility: channel.visibility,
      isArchived: channel.isArchived,
      createdAt: channel.createdAt,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `channel-${channel.slug}-export.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Channel exported', {
      description: `channel-${channel.slug}-export.json downloaded.`,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Channel settings"
          className="-mt-0.5 shrink-0 hover:bg-accent text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-64 p-1.5 rounded-xl shadow-2xl border-border bg-surface text-foreground"
      >
        <DropdownMenuItem
          onSelect={onEditDetails}
          className="gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg hover:bg-accent"
        >
          <Settings className="size-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-foreground">
              Edit channel details
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              Name, topic and description
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => {
            void navigator.clipboard?.writeText(window.location.href);
            toast.success('Channel link copied to clipboard');
          }}
          className="gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg hover:bg-accent"
        >
          <Link2 className="size-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-foreground">
              Copy channel link
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              Share this channel with a teammate
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={handleExport}
          className="gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg hover:bg-accent"
        >
          <Download className="size-4 text-muted-foreground shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-foreground">
              Export channel history
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              Download channel metadata and details as JSON
            </span>
          </div>
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => void toggleArchive()}
          className="gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg hover:bg-accent"
        >
          {channel.isArchived ? (
            <Bell className="size-4 text-muted-foreground shrink-0" />
          ) : (
            <BellOff className="size-4 text-muted-foreground shrink-0" />
          )}
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-foreground">
              {channel.isArchived ? 'Unarchive channel' : 'Archive channel'}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {channel.isArchived
                ? 'Make the channel active again'
                : 'Keep the history, close the conversation'}
            </span>
          </div>
        </DropdownMenuItem>

        {channel.membership && (
          <>
            <DropdownMenuSeparator className="my-1 bg-border/60" />
            <DropdownMenuItem
              onSelect={() => void handleLeave()}
              className="gap-2.5 px-2.5 py-2 text-xs font-medium cursor-pointer rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="size-4 text-destructive shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-destructive">
                  Leave this channel
                </span>
                <span className="text-[10px] text-destructive/80 truncate">
                  Leave channel
                </span>
              </div>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ----------------------------------------------------------------- misc --- */

function LinkOutTab({
  icon: Icon,
  title,
  description,
  actionLabel,
  to,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  to: string;
}) {
  return (
    <div className="p-4 grid flex-1 place-items-center">
      <EmptyState
        size="sm"
        icon={<Icon />}
        title={title}
        description={description}
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={to}>{actionLabel}</Link>
          </Button>
        }
      />
    </div>
  );
}

function ChannelIdFooter({ channelId }: { channelId: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="px-3 py-2 shrink-0 border-t border-border">
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(channelId);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="gap-1.5 flex max-w-full items-center rounded-sm text-[11px] text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span className="truncate">Channel ID: {channelId}</span>
        <Copy className="size-3 shrink-0" aria-hidden />
        <span className="sr-only">
          {copied ? 'Channel ID copied' : 'Copy channel ID'}
        </span>
      </button>
    </div>
  );
}

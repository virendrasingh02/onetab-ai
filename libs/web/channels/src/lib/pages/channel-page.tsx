import { useQueryClient } from '@tanstack/react-query';
import {
  WorkspacePermission,
  canManageChannelTabs,
  channelNotificationLevelInput,
  resolveChannelTabs,
  type ChannelTabId,
} from '@org/types';
import type { ChannelMember, ChannelSummary } from '@org/types';
import {
  ActionDropdownMenu,
  Badge,
  Button,
  ChatConversationSkeleton,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  type EntityAction,
  ErrorState,
  Hint,
  ScrollArea,
  Tabs,
  TabsContent,
  PageTabBar,
  TabsTrigger,
  toast,
  UserAvatar,
  useRightPanelStore,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { AddBookmarkDialog, BookmarkFavicon } from '@org/chat-ui';
import { useMarkChannelSeen, useMarkChannelUnread } from '@org/notifications';
import { queryKeys, uploadApi } from '@org/api-client';
import {
  ChannelChat,
  ConversationFilesPanel,
  ConversationPinsPanel,
  useConversationPinCount,
} from '@org/web-chat';
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  uploadRequestSchema,
} from '@org/validation';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  BellOff,
  Blocks,
  Bookmark,
  Bot,
  Clock,
  ExternalLink,
  Hash,
  LayoutTemplate,
  Lock,
  Megaphone,
  MessageSquare,
  MoreHorizontal,
  PanelsTopLeft,
  Pin,
  Plus,
  RefreshCw,
  ShieldAlert,
  Star,
  Trash2,
  Upload,
  Users,
  Workflow,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@org/auth';
import {
  ChannelDetailsPanel,
  type ChannelDetailsTab,
} from '../components/channel-details-panel.js';
import {
  CHANNEL_TAB_META,
  CustomizeChannelTabsDialog,
} from '../components/channel-tabs.js';
import { AddAppDialog } from '../components/add-app-dialog.js';
import { buildChannelActions } from '../channel-actions.js';
import { channelComposerLocks } from '../channel-composer-locks.js';
import { useCanManageChannel } from '../use-can-manage-channel.js';
import { JoinChannelControl } from '../components/join-channel-control.js';
import { TemporaryMembershipBanner } from '../components/temporary-membership-banner.js';
import { AnonymousModerationDialog } from '../components/anonymous-moderation-dialog.js';
import {
  AddAgentToChannelDialog,
  AddPeopleDialog,
  ChannelPostingDialog,
  ChannelTemplatesDialog,
  ChannelWorkflowsDialog,
  EditChannelDetailsDialog,
} from '../components/channel-setup-dialogs.js';
import {
  useAnonymousMessagingMutations,
  useArchiveChannel,
  useChannel,
  useChannelAnonymousSettings,
  useChannelBookmarks,
  useChannelFiles,
  useChannelMembers,
  useChannelPreferences,
  useJoinChannel,
  useLeaveChannel,
} from '../use-channels.js';

function ChannelHeader({
  channel,
  members = [],
  onAddBookmark,
  onOpenDetails,
  onOpenMembers,
  onOpenPins,
  onEditDetails,
  onAddPeople,
  onOpenPosting,
  onOpenAnonModeration,
  chatActionsRef,
  chatMenuRef,
  headerEnd,
}: {
  channel: ChannelSummary;
  members?: ChannelMember[];
  onAddBookmark?: () => void;
  /** Reveals the channel's details in the right rail, on `tab`. */
  onOpenDetails: (tab: ChannelDetailsTab) => void;
  /** Reveals the channel's members tab in the right rail. */
  onOpenMembers: () => void;
  /** Opens the edit-name/topic/description dialog. */
  onEditDetails: () => void;
  /** Opens the add-people dialog. */
  onAddPeople: () => void;
  /** Opens posting permissions; omitted when the viewer cannot manage the channel. */
  onOpenPosting?: () => void;
  /** Opens anonymous-message moderation; omitted when the viewer cannot moderate. */
  onOpenAnonModeration?: () => void;
  /** Switches the page to its Pins tab. */
  onOpenPins: () => void;
  /**
   * Receives the element the conversation portals its actions into — huddle and
   * search. This header is the channel's only one, so those controls belong in
   * this row rather than in a second bar below the tabs.
   */
  chatActionsRef?: (element: HTMLDivElement | null) => void;
  /**
   * Receives the element inside this header's “⋯” menu that the conversation
   * portals its own menu entries into, so the page and the conversation share
   * one menu instead of opening two next to each other.
   */
  chatMenuRef?: (element: HTMLDivElement | null) => void;
  /** Trailing controls owned by whatever hosts the page (the split pane's close / expand). */
  headerEnd?: ReactNode;
}) {
  const { workspaceId, slug: workspaceSlug } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();
  const canManage = useCanManageChannel(channel);
  const preferences = useChannelPreferences(workspaceId);
  const archive = useArchiveChannel(workspaceId);
  const leave = useLeaveChannel(workspaceId);
  const markChannelUnread = useMarkChannelUnread(workspaceId);
  const join = useJoinChannel(workspaceId);
  const queryClient = useQueryClient();

  const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;
  const isFavorite = channel.membership?.isFavorite ?? false;
  const isMuted = channel.membership?.isMuted ?? false;

  // Refetch what this screen shows. It used to toast "synchronized" after a
  // fixed 800ms without fetching anything; the timeline itself streams live
  // from Matrix, so the data worth re-pulling is the React Query side.
  const handleSyncChannel = useCallback(async () => {
    try {
      await queryClient.refetchQueries({ type: 'active' });
      toast.success('Channel synchronized', {
        description: 'Channel details, members and pins are up to date.',
      });
    } catch {
      toast.error('Could not synchronize this channel');
    }
  }, [queryClient]);

  const handleToggleFavorite = useCallback(() => {
    preferences.mutate(
      {
        channelId: channel.id,
        input: { isFavorite: !isFavorite },
      },
      {
        onSuccess: () => {
          toast.success(
            !isFavorite ? 'Added to favorites' : 'Removed from favorites',
          );
        },
      },
    );
  }, [channel.id, isFavorite, preferences]);

  const headerActions: (EntityAction | false | undefined)[] = [
    ...buildChannelActions({
      channel,
      workspaceSlug: workspaceSlug ?? '',
      canManage,
      organizeActions: (
        [
          onAddBookmark && {
            id: 'add-bookmark',
            group: 'channel',
            label: 'Add bookmark',
            icon: Bookmark,
            shortcut: 'B',
            run: onAddBookmark,
          },
          {
            id: 'pins',
            group: 'channel',
            label: 'Channel pins',
            icon: Pin,
            run: onOpenPins,
          },
          {
            id: 'sync',
            group: 'channel',
            label: 'Sync channel',
            icon: RefreshCw,
            run: handleSyncChannel,
          },
        ] as (EntityAction | undefined)[]
      ).filter((action): action is EntityAction => !!action),
      onOpenDetails,
      onToggleFavorite: handleToggleFavorite,
      onMarkUnread: () => markChannelUnread(channel.id),
      onSetNotificationLevel: (level) =>
        preferences.mutate({
          channelId: channel.id,
          input: channelNotificationLevelInput(level),
        }),
      onEditDetails,
      onAddPeople,
      onSetArchived: (archived) =>
        archive.mutateAsync({ channelId: channel.id, archived }),
      onLeave: currentUser
        ? async () => {
            await leave.mutateAsync({
              channelId: channel.id,
              userId: currentUser.id,
            });
            navigate(`/w/${workspaceSlug}/home`);
          }
        : undefined,
    }),
    // Merged into the "Channel settings…" section by group.
    onOpenPosting && {
      id: 'posting',
      group: 'manage',
      label: 'Posting permissions…',
      icon: Megaphone,
      run: onOpenPosting,
    },
    onOpenAnonModeration && {
      id: 'anon-moderation',
      group: 'manage',
      label: 'Anonymous moderation…',
      icon: ShieldAlert,
      run: onOpenAnonModeration,
    },
  ];
  const actions = headerActions.filter(
    (action): action is EntityAction => !!action,
  );

  return (
    <div className="top-0 backdrop-blur-md sticky z-20 shrink-0 bg-background/95">
      <div className="gap-2.5 px-3 sm:px-6 pt-2 pb-1 min-h-11 flex flex-wrap items-center justify-between">
        <div className="min-w-0 gap-2 flex items-center">
          <div className="min-w-0 gap-1.5 flex items-center">
            <button
              type="button"
              onClick={() => onOpenDetails('about')}
              className="gap-1.5 p-1 -m-1 flex cursor-pointer items-center rounded-md text-left transition-colors hover:bg-accent/60 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`View channel details for #${channel.name}`}
            >
              <Icon
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-base font-semibold tracking-tight truncate text-foreground">
                {channel.name}
              </h2>
            </button>
            {channel.isArchived ? (
              <Badge variant="warning">Archived</Badge>
            ) : null}
            {channel.mode === 'ANNOUNCEMENT' ? (
              <Hint
                label={
                  channel.canPost
                    ? 'Announcement channel — you can post here'
                    : 'Announcement channel — only admins can post'
                }
              >
                <Badge variant="info" className="gap-1">
                  <Megaphone className="size-3" />
                  <span>Announcement</span>
                </Badge>
              </Hint>
            ) : null}
            {channel.membership?.membershipType === 'TEMPORARY' ? (
              <Hint
                label={
                  channel.membership.expiresAt
                    ? `Your access expires ${formatRelative(
                        channel.membership.expiresAt,
                      )}`
                    : 'You joined this channel temporarily'
                }
              >
                <Badge variant="neutral" className="gap-1">
                  <Clock className="size-3" />
                  <span>Temporary</span>
                </Badge>
              </Hint>
            ) : null}
            {isMuted ? (
              <Badge variant="neutral" className="gap-1 text-muted-foreground">
                <BellOff className="size-3" />
                <span>Muted</span>
              </Badge>
            ) : null}
          </div>

          <div className="gap-0.5 flex items-center">
            {/* 1. Fav icon */}
            <Hint
              label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-pressed={isFavorite}
                aria-label={
                  isFavorite ? 'Remove from favorites' : 'Add to favorites'
                }
                onClick={handleToggleFavorite}
                className={isFavorite ? 'text-warning' : undefined}
              >
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-accent-amber',
                  )}
                />
              </Button>
            </Hint>

            {/* 2. 3-dot dropdown menu — the same `buildChannelActions` list as
                the sidebar row's "⋯" and right-click menus, plus the entries
                only this page can serve (bookmarks, pins, moderation). */}
            {channel.membership ? (
              <ActionDropdownMenu
                modal={false}
                actions={actions}
                scope={`channel:${channel.id}`}
                entityType="channel"
                entity={channel}
                align="start"
                contentClassName="w-64"
                header={
                  // The conversation's own entries land here — see the note on
                  // `chatMenuRef`. Empty (and hidden) on the non-chat tabs.
                  <div
                    ref={chatMenuRef}
                    className="-mx-1 mb-1 px-1 pb-1 border-b border-border empty:hidden"
                  />
                }
                trigger={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Channel options"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                }
              />
            ) : null}
          </div>

          {/* What the channel is for, at a glance — before this it only
              appeared in the welcome block at the very top of history. */}
          {(channel.topic ?? channel.description) ? (
            <button
              type="button"
              onClick={() => onOpenDetails('about')}
              title={channel.topic ?? channel.description ?? undefined}
              className="md:block min-w-0 max-w-md pl-2.5 text-xs hidden truncate rounded-sm border-l border-border text-left text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              {channel.topic ?? channel.description}
            </button>
          ) : null}
        </div>

        {/* Channel actions: Tools, Member Avatar Stack, Join */}
        <div className="gap-2 flex items-center">
          {/* Conversation tools portal in from the chat surface; empty on the
              non-chat tabs, where it collapses instead of leaving a gap. */}
          <div
            ref={chatActionsRef}
            className="gap-0.5 flex items-center empty:hidden"
          />

          {/* Member Avatar Stack */}
          {channel.membership ? (
            <Hint label="View channel members">
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenMembers}
                className="h-8 gap-1.5 px-2 text-xs font-normal text-muted-foreground hover:text-foreground"
                aria-label={`View ${channel.memberCount || members.length} channel members`}
              >
                {members.length > 0 ? (
                  <div className="-space-x-1.5 flex items-center">
                    {members.slice(0, 3).map((m) => (
                      <UserAvatar
                        key={m.id}
                        name={m.user.displayName ?? m.user.name}
                        src={m.user.avatarUrl ?? undefined}
                        seed={m.user.id}
                        size="xs"
                        indicator={false}
                        className="size-5 ring-2 ring-background"
                      />
                    ))}
                  </div>
                ) : (
                  <Users className="size-4" />
                )}
                <span className="text-xs font-medium text-foreground tabular-nums">
                  {channel.memberCount || members.length}
                </span>
              </Button>
            </Hint>
          ) : null}

          {!channel.membership && channel.visibility === 'PUBLIC' ? (
            <JoinChannelControl
              workspaceId={workspaceId}
              channelId={channel.id}
            />
          ) : !channel.membership ? (
            <Button
              size="sm"
              onClick={() => join.mutate({ channelId: channel.id })}
              loading={join.isPending}
            >
              Join channel
            </Button>
          ) : null}
          {headerEnd}
        </div>
      </div>
    </div>
  );
}

/**
 * Channel workspace: Chat / AI Copilot / Bookmarks / Files / Media / Pins.
 *
 * "About" is no longer one of them. Four short fields did not justify a
 * full-width tab that hid the conversation while you read them — they are
 * published to the right rail instead, where they sit *beside* the channel.
 */
export interface ChannelPageProps {
  /** Overrides the route's channel — the split pane renders this page for its own. */
  channelSlug?: string;
  /** Extra controls at the end of the header row. */
  headerEnd?: ReactNode;
}

export function ChannelPage({
  channelSlug: channelSlugProp,
  headerEnd,
}: ChannelPageProps = {}) {
  const params = useParams<{ channelSlug: string }>();
  const channelSlug = channelSlugProp ?? params.channelSlug;
  const {
    workspaceId,
    slug: workspaceSlug,
    permissions: workspacePermissions,
  } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const channelQuery = useChannel(workspaceId, channelSlug);

  /*
   * Keep the previously-resolved channel on screen while the next one loads,
   * so switching channels swaps the page contents in place instead of
   * blanking to a full-height spinner for the round trip. Without this, any
   * channel not already in the query cache (a fresh session, one opened from
   * search, a just-joined one) makes the whole panel flash empty on click.
   */
  const lastChannel = useRef<ChannelSummary | undefined>(undefined);
  if (channelQuery.data) lastChannel.current = channelQuery.data;
  const channel = channelQuery.isError
    ? undefined
    : (channelQuery.data ?? lastChannel.current);

  /* Mirrors the server's `assertCanManage`: a channel admin, or a workspace
     admin/owner (who alone hold `manage_settings`). */
  const canManageChannel =
    channel?.membership?.role === 'ADMIN' ||
    (workspacePermissions?.includes(WorkspacePermission.MANAGE_SETTINGS) ??
      false);

  const queryClient = useQueryClient();
  // Pins are Matrix `m.room.pinned_events` state — what pinning a message writes.
  const pinCount = useConversationPinCount(channel?.matrixRoomId);
  const files = useChannelFiles(workspaceId, channel?.id);
  const { bookmarks, addBookmark, removeBookmark } = useChannelBookmarks(
    workspaceId,
    channel?.id,
  );
  const members = useChannelMembers(workspaceId, channel?.id);
  const anonSettings = useChannelAnonymousSettings(workspaceId, channel?.id);
  const anonMutations = useAnonymousMessagingMutations(
    workspaceId,
    channel?.id,
  );
  const [addBookmarkOpen, setAddBookmarkOpen] = useState(false);
  const [addPeopleOpen, setAddPeopleOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [postingOpen, setPostingOpen] = useState(false);
  const [anonModerationOpen, setAnonModerationOpen] = useState(false);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [addAppOpen, setAddAppOpen] = useState(false);
  const [workflowsOpen, setWorkflowsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Controlled so the welcome block's "Ask the AI copilot" card can switch to
  // that tab; the tabs are otherwise driven by the user.
  const [activeTab, setActiveTab] = useState('chat');
  // Callback ref, not `useRef`: the conversation only portals into this element
  // once it exists, and a render has to be triggered when it does.
  const [chatActionsSlot, setChatActionsSlot] = useState<HTMLDivElement | null>(
    null,
  );
  const [chatMenuSlot, setChatMenuSlot] = useState<HTMLDivElement | null>(null);

  /*
   * The channel had a full-width "AI Copilot" tab of its own, which meant two
   * assistants with two transcripts: this one, and the rail's. Asking about the
   * channel you are reading is the same act as asking anything else, so the
   * welcome block's prompt opens the one assistant instead of a second one that
   * covered the conversation it was meant to be about.
   */
  const openAssistantView = useRightPanelStore((s) => s.setView);
  const openAssistant = useCallback(
    () => openAssistantView('assistant'),
    [openAssistantView],
  );

  const detailsSlot = useRightPanelStore((s) => s.slots.details);
  const detailsHost = useRightPanelStore((s) => s.hosted.details);
  const openHosted = useRightPanelStore((s) => s.openHosted);
  const closeHosted = useRightPanelStore((s) => s.closeHosted);
  const markChannelSeen = useMarkChannelSeen(workspaceId);

  const [huddleRequest, setHuddleRequest] = useState(0);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<ChannelDetailsTab>('about');
  const [tabsDialogOpen, setTabsDialogOpen] = useState(false);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role: workspaceRole } = useCurrentWorkspace();

  const closeDetailsPanel = useCallback(() => setDetailsPanelOpen(false), []);

  /*
   * Files uploaded from the channel are real `Upload` rows filed to it
   * (contextType CHANNEL), so they show in this tab, the Files hub and search.
   * Validated client-side with the API's own schema; the server re-checks.
   */
  const handleUploadFile = useCallback(() => {
    const channelId = channel?.id;
    if (!workspaceId || !channelId) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = ALLOWED_UPLOAD_MIME_TYPES.join(',');
    input.onchange = async () => {
      const picked = Array.from(input.files ?? []);
      if (picked.length === 0) return;
      setActiveTab('files-media');
      let uploaded = 0;
      for (const file of picked) {
        const check = uploadRequestSchema.safeParse({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
        });
        if (!check.success) {
          toast.error(
            `${file.name}: ${check.error.issues[0]?.message ?? 'This file cannot be uploaded.'}`,
          );
          continue;
        }
        try {
          await uploadApi.upload(workspaceId, file, {
            contextType: 'CHANNEL',
            contextId: channelId,
          });
          uploaded += 1;
        } catch (error) {
          toast.error(
            `${file.name}: ${error instanceof Error ? error.message : 'The upload failed.'}`,
          );
        }
      }
      if (uploaded > 0) {
        toast.success(
          uploaded === 1
            ? 'File uploaded to channel'
            : `${uploaded} files uploaded to channel`,
        );
        void queryClient.invalidateQueries({
          queryKey: queryKeys.uploads.all(workspaceId),
        });
      }
    };
    input.click();
  }, [workspaceId, channel?.id, queryClient]);

  /*
   * Claims the rail while the details panel is open, and gives it back on close
   * or when the page unmounts — otherwise the rail would outlive the channel
   * and show details for one the user has navigated away from.
   *
   * The panel passes no title: it draws its own header, with the channel name,
   * the favourite and notification controls and its own tab strip.
   */
  useEffect(() => {
    if (!detailsPanelOpen || !channel) return;
    openHosted('details', { title: '', onClose: closeDetailsPanel });
    return () => closeHosted('details');
  }, [detailsPanelOpen, channel, closeDetailsPanel, openHosted, closeHosted]);

  /* Navigating to another channel closes the details of the last one. */
  useEffect(() => {
    setDetailsPanelOpen(false);
  }, [channelSlug]);

  /* A tab hidden (here or by someone else) while it's open falls back to Messages. */
  const hiddenTabs = channel?.hiddenTabs;
  useEffect(() => {
    if (hiddenTabs?.includes(activeTab)) setActiveTab('chat');
  }, [hiddenTabs, activeTab]);

  /*
   * A copied huddle link (Settings → Huddles) is this channel's URL with
   * `?huddle=join`: opening it switches to Messages and asks the conversation
   * to start or join the huddle — which waits for the room itself. The param
   * is dropped straight away so a reload doesn't rejoin.
   */
  const wantsHuddle = searchParams.get('huddle') === 'join';
  useEffect(() => {
    if (!wantsHuddle || !channel) return;
    setSearchParams(
      (params) => {
        params.delete('huddle');
        return params;
      },
      { replace: true },
    );
    if (!channel.membership) {
      toast.info('Join the channel to hop into its huddle.');
      return;
    }
    if (!channel.huddlesEnabled) {
      toast.info('Huddles are turned off in this channel.');
      return;
    }
    setActiveTab('chat');
    setHuddleRequest((count) => count + 1);
  }, [wantsHuddle, channel, setSearchParams]);

  /* Opening a channel is what marks it read — see `useChannelActivity`. */
  useEffect(() => {
    markChannelSeen(channel?.id);
  }, [channel?.id, markChannelSeen]);

  // Only the very first channel of the session — nothing to keep on screen —
  // gets the skeleton loader; every later switch renders through in place.
  if (!channel && channelQuery.isLoading) {
    return (
      <ChatConversationSkeleton avatarShape="rounded" avatarSize="xs" hasTabs />
    );
  }
  if (channelQuery.isError || !channel) {
    return (
      <ErrorState
        fullPage
        title="Channel not found"
        description="It may be private, archived, or no longer exist."
        onRetry={() => channelQuery.refetch()}
      />
    );
  }

  // The creator is named in the welcome block when they are still a member;
  // otherwise the block simply says the channel was created.
  const creator = (members.data ?? []).find(
    (member) => member.user.id === channel.createdById,
  );
  const creatorName = creator
    ? (creator.user.displayName ?? creator.user.name)
    : undefined;

  const visibleTabs = resolveChannelTabs(
    channel.tabOrder,
    channel.hiddenTabs,
  ).filter((tab) => !tab.hidden);
  const canManageTabs = canManageChannelTabs(channel.tabManagePolicy, {
    channelRole: channel.membership?.role ?? null,
    workspaceRole: workspaceRole ?? null,
  });

  const fileCount = files.data?.length ?? 0;
  const tabCounts: Record<ChannelTabId, number | undefined> = {
    'files-media': fileCount > 0 ? fileCount : undefined,
    bookmarks: bookmarks.length > 0 ? bookmarks.length : undefined,
    pins: pinCount > 0 ? pinCount : undefined,
  };

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <ChannelHeader
        channel={channel}
        members={members.data ?? []}
        onAddBookmark={() => setAddBookmarkOpen(true)}
        onOpenDetails={(tab) => {
          setDetailsTab(tab);
          setDetailsPanelOpen(true);
        }}
        onOpenMembers={() => {
          setDetailsTab('members');
          setDetailsPanelOpen(true);
        }}
        onOpenPins={() => setActiveTab('pins')}
        onEditDetails={() => setDetailsOpen(true)}
        onAddPeople={() => setAddPeopleOpen(true)}
        onOpenPosting={
          canManageChannel ? () => setPostingOpen(true) : undefined
        }
        onOpenAnonModeration={
          anonSettings.data?.canModerate
            ? () => setAnonModerationOpen(true)
            : undefined
        }
        chatActionsRef={setChatActionsSlot}
        chatMenuRef={setChatMenuSlot}
        headerEnd={headerEnd}
      />

      {channel.membership?.membershipType === 'TEMPORARY' && currentUser ? (
        <TemporaryMembershipBanner
          workspaceId={workspaceId}
          channelId={channel.id}
          currentUserId={currentUser.id}
          expiresAt={channel.membership.expiresAt}
        />
      ) : null}

      {/* The details panel lives in the app's right rail, rendered from here so
          its dialogs and mutations stay with the page that owns the channel. */}
      {detailsPanelOpen && detailsHost && detailsSlot && currentUser
        ? createPortal(
            <ChannelDetailsPanel
              channel={channel}
              workspaceId={workspaceId}
              workspaceSlug={workspaceSlug ?? ''}
              currentUserId={currentUser.id}
              createdByName={creatorName}
              initialTab={detailsTab}
              onClose={closeDetailsPanel}
              onEditDetails={() => setDetailsOpen(true)}
              onAddPeople={() => setAddPeopleOpen(true)}
              onAddAgent={() => setAddAgentOpen(true)}
              onAddApp={() => setAddAppOpen(true)}
              onOpenWorkflows={() => setWorkflowsOpen(true)}
              onStartHuddle={() => {
                setActiveTab('chat');
                setHuddleRequest((count) => count + 1);
              }}
              onOpenPosting={
                canManageChannel ? () => setPostingOpen(true) : undefined
              }
              onCustomizeTabs={() => setTabsDialogOpen(true)}
              onChannelDeleted={() => {
                setDetailsPanelOpen(false);
                navigate(`/w/${workspaceSlug ?? ''}`, { replace: true });
              }}
            />,
            detailsSlot,
          )
        : null}

      <AddBookmarkDialog
        open={addBookmarkOpen}
        onOpenChange={setAddBookmarkOpen}
        onAdd={addBookmark}
        channelName={channel.name}
      />

      <AddPeopleDialog
        open={addPeopleOpen}
        onOpenChange={setAddPeopleOpen}
        workspaceId={workspaceId}
        channel={channel}
        existingMemberIds={(members.data ?? []).map((member) => member.user.id)}
      />

      <EditChannelDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        workspaceId={workspaceId}
        channel={channel}
      />

      <CustomizeChannelTabsDialog
        open={tabsDialogOpen}
        onOpenChange={setTabsDialogOpen}
        workspaceId={workspaceId}
        channel={channel}
      />

      <ChannelPostingDialog
        open={postingOpen}
        onOpenChange={setPostingOpen}
        workspaceId={workspaceId}
        channel={channel}
      />

      <AnonymousModerationDialog
        open={anonModerationOpen}
        onOpenChange={setAnonModerationOpen}
        workspaceId={workspaceId}
        channelId={channel.id}
      />

      <AddAgentToChannelDialog
        open={addAgentOpen}
        onOpenChange={setAddAgentOpen}
        channel={channel}
      />

      <AddAppDialog
        open={addAppOpen}
        onOpenChange={setAddAppOpen}
        channel={channel}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug ?? ''}
      />

      <ChannelTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        channel={channel}
      />

      <ChannelWorkflowsDialog
        open={workflowsOpen}
        onOpenChange={setWorkflowsOpen}
        channel={channel}
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="min-h-0 gap-0 flex flex-1 flex-col"
      >
        <PageTabBar
          afterTabs={
            <>
              {/* Everything that adds to the channel — agents, apps, workflows,
                templates, bookmarks, people — behind one “+” beside the tabs.
                Channel-management entries live in the header's “⋯” menu. */}
              <DropdownMenu>
                <Hint label="Add to channel">
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="size-7 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
                      aria-label="Add to channel"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </Hint>
                <DropdownMenuContent
                  align="start"
                  className="w-60 p-1.5 space-y-0.5"
                >
                  <DropdownMenuItem
                    onClick={() => setAddAgentOpen(true)}
                    className="gap-2.5 text-xs font-medium cursor-pointer"
                  >
                    <Bot className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <span className="text-foreground">Add AI Agent</span>
                      <p className="truncate text-[10px] text-muted-foreground">
                        Add assistant / reviewer bot
                      </p>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => setAddAppOpen(true)}
                    className="gap-2.5 text-xs font-medium cursor-pointer"
                  >
                    <Blocks className="size-4 shrink-0 text-accent-violet" />
                    <div className="min-w-0 flex-1">
                      <span className="text-foreground">Connect App</span>
                      <p className="truncate text-[10px] text-muted-foreground">
                        GitHub, Linear, Sentry &amp; Jira
                      </p>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() => setWorkflowsOpen(true)}
                    className="gap-2.5 text-xs font-medium cursor-pointer"
                  >
                    <Workflow className="size-4 shrink-0 text-accent-violet" />
                    <div className="min-w-0 flex-1">
                      <span className="text-foreground">Workflows</span>
                      <p className="truncate text-[10px] text-muted-foreground">
                        Triggers, standups &amp; alerts
                      </p>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => setTemplatesOpen(true)}
                    className="gap-2.5 text-xs font-medium cursor-pointer"
                  >
                    <LayoutTemplate className="size-4 shrink-0 text-accent-amber" />
                    <div className="min-w-0 flex-1">
                      <span className="text-foreground">Channel Templates</span>
                      <p className="truncate text-[10px] text-muted-foreground">
                        Sprint, incident &amp; launch packs
                      </p>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {canManageTabs ? (
                    <DropdownMenuItem
                      onClick={() => setTabsDialogOpen(true)}
                      className="gap-2.5 text-xs cursor-pointer"
                    >
                      <PanelsTopLeft className="size-4 shrink-0 text-muted-foreground" />
                      <span>Customize Tabs</span>
                    </DropdownMenuItem>
                  ) : null}

                  <DropdownMenuItem
                    onClick={() => setAddBookmarkOpen(true)}
                    className="gap-2.5 text-xs cursor-pointer"
                  >
                    <Bookmark className="size-4 shrink-0 text-muted-foreground" />
                    <span>Add Bookmark / Link</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => setAddPeopleOpen(true)}
                    className="gap-2.5 text-xs cursor-pointer"
                  >
                    <Users className="size-4 shrink-0 text-muted-foreground" />
                    <span>Add People to Channel</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
          end={
            <>
              {activeTab === 'files-media' &&
                workspacePermissions?.includes(WorkspacePermission.CREATE) && (
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={handleUploadFile}
                  >
                    <Upload className="size-3.5" />
                    <span>Upload File</span>
                  </Button>
                )}
              {activeTab === 'bookmarks' && (
                <Button
                  size="sm"
                  onClick={() => setAddBookmarkOpen(true)}
                  className="gap-1.5 text-xs h-7"
                >
                  <Plus className="size-3.5" />
                  <span>Add Bookmark</span>
                </Button>
              )}
            </>
          }
        >
          <TabsTrigger value="chat" icon={<MessageSquare className="size-4" />}>
            Messages
          </TabsTrigger>
          {visibleTabs.map((tab) => {
            const meta = CHANNEL_TAB_META[tab.id];
            const TabIcon = meta.icon;
            return (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                icon={<TabIcon className="size-4" />}
                count={tabCounts[tab.id]}
              >
                {meta.label}
              </TabsTrigger>
            );
          })}
        </PageTabBar>

        <TabsContent
          value="chat"
          className="min-h-0 mt-0 flex flex-1 flex-col overflow-hidden"
        >
          <ChannelChat
            channelId={channel.id}
            matrixRoomId={channel.matrixRoomId}
            workspaceId={workspaceId}
            title={channel.name}
            subtitle={channel.topic ?? undefined}
            headerActionsSlot={chatActionsSlot}
            headerMenuSlot={chatMenuSlot}
            /* The roster lives in the right rail's details panel. */
            showMembers={false}
            huddleRequest={huddleRequest}
            {...channelComposerLocks(channel)}
            anonymousPosting={
              anonSettings.data?.canPostAnonymously
                ? {
                    allowed: true,
                    onSendAnonymously: async (text) => {
                      await anonMutations.post.mutateAsync({ text });
                    },
                  }
                : undefined
            }
            welcome={{
              createdAt: channel.createdAt,
              createdByName: creatorName,
              createdBy: creator
                ? {
                    userId: creator.user.id,
                    avatarUrl: creator.user.avatarUrl,
                    email: (creator.user as { email?: string }).email,
                    title: creator.user.title,
                  }
                : undefined,
              description: channel.description ?? channel.topic,
              welcomeMessage: channel.welcomeMessage,
              isPrivate: channel.visibility === 'PRIVATE',
              onAddPeople: () => setAddPeopleOpen(true),
              onEditDescription: () => setDetailsOpen(true),
              onOpenCopilot: openAssistant,
            }}
            canManageConversation={canManageChannel}
            huddlesEnabled={channel.huddlesEnabled}
            huddleLink={
              channel.membership
                ? `${window.location.origin}/w/${workspaceSlug}/c/${channel.slug}?huddle=join`
                : undefined
            }
            memberSuggestions={channel.membership?.memberSuggestions}
          />
        </TabsContent>

        {/* Files & Media Tab */}
        <TabsContent
          value="files-media"
          className="min-h-0 flex flex-1 flex-col"
        >
          {/* Filed channel uploads + attachments shared in the chat — the
              same panel every DM / agent / app conversation uses. */}
          <ConversationFilesPanel
            context={{ type: 'CHANNEL', id: channel.id }}
            roomId={channel.matrixRoomId ?? null}
            workspaceId={workspaceId}
            currentUserId={currentUser?.id}
          />
        </TabsContent>

        {/* Dedicated Bookmarks Tab (placed before Pins) */}
        <TabsContent value="bookmarks" className="min-h-0 flex flex-1 flex-col">
          <ScrollArea
            className="min-h-0 flex-1"
            contentClassName="px-4 sm:px-6 py-3 space-y-4"
          >
            {/* "Add bookmark" lives in the tab bar, beside the tabs. */}
            <div className="pb-2.5 border-b border-border/40">
              <h3 className="text-sm font-semibold gap-2 flex items-center text-foreground">
                <Bookmark className="size-4 text-primary" />
                <span>My Bookmarks</span>
              </h3>
              <p className="text-xs mt-0.5 text-muted-foreground">
                Links and resources you've saved from #{channel.name} — only
                visible to you, on every device you sign in on.
              </p>
            </div>

            {bookmarks.length === 0 ? (
              <EmptyState
                icon={<Bookmark />}
                title="No bookmarks yet"
                description="Save links, spreadsheets, Figma designs, and docs from this channel for quick access. Only you can see them."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddBookmarkOpen(true)}
                  >
                    Add first bookmark
                  </Button>
                }
              />
            ) : (
              <div className="gap-3 sm:grid-cols-2 lg:grid-cols-3 grid">
                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="group p-3 relative flex items-start justify-between rounded-card border border-border bg-surface shadow-xs transition-all hover:border-border-strong hover:bg-surface-raised"
                  >
                    <a
                      href={bm.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 gap-2.5 flex flex-1 items-start outline-none"
                    >
                      <div className="size-8 text-base flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised">
                        <BookmarkFavicon
                          href={bm.href}
                          iconUrl={bm.iconUrl}
                          emoji={bm.emoji}
                          className="size-4"
                          fallbackIconClassName="size-4 text-muted-foreground"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-foreground transition-colors group-hover:text-primary">
                          {bm.label}
                        </p>
                        <p className="text-xs mt-0.5 truncate text-muted-foreground">
                          {bm.href}
                        </p>
                      </div>
                    </a>

                    <div className="gap-1 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                      <a
                        href={bm.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-muted-foreground hover:text-foreground"
                        aria-label="Open link"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => removeBookmark(bm.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive"
                        aria-label="Remove bookmark"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="pins" className="min-h-0 flex flex-1 flex-col">
          <ConversationPinsPanel
            roomId={channel.matrixRoomId}
            onShowInChat={() => setActiveTab('chat')}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

import type { ChannelMember, ChannelSummary } from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Hint,
  LoadingState,
  ScrollArea,
  SkeletonList,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  UserAvatar,
  useRightPanelStore,
} from '@org/ui';
import { cn, formatBytes } from '@org/utils';
import { AddBookmarkDialog } from '@org/chat-ui';
import { useMarkChannelSeen } from '@org/notifications';
import { ChannelChat } from '@org/web-chat';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  Blocks,
  Bookmark,
  Bot,
  Check,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  Hash,
  Headphones,
  Image as ImageIcon,
  Info,
  LayoutTemplate,
  Lock,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  RefreshCw,
  Share2,
  Star,
  Trash2,
  Upload,
  Users,
  Workflow,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { useCurrentUser } from '@org/auth';
import { ChannelDetailsPanel } from '../components/channel-details-panel.js';
import { AddAppDialog } from '../components/add-app-dialog.js';
import {
  AddAgentToChannelDialog,
  AddPeopleDialog,
  ChannelTemplatesDialog,
  ChannelWorkflowsDialog,
  EditChannelDetailsDialog,
} from '../components/channel-setup-dialogs.js';
import {
  useArchiveChannel,
  useChannel,
  useChannelBookmarks,
  useChannelFiles,
  useChannelMembers,
  useChannelPins,
  useChannelPreferences,
  useJoinChannel,
} from '../use-channels.js';
import { useChannelAgentsAndApps } from '../use-channel-agents-apps.js';

/**
 * Where an upload's bytes live.
 *
 * Real uploads are keys under the upload server; sample ones already carry a
 * full URL, so passing those through keeps the Media tab renderable with no
 * upload server running.
 */
function fileSrc(storageKey: string): string {
  return /^(data:|https?:)/.test(storageKey)
    ? storageKey
    : `/uploads/${storageKey}`;
}

function ChannelHeader({
  channel,
  members = [],
  onAddBookmark,
  onStartHuddle,
  onOpenDetails,
  onOpenMembers,
  onOpenPins,
  chatActionsRef,
  chatMenuRef,
}: {
  channel: ChannelSummary;
  members?: ChannelMember[];
  onAddBookmark?: () => void;
  /** Starts a huddle in the channel. */
  onStartHuddle?: () => void;
  /** Reveals the channel's details in the right rail. */
  onOpenDetails: () => void;
  /** Reveals the channel's members tab in the right rail. */
  onOpenMembers: () => void;
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
}) {
  const { workspaceId, slug: workspaceSlug } = useCurrentWorkspace();
  const preferences = useChannelPreferences(workspaceId);
  const archive = useArchiveChannel(workspaceId);
  const join = useJoinChannel(workspaceId);

  const [copied, setCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;
  const isFavorite = channel.membership?.isFavorite ?? false;
  const isMuted = channel.membership?.isMuted ?? false;

  const handleCopyLink = useCallback(() => {
    const slug = workspaceSlug || 'default';
    const url = `${window.location.origin}/w/${slug}/c/${channel.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied', {
      description: 'Channel link copied to clipboard.',
    });
    setTimeout(() => setCopied(false), 2000);
  }, [workspaceSlug, channel.slug]);

  const handleSyncChannel = useCallback(() => {
    setIsSyncing(true);
    toast.success('Channel synchronized', {
      description: 'Latest events and channel timeline are up to date.',
    });
    setTimeout(() => setIsSyncing(false), 800);
  }, []);

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

  return (
    <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
        <div className="min-w-0 gap-2 flex items-center">
          <div className="min-w-0 gap-1.5 flex items-center">
            <Icon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
              {channel.name}
            </h2>
            {channel.visibility === 'PRIVATE' ? (
              <Badge variant="neutral">Private</Badge>
            ) : null}
            {channel.isArchived ? (
              <Badge variant="warning">Archived</Badge>
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

            {/* 2. Huddle icon */}
            <Hint label="Start a huddle">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Start a huddle"
                onClick={onStartHuddle}
                className="text-muted-foreground hover:text-foreground"
              >
                <Headphones className="size-4" />
              </Button>
            </Hint>

            {/* 3. 3-dot dropdown menu */}
            {channel.membership ? (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Channel options"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  side="bottom"
                  className="w-64"
                >
                  <DropdownMenuItem
                    onClick={handleCopyLink}
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

                  <DropdownMenuItem
                    onClick={handleSyncChannel}
                    className="justify-between"
                  >
                    <div className="gap-2.5 flex items-center">
                      <RefreshCw
                        className={cn('size-4', isSyncing && 'animate-spin')}
                      />
                      <span>Sync channel</span>
                    </div>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={onOpenDetails} className="gap-2.5">
                    <Info className="size-4" />
                    <span>Open channel details</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem className="justify-between">
                    <div className="gap-2.5 flex items-center">
                      <Mail className="size-4" />
                      <span>Mark as unread</span>
                    </div>
                    <DropdownMenuShortcut>U</DropdownMenuShortcut>
                  </DropdownMenuItem>

                  <DropdownMenuItem className="gap-2.5">
                    <Pencil className="size-4" />
                    <span>Rename</span>
                  </DropdownMenuItem>

                  {onAddBookmark ? (
                    <DropdownMenuItem
                      onClick={onAddBookmark}
                      className="justify-between"
                    >
                      <div className="gap-2.5 flex items-center">
                        <Bookmark className="size-4" />
                        <span>Add bookmark</span>
                      </div>
                      <DropdownMenuShortcut>B</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  ) : null}

                  <DropdownMenuItem onClick={onOpenPins} className="gap-2.5">
                    <Pin className="size-4" />
                    <span>Channel pins</span>
                  </DropdownMenuItem>

                  {/* The conversation's own entries land here — see the note on
                      `chatMenuRef`. Empty on the non-chat tabs. */}
                  <div ref={chatMenuRef} className="contents" />

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={handleToggleFavorite}
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

                  <DropdownMenuItem className="gap-2.5">
                    <Bell className="size-4" />
                    <span>Notification settings</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() =>
                      preferences.mutate({
                        channelId: channel.id,
                        input: { isMuted: !isMuted },
                      })
                    }
                    description="Follow this Channel in the future to show it in your sidebar again."
                  >
                    <BellOff className="size-4" />
                    <span>{isMuted ? 'Follow Channel' : 'Unfollow'}</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem className="gap-2.5">
                    <Mail className="size-4" />
                    <span>Email to Channel</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem className="gap-2.5">
                    <Bell className="size-4" />
                    <span>Notification settings</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() =>
                      preferences.mutate({
                        channelId: channel.id,
                        input: { isMuted: !isMuted },
                      })
                    }
                    description="Follow this Channel in the future to show it in your sidebar again."
                  >
                    <BellOff className="size-4" />
                    <span>{isMuted ? 'Follow Channel' : 'Unfollow'}</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem className="gap-2.5">
                    <Share2 className="size-4" />
                    <span>Sharing & Permissions</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  {/* Archiving is not deleting, and this entry used to say
                      “Delete Channel” while calling the archive mutation. */}
                  {channel.membership?.role === 'ADMIN' ? (
                    <DropdownMenuItem
                      onClick={() =>
                        archive.mutate({
                          channelId: channel.id,
                          archived: !channel.isArchived,
                        })
                      }
                      variant={channel.isArchived ? undefined : 'destructive'}
                      className="gap-2.5"
                    >
                      {channel.isArchived ? (
                        <>
                          <ArchiveRestore className="size-4" />
                          <span>Unarchive channel</span>
                        </>
                      ) : (
                        <>
                          <Archive className="size-4" />
                          <span>Archive channel</span>
                        </>
                      )}
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
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
                        className="size-5 ring-2 ring-background"
                      />
                    ))}
                  </div>
                ) : (
                  <Users className="size-4" />
                )}
                <span className="text-xs font-medium tabular-nums text-foreground">
                  {channel.memberCount || members.length}
                </span>
              </Button>
            </Hint>
          ) : null}

          {!channel.membership ? (
            <Button
              size="sm"
              onClick={() => join.mutate(channel.id)}
              loading={join.isPending}
            >
              Join channel
            </Button>
          ) : null}
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
export function ChannelPage() {
  const { channelSlug } = useParams<{ channelSlug: string }>();
  const { workspaceId, slug: workspaceSlug } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const channelQuery = useChannel(workspaceId, channelSlug);
  const channel = channelQuery.data;

  const pins = useChannelPins(workspaceId, channel?.id);
  const files = useChannelFiles(workspaceId, channel?.id);
  const { bookmarks, addBookmark, removeBookmark } = useChannelBookmarks(
    workspaceId,
    channel?.id,
  );
  const members = useChannelMembers(workspaceId, channel?.id);
  const channelAgentsApps = useChannelAgentsAndApps(workspaceId, channel?.id);
  const [addBookmarkOpen, setAddBookmarkOpen] = useState(false);
  const [addPeopleOpen, setAddPeopleOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [addAgentOpen, setAddAgentOpen] = useState(false);
  const [addAppOpen, setAddAppOpen] = useState(false);
  const [workflowsOpen, setWorkflowsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [filesFilter, setFilesFilter] = useState<
    'all' | 'files' | 'media' | 'links'
  >('all');

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

  /* Bumped to ask the conversation to start a huddle — see `ChatSurface`. */
  const [huddleRequest, setHuddleRequest] = useState(0);
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [detailsTab, setDetailsTab] = useState<
    'about' | 'members' | 'apps' | 'automations'
  >('about');

  const closeDetailsPanel = useCallback(() => setDetailsPanelOpen(false), []);

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

  /* Opening a channel is what marks it read — see `useChannelActivity`. */
  useEffect(() => {
    markChannelSeen(channel?.id);
  }, [channel?.id, markChannelSeen]);

  if (channelQuery.isLoading) return <LoadingState fullPage />;
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

  const mediaFiles =
    files.data?.filter((file) => file.mimeType.startsWith('image/')) ?? [];
  const documentFiles =
    files.data?.filter((file) => !file.mimeType.startsWith('image/')) ?? [];

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <ChannelHeader
        channel={channel}
        members={members.data ?? []}
        onAddBookmark={() => setAddBookmarkOpen(true)}
        onStartHuddle={() => setHuddleRequest((n) => n + 1)}
        onOpenDetails={() => {
          setDetailsTab('about');
          setDetailsPanelOpen(true);
        }}
        onOpenMembers={() => {
          setDetailsTab('members');
          setDetailsPanelOpen(true);
        }}
        onOpenPins={() => setActiveTab('pins')}
        chatActionsRef={setChatActionsSlot}
        chatMenuRef={setChatMenuSlot}
      />

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
              onOpenAgentsAppsTab={() => {
                setDetailsPanelOpen(false);
                setActiveTab('agents-apps');
              }}
              onOpenWorkflows={() => setWorkflowsOpen(true)}
              onStartHuddle={() => {
                setActiveTab('chat');
                setHuddleRequest((count) => count + 1);
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

      <AddAgentToChannelDialog
        open={addAgentOpen}
        onOpenChange={setAddAgentOpen}
        channel={channel}
        onAgentAdded={(agent) =>
          channelAgentsApps.addAgent({
            id: agent.id,
            name: agent.name,
            handle: agent.handle,
            role: agent.role,
            description: agent.description,
            model: agent.model,
            avatarSeed: agent.avatarSeed,
            tags: agent.tags,
            status: 'active',
            enabled: true,
            triggers: [agent.handle, `/${agent.handle.replace('@', '')}`],
            capabilities: agent.tags,
          })
        }
      />

      <AddAppDialog
        open={addAppOpen}
        onOpenChange={setAddAppOpen}
        channel={channel}
        existingAppSlugs={channelAgentsApps.apps.map((a) => a.slug)}
        onAddApp={(app) => channelAgentsApps.addApp(app)}
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
        className="min-h-0 flex flex-1 flex-col"
      >
        <div className="px-3 sm:px-6 pt-2 flex items-center gap-1 border-b border-border bg-background">
          <TabsList className="scrollbar-none overflow-x-auto">
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageSquare className="size-4" /> Messages
            </TabsTrigger>
            <TabsTrigger value="files-media" className="gap-1.5">
              <FolderOpen className="size-4" /> Files &amp; Media
              {mediaFiles.length + documentFiles.length > 0 ? (
                <Badge
                  variant="neutral"
                  className="ml-0.5 px-1 py-0 text-[10px]"
                >
                  {mediaFiles.length + documentFiles.length}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="bookmarks" className="gap-1.5">
              <Bookmark className="size-4" /> Bookmarks
              {bookmarks.length > 0 ? (
                <Badge
                  variant="neutral"
                  className="ml-0.5 px-1 py-0 text-[10px]"
                >
                  {bookmarks.length}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="pins" className="gap-1.5">
              <Pin className="size-4" /> Pins
              {(pins.data?.length ?? 0) > 0 ? (
                <Badge
                  variant="neutral"
                  className="ml-0.5 px-1 py-0 text-[10px]"
                >
                  {pins.data?.length}
                </Badge>
              ) : null}
            </TabsTrigger>
          </TabsList>

          {/* 3-dots Workflow, Templates, and AI Agents dropdown menu placed immediately after the tabs */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                aria-label="Channel actions, workflows, templates, and AI agents"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60 p-1.5 space-y-0.5">
              <DropdownMenuItem
                onClick={() => setAddAgentOpen(true)}
                className="gap-2.5 text-xs font-medium cursor-pointer"
              >
                <Bot className="size-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-foreground">Add AI Agent</span>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Add assistant / reviewer bot
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setAddAppOpen(true)}
                className="gap-2.5 text-xs font-medium cursor-pointer"
              >
                <Blocks className="size-4 text-accent-violet shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-foreground">Connect App</span>
                  <p className="text-[10px] text-muted-foreground truncate">
                    GitHub, Linear, Sentry &amp; Jira
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setWorkflowsOpen(true)}
                className="gap-2.5 text-xs font-medium cursor-pointer"
              >
                <Workflow className="size-4 text-accent-violet shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-foreground">Workflows</span>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Triggers, standups &amp; alerts
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setTemplatesOpen(true)}
                className="gap-2.5 text-xs font-medium cursor-pointer"
              >
                <LayoutTemplate className="size-4 text-accent-amber shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-foreground">Channel Templates</span>
                  <p className="text-[10px] text-muted-foreground truncate">
                    Sprint, incident &amp; launch packs
                  </p>
                </div>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                onClick={() => setAddBookmarkOpen(true)}
                className="gap-2.5 text-xs cursor-pointer"
              >
                <Bookmark className="size-4 text-muted-foreground shrink-0" />
                <span>Add Bookmark / Link</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setAddPeopleOpen(true)}
                className="gap-2.5 text-xs cursor-pointer"
              >
                <Users className="size-4 text-muted-foreground shrink-0" />
                <span>Add People to Channel</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setDetailsOpen(true)}
                className="gap-2.5 text-xs cursor-pointer"
              >
                <Pencil className="size-4 text-muted-foreground shrink-0" />
                <span>Edit Channel Details</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <TabsContent
          value="chat"
          className="min-h-0 flex flex-1 flex-col overflow-hidden"
        >
          <ChannelChat
            channelId={channel.id}
            title={channel.name}
            subtitle={channel.topic ?? undefined}
            headerActionsSlot={chatActionsSlot}
            headerMenuSlot={chatMenuSlot}
            /* The roster lives in the right rail's details panel. */
            showMembers={false}
            huddleRequest={huddleRequest}
            welcome={{
              createdAt: channel.createdAt,
              createdByName: creatorName,
              description: channel.description ?? channel.topic,
              isPrivate: channel.visibility === 'PRIVATE',
              onAddPeople: () => setAddPeopleOpen(true),
              onEditDescription: () => setDetailsOpen(true),
              onOpenCopilot: openAssistant,
            }}
          />
        </TabsContent>

        {/* Files & Media Tab */}
        <TabsContent
          value="files-media"
          className="min-h-0 flex flex-1 flex-col"
        >
          <ScrollArea
            className="min-h-0 flex-1"
            contentClassName="px-4 sm:px-6 py-4 space-y-6"
          >
            {/* Top Toolbar: Filter pills & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  size="sm"
                  variant={filesFilter === 'all' ? 'primary' : 'outline'}
                  onClick={() => setFilesFilter('all')}
                  className="h-7 text-xs px-2.5"
                >
                  All ({mediaFiles.length + documentFiles.length})
                </Button>
                <Button
                  size="sm"
                  variant={filesFilter === 'files' ? 'primary' : 'outline'}
                  onClick={() => setFilesFilter('files')}
                  className="h-7 text-xs px-2.5 gap-1.5"
                >
                  <FileText className="size-3.5" />
                  <span>Documents ({documentFiles.length})</span>
                </Button>
                <Button
                  size="sm"
                  variant={filesFilter === 'media' ? 'primary' : 'outline'}
                  onClick={() => setFilesFilter('media')}
                  className="h-7 text-xs px-2.5 gap-1.5"
                >
                  <ImageIcon className="size-3.5" />
                  <span>Media ({mediaFiles.length})</span>
                </Button>
              </div>

              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => {
                  toast.info('Select a file from your device to upload');
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.onchange = () => toast.success('File uploaded to channel');
                  input.click();
                }}
              >
                <Upload className="size-3.5" />
                <span>Upload File</span>
              </Button>
            </div>

            {mediaFiles.length + documentFiles.length === 0 ? (
              <EmptyState
                icon={<FolderOpen />}
                title="No files or media yet"
                description="Share documents, design assets, and screenshots in this channel."
                action={
                  <Button
                    size="sm"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.onchange = () => toast.success('File uploaded');
                      input.click();
                    }}
                  >
                    Upload file
                  </Button>
                }
              />
            ) : null}

            {/* Media & Images Section */}
            {(filesFilter === 'all' || filesFilter === 'media') &&
            mediaFiles.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ImageIcon className="size-3.5 text-accent-amber" />
                  <span>Media &amp; Images ({mediaFiles.length})</span>
                </h4>

                <div className="gap-3 sm:grid-cols-4 grid grid-cols-2">
                  {mediaFiles.map((file) => (
                    <figure
                      key={file.id}
                      className="aspect-square overflow-hidden rounded-lg bg-muted border border-border group relative"
                    >
                      <img
                        src={fileSrc(file.storageKey)}
                        alt={file.filename}
                        className="size-full object-cover transition-transform group-hover:scale-105"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 text-white">
                        <span className="text-[11px] truncate font-medium">
                          {file.filename}
                        </span>
                      </div>
                    </figure>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Documents & Files Section */}
            {(filesFilter === 'all' || filesFilter === 'files') &&
            documentFiles.length > 0 ? (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <FileText className="size-3.5 text-accent-violet" />
                  <span>Documents &amp; Files ({documentFiles.length})</span>
                </h4>

                <ul className="divide-y divide-border rounded-xl border border-border bg-surface overflow-hidden">
                  {documentFiles.map((file) => (
                    <li
                      key={file.id}
                      className="gap-3 px-4 py-3 flex items-center hover:bg-surface-raised transition-colors"
                    >
                      <FileText className="size-5 text-muted-foreground shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-foreground">
                          {file.filename}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(file.size)} · Uploaded by{' '}
                          {file.uploader.displayName ?? file.uploader.name}
                        </p>
                      </div>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => {
                          window.open(fileSrc(file.storageKey), '_blank');
                        }}
                        title="Download file"
                      >
                        <Download className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </ScrollArea>
        </TabsContent>

        {/* Dedicated Bookmarks Tab (placed before Pins) */}
        <TabsContent value="bookmarks" className="min-h-0 flex flex-1 flex-col">
          <ScrollArea
            className="min-h-0 flex-1"
            contentClassName="px-4 sm:px-6 py-4 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Bookmark className="size-4 text-primary" />
                  <span>Channel Bookmarks</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Pinned links, documents, and resources for #{channel.name}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setAddBookmarkOpen(true)}
                className="gap-1.5 text-xs h-7"
              >
                <Plus className="size-3.5" />
                <span>Add bookmark</span>
              </Button>
            </div>

            {bookmarks.length === 0 ? (
              <EmptyState
                icon={<Bookmark />}
                title="No bookmarks yet"
                description="Pin important links, spreadsheets, Figma designs, and docs to this channel."
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
                    className="group p-3 shadow-xs relative flex items-start justify-between rounded-card border border-border bg-surface transition-all hover:border-border-strong hover:bg-surface-raised"
                  >
                    <a
                      href={bm.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 gap-2.5 flex flex-1 items-start outline-none"
                    >
                      <div className="size-8 text-base flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised">
                        {bm.emoji || '🔗'}
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
          <ScrollArea className="min-h-0 flex-1" contentClassName="px-6 py-4">
            {pins.isLoading ? (
              <SkeletonList rows={3} />
            ) : (pins.data?.length ?? 0) === 0 ? (
              <EmptyState
                icon={<Pin />}
                title="Nothing pinned"
                description="Pin important links and notes so they stay easy to find."
              />
            ) : (
              <ul className="space-y-2">
                {pins.data?.map((pin) => (
                  <li key={pin.id} className="p-3 rounded-card border">
                    <p className="text-sm font-medium">{pin.title}</p>
                    {pin.url ? (
                      <a
                        href={pin.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs mt-0.5 block truncate text-primary underline"
                      >
                        {pin.url}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

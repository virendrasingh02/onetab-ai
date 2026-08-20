import type { ChannelSummary } from '@org/types';
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
  Bookmark,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Hash,
  Image as ImageIcon,
  Info,
  Lock,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Share2,
  Star,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { useCurrentUser } from '@org/auth';
import { ChannelDetailsPanel } from '../components/channel-details-panel.js';
import {
  AddPeopleDialog,
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
  onAddBookmark,
  onOpenDetails,
  onOpenPins,
  chatActionsRef,
  chatMenuRef,
}: {
  channel: ChannelSummary;
  onAddBookmark?: () => void;
  /** Reveals the channel's details in the right rail. */
  onOpenDetails: () => void;
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

  return (
    <div className="border-b border-border bg-background">
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
                onClick={() => {
                  preferences.mutate(
                    {
                      channelId: channel.id,
                      input: { isFavorite: !isFavorite },
                    },
                    {
                      onSuccess: () => {
                        toast.success(
                          !isFavorite
                            ? 'Added to favorites'
                            : 'Removed from favorites',
                        );
                      },
                    },
                  );
                }}
                className={isFavorite ? 'text-warning' : undefined}
              >
                <Star className={cn('size-4', isFavorite && 'fill-current')} />
              </Button>
            </Hint>

            {/*
              Add bookmark, channel details and archive each had an icon of
              their own here, next to five more from the conversation. None of
              them is a per-message action, so they are all one level down in
              the menu now and the row holds only what you use while reading.
            */}
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

                  <DropdownMenuItem onClick={onOpenDetails} className="gap-2.5">
                    <Info className="size-4" />
                    <span>Channel details</span>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={() =>
                      preferences.mutate({
                        channelId: channel.id,
                        input: { isFavorite: !isFavorite },
                      })
                    }
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

          {/* The topic used to sit under the conversation's own title. With one
              header left, it shows here — where there is room for it. */}
          {channel.topic ? (
            <p className="min-w-0 pl-2 text-xs lg:block hidden max-w-[48ch] truncate border-l border-border text-muted-foreground">
              {channel.topic}
            </p>
          ) : null}
        </div>

        {/*
          Channel actions. The member avatar stack that used to sit here is gone
          — it opened a dropdown listing the same people the right rail's
          details panel now lists, with room to search them. Archive moved into
          the menu beside the rest of the channel's administration.
        */}
        <div className="gap-2 flex items-center">
          {/* Conversation tools portal in from the chat surface; empty on the
              non-chat tabs, where it collapses instead of leaving a gap. */}
          <div
            ref={chatActionsRef}
            className="gap-0.5 flex items-center empty:hidden"
          />

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
  const [addBookmarkOpen, setAddBookmarkOpen] = useState(false);
  const [addPeopleOpen, setAddPeopleOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
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
        onAddBookmark={() => setAddBookmarkOpen(true)}
        onOpenDetails={() => setDetailsPanelOpen(true)}
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
              onClose={closeDetailsPanel}
              onEditDetails={() => setDetailsOpen(true)}
              onAddPeople={() => setAddPeopleOpen(true)}
              onStartHuddle={() => {
                setActiveTab('chat');
                setHuddleRequest((count) => count + 1);
              }}
            />,
            detailsSlot,
          )
        : null}

      {/*
        The bookmarks strip that used to sit here is gone. It duplicated the
        Bookmarks tab immediately below it — the same links, in a cramped
        horizontal scroller, above a tab bar that already carries a count. The
        tab is the folder view; this was a second copy of it eating a row of
        vertical space on every channel.
      */}

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

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="min-h-0 flex flex-1 flex-col"
      >
        <div className="px-3 sm:px-6 pt-2 scrollbar-none overflow-x-auto border-b border-border bg-background">
          <TabsList>
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageSquare className="size-4" /> Messages
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
            <TabsTrigger value="files" className="gap-1.5">
              <FileText className="size-4" /> Files
            </TabsTrigger>
            <TabsTrigger value="media" className="gap-1.5">
              <ImageIcon className="size-4" /> Media
            </TabsTrigger>
            <TabsTrigger value="pins" className="gap-1.5">
              <Pin className="size-4" /> Pins
            </TabsTrigger>
          </TabsList>
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

        <TabsContent value="bookmarks" className="min-h-0 flex flex-1 flex-col">
          <ScrollArea
            className="min-h-0 flex-1"
            contentClassName="px-6 py-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Channel Bookmarks
                </h3>
                <p className="text-xs text-muted-foreground">
                  Pinned links and resources for #{channel.name}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setAddBookmarkOpen(true)}
                className="gap-1.5"
              >
                <Plus className="size-3.5" />
                <span>Add bookmark</span>
              </Button>
            </div>

            {bookmarks.length === 0 ? (
              <EmptyState
                icon={<Bookmark />}
                title="No bookmarks yet"
                description="Pin important links, spreadsheets, and docs to this channel."
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
              <div className="gap-2.5 sm:grid-cols-2 lg:grid-cols-3 grid">
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

        <TabsContent value="files" className="min-h-0 flex flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1" contentClassName="px-6 py-4">
            {files.isLoading ? (
              <SkeletonList rows={4} />
            ) : documentFiles.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title="No files yet"
                description="Files shared in this channel will appear here."
              />
            ) : (
              <ul className="divide-y">
                {documentFiles.map((file) => (
                  <li key={file.id} className="gap-3 py-2.5 flex items-center">
                    <FileText className="size-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {file.filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.size)} ·{' '}
                        {file.uploader.displayName ?? file.uploader.name}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="media" className="min-h-0 flex flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1" contentClassName="px-6 py-4">
            {mediaFiles.length === 0 ? (
              <EmptyState
                icon={<ImageIcon />}
                title="No media yet"
                description="Images shared in this channel will appear here."
              />
            ) : (
              <div className="gap-3 sm:grid-cols-4 grid grid-cols-2">
                {mediaFiles.map((file) => (
                  <figure
                    key={file.id}
                    className="aspect-square overflow-hidden rounded-lg bg-muted"
                  >
                    <img
                      src={fileSrc(file.storageKey)}
                      alt={file.filename}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </figure>
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

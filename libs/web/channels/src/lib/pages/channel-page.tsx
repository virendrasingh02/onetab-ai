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
  Input,
  LoadingState,
  ScrollArea,
  SkeletonList,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toPresenceStatus,
  toast,
  UserAvatar,
} from '@org/ui';
import { cn, formatBytes, formatDate } from '@org/utils';
import { AddBookmarkDialog, BookmarksBar } from '@org/chat-ui';
import { ChannelChat } from '@org/web-chat';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Archive,
  ArchiveRestore,
  Bell,
  BellOff,
  Bookmark,
  BookmarkPlus,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Hash,
  Image as ImageIcon,
  Lock,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  Plus,
  Search,
  Share2,
  Sparkles,
  Star,
  Trash2,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChannelAICopilot } from './ChannelAICopilot.js';
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

function ChannelMembersDropdown({
  channel,
  members,
}: {
  channel: ChannelSummary;
  members: ReturnType<typeof useChannelMembers>;
}) {
  const [memberSearch, setMemberSearch] = useState('');
  const memberList = useMemo(() => members.data ?? [], [members.data]);
  const maxVisibleAvatars = 4;
  const visibleMembers = useMemo(
    () => memberList.slice(0, maxVisibleAvatars),
    [memberList],
  );
  const remainingCount = Math.max(
    0,
    (memberList.length || channel.memberCount) - visibleMembers.length,
  );

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return memberList;
    const query = memberSearch.toLowerCase();
    return memberList.filter(
      (m) =>
        m.user.displayName?.toLowerCase().includes(query) ||
        m.user.name.toLowerCase().includes(query),
    );
  }, [memberList, memberSearch]);

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group flex items-center rounded-full p-0.5 hover:bg-accent/60 transition-all outline-none focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={`View ${channel.memberCount} members`}
        >
          <div className="flex items-center -space-x-2">
            {visibleMembers.map((m) => (
              <UserAvatar
                key={m.id}
                name={m.user.displayName ?? m.user.name}
                src={m.user.avatarUrl}
                seed={m.user.id}
                size="sm"
                className="size-7 ring-2 ring-background transition-transform group-hover:scale-105"
              />
            ))}
            {remainingCount > 0 ? (
              <span className="size-7 flex items-center justify-center rounded-full bg-surface-raised border border-border text-[11px] font-semibold text-foreground ring-2 ring-background">
                +{remainingCount}
              </span>
            ) : null}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="bottom"
        sideOffset={6}
        className="w-80 p-0"
      >
        <div className="p-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-foreground">
              Channel Members
            </span>
            <Badge variant="neutral">
              {memberList.length || channel.memberCount}
            </Badge>
          </div>
        </div>

        {memberList.length > 4 ? (
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Find members..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </div>
        ) : null}

        <ScrollArea className="max-h-72">
          <div className="p-1.5 space-y-0.5">
            {filteredMembers.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                No members found
              </p>
            ) : (
              filteredMembers.map((m) => {
                const name = m.user.displayName ?? m.user.name;
                const presence = toPresenceStatus(m.user.presence);
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-accent/60 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar
                        name={name}
                        src={m.user.avatarUrl}
                        seed={m.user.id}
                        presence={presence}
                        size="sm"
                        className="size-7"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate text-foreground">
                          {name}
                        </p>
                        <p className="text-[11px] truncate text-muted-foreground">
                          @{m.user.name}
                        </p>
                      </div>
                    </div>

                    {m.role === 'ADMIN' ? (
                      <Badge
                        variant="neutral"
                        className="text-[10px] px-1.5 py-0"
                      >
                        Admin
                      </Badge>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ChannelHeader({
  channel,
  onAddBookmark,
}: {
  channel: ChannelSummary;
  onAddBookmark?: () => void;
}) {
  const { workspaceId, slug: workspaceSlug } = useCurrentWorkspace();
  const preferences = useChannelPreferences(workspaceId);
  const archive = useArchiveChannel(workspaceId);
  const join = useJoinChannel(workspaceId);
  const members = useChannelMembers(workspaceId, channel.id);

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
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-6 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
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

          <div className="flex items-center gap-0.5">
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

            {onAddBookmark ? (
              <Hint label="Add bookmark">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Add bookmark"
                  onClick={onAddBookmark}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <BookmarkPlus className="size-4" />
                </Button>
              </Hint>
            ) : null}

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
                <DropdownMenuContent align="start" side="bottom" className="w-64">
                  <DropdownMenuItem className="justify-between">
                    <div className="flex items-center gap-2.5">
                      <Mail className="size-4" />
                      <span>Mark as unread</span>
                    </div>
                    <DropdownMenuShortcut>U</DropdownMenuShortcut>
                  </DropdownMenuItem>

                  <DropdownMenuItem className="gap-2.5">
                    <Pencil className="size-4" />
                    <span>Rename</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={handleCopyLink} className="justify-between">
                    <div className="flex items-center gap-2.5">
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
                    <DropdownMenuItem onClick={onAddBookmark} className="justify-between">
                      <div className="flex items-center gap-2.5">
                        <Bookmark className="size-4" />
                        <span>Add bookmark</span>
                      </div>
                      <DropdownMenuShortcut>B</DropdownMenuShortcut>
                    </DropdownMenuItem>
                  ) : null}

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
                    <div className="flex items-center gap-2.5">
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

                  {channel.membership?.role === 'ADMIN' ? (
                    <DropdownMenuItem
                      onClick={() =>
                        archive.mutate({
                          channelId: channel.id,
                          archived: !channel.isArchived,
                        })
                      }
                      variant="destructive"
                      className="gap-2.5"
                    >
                      {channel.isArchived ? (
                        <>
                          <ArchiveRestore className="size-4" />
                          <span>Unarchive channel</span>
                        </>
                      ) : (
                        <>
                          <Trash2 className="size-4" />
                          <span>Delete Channel</span>
                        </>
                      )}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem variant="destructive" className="gap-2.5">
                      <Trash2 className="size-4" />
                      <span>Delete Channel</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>

        {/* Channel actions: Member Avatar Stack Dropdown, Join Button, Archive */}
        <div className="flex items-center gap-2">
          {/* Member Avatar Stack with Dropdown */}
          <ChannelMembersDropdown channel={channel} members={members} />

          {!channel.membership ? (
            <Button
              size="sm"
              onClick={() => join.mutate(channel.id)}
              loading={join.isPending}
            >
              Join channel
            </Button>
          ) : null}

          {channel.membership?.role === 'ADMIN' ? (
            <Hint
              label={channel.isArchived ? 'Unarchive channel' : 'Archive channel'}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={channel.isArchived ? 'Unarchive' : 'Archive'}
                onClick={() =>
                  archive.mutate({
                    channelId: channel.id,
                    archived: !channel.isArchived,
                  })
                }
              >
                {channel.isArchived ? (
                  <ArchiveRestore className="size-4" />
                ) : (
                  <Archive className="size-4" />
                )}
              </Button>
            </Hint>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Channel workspace: Chat / About / Bookmarks / Files / Media / Pins.
 */
export function ChannelPage() {
  const { channelSlug } = useParams<{ channelSlug: string }>();
  const { workspaceId } = useCurrentWorkspace();
  const channelQuery = useChannel(workspaceId, channelSlug);
  const channel = channelQuery.data;

  const pins = useChannelPins(workspaceId, channel?.id);
  const files = useChannelFiles(workspaceId, channel?.id);
  const { bookmarks, addBookmark, removeBookmark } = useChannelBookmarks(
    workspaceId,
    channel?.id,
  );
  const [addBookmarkOpen, setAddBookmarkOpen] = useState(false);

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

  const mediaFiles =
    files.data?.filter((file) => file.mimeType.startsWith('image/')) ?? [];
  const documentFiles =
    files.data?.filter((file) => !file.mimeType.startsWith('image/')) ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChannelHeader
        channel={channel}
        onAddBookmark={() => setAddBookmarkOpen(true)}
      />

      <BookmarksBar
        bookmarks={bookmarks}
        onAdd={() => setAddBookmarkOpen(true)}
        onRemove={removeBookmark}
      />

      <AddBookmarkDialog
        open={addBookmarkOpen}
        onOpenChange={setAddBookmarkOpen}
        onAdd={addBookmark}
        channelName={channel.name}
      />

      <Tabs defaultValue="chat" className="min-h-0 flex flex-1 flex-col">
        <div className="border-b border-border bg-background px-3 sm:px-6 pt-2 overflow-x-auto scrollbar-none">
          <TabsList>
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageSquare className="size-4" /> Messages
            </TabsTrigger>
            <TabsTrigger value="copilot" className="gap-1.5 text-accent-violet">
              <Sparkles className="size-4" /> AI Copilot
            </TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="bookmarks" className="gap-1.5">
              <Bookmark className="size-4" /> Bookmarks
              {bookmarks.length > 0 ? (
                <Badge variant="neutral" className="ml-0.5 px-1 py-0 text-[10px]">
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
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ChannelChat
            channelId={channel.id}
            title={channel.name}
            subtitle={channel.topic ?? undefined}
          />
        </TabsContent>

        <TabsContent
          value="copilot"
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ChannelAICopilot channel={channel} workspaceId={workspaceId} />
        </TabsContent>

        <TabsContent value="about" className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1" contentClassName="space-y-4 px-6 py-4">
            <dl className="gap-4 sm:grid-cols-2 grid">
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase">
                  Topic
                </dt>
                <dd className="mt-1 text-sm">
                  {channel.topic || (
                    <span className="text-muted-foreground">No topic set</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-muted-foreground uppercase">
                  Created
                </dt>
                <dd className="mt-1 text-sm">
                  {formatDate(channel.createdAt)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground uppercase">
                  Description
                </dt>
                <dd className="mt-1 text-sm leading-relaxed">
                  {channel.description || (
                    <span className="text-muted-foreground">
                      No description yet.
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="bookmarks" className="flex min-h-0 flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1" contentClassName="px-6 py-4 space-y-4">
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
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="group relative flex items-start justify-between rounded-card border border-border bg-surface p-3 transition-all hover:border-border-strong hover:bg-surface-raised shadow-xs"
                  >
                    <a
                      href={bm.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 flex items-start gap-2.5 outline-none"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised text-base">
                        {bm.emoji || '🔗'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {bm.label}
                        </p>
                        <p className="truncate text-xs text-muted-foreground mt-0.5">
                          {bm.href}
                        </p>
                      </div>
                    </a>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a
                        href={bm.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-muted-foreground hover:text-foreground rounded"
                        aria-label="Open link"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => removeBookmark(bm.id)}
                        className="p-1 text-muted-foreground hover:text-destructive rounded"
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

        <TabsContent value="files" className="flex min-h-0 flex-1 flex-col">
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

        <TabsContent value="media" className="flex min-h-0 flex-1 flex-col">
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

        <TabsContent value="pins" className="flex min-h-0 flex-1 flex-col">
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
                  <li key={pin.id} className="rounded-card border p-3">
                    <p className="text-sm font-medium">{pin.title}</p>
                    {pin.url ? (
                      <a
                        href={pin.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary underline truncate block mt-0.5"
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


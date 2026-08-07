import type { ChannelSummary } from '@org/types';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Hint,
  LoadingState,
  SkeletonList,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  UserAvatar,
} from '@org/ui';
import { cn, formatBytes, formatDate, formatRelative } from '@org/utils';
import { ChannelChat } from '@org/web-chat';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Archive,
  ArchiveRestore,
  AtSign,
  Bookmark,
  FileText,
  Hash,
  Headphones,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  MessagesSquare,
  Pin,
  Star,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  useArchiveChannel,
  useChannel,
  useChannelFiles,
  useChannelMembers,
  useChannelPins,
  useChannelPreferences,
  useJoinChannel,
} from '../use-channels.js';

function ChannelHeader({ channel }: { channel: ChannelSummary }) {
  const { workspaceId } = useCurrentWorkspace();
  const preferences = useChannelPreferences(workspaceId);
  const archive = useArchiveChannel(workspaceId);
  const join = useJoinChannel(workspaceId);
  const members = useChannelMembers(workspaceId, channel.id);
  const pins = useChannelPins(workspaceId, channel.id);
  const [inHuddle, setInHuddle] = useState(false);

  const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;
  const isFavorite = channel.membership?.isFavorite ?? false;
  const pinCount = pins.data?.length ?? 0;

  return (
    <div className="border-b border-border bg-background">
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-6 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <h2 className="truncate text-sm font-medium tracking-tight text-foreground">
              {channel.name}
            </h2>
            {channel.visibility === 'PRIVATE' ? (
              <Badge variant="neutral">Private</Badge>
            ) : null}
            {channel.isArchived ? (
              <Badge variant="warning">Archived</Badge>
            ) : null}
          </div>

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
              onClick={() =>
                preferences.mutate({
                  channelId: channel.id,
                  input: { isFavorite: !isFavorite },
                })
              }
              className={isFavorite ? 'text-warning' : undefined}
            >
              <Star className={cn('size-4', isFavorite && 'fill-current')} />
            </Button>
          </Hint>
        </div>

        {/* Channel actions: huddle, member stack, membership, admin */}
        <div className="flex items-center gap-2">
          <Button
            variant={inHuddle ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setInHuddle((val) => !val)}
            aria-pressed={inHuddle}
            leadingIcon={<Headphones className="size-4" />}
          >
            {inHuddle ? 'In huddle' : 'Start huddle'}
          </Button>

          {/* Member Stack */}
          <div className="flex items-center px-1 -space-x-1.5">
            {members.data?.slice(0, 3).map((m) => (
              <UserAvatar
                key={m.id}
                name={m.user.displayName ?? m.user.name}
                src={m.user.avatarUrl}
                seed={m.user.id}
                size="sm"
                className="size-6 ring-2 ring-background"
              />
            ))}
            <span className="pl-2 text-xs tabular-nums text-muted-foreground">
              {channel.memberCount}
            </span>
          </div>

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

      {/* Sub-header: topic and channel shortcuts */}
      <div className="flex h-10 items-center justify-between gap-3 border-t border-border px-3 sm:px-6 text-xs text-muted-foreground">
        <p className="flex min-w-0 items-center gap-2 truncate">
          <span className="shrink-0 text-subtle">Topic</span>
          <span className="truncate">
            {channel.topic || (
              <span className="text-subtle">No topic set</span>
            )}
          </span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="sm" leadingIcon={<Pin className="size-3.5" />}>
            {pinCount} pinned
          </Button>
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Bookmark className="size-3.5" />}
          >
            Canvas
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Channel workspace: Chat / About / Members / Files / Media / Pins.
 *
 * Chat is the default tab and the reason the page exists; the rest is context
 * about the channel. The conversation keeps its own scroll container, so it is
 * mounted outside the shared overflow wrapper the other tabs share.
 */
export function ChannelPage() {
  const { channelSlug } = useParams<{ channelSlug: string }>();
  const { workspaceId } = useCurrentWorkspace();
  const channelQuery = useChannel(workspaceId, channelSlug);
  const channel = channelQuery.data;

  const members = useChannelMembers(workspaceId, channel?.id);
  const pins = useChannelPins(workspaceId, channel?.id);
  const files = useChannelFiles(workspaceId, channel?.id);

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
    <div className="flex h-full flex-col">
      <ChannelHeader channel={channel} />

      <Tabs defaultValue="chat" className="min-h-0 flex flex-1 flex-col">
        <div className="border-b border-border bg-background px-3 sm:px-6 pt-2 overflow-x-auto scrollbar-none">
          <TabsList>
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageSquare className="size-4" /> Messages
            </TabsTrigger>
            <TabsTrigger value="threads" className="gap-1.5">
              <MessagesSquare className="size-4" /> Threads
            </TabsTrigger>
            <TabsTrigger value="mentions" className="gap-1.5">
              <AtSign className="size-4" /> Mentions
            </TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="members" className="gap-1.5">
              <Users className="size-4" /> Members
              <Badge variant="neutral">{channel.memberCount}</Badge>
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

        <TabsContent value="chat" className="min-h-0 overflow-hidden">
          <ChannelChat
            channelId={channel.id}
            title={channel.name}
            subtitle={channel.topic ?? undefined}
          />
        </TabsContent>

        {/*
          Threads and mentions have no query backing them yet. They render an
          empty state rather than sample content so nothing on screen claims to
          be a real conversation — wire a hook in and the tab is ready.
        */}
        <TabsContent
          value="threads"
          className="min-h-0 overflow-y-auto px-6 py-4"
        >
          <EmptyState
            icon={<MessagesSquare />}
            title="No threads yet"
            description="Replies to a message are grouped here as threads."
          />
        </TabsContent>

        <TabsContent
          value="mentions"
          className="min-h-0 overflow-y-auto px-6 py-4"
        >
          <EmptyState
            icon={<AtSign />}
            title="No mentions"
            description={`Messages that mention you in #${channel.name} will appear here.`}
          />
        </TabsContent>

        {/*
          Each remaining tab carries its own scroll container. A shared wrapper
          would keep its `flex-1` height while the chat tab is active — Radix
          unmounts the inactive contents, leaving an empty box halving the page.
        */}
        <TabsContent
          value="about"
          className="min-h-0 space-y-4 overflow-y-auto px-6 py-4"
        >
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
        </TabsContent>

        <TabsContent
          value="members"
          className="min-h-0 overflow-y-auto px-6 py-4"
        >
            {members.isLoading ? (
              <SkeletonList rows={5} withAvatar />
            ) : (
              <ul className="divide-y">
                {members.data?.map((member) => (
                  <li
                    key={member.id}
                    className="gap-3 py-2.5 flex items-center"
                  >
                    <UserAvatar
                      name={member.user.displayName ?? member.user.name}
                      src={member.user.avatarUrl}
                      seed={member.user.id}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {member.user.displayName ?? member.user.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Joined {formatRelative(member.joinedAt)}
                      </p>
                    </div>
                    {member.role === 'ADMIN' ? (
                      <Badge variant="primary">Admin</Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
        </TabsContent>

        <TabsContent
          value="files"
          className="min-h-0 overflow-y-auto px-6 py-4"
        >
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
        </TabsContent>

        <TabsContent
          value="media"
          className="min-h-0 overflow-y-auto px-6 py-4"
        >
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
                      src={`/uploads/${file.storageKey}`}
                      alt={file.filename}
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  </figure>
                ))}
              </div>
            )}
        </TabsContent>

        <TabsContent
          value="pins"
          className="min-h-0 overflow-y-auto px-6 py-4"
        >
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
                        rel="noreferrer noopener"
                        className="text-xs break-all text-primary hover:underline"
                      >
                        {pin.url}
                      </a>
                    ) : null}
                    {pin.note ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {pin.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

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
import { formatBytes, formatDate, formatRelative } from '@org/utils';
import { ChannelChat } from '@org/web-chat';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Archive,
  ArchiveRestore,
  FileText,
  Hash,
  Image as ImageIcon,
  Lock,
  MessageSquare,
  Pin,
  Star,
  Users,
} from 'lucide-react';
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

  const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;
  const isFavorite = channel.membership?.isFavorite ?? false;

  return (
    <div className="gap-3 px-6 py-4 flex flex-wrap items-start border-b">
      <div className="min-w-0 flex-1">
        <div className="gap-2 flex items-center">
          <Icon className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-base font-semibold truncate">{channel.name}</h2>
          {channel.visibility === 'PRIVATE' ? (
            <Badge variant="neutral">Private</Badge>
          ) : null}
          {channel.isArchived ? (
            <Badge variant="warning">Archived</Badge>
          ) : null}
        </div>
        {channel.topic ? (
          <p className="mt-1 text-sm truncate text-muted-foreground">
            {channel.topic}
          </p>
        ) : null}
      </div>

      <div className="gap-1.5 flex items-center">
        {channel.membership ? (
          <Hint
            label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Button
              variant="ghost"
              size="icon"
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
            >
              <Star className={isFavorite ? 'fill-warning text-warning' : ''} />
            </Button>
          </Hint>
        ) : (
          <Button
            size="sm"
            onClick={() => join.mutate(channel.id)}
            loading={join.isPending}
          >
            Join channel
          </Button>
        )}

        {channel.membership?.role === 'ADMIN' ? (
          <Hint label={channel.isArchived ? 'Unarchive' : 'Archive'}>
            <Button
              variant="ghost"
              size="icon"
              aria-label={channel.isArchived ? 'Unarchive' : 'Archive'}
              onClick={() =>
                archive.mutate({
                  channelId: channel.id,
                  archived: !channel.isArchived,
                })
              }
            >
              {channel.isArchived ? <ArchiveRestore /> : <Archive />}
            </Button>
          </Hint>
        ) : null}
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
        <div className="px-6 pt-3">
          <TabsList>
            <TabsTrigger value="chat">
              <MessageSquare /> Chat
            </TabsTrigger>
            <TabsTrigger value="about">About</TabsTrigger>
            <TabsTrigger value="members">
              <Users /> Members
              <Badge variant="neutral">{channel.memberCount}</Badge>
            </TabsTrigger>
            <TabsTrigger value="files">
              <FileText /> Files
            </TabsTrigger>
            <TabsTrigger value="media">
              <ImageIcon /> Media
            </TabsTrigger>
            <TabsTrigger value="pins">
              <Pin /> Pins
            </TabsTrigger>
          </TabsList>
        </div>

        {/*
          The timeline is virtualised and manages its own scrolling, so this
          tab clips instead of scrolling — a second scroll container would
          break the stick-to-bottom behaviour.
        */}
        <TabsContent value="chat" className="min-h-0 overflow-hidden">
          <ChannelChat
            channelId={channel.id}
            title={channel.name}
            subtitle={channel.topic ?? undefined}
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
                  <li key={pin.id} className="p-3 rounded-lg border">
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

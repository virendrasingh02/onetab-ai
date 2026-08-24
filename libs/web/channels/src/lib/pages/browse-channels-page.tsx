import { Badge, Button, EmptyState, SearchInput, SkeletonList } from '@org/ui';
import { formatCount } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { Hash, Lock, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CreateChannelDialog } from '../components/create-channel-dialog.js';
import { useChannels, useJoinChannel } from '../use-channels.js';

export function BrowseChannelsPage() {
  const { slug, workspaceId } = useCurrentWorkspace();
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const channels = useChannels(workspaceId, showArchived);
  const join = useJoinChannel(workspaceId);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = channels.data ?? [];
    if (!term) return list;
    return list.filter(
      (channel) =>
        channel.name.includes(term) ||
        channel.topic?.toLowerCase().includes(term),
    );
  }, [channels.data, query]);

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <Hash
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                Browse channels
              </h2>
              <Badge
                variant="neutral"
                className="px-1.5 py-0 h-4.5 text-[11px]"
              >
                {formatCount(filtered.length)}
              </Badge>
            </div>

            {/* <div className="h-4 mx-1 sm:block hidden w-px bg-border" />

            <p className="min-w-0 text-xs sm:block hidden max-w-[48ch] truncate text-muted-foreground">
              Discover and join public or private channels in this workspace
            </p> */}
          </div>

          <div className="gap-2 flex items-center">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search channels…"
              className="h-7 text-xs"
              wrapperClassName="w-36 sm:w-48"
            />
            <Button
              variant={showArchived ? 'secondary' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              aria-pressed={showArchived}
              onClick={() => setShowArchived((value) => !value)}
            >
              Archived
            </Button>
            <Button
              onClick={() => setCreateOpen(true)}
              size="sm"
              className="h-7 text-xs gap-1"
              leadingIcon={<Plus className="size-3.5" />}
            >
              Create channel
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 p-4 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {channels.isLoading ? (
            <SkeletonList rows={6} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title={query ? 'No channels match' : 'No channels yet'}
              description={
                query
                  ? `Nothing matched "${query}".`
                  : 'Create the first channel to get started.'
              }
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {filtered.map((channel) => {
                const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;
                return (
                  <li
                    key={channel.id}
                    className="gap-3 px-4 py-3 flex items-center"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/w/${slug}/c/${channel.slug}`}
                        className="text-sm font-medium truncate hover:underline"
                      >
                        {channel.name}
                      </Link>
                      <p className="text-xs truncate text-muted-foreground">
                        {channel.memberCount} member
                        {channel.memberCount === 1 ? '' : 's'}
                        {channel.topic ? ` · ${channel.topic}` : ''}
                      </p>
                    </div>
                    {channel.isArchived ? (
                      <Badge variant="warning">Archived</Badge>
                    ) : channel.membership ? (
                      <Badge variant="neutral">Joined</Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => join.mutate(channel.id)}
                      >
                        Join
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <CreateChannelDialog open={createOpen} onOpenChange={setCreateOpen} />
        </div>
      </div>
    </div>
  );
}

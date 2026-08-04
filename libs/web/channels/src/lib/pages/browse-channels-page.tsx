import { Badge, Button, EmptyState, Input, SkeletonList } from '@org/ui';
import { formatCount } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { Hash, Lock, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useChannels, useJoinChannel } from '../use-channels.js';

export function BrowseChannelsPage() {
  const { slug, workspaceId } = useCurrentWorkspace();
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const channels = useChannels(workspaceId, showArchived);
  const join = useJoinChannel(workspaceId);
  const navigate = useNavigate();

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
    <div className="max-w-3xl p-6 mx-auto">
      <div className="mb-5 gap-3 flex flex-wrap items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Browse channels</h2>
          <p className="text-sm text-muted-foreground">
            {formatCount(filtered.length)} channel
            {filtered.length === 1 ? '' : 's'} in this workspace
          </p>
        </div>
        <Button
          onClick={() => navigate(`/w/${slug}/channels/new`)}
          leadingIcon={<Plus />}
        >
          Create channel
        </Button>
      </div>

      <div className="mb-4 gap-3 flex items-center">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search channels"
          leadingIcon={<Search />}
          aria-label="Search channels"
        />
        <Button
          variant={showArchived ? 'secondary' : 'outline'}
          size="sm"
          aria-pressed={showArchived}
          onClick={() => setShowArchived((value) => !value)}
        >
          Archived
        </Button>
      </div>

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
    </div>
  );
}

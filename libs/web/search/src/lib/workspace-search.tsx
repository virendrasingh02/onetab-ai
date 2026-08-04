import type { ChannelSummary, PublicUser } from '@org/types';
import { UserAvatar } from '@org/ui';
import { cn } from '@org/utils';
import { Hash, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface WorkspaceSearchResultsProps {
  workspaceSlug: string;
  channels: ChannelSummary[];
  people: PublicUser[];
  query: string;
  onNavigate?: () => void;
}

/**
 * Result list for the command palette.
 *
 * Rendering is split from data fetching so the palette shell can stay in
 * `@org/ui` (presentational) while the workspace-aware query lives here.
 */
export function WorkspaceSearchResults({
  workspaceSlug,
  channels,
  people,
  query,
  onNavigate,
}: WorkspaceSearchResultsProps) {
  const rowClass = cn(
    'gap-2 px-2 py-1.5 text-sm flex items-center rounded-md',
    'hover:bg-accent hover:text-accent-foreground',
  );

  return (
    <div className="space-y-3">
      {channels.length > 0 ? (
        <section>
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
            Channels
          </p>
          <ul>
            {channels.map((channel) => {
              const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;
              return (
                <li key={channel.id}>
                  <Link
                    to={`/w/${workspaceSlug}/c/${channel.slug}`}
                    onClick={onNavigate}
                    className={rowClass}
                  >
                    <Icon className="size-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{channel.name}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {people.length > 0 ? (
        <section>
          <p className="px-2 py-1 text-xs font-medium text-muted-foreground">
            People
          </p>
          <ul>
            {people.map((person) => (
              <li key={person.id}>
                <Link
                  to={`/w/${workspaceSlug}/members`}
                  onClick={onNavigate}
                  className={rowClass}
                >
                  <UserAvatar
                    name={person.displayName ?? person.name}
                    src={person.avatarUrl}
                    seed={person.id}
                    size="xs"
                  />
                  <span className="flex-1 truncate">
                    {person.displayName ?? person.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {channels.length === 0 && people.length === 0 && query ? (
        <p className="px-2 py-6 text-sm text-center text-muted-foreground">
          Nothing matched that search.
        </p>
      ) : null}
    </div>
  );
}

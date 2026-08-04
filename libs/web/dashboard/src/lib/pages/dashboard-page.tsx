import { useCurrentUser } from '@org/auth';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  SkeletonList,
  UserAvatar,
} from '@org/ui';
import { formatCount } from '@org/utils';
import { useChannels, useGroupedChannels } from '@org/web-channels';
import { useMembers } from '@org/web-members';
import { useCurrentWorkspace } from '@org/web-workspace';
import { Hash, Lock, Star, UserPlus, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs font-medium text-muted-foreground uppercase">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        {hint ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const user = useCurrentUser();
  const { slug, workspace, workspaceId } = useCurrentWorkspace();
  const channels = useChannels(workspaceId);
  const members = useMembers(workspaceId);
  const groups = useGroupedChannels(channels.data);

  const firstName = (user?.displayName ?? user?.name ?? '').split(' ')[0];

  return (
    <div className="max-w-4xl space-y-6 p-6 mx-auto">
      <div>
        <h2 className="text-lg font-semibold">
          {firstName ? `Welcome back, ${firstName}` : 'Welcome back'}
        </h2>
        <p className="text-sm text-muted-foreground">
          Here is what is happening in {workspace?.name}.
        </p>
      </div>

      <div className="gap-3 sm:grid-cols-3 grid">
        <StatCard
          label="Channels"
          value={formatCount(workspace?.channelCount ?? 0)}
          hint={`${groups.joined.length + groups.favorites.length} joined`}
        />
        <StatCard
          label="Members"
          value={formatCount(workspace?.memberCount ?? 0)}
        />
        <StatCard
          label="Favorites"
          value={formatCount(groups.favorites.length)}
        />
      </div>

      <div className="gap-4 lg:grid-cols-2 grid">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your channels</CardTitle>
            <CardDescription>Channels you have joined.</CardDescription>
          </CardHeader>
          <CardContent>
            {channels.isLoading ? (
              <SkeletonList rows={4} />
            ) : groups.favorites.length + groups.joined.length === 0 ? (
              <EmptyState
                size="sm"
                icon={<Hash />}
                title="No channels yet"
                description="Join or create a channel to get started."
                action={
                  <Button asChild size="sm">
                    <Link to={`/w/${slug}/channels/new`}>Create channel</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-1">
                {[...groups.favorites, ...groups.joined]
                  .slice(0, 8)
                  .map((channel) => {
                    const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;
                    return (
                      <li key={channel.id}>
                        <Link
                          to={`/w/${slug}/c/${channel.slug}`}
                          className="gap-2 px-2 py-1.5 text-sm flex items-center rounded-md hover:bg-muted"
                        >
                          <Icon className="size-3.5 text-muted-foreground" />
                          <span className="flex-1 truncate">
                            {channel.name}
                          </span>
                          {channel.membership?.isFavorite ? (
                            <Star className="size-3 fill-warning text-warning" />
                          ) : null}
                          <Badge variant="neutral">{channel.memberCount}</Badge>
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Teammates</CardTitle>
            <CardDescription>People in this workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            {members.isLoading ? (
              <SkeletonList rows={4} withAvatar />
            ) : (
              <>
                <ul className="space-y-2">
                  {members.data?.slice(0, 6).map((member) => (
                    <li key={member.id} className="gap-2.5 flex items-center">
                      <UserAvatar
                        name={member.user.displayName ?? member.user.name}
                        src={member.user.avatarUrl}
                        seed={member.user.id}
                        size="sm"
                        presence={
                          member.user.presence === 'ONLINE'
                            ? 'online'
                            : 'offline'
                        }
                      />
                      <span className="text-sm flex-1 truncate">
                        {member.user.displayName ?? member.user.name}
                      </span>
                      <Badge variant="neutral">
                        {member.role.toLowerCase()}
                      </Badge>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 gap-2 flex">
                  <Button asChild variant="outline" size="sm">
                    <Link to={`/w/${slug}/members`}>
                      <Users /> All members
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/w/${slug}/invitations`}>
                      <UserPlus /> Invite
                    </Link>
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

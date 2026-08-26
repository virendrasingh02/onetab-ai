import type { CurrentUser } from '@org/types';
import { LocalTime, UserAvatar } from '@org/ui';
import {
  describeTimezone,
  formatZoneDifference,
  getRegionForTimezone,
  getSystemTimezone,
  getWorkingHoursStatus,
} from '@org/utils';
import { Calendar, Clock, Globe, Shield } from 'lucide-react';

export interface ProfileSummaryCardProps {
  user: CurrentUser;
  workspaceRole?: string;
  className?: string;
}

export function ProfileSummaryCard({
  user,
  workspaceRole = 'Member',
  className = '',
}: ProfileSummaryCardProps) {
  const displayName = user.displayName || user.name;
  const handle = `@${user.email.split('@')[0]}`;
  const userTimezone = user.timezone || 'UTC';
  const region = getRegionForTimezone(userTimezone);
  const viewerZone = getSystemTimezone();
  const diff = formatZoneDifference(userTimezone, viewerZone);
  const workStatus = getWorkingHoursStatus(userTimezone);

  const formattedJoinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Aug 26, 2026';

  return (
    <div
      className={`rounded-2xl border border-border bg-surface text-foreground shadow-xs overflow-hidden ${className}`}
    >
      {/* Mini Cover Header */}
      <div
        className="h-24 w-full relative bg-cover bg-center"
        style={{
          backgroundImage: user.coverUrl
            ? `url(${user.coverUrl})`
            : 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #022c22 100%)',
        }}
      >
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Content Body with Overlapping Avatar */}
      <div className="px-5 pb-5 pt-0 relative">
        <div className="-mt-10 mb-3 flex items-end justify-between">
          <div className="relative">
            <UserAvatar
              name={displayName}
              src={user.avatarUrl}
              seed={user.id}
              size="lg"
              className="size-18 rounded-full shadow-lg ring-4 ring-surface"
              presence={user.presence === 'ONLINE' ? 'online' : user.presence === 'AWAY' ? 'away' : 'offline'}
              statusEmoji={user.statusEmoji}
              statusText={user.statusText}
            />
          </div>
        </div>

        {/* Identity */}
        <div className="space-y-0.5 mb-4">
          <h3 className="text-base font-bold tracking-tight text-foreground">{displayName}</h3>
          <p className="text-xs font-mono text-muted-foreground">{handle}</p>
        </div>

        {/* Metadata Table */}
        <div className="space-y-2.5 pt-3 border-t border-border/60 text-xs">
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="size-3.5 text-muted-foreground" />
              <span>Joined on</span>
            </div>
            <span className="font-semibold text-foreground">{formattedJoinedDate}</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="size-3.5 text-muted-foreground" />
              <span>Timezone</span>
            </div>
            <div className="text-right">
              <div className="font-semibold text-foreground flex items-center justify-end gap-1.5">
                <span>{region.flag}</span>
                <span>{describeTimezone(userTimezone)}</span>
              </div>
              <div className="text-[11px] text-muted-foreground flex items-center justify-end gap-1 mt-0.5">
                <LocalTime timezone={userTimezone} className="font-mono" />
                <span>•</span>
                <span>{diff}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-3.5 text-muted-foreground" />
              <span>Working Hours</span>
            </div>
            <div className="flex items-center gap-1 font-medium text-foreground">
              <span>{workStatus.icon}</span>
              <span>{workStatus.status === 'working' ? 'Active Work Hours' : 'Off-Hours'}</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="size-3.5 text-muted-foreground" />
              <span>Role</span>
            </div>
            <span className="font-semibold text-foreground">{workspaceRole}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

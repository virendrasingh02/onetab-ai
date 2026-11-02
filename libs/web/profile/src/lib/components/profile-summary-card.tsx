import type { CurrentUser } from '@org/types';
import { resolveMediaUrl } from '@org/api-client';
import { LocalTime, UserAvatar, UserCover } from '@org/ui';
import {
  describeTimezone,
  formatZoneDifference,
  getRegionForTimezone,
  getSystemTimezone,
  formatWorkingSchedule,
  getScheduleStatus,
  resolveWorkingSchedule,
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
  const handle = `@${user.username || user.email.split('@')[0]}`;
  const userTimezone = user.timezone || 'UTC';
  const region = getRegionForTimezone(userTimezone);
  const viewerZone = getSystemTimezone();
  const diff = formatZoneDifference(userTimezone, viewerZone);
  const schedule = resolveWorkingSchedule(user);
  const workStatus = getScheduleStatus(userTimezone, schedule);

  const formattedJoinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Aug 26, 2026';

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border bg-surface text-foreground shadow-xs ${className}`}
    >
      {/* Mini Cover Header */}
      <UserCover
        src={resolveMediaUrl(user.coverUrl)}
        seed={user.id}
        className="h-24"
      />

      {/* Content Body with Overlapping Avatar */}
      <div className="px-5 pb-5 pt-0 relative">
        <div className="-mt-10 mb-3 flex items-end justify-between">
          <div className="relative">
            <UserAvatar
              name={displayName}
              src={user.avatarUrl}
              seed={user.id}
              size="lg"
              className="size-18 rounded-full shadow-lg ring-1 ring-foreground/10"
              presence={user.presence}
              statusEmoji={user.statusEmoji}
              statusText={user.statusText}
            />
          </div>
        </div>

        {/* Identity */}
        <div className="space-y-0.5 mb-4">
          <h3 className="text-base font-bold tracking-tight text-foreground">
            {displayName}
          </h3>
          <p className="text-xs font-mono text-muted-foreground">{handle}</p>
        </div>

        {/* Metadata Table */}
        <div className="space-y-2.5 pt-3 text-xs border-t border-border/60">
          <div className="py-1 flex items-center justify-between">
            <div className="gap-2 flex items-center text-muted-foreground">
              <Calendar className="size-3.5 text-muted-foreground" />
              <span>Joined on</span>
            </div>
            <span className="font-semibold text-foreground">
              {formattedJoinedDate}
            </span>
          </div>

          <div className="py-1 flex items-center justify-between">
            <div className="gap-2 flex items-center text-muted-foreground">
              <Globe className="size-3.5 text-muted-foreground" />
              <span>Timezone</span>
            </div>
            <div className="text-right">
              <div className="font-semibold gap-1.5 flex items-center justify-end text-foreground">
                <span>{region.flag}</span>
                <span>{describeTimezone(userTimezone)}</span>
              </div>
              <div className="gap-1 mt-0.5 flex items-center justify-end text-[11px] text-muted-foreground">
                <LocalTime timezone={userTimezone} className="font-mono" />
                <span>•</span>
                <span>{diff}</span>
              </div>
            </div>
          </div>

          <div className="py-1 flex items-center justify-between">
            <div className="gap-2 flex items-center text-muted-foreground">
              <Clock className="size-3.5 text-muted-foreground" />
              <span>Working Hours</span>
            </div>
            <div className="text-right">
              <div className="gap-1 font-medium flex items-center justify-end text-foreground">
                <span>{workStatus.icon}</span>
                <span>
                  {workStatus.status === 'working'
                    ? 'Working now'
                    : workStatus.label === 'Day off'
                      ? 'Day off'
                      : 'Off-Hours'}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {formatWorkingSchedule(schedule)}
              </div>
            </div>
          </div>

          <div className="py-1 flex items-center justify-between">
            <div className="gap-2 flex items-center text-muted-foreground">
              <Shield className="size-3.5 text-muted-foreground" />
              <span>Role</span>
            </div>
            <span className="font-semibold text-foreground">
              {workspaceRole}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

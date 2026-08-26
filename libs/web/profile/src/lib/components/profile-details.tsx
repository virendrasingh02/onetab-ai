import type { CurrentUser } from '@org/types';
import { Badge, LocalTime } from '@org/ui';
import {
  describeTimezone,
  formatZoneDifference,
  getRegionForTimezone,
  getSystemTimezone,
  getWorkingHoursStatus,
} from '@org/utils';
import {
  Briefcase,
  Calendar,
  Clock,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  ShieldCheck,
  User as UserIcon,
} from 'lucide-react';

export interface ProfileDetailsProps {
  user: CurrentUser;
  workspaceRole?: string;
}

export function ProfileDetails({ user, workspaceRole = 'Member' }: ProfileDetailsProps) {
  const userTimezone = user.timezone || 'UTC';
  const region = getRegionForTimezone(userTimezone);
  const viewerZone = getSystemTimezone();
  const diff = formatZoneDifference(userTimezone, viewerZone);
  const workStatus = getWorkingHoursStatus(userTimezone);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-foreground">
      {/* Box 1: About & Bio */}
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <UserIcon className="size-3.5 text-primary" />
          <span>About Me</span>
        </h3>
        <p className="text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {user.bio || 'No bio provided. Click "Edit Profile" to share what you are working on.'}
        </p>
      </div>

      {/* Box 2: Work & Role */}
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Briefcase className="size-3.5 text-primary" />
          <span>Work &amp; Organization</span>
        </h3>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Role:</span>
            <Badge variant="primary" className="text-[10px] font-semibold">
              {workspaceRole}
            </Badge>
          </div>
          {user.jobTitle && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Job Title:</span>
              <span className="font-medium text-foreground">{user.jobTitle}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">System Standing:</span>
            <span className="font-mono text-muted-foreground">{user.systemRole}</span>
          </div>
        </div>
      </div>

      {/* Box 3: Contact & Links */}
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Mail className="size-3.5 text-primary" />
          <span>Contact &amp; Links</span>
        </h3>
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email:</span>
            <span className="font-mono font-medium text-foreground">{user.email}</span>
          </div>

          {user.location && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <MapPin className="size-3" /> Location:
              </span>
              <span className="font-medium text-foreground">{user.location}</span>
            </div>
          )}

          {user.website && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Globe className="size-3" /> Website:
              </span>
              <a
                href={user.website.startsWith('http') ? user.website : `https://${user.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <span>{user.website.replace(/^https?:\/\//, '')}</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
          )}

          {user.github && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">GitHub:</span>
              <a
                href={`https://github.com/${user.github.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                @{user.github.replace(/^@/, '')}
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Box 4: Regional Timezone & Hours */}
      <div className="rounded-2xl border border-border bg-surface p-5 space-y-3 shadow-xs">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Clock className="size-3.5 text-primary" />
            <span>Timezone &amp; Local Clock</span>
          </h3>
          <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <span>{workStatus.icon}</span>
            <span>{workStatus.status === 'working' ? 'Working' : 'Off-hours'}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl border border-border/80 bg-surface-raised flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <span className="text-xl leading-none">{region.flag}</span>
            <div>
              <div className="font-semibold text-foreground">{describeTimezone(userTimezone)}</div>
              <div className="text-[11px] text-muted-foreground">{diff === 'same time as you' ? 'Same time as you' : diff}</div>
            </div>
          </div>

          <LocalTime
            timezone={userTimezone}
            className="font-mono font-bold text-base text-foreground"
          />
        </div>
      </div>
    </div>
  );
}

import type { CurrentUser, PublicUser, WorkspaceMember } from '@org/types';
import {
  cn,
  describeTimezone,
  formatDateInZone,
  formatTimeInZone,
  formatZoneDifference,
  formatZoneOffset,
  getRegionForTimezone,
  getSystemTimezone,
  getWorkingHoursStatus,
} from '@org/utils';
import {
  Copy,
  Globe,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { create } from 'zustand';
import { UserAvatar } from './avatar.js';
import { Button } from './button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './dialog.js';
import { useMinuteTick } from './local-time.js';
import { ScrollArea } from './scroll-area.js';

interface WorldClockState {
  isOpen: boolean;
  openWorldClock: () => void;
  closeWorldClock: () => void;
}

export const useWorldClockStore = create<WorldClockState>((set) => ({
  isOpen: false,
  openWorldClock: () => set({ isOpen: true }),
  closeWorldClock: () => set({ isOpen: false }),
}));

export interface TeamMemberData {
  id: string;
  name: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  timezone: string;
  statusEmoji?: string | null;
  statusText?: string | null;
}

export interface TeamWorldClockModalProps {
  currentUser?: CurrentUser | null;
  members?: (WorkspaceMember | PublicUser | TeamMemberData)[];
}

export function TeamWorldClockModal({
  currentUser,
  members = [],
}: TeamWorldClockModalProps) {
  const isOpen = useWorldClockStore((s) => s.isOpen);
  const closeWorldClock = useWorldClockStore((s) => s.closeWorldClock);
  const now = useMinuteTick();

  const [activeTab, setActiveTab] = useState<'clocks' | 'planner'>('clocks');
  const [selectedHour, setSelectedHour] = useState<number>(() => now.getUTCHours());

  const viewerTimezone = currentUser?.timezone || getSystemTimezone();

  // Normalize member list
  const teamList: TeamMemberData[] = useMemo(() => {
    const list: TeamMemberData[] = [];
    const seen = new Set<string>();

    if (currentUser) {
      list.push({
        id: currentUser.id,
        name: currentUser.name,
        displayName: currentUser.displayName,
        avatarUrl: currentUser.avatarUrl,
        timezone: currentUser.timezone,
        statusEmoji: currentUser.statusEmoji,
        statusText: currentUser.statusText,
      });
      seen.add(currentUser.id);
    }

    for (const m of members) {
      const user = 'user' in m ? m.user : m;
      if (user && !seen.has(user.id)) {
        seen.add(user.id);
        list.push({
          id: user.id,
          name: user.name,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          timezone: user.timezone || 'UTC',
          statusEmoji: user.statusEmoji,
          statusText: user.statusText,
        });
      }
    }

    return list;
  }, [currentUser, members]);

  // Group members by timezone
  const timezoneGroups = useMemo(() => {
    const map = new Map<string, { timezone: string; members: TeamMemberData[] }>();

    for (const member of teamList) {
      const tz = member.timezone || 'UTC';
      if (!map.has(tz)) {
        map.set(tz, { timezone: tz, members: [] });
      }
      map.get(tz)!.members.push(member);
    }

    // Sort by viewer zone first, then by timezone name
    return Array.from(map.values()).sort((a, b) => {
      if (a.timezone === viewerTimezone) return -1;
      if (b.timezone === viewerTimezone) return 1;
      return a.timezone.localeCompare(b.timezone);
    });
  }, [teamList, viewerTimezone]);

  const handleCopyMeetingTime = () => {
    const d = new Date();
    d.setUTCHours(selectedHour, 0, 0, 0);

    const lines = timezoneGroups.map((g) => {
      const region = getRegionForTimezone(g.timezone);
      const timeStr = formatTimeInZone(d, g.timezone);
      const tzName = describeTimezone(g.timezone);
      return `${region.flag} ${timeStr} (${tzName})`;
    });

    const text = `📅 Recommended Meeting Time:\n${lines.join('\n')}`;
    navigator.clipboard.writeText(text);
    toast.success('Meeting times copied to clipboard!');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeWorldClock()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-border bg-popover text-foreground">
        <DialogHeader className="p-5 pb-3 border-b border-border flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Globe className="size-4.5 text-primary" />
              Team Time Zones & World Clock
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Coordinate across regions, check working hours, and find meeting overlaps.
            </DialogDescription>
          </div>

          <div className="flex items-center gap-1 bg-surface rounded-lg p-0.5 border border-border">
            <button
              type="button"
              onClick={() => setActiveTab('clocks')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                activeTab === 'clocks'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              World Clocks
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('planner')}
              className={cn(
                'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                activeTab === 'planner'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Meeting Planner
            </button>
          </div>
        </DialogHeader>

        <div className="p-5">
          {activeTab === 'clocks' ? (
            /* Clocks Grid View */
            <ScrollArea className="max-h-[60vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {timezoneGroups.map((group) => {
                  const region = getRegionForTimezone(group.timezone);
                  const isViewer = group.timezone === viewerTimezone;
                  const timeFormatted = formatTimeInZone(now, group.timezone, {
                    seconds: true,
                  });
                  const dateFormatted = formatDateInZone(now, group.timezone);
                  const offsetFormatted = formatZoneOffset(group.timezone, now);
                  const diffFormatted = isViewer
                    ? 'Your timezone'
                    : formatZoneDifference(group.timezone, viewerTimezone, now);
                  const workStatus = getWorkingHoursStatus(group.timezone, now);

                  return (
                    <div
                      key={group.timezone}
                      className={cn(
                        'p-4 rounded-xl border transition-all',
                        isViewer
                          ? 'border-primary/40 bg-primary/5 shadow-xs'
                          : 'border-border bg-surface/50 hover:bg-surface',
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xl leading-none">{region.flag}</span>
                          <div>
                            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                              <span className="truncate">{describeTimezone(group.timezone)}</span>
                              {isViewer && (
                                <span className="text-[9px] bg-primary text-primary-foreground px-1.5 py-0.2 rounded-full font-bold">
                                  YOU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {dateFormatted} · {offsetFormatted}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono text-base font-bold text-foreground">
                            {timeFormatted}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {diffFormatted}
                          </div>
                        </div>
                      </div>

                      {/* Working hours status indicator */}
                      <div className="mt-3 flex items-center justify-between pt-2.5 border-t border-border/50 text-xs">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full',
                            workStatus.status === 'working'
                              ? 'bg-success/15 text-success'
                              : workStatus.status === 'sleeping'
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-warning/15 text-warning',
                          )}
                        >
                          <span>{workStatus.icon}</span>
                          <span>{workStatus.label}</span>
                        </span>

                        {/* Members in this timezone */}
                        <div className="flex items-center -space-x-1.5 overflow-hidden">
                          {group.members.slice(0, 4).map((member) => (
                            <UserAvatar
                              key={member.id}
                              name={member.displayName ?? member.name}
                              src={member.avatarUrl}
                              seed={member.id}
                              size="xs"
                              className="size-5 ring-1 ring-background"
                              statusEmoji={member.statusEmoji}
                              statusText={member.statusText}
                            />
                          ))}
                          {group.members.length > 4 && (
                            <span className="text-[9px] font-bold text-muted-foreground pl-1">
                              +{group.members.length - 4}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            /* Meeting Overlap Time Planner */
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  Slide or select an hour (UTC) to preview the team's local time:
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyMeetingTime}
                  className="h-7 text-xs gap-1.5"
                >
                  <Copy className="size-3.5" />
                  Copy Meeting Schedule
                </Button>
              </div>

              {/* Hour selector slider */}
              <div className="space-y-1 bg-surface-inset p-3 rounded-xl border border-border">
                <div className="flex items-center justify-between text-xs font-mono font-semibold text-foreground">
                  <span>UTC Hour: {String(selectedHour).padStart(2, '0')}:00</span>
                  <span className="text-[11px] text-muted-foreground">
                    Viewer Time: {formatTimeInZone(new Date(Date.UTC(2026, 0, 1, selectedHour, 0)), viewerTimezone)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={23}
                  step={1}
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(parseInt(e.target.value, 10))}
                  className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[9px] text-muted-foreground font-mono">
                  <span>00:00</span>
                  <span>06:00</span>
                  <span>12:00</span>
                  <span>18:00</span>
                  <span>23:00</span>
                </div>
              </div>

              {/* Matrix of timezones */}
              <ScrollArea className="max-h-72">
                <div className="space-y-2">
                  {timezoneGroups.map((group) => {
                    const region = getRegionForTimezone(group.timezone);
                    const simulatedDate = new Date(Date.UTC(2026, 0, 1, selectedHour, 0));
                    const timeInZone = formatTimeInZone(simulatedDate, group.timezone);
                    const workStatus = getWorkingHoursStatus(group.timezone, simulatedDate);

                    return (
                      <div
                        key={group.timezone}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-surface text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base leading-none">{region.flag}</span>
                          <span className="font-medium text-foreground truncate">
                            {describeTimezone(group.timezone)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({group.members.length} {group.members.length === 1 ? 'member' : 'members'})
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            className={cn(
                              'text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1',
                              workStatus.status === 'working'
                                ? 'bg-success/15 text-success'
                                : workStatus.status === 'sleeping'
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-warning/15 text-warning',
                            )}
                          >
                            <span>{workStatus.icon}</span>
                            <span>{workStatus.label}</span>
                          </span>

                          <span className="font-mono font-bold text-foreground text-sm">
                            {timeInZone}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

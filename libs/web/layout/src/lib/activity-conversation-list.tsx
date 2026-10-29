import { useCurrentUser } from '@org/auth';
import {
  useDirectMessageActivity,
  useNotificationFeed,
  type ActivityIndicator,
} from '@org/notifications';
import { useUserPresenceMap } from '@org/realtime';
import type { ChannelSummary, WorkspaceMember } from '@org/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  GroupAvatar,
  Hint,
  SkeletonList,
  toPresenceStatus,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  useDirectMessagePreferences,
  useGroupDirectMessages,
  type GroupDirectMessageSummary,
  type LiveRoomActivity,
  type RoomActivityEntry,
} from '@org/web-chat';
import { useMembers } from '@org/web-members';
import { Hash, LayoutList, Lock } from 'lucide-react';
import { Fragment, useMemo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import type { ActivityRowContent } from './activity-row-link.js';
import { DirectMessageRow, GroupDmRow } from './direct-messages-section.js';
import { mergeDirectMessageActivity } from './merge-dm-activity.js';
import {
  useSidebarStore,
  type ActivityListFilter,
  type SidebarLayoutMode,
} from './navigation/sidebar-store.js';

/**
 * The Matrix room behind a channel: matched by name first (how rooms are
 * created), then by the stored room id.
 */
export function liveRoomForChannel(
  live: LiveRoomActivity,
  channel: { name: string },
): RoomActivityEntry | undefined {
  const byName = live.byChannelName.get(channel.name.toLowerCase().trim());
  if (byName) return byName;
  const roomId = (channel as { matrixRoomId?: unknown }).matrixRoomId;
  return typeof roomId === 'string' ? live.byRoomId.get(roomId) : undefined;
}

const FILTERS: { value: Exclude<ActivityListFilter, 'all'>; label: string }[] =
  [
    { value: 'unreads', label: 'Unreads' },
    { value: 'dms', label: 'DMs' },
    { value: 'channels', label: 'Channels' },
  ];

type ConversationSource =
  | { kind: 'channel'; channel: ChannelSummary }
  | { kind: 'dm'; member: WorkspaceMember; activity?: ActivityIndicator }
  | { kind: 'group'; group: GroupDirectMessageSummary };

interface ConversationItem {
  key: string;
  name: string;
  source: ConversationSource;
  content: ActivityRowContent;
  /** The open conversation — kept under the Unreads filter while you read it. */
  isOpen: boolean;
  lastActivityAt?: number;
  activity: { level: ActivityIndicator['level']; count: number };
  isMuted: boolean;
}

function previewLine(
  entry: RoomActivityEntry | undefined,
  selfId: string | undefined,
  showSender: boolean,
): string | undefined {
  const preview = entry?.latestPreview;
  if (!preview) return undefined;
  const body = preview.body.replace(/\s+/g, ' ').trim() || 'Sent an attachment';
  if (selfId && preview.senderUserId === selfId) return `You: ${body}`;
  if (!showSender || !preview.senderName) return body;
  return `${preview.senderName.split(' ')[0]}: ${body}`;
}

function toIndicator(
  feed: ActivityIndicator | undefined,
  live: { unreadCount: number; mentionCount: number } | undefined,
): { level: ActivityIndicator['level']; count: number } {
  const mentions = Math.max(feed?.mentionCount ?? 0, live?.mentionCount ?? 0);
  if (mentions > 0) return { level: 'mention', count: mentions };
  const unread = Math.max(feed?.count ?? 0, live?.unreadCount ?? 0);
  const feedLevel = feed && feed.level !== 'none' ? feed.level : undefined;
  if (unread > 0 || feedLevel) {
    return { level: feedLevel ?? 'activity', count: unread };
  }
  return { level: 'none', count: 0 };
}

/** The view switch shared by both sidebar layouts. */
export function SidebarLayoutMenu({ className }: { className?: string }) {
  const layoutMode = useSidebarStore((s) => s.layoutMode);
  const setLayoutMode = useSidebarStore((s) => s.setLayoutMode);
  return (
    <DropdownMenu>
      <Hint label="Sidebar view">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Change sidebar view"
            className={cn(
              'size-6 p-0 inline-flex shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
              'outline-none focus-visible:ring-1 focus-visible:ring-ring',
              className,
            )}
          >
            <LayoutList className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent align="end" side="bottom" className="w-56">
        <DropdownMenuLabel className="tracking-wide text-[11px] text-muted-foreground uppercase">
          Sidebar view
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={layoutMode}
          onValueChange={(value) => setLayoutMode(value as SidebarLayoutMode)}
        >
          <DropdownMenuRadioItem value="sections" className="text-xs">
            Sections
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="activity" className="text-xs">
            Activity — newest first
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Every joined channel, 1:1 DM and group conversation in one list, newest
 * message first, each with its last message as a preview line — the
 * alternative to the sectioned sidebar (`layoutMode: 'activity'`). Previews,
 * timestamps and live counts come from the Matrix client; the feed backs up
 * unread state for rooms it has not synced.
 *
 * Each entry is the same row component the sectioned view uses, drawn in its
 * activity layout, so the ⋯ menu, right-click menu, favorite star and dialogs
 * match between the two views. Channel rows come from `renderChannelRow`
 * because `ChannelRow` lives with `ChannelNav`, which renders this list.
 */
export function ActivityConversationList({
  workspaceId,
  workspaceSlug,
  channels,
  channelActivity,
  liveRoomActivity,
  isLoading = false,
  renderChannelRow,
}: {
  workspaceId: string;
  workspaceSlug: string;
  /** Joined channels. */
  channels: ChannelSummary[];
  channelActivity?: Record<string, ActivityIndicator>;
  liveRoomActivity?: LiveRoomActivity;
  isLoading?: boolean;
  renderChannelRow: (
    channel: ChannelSummary,
    content: ActivityRowContent,
  ) => ReactNode;
}) {
  const { pathname, search } = useLocation();
  const currentUser = useCurrentUser();
  const members = useMembers(workspaceId);
  const groups = useGroupDirectMessages();
  const presenceMap = useUserPresenceMap();
  const dmPreferences = useDirectMessagePreferences(workspaceId);
  const { favoriteIds, mutedIds } = dmPreferences;
  const filter = useSidebarStore((s) => s.activityFilter);
  const setFilter = useSidebarStore((s) => s.setActivityFilter);

  // Same cached feed AppShell already fetches — no extra request.
  const notificationFeed = useNotificationFeed(workspaceId);
  const feedDmActivity = useDirectMessageActivity(
    workspaceId,
    notificationFeed.data,
  );

  const items = useMemo<ConversationItem[]>(() => {
    const selfId = currentUser?.id;
    const live = liveRoomActivity;
    const result: ConversationItem[] = [];
    const roomParam = new URLSearchParams(search).get('room');

    const channelNames = new Set<string>();
    for (const channel of channels) {
      channelNames.add(channel.name.toLowerCase().trim());
      const entry = live ? liveRoomForChannel(live, channel) : undefined;
      const to = `/w/${workspaceSlug}/c/${channel.slug}`;
      const Icon = channel.visibility === 'PRIVATE' ? Lock : Hash;
      result.push({
        key: `channel:${channel.id}`,
        name: channel.name,
        source: { kind: 'channel', channel },
        content: {
          avatar: (
            <span className="size-8 inline-flex shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Icon className="size-4" aria-hidden />
            </span>
          ),
          preview: previewLine(entry, selfId, true),
          emptyPreview: 'No messages yet',
          lastActivityAt: entry?.lastActivityAt,
        },
        isOpen: pathname === to || pathname.startsWith(`${to}/`),
        lastActivityAt: entry?.lastActivityAt,
        activity: toIndicator(channelActivity?.[channel.id], entry),
        isMuted: channel.membership?.isMuted ?? false,
      });
    }

    const liveDmCounts: Record<
      string,
      { unreadCount: number; mentionCount: number }
    > = {};
    for (const [peerId, entry] of live?.byDirectPeerId ?? []) {
      liveDmCounts[peerId] = {
        unreadCount: entry.unreadCount,
        mentionCount: entry.mentionCount,
      };
    }
    const dmActivity = mergeDirectMessageActivity(feedDmActivity, liveDmCounts);

    const seenPeople = new Set<string>();
    for (const member of members.data ?? []) {
      const peerId = member.user.id;
      if (peerId === selfId || seenPeople.has(peerId)) continue;
      seenPeople.add(peerId);
      const entry = live?.byDirectPeerId.get(peerId);
      const feed = dmActivity[peerId];
      // Only conversations that exist — not the whole workspace roster.
      if (!entry && (!feed || feed.level === 'none')) continue;
      const name = member.user.displayName ?? member.user.name;
      const presence =
        presenceMap[peerId]?.status ?? toPresenceStatus(member.user.presence);
      result.push({
        key: `dm:${peerId}`,
        name,
        source: { kind: 'dm', member, activity: feed },
        content: {
          avatar: (
            <UserAvatar
              name={name}
              src={member.user.avatarUrl}
              seed={peerId}
              size="md"
              presence={presence}
              statusEmoji={member.user.statusEmoji}
              statusText={member.user.statusText}
              className="shrink-0"
            />
          ),
          preview: previewLine(entry, selfId, false),
          lastActivityAt: entry?.lastActivityAt,
        },
        isOpen: pathname === `/w/${workspaceSlug}/dms/${peerId}`,
        lastActivityAt: entry?.lastActivityAt,
        activity: toIndicator(feed, entry),
        isMuted: mutedIds.includes(peerId),
      });
    }

    const seenRooms = new Set<string>();
    for (const group of groups) {
      if (!group.roomId || seenRooms.has(group.roomId)) continue;
      // A channel's own room also reports as a multi-member room.
      if (channelNames.has(group.name.toLowerCase().trim())) continue;
      seenRooms.add(group.roomId);
      const entry = live?.byRoomId.get(group.roomId);
      const isOpen =
        pathname === `/w/${workspaceSlug}/dms` && roomParam === group.roomId;
      result.push({
        key: `group:${group.roomId}`,
        name: group.name,
        source: { kind: 'group', group },
        content: {
          avatar: (
            <GroupAvatar
              name={group.name}
              avatarUrl={group.avatarUrl}
              members={group.avatarMembers}
              size="md"
              className="shrink-0"
            />
          ),
          preview: previewLine(entry, selfId, true),
          lastActivityAt: entry?.lastActivityAt ?? group.lastActivityAt,
          isActive: isOpen,
        },
        isOpen,
        lastActivityAt: entry?.lastActivityAt ?? group.lastActivityAt,
        activity: toIndicator(undefined, {
          unreadCount: group.unreadCount,
          mentionCount: group.mentionCount,
        }),
        isMuted: mutedIds.includes(group.roomId),
      });
    }

    return result.sort(
      (a, b) =>
        (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0) ||
        a.name.localeCompare(b.name),
    );
  }, [
    channels,
    channelActivity,
    liveRoomActivity,
    feedDmActivity,
    members.data,
    groups,
    presenceMap,
    mutedIds,
    currentUser?.id,
    workspaceSlug,
    pathname,
    search,
  ]);

  const visible = useMemo(() => {
    switch (filter) {
      case 'unreads':
        // The open conversation stays put so reading it doesn't yank the row.
        return items.filter(
          (i) =>
            i.isOpen ||
            i.activity.level === 'mention' ||
            (!i.isMuted && i.activity.level !== 'none'),
        );
      case 'dms':
        return items.filter((i) => i.source.kind !== 'channel');
      case 'channels':
        return items.filter((i) => i.source.kind === 'channel');
      default:
        return items;
    }
  }, [items, filter]);

  const showSkeleton =
    items.length === 0 && (isLoading || !liveRoomActivity?.ready);

  const renderRow = (item: ConversationItem) => {
    const { source } = item;
    switch (source.kind) {
      case 'channel':
        return renderChannelRow(source.channel, item.content);
      case 'dm':
        return (
          <DirectMessageRow
            member={source.member}
            workspaceId={workspaceId}
            workspaceSlug={workspaceSlug}
            isFavorite={favoriteIds.includes(source.member.user.id)}
            isMuted={item.isMuted}
            activity={source.activity}
            onToggleFavorite={() =>
              dmPreferences.toggleFavorite(source.member.user.id)
            }
            onToggleMuted={() =>
              dmPreferences.toggleMuted(source.member.user.id)
            }
            activityContent={item.content}
          />
        );
      case 'group':
        return (
          <GroupDmRow
            group={source.group}
            workspaceSlug={workspaceSlug}
            isFavorite={favoriteIds.includes(source.group.roomId)}
            isMuted={item.isMuted}
            onToggleFavorite={() =>
              dmPreferences.toggleFavorite(source.group.roomId)
            }
            onToggleMuted={() => dmPreferences.toggleMuted(source.group.roomId)}
            activityContent={item.content}
          />
        );
    }
  };

  return (
    <section aria-label="Conversations" className="space-y-2">
      <div className="gap-1.5 px-1 flex items-center">
        <div
          role="group"
          aria-label="Filter conversations"
          className="gap-1.5 min-w-0 flex flex-1 flex-wrap items-center"
        >
          {FILTERS.map((chip) => {
            const selected = filter === chip.value;
            return (
              <button
                key={chip.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setFilter(selected ? 'all' : chip.value)}
                className={cn(
                  'h-6 px-2.5 text-xs font-medium rounded-full border transition-colors',
                  'outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  'pointer-coarse:h-8',
                  selected
                    ? 'border-primary/30 bg-primary/12 text-primary-text'
                    : 'border-border text-foreground/80 hover:bg-accent hover:text-foreground',
                )}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
        <SidebarLayoutMenu />
      </div>

      {showSkeleton ? (
        <SkeletonList rows={6} className="gap-2 px-1 py-1" />
      ) : visible.length === 0 ? (
        <p className="px-2 py-6 text-xs text-center text-muted-foreground">
          {filter === 'unreads'
            ? 'You’re all caught up.'
            : filter === 'dms'
              ? 'No direct messages yet.'
              : filter === 'channels'
                ? 'You have not joined any channels yet.'
                : 'No conversations yet.'}
        </p>
      ) : (
        <ul className="space-y-0.5">
          {visible.map((item) => (
            <Fragment key={item.key}>{renderRow(item)}</Fragment>
          ))}
        </ul>
      )}
    </section>
  );
}

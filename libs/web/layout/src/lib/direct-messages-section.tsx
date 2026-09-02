import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCurrentUser } from '@org/auth';
import { useUserPresenceMap } from '@org/realtime';
import type { WorkspaceMember } from '@org/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  Hint,
  PRESENCE_LABELS,
  SidebarActivityIndicator,
  toPresenceStatus,
  UserAvatar,
  type PresenceStatus,
} from '@org/ui';
import {
  useDirectMessageActivity,
  useNotificationFeed,
  type ActivityIndicator,
} from '@org/notifications';
import { cn } from '@org/utils';
import { useChannels } from '@org/web-channels';
import {
  useDirectMessagePreferences,
  useGroupDirectMessages,
  type GroupDirectMessageSummary,
} from '@org/web-chat';
import { useMembers } from '@org/web-members';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Bell,
  BellOff,
  Check,
  Copy,
  Mail,
  Plus,
  Star,
  UserRound,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FavoriteToggle,
  navActionClass,
  navIconClass,
  navRowClass,
  NavRowActions,
  NavRowMenuTrigger,
  Section,
  useCopyLink,
} from './nav-primitives.js';
import { useSidebarStore } from './navigation/sidebar-store.js';

const PRESENCE_DOT: Record<PresenceStatus, string> = {
  online: 'bg-success',
  away: 'bg-warning',
  busy: 'bg-destructive',
  offline: 'bg-muted-foreground/60',
};

/**
 * One person's row.
 */
function DirectMessageRow({
  member,
  workspaceSlug,
  isFavorite,
  isMuted,
  activity,
  onToggleFavorite,
  onToggleMuted,
}: {
  member: WorkspaceMember;
  workspaceSlug: string;
  isFavorite: boolean;
  isMuted: boolean;
  activity?: ActivityIndicator;
  onToggleFavorite: () => void;
  onToggleMuted: () => void;
}) {
  const navigate = useNavigate();
  const [unreadState, setUnreadState] = useState(false);
  const unreadTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const presenceMap = useUserPresenceMap();
  const name = member.user.displayName ?? member.user.name;
  const livePresence = presenceMap[member.user.id];
  const presence =
    livePresence?.status ?? toPresenceStatus(member.user.presence);
  const hasUnread = !isMuted && !!activity && activity.level !== 'none';
  const to = `/w/${workspaceSlug}/dms/${member.user.id}`;
  const { copied, copy: handleCopyLink } = useCopyLink(
    `${window.location.origin}${to}`,
  );

  useEffect(() => () => clearTimeout(unreadTimer.current), []);

  const handleMarkUnread = useCallback(() => {
    setUnreadState(true);
    clearTimeout(unreadTimer.current);
    unreadTimer.current = setTimeout(() => setUnreadState(false), 2000);
  }, []);

  return (
    <li className="group/row relative">
      <NavLink
        to={to}
        className={({ isActive }) =>
          navRowClass(isActive, {
            depth: 1,
            extra: cn(
              'pr-14',
              isMuted && 'text-muted-foreground',
              hasUnread && 'font-semibold text-foreground',
            ),
          })
        }
      >
        <div className="relative shrink-0">
          <UserAvatar
            name={name}
            src={member.user.avatarUrl}
            seed={member.user.id}
            indicator={false}
            className="size-4"
          />
          <Hint label={PRESENCE_LABELS[presence]} side="top">
            <span
              title={PRESENCE_LABELS[presence]}
              aria-label={`${name} is ${PRESENCE_LABELS[presence]}`}
              className={cn(
                'right-0 bottom-0 size-1.5 pointer-events-auto absolute cursor-default rounded-full ring-1 ring-background',
                PRESENCE_DOT[presence],
              )}
            />
          </Hint>
        </div>

        <span className="flex-1 truncate">{name}</span>

        <SidebarActivityIndicator
          surface="dms"
          itemLabel={name}
          state={{
            activityType: activity?.level,
            unreadCount:
              activity?.level === 'mention'
                ? activity?.mentionCount
                : activity?.count,
            isMuted,
          }}
          className="mr-1"
        />

        {isMuted && (
          <Hint label="Notifications muted">
            <BellOff className="mr-1 size-3 shrink-0 text-muted-foreground/70" />
          </Hint>
        )}
      </NavLink>

      <NavRowActions isPinned={isFavorite}>
        <FavoriteToggle isFavorite={isFavorite} onToggle={onToggleFavorite} />

        <DropdownMenu modal={false}>
          <NavRowMenuTrigger label={`Options for ${name}`} />
          <DropdownMenuContent align="end" side="bottom" className="w-60">
            <div className="px-2 py-1.5 border-b border-border/60">
              <div className="gap-2 flex items-center">
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    PRESENCE_DOT[presence],
                  )}
                />
                <span className="text-xs font-semibold truncate text-foreground">
                  {name}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {PRESENCE_LABELS[presence]} · @{member.user.name}
              </span>
            </div>

            <DropdownMenuItem
              onSelect={handleMarkUnread}
              className="mt-1 justify-between"
            >
              <div className="gap-2.5 flex items-center">
                {unreadState ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <Mail className="size-4" />
                )}
                <span>
                  {unreadState ? 'Marked as unread!' : 'Mark as unread'}
                </span>
              </div>
              <DropdownMenuShortcut>U</DropdownMenuShortcut>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={handleCopyLink}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                {copied ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span>{copied ? 'Link copied!' : 'Copy link'}</span>
              </div>
              <DropdownMenuShortcut>C</DropdownMenuShortcut>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={onToggleFavorite}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-accent-amber',
                  )}
                />
                <span>{isFavorite ? 'Remove Favorite' : 'Favorite'}</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={onToggleMuted}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                {isMuted ? (
                  <Bell className="size-4" />
                ) : (
                  <BellOff className="size-4" />
                )}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() => navigate(`/w/${workspaceSlug}/members`)}
              className="gap-2.5"
            >
              <UserRound className="size-4" />
              <span>View Profile</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </NavRowActions>
    </li>
  );
}

function SortableDirectMessageRow(props: {
  member: WorkspaceMember;
  workspaceSlug: string;
  isFavorite: boolean;
  isMuted: boolean;
  activity?: ActivityIndicator;
  onToggleFavorite: () => void;
  onToggleMuted: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.member.user.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative',
        isDragging &&
          'z-50 rounded-lg bg-surface-raised opacity-80 shadow-sm ring-1 ring-primary/40',
      )}
      {...attributes}
      {...listeners}
    >
      <DirectMessageRow {...props} />
    </div>
  );
}

/**
 * The reader's own row — a note-to-self conversation, pinned to the top of the
 * list the way every chat app keeps "you" reachable. No favorite / mute menu:
 * there is no one else here to be notified about.
 */
function SelfDmRow({
  member,
  workspaceSlug,
}: {
  member: WorkspaceMember;
  workspaceSlug: string;
}) {
  const name = member.user.displayName ?? member.user.name;
  const to = `/w/${workspaceSlug}/dms/${member.user.id}`;

  return (
    <li className="group/row relative">
      <NavLink
        to={to}
        className={({ isActive }) => navRowClass(isActive, { depth: 1 })}
      >
        <UserAvatar
          name={name}
          src={member.user.avatarUrl}
          seed={member.user.id}
          indicator={false}
          className="size-4 shrink-0"
        />
        <span className="flex-1 truncate">{name}</span>
        <span className="font-medium text-[10px] text-muted-foreground/70">
          you
        </span>
      </NavLink>
    </li>
  );
}

/**
 * A group direct message's row — an avatar stack, its name, and the same
 * favorite / mute controls a 1:1 has, keyed on the room id.
 */
function GroupDmRow({
  group,
  workspaceSlug,
  isFavorite,
  isMuted,
  onToggleFavorite,
  onToggleMuted,
}: {
  group: GroupDirectMessageSummary;
  workspaceSlug: string;
  isFavorite: boolean;
  isMuted: boolean;
  onToggleFavorite: () => void;
  onToggleMuted: () => void;
}) {
  const to = `/w/${workspaceSlug}/dms?room=${group.roomId}`;
  const { copied, copy: handleCopyLink } = useCopyLink(
    `${window.location.origin}${to}`,
  );
  const hasUnread = !isMuted && group.unreadCount > 0;

  return (
    <li className="group/row relative">
      <NavLink
        to={to}
        className={({ isActive }) =>
          navRowClass(isActive, {
            depth: 1,
            extra: cn(
              'pr-14',
              isMuted && 'text-muted-foreground',
              hasUnread && 'font-semibold text-foreground',
            ),
          })
        }
      >
        <span className="-space-x-1.5 flex shrink-0">
          {(group.avatarMembers.length
            ? group.avatarMembers.slice(0, 2)
            : [{ userId: group.roomId, displayName: group.name }]
          ).map((member) => (
            <UserAvatar
              key={member.userId}
              name={member.displayName}
              src={'avatarUrl' in member ? member.avatarUrl : undefined}
              seed={member.userId}
              indicator={false}
              className="size-4 text-[8px] ring-1 ring-background"
            />
          ))}
        </span>

        <span className="flex-1 truncate">{group.name}</span>

        <SidebarActivityIndicator
          surface="dms"
          itemLabel={group.name}
          state={{ unreadCount: group.unreadCount, isMuted }}
          className="mr-1"
        />
        {isMuted ? (
          <Hint label="Notifications muted">
            <BellOff className="mr-1 size-3 shrink-0 text-muted-foreground/70" />
          </Hint>
        ) : null}
      </NavLink>

      <NavRowActions isPinned={isFavorite}>
        <FavoriteToggle isFavorite={isFavorite} onToggle={onToggleFavorite} />

        <DropdownMenu modal={false}>
          <NavRowMenuTrigger label={`Options for ${group.name}`} />
          <DropdownMenuContent align="end" side="bottom" className="w-56">
            <DropdownMenuItem
              onSelect={handleCopyLink}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                {copied ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <Copy className="size-4" />
                )}
                <span>{copied ? 'Link copied!' : 'Copy link'}</span>
              </div>
              <DropdownMenuShortcut>C</DropdownMenuShortcut>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={onToggleFavorite}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-accent-amber',
                  )}
                />
                <span>{isFavorite ? 'Remove Favorite' : 'Favorite'}</span>
              </div>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={onToggleMuted}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                {isMuted ? (
                  <Bell className="size-4" />
                ) : (
                  <BellOff className="size-4" />
                )}
                <span>{isMuted ? 'Unmute' : 'Mute'}</span>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </NavRowActions>
    </li>
  );
}

/**
 * The people this workspace can message with drag-and-drop sortable ordering,
 * with group conversations listed above them.
 */
export function DirectMessagesSection({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const members = useMembers(workspaceId);
  const groups = useGroupDirectMessages();
  const { data: channels } = useChannels(workspaceId);
  const preferences = useDirectMessagePreferences(workspaceId);
  const dndId = useId();

  /*
   * Shares one query key with the feed AppShell already fetches, so this is a
   * cache read, not a second request. `useDirectMessageActivity` buckets its
   * rows by DM peer — the same data that drives the channel dots.
   */
  const notificationFeed = useNotificationFeed(workspaceId);
  const dmActivity = useDirectMessageActivity(
    workspaceId,
    notificationFeed.data,
  );

  const resourceOrders = useSidebarStore((s) => s.resourceOrders);
  const moveResourceItem = useSidebarStore((s) => s.moveResourceItem);

  const { favoriteIds, mutedIds } = preferences;

  const channelNames = useMemo(
    () => new Set((channels ?? []).map((c) => c.name.toLowerCase().trim())),
    [channels],
  );

  const filteredGroups = useMemo(() => {
    const seenRooms = new Set<string>();
    const seenNames = new Set<string>();

    return groups.filter((group) => {
      if (!group.roomId || seenRooms.has(group.roomId)) return false;
      const lowerName = group.name.toLowerCase().trim();
      // If the group name matches any existing channel name, or if we've already seen this name, exclude it
      if (channelNames.has(lowerName) || seenNames.has(lowerName)) {
        return false;
      }
      seenRooms.add(group.roomId);
      seenNames.add(lowerName);
      return true;
    });
  }, [groups, channelNames]);

  const selfMember = useMemo(
    () =>
      currentUser?.id
        ? (members.data ?? []).find(
            (member) => member.user.id === currentUser.id,
          )
        : undefined,
    [members.data, currentUser?.id],
  );

  const rawPeople = useMemo(() => {
    const seen = new Set<string>();
    const roster = (members.data ?? []).filter((member) => {
      if (member.user.id === currentUser?.id || seen.has(member.user.id)) {
        return false;
      }
      seen.add(member.user.id);
      return true;
    });

    return [
      ...roster.filter((member) => favoriteIds.includes(member.user.id)),
      ...roster.filter((member) => !favoriteIds.includes(member.user.id)),
    ];
  }, [members.data, currentUser?.id, favoriteIds]);

  const customOrder = workspaceId
    ? resourceOrders[workspaceId]?.dms
    : undefined;

  const people = useMemo(() => {
    if (!customOrder || customOrder.length === 0) {
      return rawPeople;
    }
    const map = new Map(rawPeople.map((p) => [p.user.id, p]));
    const result: WorkspaceMember[] = [];

    for (const id of customOrder) {
      const p = map.get(id);
      if (p) {
        result.push(p);
        map.delete(id);
      }
    }

    for (const p of map.values()) {
      result.push(p);
    }

    return result;
  }, [rawPeople, customOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !workspaceId) return;

    moveResourceItem(
      workspaceId,
      'dms',
      active.id as string,
      over.id as string,
      people.map((p) => p.user.id),
    );
  };

  return (
    <Section
      title="Direct Messages"
      count={people.length + filteredGroups.length + (selfMember ? 1 : 0)}
      action={
        <Hint label="New direct message">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="New direct message"
            className="size-5 p-0 opacity-0 transition-opacity duration-150 group-focus-within/section:opacity-100 group-hover/section:opacity-100 focus-visible:opacity-100"
          >
            <NavLink to={`/w/${workspaceSlug}/dms`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {selfMember ? (
        <SelfDmRow member={selfMember} workspaceSlug={workspaceSlug} />
      ) : null}

      {filteredGroups.map((group) => (
        <GroupDmRow
          key={group.roomId}
          group={group}
          workspaceSlug={workspaceSlug}
          isFavorite={favoriteIds.includes(group.roomId)}
          isMuted={mutedIds.includes(group.roomId)}
          onToggleFavorite={() => preferences.toggleFavorite(group.roomId)}
          onToggleMuted={() => preferences.toggleMuted(group.roomId)}
        />
      ))}

      <DndContext
        id={dndId}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={people.map((p) => p.user.id)}
          strategy={verticalListSortingStrategy}
        >
          {people.map((member) => (
            <SortableDirectMessageRow
              key={member.user.id}
              member={member}
              workspaceSlug={workspaceSlug}
              isFavorite={favoriteIds.includes(member.user.id)}
              isMuted={mutedIds.includes(member.user.id)}
              activity={dmActivity[member.user.id]}
              onToggleFavorite={() =>
                preferences.toggleFavorite(member.user.id)
              }
              onToggleMuted={() => preferences.toggleMuted(member.user.id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      <li>
        <NavLink
          to={`/w/${workspaceSlug}/members`}
          className={navActionClass({ depth: 1 })}
        >
          <Plus className={navIconClass(1)} aria-hidden />
          <span className="flex-1 truncate">Add teammates</span>
        </NavLink>
      </li>
    </Section>
  );
}

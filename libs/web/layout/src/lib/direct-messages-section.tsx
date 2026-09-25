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
  ActionDropdownMenu,
  Button,
  copyToClipboard,
  DropdownMenuLabel,
  EntityContextMenu,
  entityUrl,
  Hint,
  PRESENCE_LABELS,
  PresenceDot,
  SidebarActivityIndicator,
  toPresenceStatus,
  UserAvatar,
  GroupAvatar,
  DirectMessagesNavSkeleton,
  useRightPanelStore,
  type EntityAction,
  type PresenceStatus,
} from '@org/ui';
import {
  useDirectMessageActivity,
  useIsFlaggedUnread,
  useMarkDirectMessageSeen,
  useMarkDirectMessageUnread,
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
  Link2,
  Mail,
  MailOpen,
  MessageSquare,
  Plus,
  Star,
  UserRound,
} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
} from 'react';
import { NavLink, useMatch, useNavigate } from 'react-router-dom';
import {
  FavoriteToggle,
  navActionClass,
  navIconClass,
  navRowClass,
  NavRowActions,
  NavRowMenuButton,
  Section,
} from './nav-primitives.js';
import { useSidebarStore } from './navigation/sidebar-store.js';

/**
 * One person's row.
 */
function DirectMessageRow({
  member,
  workspaceId,
  workspaceSlug,
  isFavorite,
  isMuted,
  activity,
  onToggleFavorite,
  onToggleMuted,
}: {
  member: WorkspaceMember;
  workspaceId: string | undefined;
  workspaceSlug: string;
  isFavorite: boolean;
  isMuted: boolean;
  activity?: ActivityIndicator;
  onToggleFavorite: () => void;
  onToggleMuted: () => void;
}) {
  const navigate = useNavigate();
  const presenceMap = useUserPresenceMap();
  const name = member.user.displayName ?? member.user.name;
  const livePresence = presenceMap[member.user.id];
  const presence =
    livePresence?.status ?? toPresenceStatus(member.user.presence);
  const hasUnread = !isMuted && !!activity && activity.level !== 'none';
  const to = `/w/${workspaceSlug}/dms/${member.user.id}`;
  const markUnread = useMarkDirectMessageUnread(workspaceId);
  const markSeen = useMarkDirectMessageSeen(workspaceId);
  const flagged = useIsFlaggedUnread(workspaceId, `dm:${member.user.id}`);
  const isActive = useMatch(to) !== null;

  // Opening the conversation is what reads it — including a manual unread flag.
  useEffect(() => {
    if (isActive && flagged) markSeen(member.user.id);
  }, [isActive, flagged, markSeen, member.user.id]);

  const actions: EntityAction[] = [
    {
      id: 'open',
      group: 'open',
      label: 'Open conversation',
      icon: MessageSquare,
      run: () => navigate(to),
    },
    hasUnread || flagged
      ? {
          id: 'mark-read',
          group: 'state',
          label: 'Mark as read',
          icon: MailOpen,
          shortcut: 'R',
          run: () => markSeen(member.user.id),
        }
      : {
          id: 'mark-unread',
          group: 'state',
          label: 'Mark as unread',
          icon: Mail,
          shortcut: 'U',
          run: () => markUnread(member.user.id),
          successMessage: `Conversation with ${name} marked as unread`,
        },
    {
      id: 'favorite',
      group: 'state',
      label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
      icon: Star,
      shortcut: 'F',
      run: onToggleFavorite,
    },
    {
      id: 'mute',
      group: 'state',
      label: isMuted ? 'Unmute conversation' : 'Mute conversation',
      icon: isMuted ? Bell : BellOff,
      shortcut: 'M',
      run: onToggleMuted,
    },
    {
      id: 'copy-link',
      group: 'share',
      label: 'Copy link',
      icon: Link2,
      shortcut: 'C',
      run: () => copyToClipboard(entityUrl(to)),
    },
    {
      id: 'profile',
      group: 'profile',
      label: 'View profile',
      icon: UserRound,
      run: () => {
        navigate(to);
        useRightPanelStore.getState().openProfile({
          userId: member.user.id,
          name,
          avatarUrl: member.user.avatarUrl ?? undefined,
          role: member.role,
          timezone: member.user.timezone,
          statusEmoji: member.user.statusEmoji,
          statusText: member.user.statusText,
        });
      },
    },
  ];

  const row = (
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
        <UserAvatar
          name={name}
          src={member.user.avatarUrl}
          seed={member.user.id}
          size="xs"
          presence={presence}
          statusEmoji={member.user.statusEmoji}
          statusText={member.user.statusText}
          className="size-4"
        />

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

        <ActionDropdownMenu
          modal={false}
          actions={actions}
          scope={`dm:${member.user.id}`}
          entityType="direct-message"
          entity={member}
          trigger={<NavRowMenuButton label={`Options for ${name}`} />}
          header={
            <DropdownMenuLabel className="normal-case tracking-normal border-b border-border/60 mb-1 pb-1.5">
              <span className="gap-2 flex items-center">
                <PresenceDot presence={presence} hint={false} />
                <span className="text-xs font-semibold truncate text-foreground">
                  {name}
                </span>
              </span>
              <span className="block text-[11px] font-normal text-muted-foreground">
                {PRESENCE_LABELS[presence]} · @{member.user.name}
              </span>
            </DropdownMenuLabel>
          }
        />
      </NavRowActions>
    </li>
  );

  return (
    <EntityContextMenu
      actions={actions}
      scope={`dm:${member.user.id}`}
      entityType="direct-message"
      entity={member}
      label={name}
    >
      {row}
    </EntityContextMenu>
  );
}

function SortableDirectMessageRow(props: {
  member: WorkspaceMember;
  workspaceId: string | undefined;
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
  const presenceMap = useUserPresenceMap();
  const name = member.user.displayName ?? member.user.name;
  const to = `/w/${workspaceSlug}/dms/${member.user.id}`;
  // Your own row: you are looking at the screen, so default to online unless
  // realtime presence says otherwise. The members-list snapshot is `OFFLINE`
  // by default and would be wrong for the one person we know is here.
  const presence: PresenceStatus =
    presenceMap[member.user.id]?.status ?? 'online';

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
          size="xs"
          presence={presence}
          className="size-4"
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
  const navigate = useNavigate();
  const to = `/w/${workspaceSlug}/dms?room=${group.roomId}`;
  const hasUnread = !isMuted && group.unreadCount > 0;

  const actions: EntityAction[] = [
    {
      id: 'open',
      group: 'open',
      label: 'Open conversation',
      icon: MessageSquare,
      run: () => navigate(to),
    },
    {
      id: 'favorite',
      group: 'state',
      label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
      icon: Star,
      shortcut: 'F',
      run: onToggleFavorite,
    },
    {
      id: 'mute',
      group: 'state',
      label: isMuted ? 'Unmute conversation' : 'Mute conversation',
      icon: isMuted ? Bell : BellOff,
      shortcut: 'M',
      run: onToggleMuted,
    },
    {
      id: 'copy-link',
      group: 'share',
      label: 'Copy link',
      icon: Link2,
      shortcut: 'C',
      run: () => copyToClipboard(entityUrl(to)),
    },
  ];

  const row = (
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
        <GroupAvatar
          name={group.name}
          avatarUrl={group.avatarUrl}
          members={group.avatarMembers}
          size="xs"
          className="size-4 shrink-0"
        />

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

        <ActionDropdownMenu
          modal={false}
          actions={actions}
          scope={`group-dm:${group.roomId}`}
          entityType="group-dm"
          entity={group}
          contentClassName="w-56"
          trigger={<NavRowMenuButton label={`Options for ${group.name}`} />}
        />
      </NavRowActions>
    </li>
  );

  return (
    <EntityContextMenu
      actions={actions}
      scope={`group-dm:${group.roomId}`}
      entityType="group-dm"
      entity={group}
      label={group.name}
    >
      {row}
    </EntityContextMenu>
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

  const showDmsSkeleton =
    (!members.data || members.data.length === 0) && members.isLoading;

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
      {showDmsSkeleton ? (
        <DirectMessagesNavSkeleton rows={4} />
      ) : (
        <>
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
                  workspaceId={workspaceId}
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
        </>
      )}

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

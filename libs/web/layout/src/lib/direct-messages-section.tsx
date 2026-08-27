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
  toPresenceStatus,
  type PresenceStatus,
} from '@org/ui';
import { cn } from '@org/utils';
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
  onToggleFavorite,
  onToggleMuted,
}: {
  member: WorkspaceMember;
  workspaceSlug: string;
  isFavorite: boolean;
  isMuted: boolean;
  onToggleFavorite: () => void;
  onToggleMuted: () => void;
}) {
  const navigate = useNavigate();
  const [unreadState, setUnreadState] = useState(false);
  const unreadTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const name = member.user.displayName ?? member.user.name;
  const presence = toPresenceStatus(member.user.presence);
  const to = `/w/${workspaceSlug}/dms?user=${member.user.id}`;
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
            extra: cn('pr-14', isMuted && 'text-muted-foreground'),
          })
        }
      >
        {member.user.avatarUrl ? (
          <div className="relative shrink-0">
            <img
              src={member.user.avatarUrl}
              alt=""
              className="size-4 rounded-full object-cover"
            />
            <span
              className={cn(
                'right-0 bottom-0 absolute size-1.5 rounded-full ring-1 ring-background',
                PRESENCE_DOT[presence],
              )}
            />
          </div>
        ) : (
          <div className="relative shrink-0">
            <div className="size-4 rounded-full bg-accent-amber/20 text-accent-amber flex items-center justify-center text-[9px] font-bold">
              {name.charAt(0).toUpperCase()}
            </div>
            <span
              className={cn(
                'right-0 bottom-0 absolute size-1.5 rounded-full ring-1 ring-background',
                PRESENCE_DOT[presence],
              )}
            />
          </div>
        )}

        <span className="flex-1 truncate">{name}</span>

        {isMuted && (
          <Hint label="Notifications muted">
            <BellOff className="mr-1 size-3 shrink-0 text-muted-foreground/70" />
          </Hint>
        )}
      </NavLink>

      <NavRowActions isPinned={isFavorite}>
        <FavoriteToggle
          isFavorite={isFavorite}
          onToggle={onToggleFavorite}
        />

        <DropdownMenu modal={false}>
          <NavRowMenuTrigger label={`Options for ${name}`} />
          <DropdownMenuContent align="end" side="bottom" className="w-60">
            <div className="px-2 py-1.5 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'size-2 rounded-full shrink-0',
                    PRESENCE_DOT[presence],
                  )}
                />
                <span className="text-xs font-semibold text-foreground truncate">
                  {name}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {PRESENCE_LABELS[presence]} · @{member.user.name}
              </span>
            </div>

            <DropdownMenuItem
              onSelect={handleMarkUnread}
              className="justify-between mt-1"
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
          'z-50 opacity-80 rounded-lg bg-surface-raised ring-1 ring-primary/40 shadow-sm',
      )}
      {...attributes}
      {...listeners}
    >
      <DirectMessageRow {...props} />
    </div>
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
        <span className="shrink-0 flex -space-x-1.5">
          {(group.avatarMembers.length
            ? group.avatarMembers.slice(0, 2)
            : [{ userId: group.roomId, displayName: group.name }]
          ).map((member) => (
            <span
              key={member.userId}
              className="size-4 overflow-hidden rounded-full bg-accent-amber/20 text-[8px] font-bold text-accent-amber ring-1 ring-background flex items-center justify-center"
            >
              {'avatarUrl' in member && member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                member.displayName.charAt(0).toUpperCase()
              )}
            </span>
          ))}
        </span>

        <span className="flex-1 truncate">{group.name}</span>

        {hasUnread ? (
          <span className="mr-1 size-1.5 shrink-0 rounded-full bg-primary" />
        ) : null}
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
  const preferences = useDirectMessagePreferences(workspaceId);
  const dndId = useId();

  const resourceOrders = useSidebarStore((s) => s.resourceOrders);
  const moveResourceItem = useSidebarStore((s) => s.moveResourceItem);

  const { favoriteIds, mutedIds } = preferences;

  const rawPeople = useMemo(() => {
    const roster = (members.data ?? []).filter(
      (member) => member.user.id !== currentUser?.id,
    );

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
      count={people.length + groups.length}
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
      {groups.map((group) => (
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
              onToggleFavorite={() => preferences.toggleFavorite(member.user.id)}
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

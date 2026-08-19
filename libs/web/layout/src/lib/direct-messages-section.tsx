import { useCurrentUser } from '@org/auth';
import type { WorkspaceMember } from '@org/types';
import {
  Badge,
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
import { useDirectMessagePreferences } from '@org/web-chat';
import { useMembers } from '@org/web-members';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Bell,
  BellOff,
  Check,
  ChevronRight,
  Copy,
  Mail,
  Plus,
  Star,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const PRESENCE_DOT: Record<PresenceStatus, string> = {
  online: 'bg-success',
  away: 'bg-warning',
  busy: 'bg-destructive',
  offline: 'bg-muted-foreground/60',
};

/**
 * One person's row.
 *
 * Carries the same hover cluster a channel row does — star plus overflow menu.
 * A DM has no membership record to hang preferences off, so favorite and mute
 * come from `useDirectMessagePreferences`, which is also what the conversation
 * header reads; starring here and starring there are the same switch.
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
        {/*
          The avatar chip is sized off `navIconClass`, not a hand-picked
          `size-5`: at 20px these rows stood 4px taller than the channel and
          project rows in the same sidebar.
        */}
        <span
          className={navIconClass(1, 'relative flex items-center justify-center')}
        >
          {member.user.avatarUrl ? (
            <img
              src={member.user.avatarUrl}
              alt=""
              className="size-full rounded-md object-cover"
            />
          ) : (
            <span
              aria-hidden
              className="flex size-full items-center justify-center rounded-md bg-secondary text-[9px] font-semibold text-foreground"
            >
              {name.charAt(0).toUpperCase()}
            </span>
          )}

          {/*
            The presence dot carried no text alternative, so screen readers
            announced identically-named rows with no status at all.
          */}
          <span
            className={cn(
              'absolute -right-1 -bottom-1 size-2 rounded-full border-2 border-sidebar',
              PRESENCE_DOT[presence],
            )}
          >
            <span className="sr-only">{PRESENCE_LABELS[presence]}</span>
          </span>
        </span>

        <span className="flex-1 truncate flex items-center gap-1.5">
          <span className="truncate">{name}</span>
          {member.user.statusEmoji ? (
            <span
              className="text-[11px] select-none shrink-0"
              title={member.user.statusText ? `${member.user.statusEmoji} ${member.user.statusText}` : undefined}
            >
              {member.user.statusEmoji}
            </span>
          ) : null}
        </span>

        {isMuted ? (
          <Hint label="Notifications muted">
            <BellOff className="mr-1 size-3 shrink-0 text-muted-foreground/70" />
          </Hint>
        ) : null}

        {member.role === 'OWNER' ? (
          <Badge variant="neutral" className="ml-auto h-3.5 px-1 py-0 text-[9px]">
            Owner
          </Badge>
        ) : null}
      </NavLink>

      <NavRowActions isPinned={isFavorite}>
        <FavoriteToggle isFavorite={isFavorite} onToggle={onToggleFavorite} />

        <DropdownMenu modal={false}>
          <NavRowMenuTrigger label={`Options for ${name}`} />
          <DropdownMenuContent align="end" side="bottom" className="w-64">
            <DropdownMenuItem
              onSelect={handleMarkUnread}
              className="justify-between"
            >
              <div className="gap-2.5 flex items-center">
                {unreadState ? (
                  <Check className="size-4 text-success-text" />
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
                  <Check className="size-4 text-success-text" />
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
              <ChevronRight className="size-4 text-muted-foreground/70" />
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={onToggleMuted}
              description={
                isMuted
                  ? 'Turn notifications for this conversation back on.'
                  : 'Keep the conversation in your sidebar without being notified.'
              }
            >
              {isMuted ? (
                <Bell className="size-4" />
              ) : (
                <BellOff className="size-4" />
              )}
              <span>{isMuted ? 'Unmute conversation' : 'Mute conversation'}</span>
            </DropdownMenuItem>

            <DropdownMenuItem
              onSelect={() =>
                navigate(`/w/${workspaceSlug}/settings?tab=notifications`)
              }
              className="gap-2.5"
            >
              <Bell className="size-4" />
              <span>Notification settings</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              onSelect={() => navigate(`/w/${workspaceSlug}/members`)}
              className="gap-2.5"
            >
              <UserRound className="size-4" />
              <span>View profile</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </NavRowActions>
    </li>
  );
}

/**
 * The people this workspace can be messaged.
 *
 * There is no DM endpoint yet, so the roster is the workspace's member list
 * rather than a list of open conversations — which is what it should be either
 * way on a workspace where nobody has messaged anyone. It used to be four
 * invented names with invented unread counts, so every sidebar looked like it
 * had traffic in it.
 *
 * Starred people sort to the top, the way starred channels do; within each half
 * the roster keeps the order the member list came in.
 */
export function DirectMessagesSection({ workspaceSlug }: { workspaceSlug: string }) {
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const members = useMembers(workspaceId);
  const preferences = useDirectMessagePreferences(workspaceId);

  const { favoriteIds, mutedIds } = preferences;

  // Messaging yourself is not a conversation.
  const people = useMemo(() => {
    const roster = (members.data ?? []).filter(
      (member) => member.user.id !== currentUser?.id,
    );

    return [
      ...roster.filter((member) => favoriteIds.includes(member.user.id)),
      ...roster.filter((member) => !favoriteIds.includes(member.user.id)),
    ];
  }, [members.data, currentUser?.id, favoriteIds]);

  return (
    <Section
      title="Direct Messages"
      count={people.length}
      action={
        <Hint label="New direct message">
          <Button
            asChild
            variant="ghost"
            size="icon-sm"
            aria-label="New direct message"
            className="size-5 p-0 opacity-0 transition-opacity duration-150 group-hover/section:opacity-100 group-focus-within/section:opacity-100 focus-visible:opacity-100"
          >
            <NavLink to={`/w/${workspaceSlug}/dms`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {people.map((member) => (
        <DirectMessageRow
          key={member.user.id}
          member={member}
          workspaceSlug={workspaceSlug}
          isFavorite={favoriteIds.includes(member.user.id)}
          isMuted={mutedIds.includes(member.user.id)}
          onToggleFavorite={() => preferences.toggleFavorite(member.user.id)}
          onToggleMuted={() => preferences.toggleMuted(member.user.id)}
        />
      ))}

      {/* Same treatment as "Browse channels" / "Add project" — it used to be a
          nav row with a dashed medallion, unlike every other add affordance. */}
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

import { useCurrentUser } from '@org/auth';
import {
  Badge,
  Button,
  Hint,
  PRESENCE_LABELS,
  toPresenceStatus,
  type PresenceStatus,
} from '@org/ui';
import { cn } from '@org/utils';
import { useMembers } from '@org/web-members';
import { useCurrentWorkspace } from '@org/web-workspace';
import { Plus } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { navActionClass, navIconClass, navRowClass, Section } from './nav-primitives.js';

const PRESENCE_DOT: Record<PresenceStatus, string> = {
  online: 'bg-success',
  away: 'bg-warning',
  busy: 'bg-destructive',
  offline: 'bg-muted-foreground/60',
};

/**
 * The people this workspace can be messaged.
 *
 * There is no DM endpoint yet, so the roster is the workspace's member list
 * rather than a list of open conversations — which is what it should be either
 * way on a workspace where nobody has messaged anyone. It used to be four
 * invented names with invented unread counts, so every sidebar looked like it
 * had traffic in it.
 */
export function DirectMessagesSection({ workspaceSlug }: { workspaceSlug: string }) {
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const members = useMembers(workspaceId);

  // Messaging yourself is not a conversation.
  const people = (members.data ?? []).filter(
    (member) => member.user.id !== currentUser?.id,
  );

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
            className="size-5 p-0"
          >
            <NavLink to={`/w/${workspaceSlug}/dms`}>
              <Plus className="size-3.5" />
            </NavLink>
          </Button>
        </Hint>
      }
    >
      {people.map((member) => {
        const name = member.user.displayName ?? member.user.name;
        const presence = toPresenceStatus(member.user.presence);

        return (
          <li key={member.user.id}>
            <NavLink
              to={`/w/${workspaceSlug}/dms?user=${member.user.id}`}
              className={({ isActive }) => navRowClass(isActive, { depth: 1 })}
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

              <span className="flex-1 truncate">{name}</span>

              {member.role === 'OWNER' ? (
                <Badge variant="neutral" className="ml-auto h-3.5 px-1 py-0 text-[9px]">
                  Owner
                </Badge>
              ) : null}
            </NavLink>
          </li>
        );
      })}

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

import { Badge, Button, Hint } from '@org/ui';
import { cn } from '@org/utils';
import { Plus, Sparkles } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { navActionClass, navIconClass, navRowClass, Section } from './nav-primitives.js';

interface DirectMessage {
  id: string;
  name: string;
  avatarUrl?: string;
  status: 'online' | 'away' | 'dnd' | 'offline';
  unreadCount?: number;
  isAi?: boolean;
}

/** Placeholder roster until the DM endpoint exists. */
const DIRECT_MESSAGES: readonly DirectMessage[] = [
  { id: 'dm_ai', name: 'AI Workspace Copilot', status: 'online', isAi: true },
  { id: 'dm_alex', name: 'Alex Morgan', status: 'online', unreadCount: 2 },
  { id: 'dm_sarah', name: 'Sarah Chen', status: 'away' },
  { id: 'dm_david', name: 'David Miller', status: 'offline', unreadCount: 1 },
];

const PRESENCE_DOT: Record<DirectMessage['status'], string> = {
  online: 'bg-success',
  away: 'bg-warning',
  dnd: 'bg-destructive',
  offline: 'bg-muted-foreground/60',
};

const PRESENCE_LABEL: Record<DirectMessage['status'], string> = {
  online: 'Online',
  away: 'Away',
  dnd: 'Do not disturb',
  offline: 'Offline',
};

export function DirectMessagesSection({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <Section
      title="Direct Messages"
      count={DIRECT_MESSAGES.length}
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
      {DIRECT_MESSAGES.map((dm) => (
        <li key={dm.id}>
          <NavLink
            to={`/w/${workspaceSlug}/dms`}
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
              {dm.isAi ? (
                <span className="flex size-full items-center justify-center rounded-md bg-primary/20 text-primary">
                  <Sparkles className="size-2.5" aria-hidden />
                </span>
              ) : dm.avatarUrl ? (
                <img
                  src={dm.avatarUrl}
                  alt=""
                  className="size-full rounded-md object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex size-full items-center justify-center rounded-md bg-secondary text-[9px] font-semibold text-foreground"
                >
                  {dm.name.charAt(0)}
                </span>
              )}

              {/*
                The presence dot carried no text alternative, so screen readers
                announced four identically-named rows with no status at all.
              */}
              <span
                className={cn(
                  'absolute -right-1 -bottom-1 size-2 rounded-full border-2 border-sidebar',
                  PRESENCE_DOT[dm.status],
                )}
              >
                <span className="sr-only">{PRESENCE_LABEL[dm.status]}</span>
              </span>
            </span>

            <span
              className={cn(
                'flex-1 truncate',
                dm.unreadCount && 'font-semibold text-foreground',
              )}
            >
              {dm.name}
            </span>

            {dm.unreadCount ? (
              <Badge
                variant="count"
                aria-label={`${dm.unreadCount} unread`}
                className="ml-auto"
              >
                {dm.unreadCount}
              </Badge>
            ) : null}
          </NavLink>
        </li>
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

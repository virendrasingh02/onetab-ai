import type { Reaction } from '@org/types';
import { Tooltip, TooltipContent, TooltipTrigger } from '@org/ui';
import { cn } from '@org/utils';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/** Who a user id is, for "Alice and Bob reacted with 👍". */
export interface ReactorProfile {
  name: string;
}

interface ReactorDirectory {
  resolve: (userId: string) => ReactorProfile | undefined;
  myUserId?: string;
}

const ReactorDirectoryContext = createContext<ReactorDirectory>({
  resolve: () => undefined,
});

/**
 * Supplies names to every `ReactionBar` below it, so the hover card can say
 * who reacted without each message renderer threading a member list through.
 */
export function ReactorDirectoryProvider({
  resolve,
  myUserId,
  children,
}: ReactorDirectory & { children: ReactNode }) {
  const value = useMemo(() => ({ resolve, myUserId }), [resolve, myUserId]);
  return (
    <ReactorDirectoryContext.Provider value={value}>
      {children}
    </ReactorDirectoryContext.Provider>
  );
}

/** `@alice:example.org` → `alice`, for someone not in the member list. */
function fallbackName(userId: string): string {
  return userId.replace(/^@/, '').split(':')[0] || userId;
}

/** How long an optimistic toggle may wait for the server's echo. */
const PENDING_TIMEOUT_MS = 5_000;

/** Names listed in full before "and N others". */
const MAX_NAMED = 8;

/**
 * "You, Alice and 3 others" — the reader first, as in Slack, so they can see
 * at a glance that a click will take their reaction back.
 */
export function describeReactors(
  userIds: readonly string[],
  resolve: (userId: string) => ReactorProfile | undefined,
  myUserId?: string,
): string {
  const ordered = [
    ...userIds.filter((id) => id === myUserId),
    ...userIds.filter((id) => id !== myUserId),
  ];
  const names = ordered.map((id) =>
    id === myUserId ? 'You' : (resolve(id)?.name ?? fallbackName(id)),
  );
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];

  const shown = names.slice(0, MAX_NAMED);
  const rest = names.length - shown.length;
  if (rest > 0) {
    return `${shown.join(', ')} and ${rest} other${rest === 1 ? '' : 's'}`;
  }
  return `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
}

export interface ReactionBarProps {
  reactions: readonly Reaction[];
  /**
   * Adds the reader's reaction, or takes it back when they already reacted —
   * one click either way, like Slack and Discord.
   */
  onToggle?: (key: string, reactedByMe: boolean) => void | Promise<unknown>;
  /** The trailing "add reaction" control (a picker trigger). */
  addButton?: ReactNode;
  className?: string;
}

/**
 * A message's reactions as pills: emoji and count, highlighted when the reader
 * is one of the reactors, with a hover card naming who reacted.
 *
 * Clicks apply optimistically — the pill flips at once and settles when the
 * server's echo arrives — and a pill ignores further clicks while its toggle
 * is in flight, so a double-click can't add and remove in a race.
 */
export function ReactionBar({
  reactions,
  onToggle,
  addButton,
  className,
}: ReactionBarProps) {
  const { resolve, myUserId } = useContext(ReactorDirectoryContext);
  // key → whether the reader should now be a reactor, until the echo agrees.
  const [pending, setPending] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(),
  );

  // Drop an override once the real reactions match it (or the pill vanished).
  useEffect(() => {
    setPending((current) => {
      if (current.size === 0) return current;
      let changed = false;
      const next = new Map(current);
      for (const [key, wanted] of current) {
        const actual = reactions.find((r) => r.key === key)?.reactedByMe ?? false;
        if (actual === wanted) {
          next.delete(key);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [reactions]);

  const shown = useMemo(() => {
    const list = reactions.map((reaction) => {
      const wanted = pending.get(reaction.key);
      if (wanted === undefined || wanted === reaction.reactedByMe) return reaction;
      const userIds = wanted
        ? [...reaction.userIds, ...(myUserId ? [myUserId] : [])]
        : reaction.userIds.filter((id) => id !== myUserId);
      return {
        ...reaction,
        reactedByMe: wanted,
        count: Math.max(0, reaction.count + (wanted ? 1 : -1)),
        userIds,
      };
    });
    return list.filter((reaction) => reaction.count > 0);
  }, [reactions, pending, myUserId]);

  const toggle = useCallback(
    (reaction: Reaction) => {
      if (!onToggle || pending.has(reaction.key)) return;
      const wanted = !reaction.reactedByMe;
      setPending((current) => new Map(current).set(reaction.key, wanted));
      const settle = () =>
        setPending((current) => {
          if (current.get(reaction.key) !== wanted) return current;
          const next = new Map(current);
          next.delete(reaction.key);
          return next;
        });
      Promise.resolve(onToggle(reaction.key, reaction.reactedByMe)).then(
        // Normally the echo clears the override first; this only stops a
        // lost echo (or a handler that can't report failure) pinning it.
        () => window.setTimeout(settle, PENDING_TIMEOUT_MS),
        settle,
      );
    },
    [onToggle, pending],
  );

  if (shown.length === 0 && !addButton) return null;

  return (
    <ul className={cn('mt-1.5 gap-1.5 flex flex-wrap items-center', className)}>
      {shown.map((reaction) => {
        const who = describeReactors(reaction.userIds, resolve, myUserId);
        return (
          <li key={reaction.key}>
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={!onToggle}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(reaction);
                  }}
                  // A double-click must not also select the message text.
                  onMouseDown={(event) => {
                    if (event.detail > 1) event.preventDefault();
                  }}
                  aria-pressed={reaction.reactedByMe}
                  aria-label={`${reaction.key} ${reaction.count}: ${who || 'reaction'}${
                    reaction.reactedByMe ? '. Click to remove your reaction' : ''
                  }`}
                  className={cn(
                    'h-7 min-w-11 gap-1.5 pl-2 pr-2.5 flex items-center justify-center rounded-full border text-xs font-semibold',
                    'select-none transition-[background-color,border-color,color,transform] duration-150 active:scale-95',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'disabled:cursor-default disabled:active:scale-100',
                    reaction.reactedByMe
                      ? 'border-primary/60 bg-primary/12 text-primary hover:bg-primary/20'
                      : 'border-border/70 bg-surface-raised text-muted-foreground hover:border-border hover:bg-accent hover:text-foreground',
                  )}
                >
                  <span aria-hidden="true" className="text-base leading-none">
                    {reaction.key}
                  </span>
                  <span className="tabular-nums leading-none">{reaction.count}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="top"
                className="max-w-60 px-3 py-2.5 flex flex-col items-center gap-1.5 text-center"
              >
                <span aria-hidden="true" className="text-3xl leading-none">
                  {reaction.key}
                </span>
                <span className="text-xs leading-snug text-popover-foreground">
                  <span className="font-semibold">{who}</span>{' '}
                  <span className="text-muted-foreground">
                    reacted with {reaction.key}
                  </span>
                </span>
                {onToggle ? (
                  <span className="text-[10px] text-muted-foreground">
                    {reaction.reactedByMe ? 'Click to remove' : 'Click to react'}
                  </span>
                ) : null}
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
      {addButton ? <li>{addButton}</li> : null}
    </ul>
  );
}

/** Classes for the trailing "add reaction" pill, so it matches the others. */
export const reactionAddButtonClass =
  'h-7 w-9 flex items-center justify-center rounded-full border border-border/70 bg-surface-raised text-muted-foreground transition-colors hover:border-border hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

import { cn } from '@org/utils';

/**
 * How loudly a row wants attention.
 *
 * Three levels rather than a boolean, because "something happened here" and
 * "someone called you by name" are different enough that they must not look
 * alike: unread traffic is ambient and gets a muted dot, a mention is
 * addressed to you and gets the destructive colour every other urgent affordance
 * in the app uses.
 */
export type ActivityLevel = 'none' | 'activity' | 'mention';

export interface ActivityDotProps {
  level: ActivityLevel;
  /** Count rendered inside the dot. Mentions only — ambient activity stays a dot. */
  count?: number;
  className?: string;
  /** Overrides the default label. Keep it a sentence, it is read aloud. */
  label?: string;
}

const LEVEL_LABEL: Record<Exclude<ActivityLevel, 'none'>, string> = {
  activity: 'Unread activity',
  mention: 'You were mentioned',
};

/**
 * The unread marker used by the workspace switcher and the channel rows.
 *
 * Renders nothing at `none` so callers can pass a level straight through
 * without a conditional at every call site.
 */
export function ActivityDot({
  level,
  count,
  className,
  label,
}: ActivityDotProps) {
  if (level === 'none') return null;

  const isMention = level === 'mention';
  const showCount = isMention && typeof count === 'number' && count > 0;
  const text = label ?? LEVEL_LABEL[level];

  return (
    /* `role="img"`, not `role="status"`: a sidebar full of live regions would
       announce every workspace and channel as its dot changed. The label is
       read when the row it sits in is read, which is when it matters. */
    <span
      role="img"
      aria-label={showCount ? `${text} (${count})` : text}
      className={cn(
        'shrink-0 rounded-full',
        showCount
          ? 'min-w-4 h-4 px-1 font-semibold grid place-items-center bg-destructive text-[10px] leading-none text-destructive-foreground'
          : 'size-2',
        !showCount && (isMention ? 'bg-destructive' : 'bg-muted-foreground/60'),
        className,
      )}
    >
      {showCount ? (count > 99 ? '99+' : count) : null}
    </span>
  );
}

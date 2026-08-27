import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DropdownMenuTrigger,
  Hint,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ChevronDown,
  MoreHorizontal,
  PinOff,
  Star,
  type LucideIcon,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { NavLink } from 'react-router-dom';

export interface NavEntry {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  end?: boolean;
}

/**
 * Nesting depth for a sidebar row. Indentation used to be applied ad hoc with
 * `pl-6` / `pl-1.5` / `pl-1` and font sizes down to `text-[10.5px]`, so rows at
 * the same logical depth did not line up and the type scale had no rhythm.
 * Depth is now the only knob, and every level shares one ramp.
 */
export type NavDepth = 0 | 1 | 2;

const DEPTH_PADDING: Record<NavDepth, string> = {
  0: 'pl-2.5 pr-2',
  1: 'pl-2.5 pr-2',
  2: 'pl-6 pr-2',
};

const DEPTH_TEXT: Record<NavDepth, string> = {
  0: 'text-[13px]',
  1: 'text-[13px]',
  2: 'text-xs',
};

/**
 * Leading glyph size, also driven by depth. Rows used to pick their own
 * (`size-3`, `size-3.5`, `size-4`, `size-5` avatars), so sibling rows in the
 * same list rendered at different heights.
 */
const DEPTH_ICON: Record<NavDepth, string> = {
  0: 'size-4',
  1: 'size-4',
  2: 'size-3.5',
};

/** The icon/avatar slot for a row at `depth`. Fixed size keeps rows aligned. */
export function navIconClass(depth: NavDepth = 0, extra?: string) {
  return cn('shrink-0', DEPTH_ICON[depth], extra);
}

/**
 * One nav row.
 */
export function navRowClass(
  isActive: boolean,
  options: { depth?: NavDepth; extra?: string } = {},
) {
  const { depth = 0, extra } = options;
  return cn(
    'group gap-2.5 py-1.5 font-medium relative flex items-center rounded-xl tracking-[-0.01em]',
    DEPTH_PADDING[depth],
    DEPTH_TEXT[depth],
    'transition-all duration-(--duration-fast) ease-standard',
    'outline-none focus-visible:ring-1 focus-visible:ring-ring',
    isActive
      ? 'font-semibold shadow-2xs bg-accent text-foreground'
      : 'font-medium text-foreground/90 hover:bg-accent/70 hover:text-foreground',
    extra,
  );
}

/**
 * A plain button/link styled to sit flush with the nav rows around it.
 *
 * Takes the same `depth` as `navRowClass` — "Browse channels", "Add project"
 * and friends live inside sections, so hard-coding depth 0 left them a level
 * out of step with the rows they sit under.
 */
export function navActionClass(
  options: { depth?: NavDepth; extra?: string } = {},
) {
  const { depth = 0, extra } = options;
  return cn(
    'group gap-2.5 py-1.5 font-medium flex w-full items-center rounded-xl text-left',
    DEPTH_PADDING[depth],
    DEPTH_TEXT[depth],
    'text-foreground/80 transition-all duration-(--duration-fast) ease-standard',
    'hover:bg-accent/70 hover:text-foreground',
    'outline-none focus-visible:ring-1 focus-visible:ring-ring',
    extra,
  );
}

/**
 * Header for a group nested *inside* a section — a docs company, say. Applied
 * to the row container (it holds a disclosure button plus hover actions, so it
 * cannot itself be a button); it shares the row geometry, so a group header and
 * the rows under it line up and only weight marks it as a parent.
 */
export function navGroupHeaderClass(
  options: { depth?: NavDepth; extra?: string } = {},
) {
  const { depth = 0, extra } = options;
  return cn(
    'gap-2 py-1.5 flex w-full items-center rounded-xl text-left',
    DEPTH_PADDING[depth],
    DEPTH_TEXT[depth],
    'font-semibold text-foreground',
    'transition-colors duration-(--duration-fast) ease-standard hover:bg-accent/70',
    extra,
  );
}

/** The disclosure button inside a `navGroupHeaderClass` container. */
export const navGroupTriggerClass = cn(
  'min-w-0 gap-1.5 flex flex-1 items-center truncate rounded-btn text-left',
  'outline-none focus-visible:ring-1 focus-visible:ring-ring',
);

export function NavRow({
  entry,
  workspaceSlug,
  depth = 0,
  onTogglePin,
  isActiveOverride,
}: {
  entry: NavEntry;
  workspaceSlug: string;
  depth?: NavDepth;
  onTogglePin?: () => void;
  /**
   * Forces the active style regardless of the URL match — the "Channels" row
   * lights up for any `/c/:slug`, which `NavLink`'s own match never covers.
   */
  isActiveOverride?: boolean;
}) {
  const Icon = entry.icon;
  const to = entry.path
    ? `/w/${workspaceSlug}/${entry.path}`
    : `/w/${workspaceSlug}`;

  return (
    <div className="group/nav-row relative flex items-center">
      <NavLink
        to={to}
        end={entry.end}
        className={({ isActive }) =>
          navRowClass(Boolean(isActiveOverride) || isActive, {
            depth,
            extra: onTogglePin ? 'pr-7 flex-1' : 'flex-1',
          })
        }
      >
        <Icon className={navIconClass(depth)} aria-hidden />
        <span className="font-medium flex-1 truncate">{entry.label}</span>
        {entry.badge !== undefined && (
          <Badge
            variant="neutral"
            className="px-1.5 py-0 h-4 font-semibold ml-auto font-mono text-[10px]"
          >
            {entry.badge}
          </Badge>
        )}
      </NavLink>

      {onTogglePin && entry.path !== '' ? (
        <div className="right-1 absolute top-1/2 -translate-y-1/2 opacity-0 transition-opacity group-focus-within/nav-row:opacity-100 group-hover/nav-row:opacity-100">
          <Hint label="Unpin from sidebar">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTogglePin();
              }}
              aria-label={`Unpin ${entry.label} from sidebar`}
              className="size-5 flex cursor-pointer items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <PinOff className="size-3" />
            </button>
          </Hint>
        </div>
      ) : null}
    </div>
  );
}

export function IconOnlyNavRow({
  entry,
  workspaceSlug,
  isActive,
  onClick,
}: {
  entry: NavEntry;
  workspaceSlug: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const Icon = entry.icon;
  const to = entry.path
    ? `/w/${workspaceSlug}/${entry.path}`
    : `/w/${workspaceSlug}`;

  const tooltipText = entry.badge !== undefined
    ? `${entry.label} (${entry.badge})`
    : entry.label;

  return (
    <Hint side="right" label={tooltipText}>
      <NavLink
        to={to}
        end={entry.end}
        onClick={onClick}
        className={({ isActive: linkActive }) => {
          const active = isActive ?? linkActive;
          return cn(
            'relative size-9 flex items-center justify-center rounded-xl transition-all duration-150',
            'outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer',
            active
              ? 'bg-accent text-foreground shadow-2xs font-semibold'
              : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
          );
        }}
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        {entry.badge !== undefined && (
          <span className="absolute top-1 right-1 size-2 rounded-full bg-primary ring-2 ring-background" />
        )}
      </NavLink>
    </Hint>
  );
}


/**
 * Section container. Wraps a titled group of rows (Favorites, Channels, DMs,
 * Projects) in a `Collapsible` box so people can collapse what they are not using.
 */
export function Section({
  title,
  count,
  emptyLabel,
  action,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  emptyLabel?: string;
  action?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
  }, []);

  const isEmpty = count === 0;

  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      className="mt-2.5 mb-1"
      asChild
    >
      <section>
        <div className="group/section gap-1.5 px-2.5 py-1 flex items-center justify-between select-none">
          <CollapsibleTrigger
            className={cn(
              'group/trigger gap-1 flex items-center rounded-md',
              'font-semibold tracking-wide text-[11px] text-foreground/75 uppercase',
              'transition-colors duration-(--duration-fast) hover:text-foreground',
              'cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            <span>{title}</span>
            <ChevronDown
              className={cn(
                'size-3 shrink-0 text-foreground/60 opacity-0 transition-all duration-150',
                'group-focus-within/section:opacity-100 group-hover/section:opacity-100',
                !open && '-rotate-90',
              )}
              aria-hidden
            />
          </CollapsibleTrigger>
          {action}
        </div>

        <CollapsibleContent>
          {isEmpty ? (
            <p className="px-2.5 py-1 font-medium text-[11px] text-subtle">
              {emptyLabel}
            </p>
          ) : null}
          {/*
            The hint sits *above* the list rather than replacing it. Sections
            put their affordances in the list — "Browse channels", "Add agent" —
            and swapping the whole list out for the hint took those away at
            exactly the moment they were most useful.

            No horizontal padding: rows carry their own indent through `depth`,
            and the extra `px-1` used to push every section row 4px right of the
            section headers and the top-level nav rows.
          */}
          <ul className="mt-0.5 space-y-0.5">{children}</ul>
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

/* ------------------------------------------------- Sidebar row actions ---- */

/**
 * The hover/focus action cluster pinned to the right edge of a sidebar row.
 *
 * Every resource row — channels, docs, projects, agents, apps, workflows —
 * had its own byte-identical copy of this positioning block. Rows using it
 * must reserve the space with `extra: 'pr-14'` on `navRowClass`, or the label
 * runs under the buttons.
 *
 * `isPinned` keeps the cluster visible when the row is favourited: the star is
 * state, not just an affordance, so it has to survive the pointer leaving.
 */
export function NavRowActions({
  isPinned = false,
  className,
  children,
}: {
  isPinned?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        'right-1 gap-0.5 absolute top-1/2 flex -translate-y-1/2 items-center transition-opacity',
        isPinned
          ? 'opacity-100'
          : 'opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-within:opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The favourite star shared by every sidebar row.
 *
 * Uses the `accent-amber` token rather than the raw `#eab308` the six copies
 * of this button each hard-coded — that literal is a mid-tone that dims into
 * the dark canvas, while the token lightens for dark mode.
 */
export function FavoriteToggle({
  isFavorite,
  onToggle,
}: {
  isFavorite: boolean;
  onToggle: () => void;
}) {
  const label = isFavorite ? 'Remove from favorites' : 'Add to favorites';

  return (
    <Hint label={label}>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onToggle();
        }}
        aria-label={label}
        aria-pressed={isFavorite}
        className={cn(
          'size-5 p-0',
          isFavorite
            ? 'text-accent-amber opacity-100'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Star className={cn('size-3.5', isFavorite && 'fill-current')} />
      </Button>
    </Hint>
  );
}

/**
 * The `…` trigger that opens a row's context menu. Must be rendered inside a
 * `DropdownMenu`; it supplies the `DropdownMenuTrigger` itself.
 *
 * The click handler stops the event before it reaches the enclosing `NavLink`,
 * which would otherwise navigate out from under the menu as it opens.
 */
export function NavRowMenuTrigger({ label }: { label: string }) {
  return (
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={label}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        className="size-5 p-0 text-muted-foreground hover:text-foreground"
      >
        <MoreHorizontal className="size-3.5" />
      </Button>
    </DropdownMenuTrigger>
  );
}

/**
 * "Copy link" with a transient confirmation.
 *
 * Each row previously inlined this with a bare `setTimeout`, so navigating
 * away inside the 2s window left the timer to fire `setCopied` against an
 * unmounted row — a React warning per copy. The timer is tracked and cleared
 * here instead, and re-copying restarts it rather than stacking timers.
 */
export function useCopyLink(url: string) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(url);
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  }, [url]);

  return { copied, copy };
}

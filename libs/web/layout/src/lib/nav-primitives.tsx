import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
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
  0: 'pl-3',
  1: 'pl-6',
  2: 'pl-9',
};

const DEPTH_TEXT: Record<NavDepth, string> = {
  0: 'text-[13px]',
  1: 'text-xs',
  2: 'text-xs',
};

/**
 * Leading glyph size, also driven by depth. Rows used to pick their own
 * (`size-3`, `size-3.5`, `size-4`, `size-5` avatars), so sibling rows in the
 * same list rendered at different heights.
 */
const DEPTH_ICON: Record<NavDepth, string> = {
  0: 'size-4',
  1: 'size-3.5',
  2: 'size-3.5',
};

/** The icon/avatar slot for a row at `depth`. Fixed size keeps rows aligned. */
export function navIconClass(depth: NavDepth = 0, extra?: string) {
  return cn('shrink-0', DEPTH_ICON[depth], extra);
}

/**
 * One nav row. The active indicator is a 2px pseudo-element rather than a real
 * border so switching rows never reflows the list by a pixel.
 */
export function navRowClass(
  isActive: boolean,
  options: { depth?: NavDepth; extra?: string } = {},
) {
  const { depth = 0, extra } = options;
  return cn(
    'group relative flex items-center gap-2.5 rounded-btn py-1.5 pr-2',
    DEPTH_PADDING[depth],
    DEPTH_TEXT[depth],
    'transition-colors duration-(--duration-fast) ease-standard',
    'outline-none focus-visible:ring-1 focus-visible:ring-ring',
    'before:absolute before:top-1/2 before:left-0 before:h-4 before:w-0.5',
    'before:-translate-y-1/2 before:rounded-full before:bg-primary',
    'before:transition-opacity before:duration-(--duration-fast)',
    isActive
      ? 'bg-selected font-medium text-foreground before:opacity-100'
      : 'text-muted-foreground hover:bg-accent hover:text-foreground before:opacity-0',
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
    'group flex w-full items-center gap-2.5 rounded-btn py-1.5 pr-2 text-left',
    DEPTH_PADDING[depth],
    DEPTH_TEXT[depth],
    'text-muted-foreground transition-colors duration-(--duration-fast) ease-standard',
    'hover:bg-accent hover:text-foreground',
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
    'flex w-full items-center gap-1.5 rounded-btn py-1.5 pr-2 text-left',
    DEPTH_PADDING[depth],
    DEPTH_TEXT[depth],
    'font-medium text-foreground',
    'transition-colors duration-(--duration-fast) ease-standard hover:bg-accent',
    extra,
  );
}

/** The disclosure button inside a `navGroupHeaderClass` container. */
export const navGroupTriggerClass = cn(
  'flex min-w-0 flex-1 items-center gap-1.5 truncate rounded-btn text-left',
  'outline-none focus-visible:ring-1 focus-visible:ring-ring',
);

export function NavRow({
  entry,
  workspaceSlug,
  depth = 0,
}: {
  entry: NavEntry;
  workspaceSlug: string;
  depth?: NavDepth;
}) {
  const Icon = entry.icon;
  const to = entry.path
    ? `/w/${workspaceSlug}/${entry.path}`
    : `/w/${workspaceSlug}`;

  return (
    <NavLink
      to={to}
      end={entry.end}
      className={({ isActive }) => navRowClass(isActive, { depth })}
    >
      <Icon className={navIconClass(depth)} aria-hidden />
      <span className="flex-1 truncate">{entry.label}</span>
      {entry.badge ? (
        <Badge variant="count" aria-label={`${entry.badge} unread`}>
          {entry.badge}
        </Badge>
      ) : null}
    </NavLink>
  );
}

const SECTION_STORAGE_KEY = 'onetab_sidebar_sections_v1';

function readSectionState(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SECTION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Collapsible sidebar group.
 *
 * Open/closed state is keyed by title and persisted: with ten sections all
 * defaulting to open, the sidebar was several screens tall on load and every
 * reload discarded whatever the user had collapsed to tame it.
 */
export function Section({
  title,
  count,
  children,
  action,
  defaultOpen = true,
  emptyLabel,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  action?: ReactNode;
  defaultOpen?: boolean;
  /** Shown instead of hiding the whole section when `count` is 0. */
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(
    () => readSectionState()[title] ?? defaultOpen,
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(
          SECTION_STORAGE_KEY,
          JSON.stringify({ ...readSectionState(), [title]: next }),
        );
      } catch {
        /* Preference only — not worth surfacing. */
      }
    },
    [title],
  );

  const isEmpty = count === 0;
  /* Previously an empty section returned null, so "Favorites" silently
     disappeared and the affordance to add one vanished with it. */
  if (isEmpty && !emptyLabel) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      className="mt-3 mb-1"
      asChild
    >
      <section>
        {/* `px-3`, matching `DEPTH_PADDING[0]`, so the chevron sits on the same
            x as the row icons underneath it. */}
        <div className="group flex items-center gap-1.5 px-3 py-1 select-none">
          <CollapsibleTrigger
            className={cn(
              'group/trigger flex flex-1 items-center gap-1.5 rounded-md',
              'text-[11px] font-medium tracking-wide text-subtle uppercase',
              'transition-colors duration-(--duration-fast) hover:text-muted-foreground',
              'outline-none focus-visible:ring-1 focus-visible:ring-ring',
            )}
          >
            <ChevronDown
              className="size-3.5 shrink-0 transition-transform duration-(--duration-fast) group-data-[state=closed]/trigger:-rotate-90"
              aria-hidden
            />
            <span>{title}</span>
          </CollapsibleTrigger>
          {action}
        </div>

        <CollapsibleContent>
          {isEmpty ? (
            <p className="px-3 py-1 text-[11px] text-subtle">{emptyLabel}</p>
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

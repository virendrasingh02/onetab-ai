import {
  ActionDropdownMenu,
  EntityContextMenu,
  Popover,
  PopoverContent,
  PopoverTrigger,
  SearchInput,
  type EntityAction,
} from '@org/ui';
import { cn, formatDate, formatRelative } from '@org/utils';
import { ChevronDown, MoreHorizontal } from 'lucide-react';
import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { NavLink } from 'react-router-dom';

export interface InactiveDropdownItem {
  id: string;
  name: string;
  to: string;
  icon: ReactNode;
  /** Epoch ms of the item's last activity — shown as a compact age ("45d"). */
  lastActiveAt?: number;
  actions?: EntityAction[];
  scope?: string;
  entityType?: string;
  entity?: unknown;
}

export interface InactiveItemsDropdownProps {
  category: 'channels' | 'dms' | 'apps' | 'agents' | 'coworkers';
  /** Names the category for assistive tech ("Inactive direct messages"). */
  categoryLabel?: string;
  items: InactiveDropdownItem[];
  className?: string;
}

/** Past this many rows the menu grows a filter field. */
const FILTER_THRESHOLD = 8;

const DAY_MS = 24 * 60 * 60 * 1000;

/** "45d", "3mo", "2y" — short enough to sit at the end of a sidebar row. */
function compactAge(at: number, now: number): string {
  const days = Math.max(1, Math.floor((now - at) / DAY_MS));
  if (days < 60) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

/**
 * The "Inactive" menu beside a sidebar section title: everything in that
 * section with no messages for 30+ days, one click from being reopened.
 * Renders nothing when the section has no inactive items.
 */
export function InactiveItemsDropdown({
  category,
  categoryLabel,
  items,
  className,
}: InactiveItemsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLUListElement>(null);

  const label = categoryLabel ?? category;
  const showFilter = items.length > FILTER_THRESHOLD;

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => item.name.toLowerCase().includes(needle));
  }, [items, query]);

  if (items.length === 0) return null;

  const now = Date.now();

  // Arrow keys walk the row links, like a menu; Home/End jump to the ends.
  const handleListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const links = Array.from(
      listRef.current?.querySelectorAll<HTMLAnchorElement>('a[data-inactive-link]') ??
        [],
    );
    if (links.length === 0) return;
    event.preventDefault();
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? links.length - 1
          : event.key === 'ArrowDown'
            ? (current + 1) % links.length
            : (current - 1 + links.length) % links.length;
    links[next]?.focus();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Inactive ${label}`}
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring select-none',
            'text-muted-foreground/75 hover:text-foreground hover:bg-accent/60',
            open && 'bg-accent/70 text-foreground font-semibold',
            className,
          )}
        >
          <span>Inactive</span>
          <ChevronDown
            className={cn(
              'size-3 text-muted-foreground/60 transition-transform duration-150',
              open && 'rotate-180 text-foreground',
            )}
            aria-hidden
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        aria-label={`Inactive ${label}`}
        className={cn(
          'w-72 max-w-[calc(100vw-1.5rem)] p-0 z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-overlay outline-none',
          'flex flex-col max-h-[min(24rem,var(--radix-popover-content-available-height))] overflow-hidden',
        )}
      >
        <div className="px-3 py-2 border-b border-border/60 bg-muted/20">
          <p className="text-[11px] font-medium text-muted-foreground leading-normal select-none">
            No messages in at least 30 days
          </p>
        </div>

        {showFilter ? (
          <div className="px-2 pt-2">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder={`Filter ${label}`}
              className="h-8 text-xs"
            />
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto overscroll-contain p-1 scrollbar-subtle">
          {visibleItems.length === 0 ? (
            <p className="px-2.5 py-3 text-center text-xs text-muted-foreground">
              No inactive {label} match “{query.trim()}”.
            </p>
          ) : (
            <ul
              ref={listRef}
              className="space-y-0.5"
              aria-label={`Inactive ${label}`}
              onKeyDown={handleListKeyDown}
            >
              {visibleItems.map((item) => {
                const hasActions = !!item.actions && item.actions.length > 0;
                const age =
                  item.lastActiveAt && item.lastActiveAt > 0
                    ? compactAge(item.lastActiveAt, now)
                    : null;

                const row = (
                  <li
                    key={item.id}
                    className="group/inactive-item relative flex items-center rounded-lg hover:bg-accent/70 transition-colors"
                  >
                    <NavLink
                      to={item.to}
                      data-inactive-link
                      onClick={() => setOpen(false)}
                      title={
                        item.lastActiveAt
                          ? `${item.name} — last active ${formatRelative(item.lastActiveAt)} (${formatDate(item.lastActiveAt)})`
                          : item.name
                      }
                      className={({ isActive }) =>
                        cn(
                          'flex-1 min-w-0 flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-foreground/85 hover:text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring',
                          hasActions ? 'pr-9' : 'pr-2.5',
                          isActive && 'font-semibold text-primary-text bg-primary/12',
                        )
                      }
                    >
                      {item.icon}
                      <span className="flex-1 truncate">{item.name}</span>
                      {age ? (
                        <span
                          className={cn(
                            'shrink-0 text-[11px] tabular-nums text-muted-foreground/70',
                            // Makes way for the ⋯ button on hover / focus.
                            hasActions &&
                              'group-hover/inactive-item:invisible group-focus-within/inactive-item:invisible pointer-coarse:invisible',
                          )}
                        >
                          {age}
                        </span>
                      ) : null}
                    </NavLink>

                    {hasActions && (
                      <div
                        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/inactive-item:opacity-100 group-focus-within/inactive-item:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100 transition-opacity"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ActionDropdownMenu
                          modal={false}
                          actions={item.actions ?? []}
                          scope={item.scope ?? item.id}
                          entityType={item.entityType ?? 'item'}
                          entity={item.entity}
                          contentClassName="w-64"
                          trigger={
                            <button
                              type="button"
                              aria-label={`Options for ${item.name}`}
                              className="size-6 flex items-center justify-center rounded-md text-muted-foreground/70 hover:bg-accent hover:text-foreground cursor-pointer transition-colors outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            >
                              <MoreHorizontal className="size-3.5" />
                            </button>
                          }
                        />
                      </div>
                    )}
                  </li>
                );

                return hasActions ? (
                  <EntityContextMenu
                    key={item.id}
                    actions={item.actions ?? []}
                    scope={item.scope ?? item.id}
                    entityType={item.entityType ?? 'item'}
                    entity={item.entity}
                    label={item.name}
                  >
                    {row}
                  </EntityContextMenu>
                ) : (
                  row
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

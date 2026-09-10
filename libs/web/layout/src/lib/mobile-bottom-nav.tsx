import { cn } from '@org/utils';
import {
  Bell,
  Home,
  Menu,
  MessagesSquare,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

/**
 * The phone-only tab bar pinned to the bottom of the app shell (below `md`).
 *
 * It is not a second information architecture — it is five shortcuts over the
 * existing one. Four route into real destinations that already exist in the
 * sidebar/route table; the fifth ("Menu") opens the full navigation drawer, so
 * every channel, project, doc, setting and admin area stays one tap away and no
 * screen is unreachable. Permissions are unaffected: the drawer and the routes
 * it lists enforce them exactly as on desktop.
 *
 * Rendered in normal flow as the last flex child of the shell column (not
 * `position: fixed`), so the routed content area simply shrinks by its height
 * and nothing is ever covered. `pb-safe` clears the home indicator.
 */
export interface MobileBottomNavProps {
  workspaceSlug: string;
  /** Unread count for the Inbox tab's badge. */
  inboxUnread?: number;
  /** Opens the command palette / search overlay. */
  onOpenSearch: () => void;
  /** Opens the primary navigation drawer (channels, projects, docs, …). */
  onOpenMenu: () => void;
  /** `true` while the navigation drawer is open — reflected on the Menu tab. */
  menuOpen?: boolean;
}

interface RouteTab {
  kind: 'route';
  id: string;
  label: string;
  icon: LucideIcon;
  to: string;
  end?: boolean;
  badge?: number;
}

interface ActionTab {
  kind: 'action';
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  active?: boolean;
}

type Tab = RouteTab | ActionTab;

const tabBase = cn(
  'group relative flex flex-1 flex-col items-center justify-center gap-0.5',
  'min-h-11 rounded-lg px-1 pt-1 text-[10px] font-medium',
  'text-muted-foreground transition-colors duration-(--duration-fast) ease-standard',
  'outline-none focus-visible:ring-1 focus-visible:ring-ring',
  'active:bg-accent/60',
);

export function MobileBottomNav({
  workspaceSlug,
  inboxUnread = 0,
  onOpenSearch,
  onOpenMenu,
  menuOpen = false,
}: MobileBottomNavProps) {
  const location = useLocation();
  const base = `/w/${workspaceSlug}`;

  const tabs: Tab[] = [
    {
      kind: 'route',
      id: 'home',
      label: 'Home',
      icon: Home,
      to: base,
      end: true,
    },
    {
      kind: 'route',
      id: 'threads',
      label: 'Chat',
      icon: MessagesSquare,
      to: `${base}/threads`,
    },
    {
      kind: 'action',
      id: 'search',
      label: 'Search',
      icon: Search,
      onSelect: onOpenSearch,
    },
    {
      kind: 'route',
      id: 'inbox',
      label: 'Inbox',
      icon: Bell,
      to: `${base}/inbox`,
      badge: inboxUnread,
    },
    {
      kind: 'action',
      id: 'menu',
      label: 'Menu',
      icon: Menu,
      onSelect: onOpenMenu,
      active: menuOpen,
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'shrink-0 border-t border-border bg-background/95 backdrop-blur-sm md:hidden',
        'pb-safe',
      )}
    >
      <ul className="flex items-stretch gap-0.5 px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const badge =
            tab.kind === 'route' && tab.badge && tab.badge > 0 ? tab.badge : 0;
          const iconWithBadge = (
            <span className="relative flex items-center justify-center">
              <Icon className="size-5 shrink-0" aria-hidden />
              {badge > 0 ? (
                <span
                  className={cn(
                    'absolute -top-1.5 -right-2 min-w-4 rounded-full px-1',
                    'bg-destructive text-[9px] leading-4 font-semibold text-destructive-foreground',
                    'text-center tabular-nums',
                  )}
                  aria-hidden
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              ) : null}
            </span>
          );

          if (tab.kind === 'action') {
            return (
              <li key={tab.id} className="flex flex-1">
                <button
                  type="button"
                  onClick={tab.onSelect}
                  aria-label={tab.label}
                  aria-pressed={tab.active ? true : undefined}
                  className={cn(tabBase, tab.active && 'text-primary-text')}
                >
                  {iconWithBadge}
                  <span className="truncate">{tab.label}</span>
                </button>
              </li>
            );
          }

          // A route tab is "current" when it matches; `inbox` also needs an
          // explicit check because `NavLink` end-matching would miss nested
          // notification routes if any are added later.
          const isActive =
            tab.end
              ? location.pathname === tab.to
              : location.pathname.startsWith(tab.to);

          return (
            <li key={tab.id} className="flex flex-1">
              <NavLink
                to={tab.to}
                end={tab.end}
                aria-label={
                  badge > 0 ? `${tab.label}, ${badge} unread` : tab.label
                }
                className={cn(tabBase, isActive && 'text-primary-text')}
              >
                {iconWithBadge}
                <span className="truncate">{tab.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

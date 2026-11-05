import {
  EntityContextMenu,
  Hint,
  SidebarActivityIndicator,
  type SidebarActivityState,
} from '@org/ui';
import { studioAppUrl, studioWorkspacePath } from '@org/platform';
import { cn } from '@org/utils';
import { Settings, Sparkles, type LucideIcon } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { resolveNavigation } from './navigation/navigation-resolver.js';
import { APP_RAIL_NAV_ITEM_IDS } from './navigation/navigation.config.js';
import { isRouteActive } from './navigation/route-matcher.js';
import { useSidebarStore } from './navigation/sidebar-store.js';
import { useSplitViewAction } from './split-view/use-split-view-action.js';

/**
 * The always-visible icon column at the far left of the desktop shell: the
 * app-level destinations and the AI Agent Studio on top, Settings pinned to the
 * bottom.
 *
 * It is the first column of the shell row rather than part of the sidebar, so
 * it stays put when the sidebar is collapsed or hidden. Which items appear (and
 * their order) still comes from `resolveNavigation`, so the sidebar customizer
 * keeps working for them. Phones have no rail: `MobileBottomNav` and the
 * navigation drawer cover the same destinations.
 */
export interface AppRailProps {
  workspaceSlug: string;
  /** Unread count for the Inbox item. */
  inboxUnread?: number;
}

interface RailLinkProps {
  to: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  activity?: SidebarActivityState;
  /** `to` is another app: open it in a new tab instead of routing here. */
  external?: boolean;
}

function RailLink({
  to,
  label,
  icon: Icon,
  active = false,
  activity,
  external = false,
}: RailLinkProps) {
  const count = activity?.unreadCount ?? 0;
  const className = cn(
    'size-10 relative flex items-center justify-center rounded-xl',
    'transition-colors duration-(--duration-fast) ease-standard',
    'outline-none focus-visible:ring-1 focus-visible:ring-ring',
    active
      ? [
          'bg-primary/12 text-primary-text',
          // The marker on the rail's edge that says "you are here".
          'before:-left-1 before:h-5 before:w-0.75 before:absolute',
          'before:rounded-full before:bg-primary',
        ]
      : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
  );
  const icon = <Icon className="size-5 shrink-0" aria-hidden />;

  return (
    <Hint side="right" label={count > 0 ? `${label} (${count})` : label}>
      {external ? (
        <a
          href={to}
          target="_blank"
          rel="noopener"
          aria-label={`${label} (opens in a new tab)`}
          className={className}
        >
          {icon}
        </a>
      ) : (
        <Link
          to={to}
          aria-label={count > 0 ? `${label}, ${count} unread` : label}
          aria-current={active ? 'page' : undefined}
          className={className}
        >
          {icon}
          <SidebarActivityIndicator
            state={activity}
            surface="notifications"
            itemLabel={label}
            collapsed
          />
        </Link>
      )}
    </Hint>
  );
}

export function AppRail({ workspaceSlug, inboxUnread = 0 }: AppRailProps) {
  const { pathname } = useLocation();
  const itemsPrefs = useSidebarStore((s) => s.items);
  const splitAction = useSplitViewAction();

  const items = useMemo(
    () =>
      resolveNavigation(itemsPrefs, { workspaceSlug }).visibleItems.filter(
        (item) => APP_RAIL_NAV_ITEM_IDS.has(item.id),
      ),
    [itemsPrefs, workspaceSlug],
  );

  const inboxActivity = useMemo<SidebarActivityState>(
    () => ({
      unreadCount: inboxUnread,
      activityType: inboxUnread > 0 ? 'activity' : 'none',
    }),
    [inboxUnread],
  );

  return (
    <nav
      aria-label="App"
      className="w-12 py-1 flex h-full shrink-0 flex-col items-center justify-between"
    >
      <ul className="gap-1 flex flex-col items-center">
        {items.map((item) => (
          <li key={item.id}>
            <EntityContextMenu
              actions={[splitAction(item.fullPath, item.label)]}
              scope={`rail:${item.id}`}
              label={item.label}
            >
              <RailLink
                to={item.fullPath}
                label={item.label}
                icon={item.icon}
                active={isRouteActive(item.href, pathname, workspaceSlug)}
                activity={item.id === 'inbox' ? inboxActivity : undefined}
              />
            </EntityContextMenu>
          </li>
        ))}
        <li>
          <RailLink
            to={studioAppUrl(studioWorkspacePath(workspaceSlug))}
            label="AI Agent Studio"
            icon={Sparkles}
            external
          />
        </li>
      </ul>

      {/* No split-view action: Settings renders outside the shell. */}
      <RailLink
        to={`/w/${workspaceSlug}/settings`}
        label="Settings"
        icon={Settings}
      />
    </nav>
  );
}

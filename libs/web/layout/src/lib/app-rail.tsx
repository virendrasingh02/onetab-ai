import {
  EntityContextMenu,
  type EntityAction,
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
import {
  useSidebarStore,
  type AppRailDisplay,
} from './navigation/sidebar-store.js';
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
 *
 * Labels sit under the icons by default; right-clicking anywhere on the rail
 * switches between "Icons and text" and "Icons only" (`railDisplay`, synced
 * with the rest of the sidebar preferences).
 */
export interface AppRailProps {
  workspaceSlug: string;
  /** Unread count for the Inbox item. */
  inboxUnread?: number;
}

interface RailLinkProps {
  to: string;
  label: string;
  /** Shorter caption under the icon when the full label would not fit. */
  shortLabel?: string;
  icon: LucideIcon;
  showLabel: boolean;
  active?: boolean;
  activity?: SidebarActivityState;
  /** `to` is another app: open it in a new tab instead of routing here. */
  external?: boolean;
}

function RailLink({
  to,
  label,
  shortLabel,
  icon: Icon,
  showLabel,
  active = false,
  activity,
  external = false,
}: RailLinkProps) {
  const count = activity?.unreadCount ?? 0;
  const caption = shortLabel ?? label;
  const className = cn(
    'group/rail relative flex flex-col items-center rounded-xl',
    'outline-none focus-visible:ring-1 focus-visible:ring-ring',
    showLabel ? 'gap-0.5 py-0.5 w-14' : 'size-10 justify-center',
  );
  const iconWrap = (
    <span
      className={cn(
        'relative flex items-center justify-center rounded-xl',
        'transition-colors duration-(--duration-fast) ease-standard',
        showLabel ? 'h-8 w-9' : 'size-10',
        active
          ? [
              'bg-primary/12 text-primary-text',
              // The marker on the rail's edge that says "you are here".
              'before:h-5 before:w-0.75 before:absolute',
              'before:rounded-full before:bg-primary',
              showLabel ? 'before:-left-3.5' : 'before:-left-1',
            ]
          : 'text-muted-foreground group-hover/rail:bg-accent/70 group-hover/rail:text-foreground',
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden />
      {external ? null : (
        <SidebarActivityIndicator
          state={activity}
          surface="notifications"
          itemLabel={label}
          collapsed
        />
      )}
    </span>
  );
  const content = (
    <>
      {iconWrap}
      {showLabel ? (
        <span
          aria-hidden
          className={cn(
            'px-0.5 leading-tight max-w-full truncate text-[10px]',
            'transition-colors duration-(--duration-fast) ease-standard',
            active
              ? 'font-semibold text-foreground'
              : 'font-medium text-muted-foreground group-hover/rail:text-foreground',
          )}
        >
          {caption}
        </span>
      ) : null}
    </>
  );

  const link = external ? (
    <a
      href={to}
      target="_blank"
      rel="noopener"
      aria-label={`${label} (opens in a new tab)`}
      className={className}
    >
      {content}
    </a>
  ) : (
    <Link
      to={to}
      aria-label={count > 0 ? `${label}, ${count} unread` : label}
      aria-current={active ? 'page' : undefined}
      className={className}
    >
      {content}
    </Link>
  );

  // With captions showing, a tooltip only adds something when it says more
  // than the caption does (a full name, an unread count).
  const hint = count > 0 ? `${label} (${count})` : label;
  if (showLabel && hint === caption) return link;
  return (
    <Hint side="right" label={hint}>
      {link}
    </Hint>
  );
}

/** Captions for items whose full label would not fit under the icon. */
const RAIL_SHORT_LABELS: Record<string, string> = {
  marketplace: 'Market',
};

/** The "Show" choice offered by every right-click menu on the rail. */
function railDisplayActions(
  current: AppRailDisplay,
  set: (display: AppRailDisplay) => void,
): EntityAction[] {
  return [
    {
      id: 'rail-show-icons-text',
      label: 'Icons and text',
      group: 'rail-show',
      checked: current === 'icons-text',
      run: () => set('icons-text'),
    },
    {
      id: 'rail-show-icons',
      label: 'Icons only',
      group: 'rail-show',
      checked: current === 'icons',
      run: () => set('icons'),
    },
  ];
}

export function AppRail({ workspaceSlug, inboxUnread = 0 }: AppRailProps) {
  const { pathname } = useLocation();
  const itemsPrefs = useSidebarStore((s) => s.items);
  const splitAction = useSplitViewAction();
  const railDisplay = useSidebarStore((s) => s.railDisplay) ?? 'icons-text';
  const setRailDisplay = useSidebarStore((s) => s.setRailDisplay);
  const showLabel = railDisplay !== 'icons';
  const displayActions = useMemo(
    () => railDisplayActions(railDisplay, setRailDisplay),
    [railDisplay, setRailDisplay],
  );

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
    <EntityContextMenu
      actions={displayActions}
      scope="rail"
      label="App rail"
      longPress={false}
    >
      <nav
        aria-label="App"
        className={cn(
          'py-1 flex h-full shrink-0 flex-col items-center justify-between',
          'transition-[width] duration-(--duration-fast) ease-standard',
          showLabel ? 'w-16' : 'w-12',
        )}
      >
        <ul
          className={cn(
            'flex flex-col items-center',
            showLabel ? 'gap-1.5' : 'gap-1',
          )}
        >
          {items.map((item) => (
            <li key={item.id}>
              <EntityContextMenu
                actions={[
                  splitAction(item.fullPath, item.label),
                  ...displayActions,
                ]}
                scope={`rail:${item.id}`}
                label={item.label}
              >
                <RailLink
                  to={item.fullPath}
                  label={item.label}
                  shortLabel={RAIL_SHORT_LABELS[item.id]}
                  icon={item.icon}
                  showLabel={showLabel}
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
              shortLabel="Studio"
              icon={Sparkles}
              showLabel={showLabel}
              external
            />
          </li>
        </ul>

        {/* No split-view action: Settings renders outside the shell. */}
        <RailLink
          to={`/w/${workspaceSlug}/settings`}
          label="Settings"
          icon={Settings}
          showLabel={showLabel}
        />
      </nav>
    </EntityContextMenu>
  );
}

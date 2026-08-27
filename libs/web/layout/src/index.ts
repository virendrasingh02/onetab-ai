export { AppShell } from './lib/app-shell.js';
export { DirectMessagesPage } from './lib/direct-messages-page.js';
export { AppHeader, type AppHeaderProps } from './lib/app-header.js';
export {
  AssistantPanel,
  type AssistantPanelProps,
} from './lib/assistant-panel.js';
export { ChannelNav, type ChannelNavProps } from './lib/channel-nav.js';
export { RightPanel, type RightPanelProps } from './lib/right-panel.js';
export {
  WorkspaceMenu,
  type WorkspaceMenuProps,
} from './lib/workspace-switcher.js';
export {
  ManageAccountsDialog,
  type ManageAccountsDialogProps,
} from './lib/manage-accounts-dialog.js';
export {
  AddAccountDialog,
  type AddAccountDialogProps,
} from './lib/add-account-dialog.js';
export {
  useResizableLayout,
  DEFAULT_LAYOUT_BOUNDS,
  type LayoutBounds,
  type StoredLayoutConfig,
  type UseResizableLayoutOptions,
} from './lib/use-resizable-layout.js';
export { ResizeHandle, type ResizeHandleProps } from './lib/resize-handle.js';
/* Re-exported for existing callers; the hook itself moved to `@org/ui` so the
   docs editor in `@org/web-work-tools` can use it without a dependency cycle. */
export { usePromptDialog, type PromptDialog } from '@org/ui';
export {
  FavoriteToggle,
  IconOnlyNavRow,
  NavRow,
  NavRowActions,
  NavRowMenuTrigger,
  Section,
  navActionClass,
  navGroupHeaderClass,
  navGroupTriggerClass,
  navIconClass,
  navRowClass,
  useCopyLink,
  type NavDepth,
  type NavEntry,
} from './lib/nav-primitives.js';

export {
  DEFAULT_NAV_GROUPS,
  DEFAULT_NAV_ITEMS,
  type NavGroupConfig,
  type NavGroupId,
  type NavItemConfig,
} from './lib/navigation/navigation.config.js';

export {
  resolveNavigation,
  type ResolvedNavGroup,
  type ResolvedNavItem,
  type NavigationResolutionContext,
} from './lib/navigation/navigation-resolver.js';

export { isRouteActive } from './lib/navigation/route-matcher.js';

export {
  useSidebarStore,
  DEFAULT_SIDEBAR_SECTIONS,
  type SidebarItemPreference,
  type SidebarSectionConfig,
  type SidebarSectionId,
  type SidebarState,
} from './lib/navigation/sidebar-store.js';

export { SidebarCustomizerDialog } from './lib/navigation/sidebar-customizer-dialog.js';



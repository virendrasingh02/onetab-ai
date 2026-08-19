export { AppShell } from './lib/app-shell.js';
export { AppHeader, type AppHeaderProps } from './lib/app-header.js';
export { AssistantPanel, type AssistantPanelProps } from './lib/assistant-panel.js';
export { ChannelNav, type ChannelNavProps } from './lib/channel-nav.js';
export { WorkspaceMenu, type WorkspaceMenuProps } from './lib/workspace-switcher.js';
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

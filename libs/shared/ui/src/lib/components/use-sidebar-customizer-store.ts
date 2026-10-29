import { create } from 'zustand';

export type SidebarCustomizerTab = 'sections' | 'items' | 'indicators';

/** Sections (default) or the newest-first activity list. */
export type SidebarViewMode = 'sections' | 'activity';

export interface SidebarCustomizerStore {
  /** Whether the sidebar-customizer dialog is open. */
  open: boolean;
  /**
   * Tab to show the next time it opens. The dialog consumes this (resets it to
   * `undefined`) once applied, so a later plain open keeps its own tab.
   */
  requestedTab?: SidebarCustomizerTab;
  setOpen: (open: boolean) => void;
  /** Open the dialog, optionally jumping straight to a tab. */
  openWith: (tab?: SidebarCustomizerTab) => void;
  /**
   * Mirror of the sidebar store's `layoutMode`. `@org/web-layout` keeps the two
   * in step both ways, so settings screens can read and change the sidebar view
   * without importing the feature lib; the sidebar store stays the source that
   * persists and syncs to the server.
   */
  layoutMode: SidebarViewMode;
  setLayoutMode: (mode: SidebarViewMode) => void;
}

/**
 * Cross-feature "open the sidebar customizer" signal.
 *
 * The dialog itself lives in `@org/web-layout` and is always mounted in the
 * shell; this leaf store lets any screen — the settings "App sidebar →
 * Customize" row, a command-palette action — pop it open without importing the
 * feature lib.
 */
export const useSidebarCustomizerStore = create<SidebarCustomizerStore>(
  (set) => ({
    open: false,
    requestedTab: undefined,
    setOpen: (open) => set({ open }),
    openWith: (tab) => set({ open: true, requestedTab: tab }),
    layoutMode: 'sections',
    setLayoutMode: (mode) => set({ layoutMode: mode }),
  }),
);

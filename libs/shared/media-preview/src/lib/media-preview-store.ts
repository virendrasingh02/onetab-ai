import { create } from 'zustand';
import type { MediaItem } from './types.js';

/**
 * Ephemeral overlay state — deliberately no `persist` middleware (unlike
 * `useRightPanelStore`). A previewed file has no meaning across a reload the
 * way an open rail view does.
 *
 * `resolveUrl()` results and in-flight promises live outside the reactive
 * state (a plain module-level `Map`, same precedent as
 * `scroll-position-store.ts`) so a re-render never re-triggers a fetch or
 * loses track of one already underway; `resolvedUrls`/`resolvingIds`/`errors`
 * in the state below exist only so components can *react* to that bookkeeping.
 */
const pendingResolves = new Map<string, Promise<string>>();
/** ids whose `resolvedUrls` entry is a blob: URL *this store* created via
 * `resolveUrl()` — revoked on close. Never applies to a caller-supplied
 * `item.url`, which the caller still owns. */
const blobTrackedIds = new Set<string>();

export interface MediaPreviewStoreState {
  items: MediaItem[];
  activeIndex: number;
  isOpen: boolean;
  resolvedUrls: Record<string, string>;
  resolvingIds: Record<string, boolean>;
  errors: Record<string, string>;

  open: (items: MediaItem[], startIndex?: number) => void;
  close: () => void;
  next: () => void;
  previous: () => void;
  goTo: (index: number) => void;
  /** Ensures a usable URL exists for `item`, resolving it lazily if needed.
   * Safe to call repeatedly — in-flight/finished resolutions are reused. */
  resolve: (item: MediaItem) => Promise<string | undefined>;
}

function revokeTrackedBlobUrls(resolvedUrls: Record<string, string>) {
  for (const id of blobTrackedIds) {
    const url = resolvedUrls[id];
    if (url) URL.revokeObjectURL(url);
  }
  blobTrackedIds.clear();
  pendingResolves.clear();
}

export const useMediaPreviewStore = create<MediaPreviewStoreState>()(
  (set, get) => ({
    items: [],
    activeIndex: 0,
    isOpen: false,
    resolvedUrls: {},
    resolvingIds: {},
    errors: {},

    open: (items, startIndex = 0) => {
      // A previous session's blob URLs are meaningless once we're pointed at
      // a new item list — release them before starting the new one.
      revokeTrackedBlobUrls(get().resolvedUrls);
      set({
        items,
        activeIndex: Math.min(Math.max(startIndex, 0), Math.max(items.length - 1, 0)),
        isOpen: true,
        resolvedUrls: {},
        resolvingIds: {},
        errors: {},
      });
    },

    close: () => {
      // `items`/`activeIndex`/`resolvedUrls` deliberately survive a close —
      // this store never unmounts the modal, and Radix plays a closing
      // animation against whatever `<DialogPrimitive.Content>` last
      // rendered. Revoking an already-displayed blob: URL here is safe (a
      // live <img>/<video> keeps showing what it already decoded), and the
      // next `open()` call resets everything for the next item list.
      revokeTrackedBlobUrls(get().resolvedUrls);
      set({ isOpen: false });
    },

    next: () => {
      const { items, activeIndex } = get();
      if (items.length < 2) return;
      set({ activeIndex: (activeIndex + 1) % items.length });
    },

    previous: () => {
      const { items, activeIndex } = get();
      if (items.length < 2) return;
      set({ activeIndex: (activeIndex - 1 + items.length) % items.length });
    },

    goTo: (index) => {
      const { items } = get();
      if (index < 0 || index >= items.length) return;
      set({ activeIndex: index });
    },

    resolve: async (item) => {
      if (item.url) return item.url;
      if (!item.resolveUrl) return undefined;

      const cached = get().resolvedUrls[item.id];
      if (cached) return cached;

      const inFlight = pendingResolves.get(item.id);
      if (inFlight) return inFlight;

      set((state) => ({
        resolvingIds: { ...state.resolvingIds, [item.id]: true },
        errors: { ...state.errors, [item.id]: '' },
      }));

      const promise = item
        .resolveUrl()
        .then((url) => {
          blobTrackedIds.add(item.id);
          set((state) => ({
            resolvedUrls: { ...state.resolvedUrls, [item.id]: url },
            resolvingIds: { ...state.resolvingIds, [item.id]: false },
          }));
          return url;
        })
        .catch((error: unknown) => {
          set((state) => ({
            resolvingIds: { ...state.resolvingIds, [item.id]: false },
            errors: {
              ...state.errors,
              [item.id]: error instanceof Error ? error.message : 'Failed to load file',
            },
          }));
          throw error;
        })
        .finally(() => {
          pendingResolves.delete(item.id);
        });

      pendingResolves.set(item.id, promise);
      return promise.catch(() => undefined);
    },
  }),
);

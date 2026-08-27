import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * The right rail used to be the AI assistant and nothing else, so its open
 * state was a boolean owned by the layout hook. It now hosts several unrelated
 * surfaces — the assistant, a person, a page's details, an open Kanban card, a
 * conversation's threads — and every one of them is opened from a different
 * library: the app header, the channel page, the board, the chat surface.
 *
 * They are *separate panels*, not tabs of one: only ever one fills the rail,
 * each is opened from its own trigger, and each brings its own header. Threading
 * callbacks from `AppShell` down to each opener would have meant a prop through
 * six components that do not otherwise care, so the rail's selection lives here
 * instead. The rail's geometry (width, resize, mobile drawer) stays in
 * `useResizableLayout` — this store deliberately knows nothing about pixels.
 */
export type RightPanelView =
  'assistant' | 'profile' | 'details' | 'card' | 'threads';

/**
 * Views the rail does not render itself.
 *
 * A Kanban card and a thread reply box own editing state — a half-typed
 * comment, an open picker — that belongs to the board or the conversation, not
 * to the shell. Rebuilding them here would mean duplicating that state; instead
 * the shell publishes an empty element and the owner portals into it. Same slot
 * trick the channel header already uses for its chat actions.
 */
export type RightPanelHostedView = Extract<
  RightPanelView,
  'card' | 'threads' | 'details'
>;

const HOSTED_VIEWS: RightPanelHostedView[] = ['card', 'threads', 'details'];

/** What an owner registers when it takes over the rail. */
export interface HostedPanel {
  /** Shown in the rail's header. Hosted views that draw their own pass ''. */
  title: string;
  /**
   * Run when the rail is dismissed from its own close button.
   *
   * The owner has to hear about it: closing the rail on an open card must
   * actually close the card, or the board would still think it is showing one.
   */
  onClose: () => void;
}

/** A person shown in the rail's profile view. */
export interface RightPanelProfile {
  userId: string;
  name: string;
  avatarUrl?: string;
  title?: string;
  role?: string;
  powerLevel?: number;
  email?: string;
  joinedAt?: string | number;
  bio?: string;
  timezone?: string;
  status?: 'online' | 'unavailable' | 'offline';
  statusEmoji?: string | null;
  statusText?: string | null;
}

export interface RightPanelState {
  open: boolean;
  view: RightPanelView;

  profile: RightPanelProfile | null;

  /** Registered by whichever component currently owns each hosted view. */
  hosted: Record<RightPanelHostedView, HostedPanel | null>;
  slots: Record<RightPanelHostedView, HTMLElement | null>;

  setOpen: (open: boolean) => void;
  setView: (view: RightPanelView) => void;
  /** Opens the rail on `view`, or closes it if that view is already showing. */
  toggleView: (view: RightPanelView) => void;
  /** Dismisses the rail, telling the current hosted owner if there is one. */
  dismiss: () => void;
  /**
   * Return the rail to its default — closed, on the assistant, holding nothing
   * transient. Called when the active workspace changes: an "Ask AI" rail or an
   * open profile belongs to the workspace it was opened in, not the next one, so
   * switching workspaces starts the rail over rather than carrying it across.
   * Hosted views (card/threads/details) already close themselves when their
   * owning page unmounts on navigation; this clears them too, defensively.
   */
  reset: () => void;

  openProfile: (profile: RightPanelProfile | null) => void;

  setSlot: (view: RightPanelHostedView, element: HTMLElement | null) => void;
  openHosted: (view: RightPanelHostedView, panel: HostedPanel) => void;
  closeHosted: (view: RightPanelHostedView) => void;
}

const emptyHosted = (): Record<RightPanelHostedView, HostedPanel | null> => ({
  card: null,
  threads: null,
  details: null,
});

const emptySlots = (): Record<RightPanelHostedView, HTMLElement | null> => ({
  card: null,
  threads: null,
  details: null,
});

function isHosted(view: RightPanelView): view is RightPanelHostedView {
  return (HOSTED_VIEWS as RightPanelView[]).includes(view);
}

export const useRightPanelStore = create<RightPanelState>()(
  persist(
    (set, get) => ({
      open: true,
      view: 'assistant',
      profile: null,
      hosted: emptyHosted(),
      slots: emptySlots(),

      setOpen: (open) => set({ open }),
      setView: (view) => set({ view, open: true }),

      toggleView: (view) => {
        const state = get();
        if (state.open && state.view === view) {
          set({ open: false });
          return;
        }
        set({ view, open: true });
      },

      dismiss: () => {
        const { view, hosted } = get();
        set({ open: false });
        // After the state write, so the owner's own close sees a shut rail.
        if (isHosted(view)) hosted[view]?.onClose();
      },

      reset: () =>
        set({
          open: false,
          view: 'assistant',
          profile: null,
          hosted: emptyHosted(),
          slots: emptySlots(),
        }),

      openProfile: (profile) => set({ profile, view: 'profile', open: true }),

      setSlot: (view, element) =>
        set((state) =>
          state.slots[view] === element
            ? state
            : { slots: { ...state.slots, [view]: element } },
        ),

      openHosted: (view, panel) =>
        set((state) => ({
          hosted: { ...state.hosted, [view]: panel },
          view,
          open: true,
        })),

      closeHosted: (view) =>
        set((state) => {
          const wasOpenOnThisView = state.open && state.view === view;
          return {
            hosted: { ...state.hosted, [view]: null },
            open: wasOpenOnThisView ? false : state.open,
            view: state.view === view ? 'assistant' : state.view,
          };
        }),
    }),
    {
      name: 'onetab_right_panel_v1',
      /*
       * Open/closed is the only thing worth remembering. Every view other than
       * the assistant needs a payload — a card, a person, a page's details —
       * and none of those survive a reload, so restoring the view would open
       * the rail on something that is no longer there.
       */
      partialize: (state) => ({ open: state.open }),
    },
  ),
);

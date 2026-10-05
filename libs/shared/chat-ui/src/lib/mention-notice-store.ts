import { useMemo } from 'react';
import { create } from 'zustand';
import type { AddAction, ComposerSurfaceKind, MentionKind } from '@org/types';

/** Someone (or something) a sent message mentioned who will not see it. */
export interface MentionNoticeTarget {
  id: string;
  name: string;
  kind: MentionKind;
  /** What the viewer may do about it — `'none'` when they lack permission. */
  addAction: AddAction;
}

export type MentionNoticeStatus = 'idle' | 'adding' | 'added' | 'failed';

/**
 * One "Only visible to you" timeline notice. These are ephemeral by design —
 * they live in memory for the session, never reach the server or another
 * device, and are gone on reload (the same lifetime Slack gives its own).
 */
export interface MentionNoticeEntry {
  id: string;
  /** The room the notice belongs to. */
  conversationKey: string;
  /** Set when a thread reply raised it — it renders in that thread instead. */
  threadRootId?: string;
  /**
   * The message that raised it (its event id or, for a fresh send, its
   * transaction id), so the notice sits directly underneath that message.
   */
  anchorId?: string;
  createdAt: number;
  targets: MentionNoticeTarget[];
  surfaceKind: ComposerSurfaceKind;
  /** Channel name (without `#`) or conversation title. */
  conversationName?: string;
  /** The other party of a 1:1 conversation. */
  peerName?: string;
  isPrivate?: boolean;
  status: MentionNoticeStatus;
  /** Targets actually added so far. */
  addedIds: string[];
  error?: string;
}

export type RaiseMentionNoticeInput = Omit<
  MentionNoticeEntry,
  'id' | 'status' | 'addedIds' | 'createdAt' | 'error'
> & { createdAt?: number };

/** Older notices fall off past this many, so a long session cannot pile up. */
const MAX_NOTICES = 50;

let sequence = 0;

export interface MentionNoticeStoreState {
  notices: MentionNoticeEntry[];
  /** Adds a notice and returns its id. */
  raise: (input: RaiseMentionNoticeInput) => string;
  update: (
    id: string,
    patch: Partial<Pick<MentionNoticeEntry, 'status' | 'addedIds' | 'error'>>,
  ) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

export const useMentionNoticeStore = create<MentionNoticeStoreState>(
  (set) => ({
    notices: [],
    raise: (input) => {
      const id = `mention-notice-${Date.now()}-${++sequence}`;
      const targetIds = new Set(input.targets.map((t) => t.id));
      set((state) => {
        /*
         * Mentioning the same missing person three messages running should not
         * stack three identical notices — the newest replaces any still-open
         * one in the same place that it fully covers.
         */
        const kept = state.notices.filter(
          (notice) =>
            !(
              notice.status === 'idle' &&
              notice.conversationKey === input.conversationKey &&
              notice.threadRootId === input.threadRootId &&
              notice.targets.every((t) => targetIds.has(t.id))
            ),
        );
        const next: MentionNoticeEntry = {
          ...input,
          id,
          createdAt: input.createdAt ?? Date.now(),
          status: 'idle',
          addedIds: [],
        };
        return { notices: [...kept, next].slice(-MAX_NOTICES) };
      });
      return id;
    },
    update: (id, patch) =>
      set((state) => ({
        notices: state.notices.map((notice) =>
          notice.id === id ? { ...notice, ...patch } : notice,
        ),
      })),
    dismiss: (id) =>
      set((state) => ({
        notices: state.notices.filter((notice) => notice.id !== id),
      })),
    dismissAll: () => set({ notices: [] }),
  }),
);

/**
 * The notices for one room's main timeline (`threadRootId` omitted) or for one
 * of its threads, oldest first.
 */
export function useMentionNotices(
  conversationKey: string | null | undefined,
  threadRootId?: string,
): MentionNoticeEntry[] {
  // Select the stable array and filter outside the selector — a selector that
  // returns a fresh array every call re-renders forever under zustand v5.
  const notices = useMentionNoticeStore((state) => state.notices);
  return useMemo(
    () =>
      conversationKey
        ? notices.filter(
            (notice) =>
              notice.conversationKey === conversationKey &&
              notice.threadRootId === threadRootId,
          )
        : [],
    [notices, conversationKey, threadRootId],
  );
}

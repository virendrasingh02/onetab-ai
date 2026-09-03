import { useCallback, useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * A message the reader put aside, as it looked when they put it aside.
 *
 * A snapshot rather than a pointer, and deliberately so. Saved items are a
 * personal shortlist that has to be readable from the sidebar's Saved page,
 * which sits outside any conversation — resolving an event id there would mean
 * opening every room the list touches just to render a preview, and an
 * encrypted room would not give the text up at all. The copy is the reader's
 * own, taken at the moment they saved it, and the entry keeps the ids needed to
 * jump back to the live message.
 */
export interface SavedMessage {
  /** Matrix event id. Unique within a room, and what "unsave" matches on. */
  id: string;
  roomId: string;
  /** Where it was saved from, for the "open channel" link. */
  channelName: string;
  channelSlug?: string;
  /** Sender's Matrix id — the stable seed for the avatar fallback. Optional so
   *  entries persisted before this field carry on working (they fall back to
   *  the name and self-correct on the next save). */
  senderId?: string;
  senderName: string;
  senderAvatarUrl?: string;
  body: string;
  /** When the message was sent, not when it was saved. */
  sentAt: number;
  savedAt: number;
}

interface SavedMessagesState {
  saved: SavedMessage[];
  add: (message: SavedMessage) => void;
  remove: (id: string) => void;
  clear: () => void;
}

/**
 * Saved items used to be a `useState` inside `ChatPanel`, which meant they
 * lasted exactly as long as one visit to one conversation — leaving the channel
 * lost the list, and nothing outside that conversation could ever show it.
 */
export const useSavedMessagesStore = create<SavedMessagesState>()(
  persist(
    (set) => ({
      saved: [],

      add: (message) =>
        set((state) =>
          state.saved.some((entry) => entry.id === message.id)
            ? state
            : { saved: [message, ...state.saved] },
        ),

      remove: (id) =>
        set((state) => ({
          saved: state.saved.filter((entry) => entry.id !== id),
        })),

      clear: () => set({ saved: [] }),
    }),
    { name: 'onetab_saved_messages_v1' },
  ),
);

/** The ids saved in one room, for the conversation's own bookmark toggles. */
export function useSavedIds(roomId: string | undefined): string[] {
  const saved = useSavedMessagesStore((s) => s.saved);
  return useMemo(
    () =>
      roomId
        ? saved.filter((entry) => entry.roomId === roomId).map((e) => e.id)
        : [],
    [saved, roomId],
  );
}

/**
 * Saves or unsaves one message.
 *
 * Takes the whole snapshot rather than an id: the caller is the only place that
 * still has the message in hand, and the store has to keep enough of it to
 * render outside the room.
 */
export function useToggleSaved() {
  const add = useSavedMessagesStore((s) => s.add);
  const remove = useSavedMessagesStore((s) => s.remove);

  return useCallback(
    (message: SavedMessage, isSaved: boolean) => {
      if (isSaved) remove(message.id);
      else add(message);
    },
    [add, remove],
  );
}

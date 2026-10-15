import type { SavedMessage } from '@org/types';
import { toast } from '@org/ui';
import { useCallback, useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useMatrix } from './matrix-provider.js';

export type { SavedMessage };

/**
 * Saved items are a snapshot (see `SavedMessage`) kept in the reader's Matrix
 * account data (`mie.saved_messages`), so they follow them across devices. The
 * zustand store is a read-through cache of that list — persisted locally only
 * so the Saved page paints instantly and works offline.
 */
interface SavedMessagesState {
  saved: SavedMessage[];
  add: (message: SavedMessage) => void;
  remove: (id: string) => void;
  replace: (saved: SavedMessage[]) => void;
  clear: () => void;
}

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

      replace: (saved) => set({ saved }),

      clear: () => set({ saved: [] }),
    }),
    { name: 'onetab_saved_messages_v1' },
  ),
);

/**
 * Keeps the store in step with Matrix. Safe to mount from several places.
 *
 * Once the client has synced, anything saved on this device before saves moved
 * to Matrix is merged up (never overwriting what other devices saved), then
 * every later change — from any device — flows back in live.
 */
export function useSavedMessagesSync(): void {
  const { client, status } = useMatrix();
  const connected = !!client && status.state === 'connected';

  useEffect(() => {
    if (!client || !connected) return;
    const replace = useSavedMessagesStore.getState().replace;

    const remote = client.getSavedMessages();
    const local = useSavedMessagesStore.getState().saved;
    const known = new Set(remote.map((entry) => entry.id));
    const unsynced = local.filter((entry) => !known.has(entry.id));
    if (unsynced.length > 0) {
      const merged = [...remote, ...unsynced].sort(
        (a, b) => b.savedAt - a.savedAt,
      );
      replace(merged);
      void client.setSavedMessages(merged).catch(() => {
        // Retried the next time the client reconnects.
      });
    } else {
      replace(remote);
    }

    return client.on((event) => {
      if (event.type === 'saved.updated') replace(event.saved);
    });
  }, [client, connected]);
}

/** The ids saved in one room, for the conversation's own bookmark toggles. */
export function useSavedIds(roomId: string | undefined): string[] {
  useSavedMessagesSync();
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
 * Saves or unsaves one message: optimistic locally, written to Matrix, and
 * rolled back with a toast if the homeserver refuses.
 *
 * Takes the whole snapshot rather than an id: the caller is the only place that
 * still has the message in hand, and the entry has to hold enough of it to
 * render outside the room.
 */
export function useToggleSaved() {
  const { client } = useMatrix();

  return useCallback(
    (message: SavedMessage, isSaved: boolean) => {
      const { add, remove } = useSavedMessagesStore.getState();
      if (isSaved) remove(message.id);
      else add(message);
      if (!client) return;
      client.setMessageSaved(message, !isSaved).catch(() => {
        if (isSaved) add(message);
        else remove(message.id);
        toast.error(
          isSaved ? 'Could not remove the saved message.' : 'Could not save the message.',
        );
      });
    },
    [client],
  );
}

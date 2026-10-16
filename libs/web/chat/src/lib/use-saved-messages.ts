import { bookmarksApi } from '@org/api-client';
import type { SavedMessage } from '@org/types';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { useMatrix } from './matrix-provider.js';
import {
  MESSAGE_BOOKMARK_TYPE,
  bookmarkToSavedMessage,
  savedMessageToBookmark,
} from './saved-message-mapping.js';
import { useBookmarks, useBookmarkToggle } from './use-bookmarks.js';

export {
  MESSAGE_BOOKMARK_TYPE,
  bookmarkToSavedMessage,
  savedMessageToBookmark,
};

export type { SavedMessage };

/* --- one-off import of pre-server saves -------------------------------- */

/** The zustand cache older clients persisted the Matrix list into. */
const LEGACY_CACHE_KEY = 'onetab_saved_messages_v1';
const IMPORT_CHUNK = 500;

function readLegacyCache(): SavedMessage[] {
  try {
    const raw = localStorage.getItem(LEGACY_CACHE_KEY);
    if (!raw) return [];
    const saved = (JSON.parse(raw) as { state?: { saved?: unknown } })?.state?.saved;
    return Array.isArray(saved)
      ? saved.filter(
          (entry): entry is SavedMessage =>
            !!entry &&
            typeof (entry as SavedMessage).id === 'string' &&
            typeof (entry as SavedMessage).roomId === 'string',
        )
      : [];
  } catch {
    return [];
  }
}

function dropLegacyCache(): void {
  try {
    localStorage.removeItem(LEGACY_CACHE_KEY);
  } catch {
    // Storage blocked — nothing was cached there either.
  }
}

/** Shared across every mount: the import runs once per page load at most. */
let legacyImport: Promise<void> | null = null;

/**
 * Moves saves made before they lived on the server — the Matrix account-data
 * list and this device's cache of it — into `/bookmarks`, then clears both so
 * they can't resurrect anything removed later. The server never overwrites an
 * existing bookmark and files channel messages under their own workspace.
 * Failures leave the legacy data in place for the next attempt.
 */
export function useLegacySavedMessagesImport(): void {
  const { client, status } = useMatrix();
  const { workspaceId } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const connected = !!client && status.state === 'connected';

  useEffect(() => {
    if (!client || !connected || !workspaceId || legacyImport) return;

    const remote = client.getSavedMessages();
    const byId = new Map<string, SavedMessage>();
    for (const entry of [...readLegacyCache(), ...remote]) byId.set(entry.id, entry);
    if (byId.size === 0) return;

    const items = [...byId.values()].map(savedMessageToBookmark);
    legacyImport = (async () => {
      for (let i = 0; i < items.length; i += IMPORT_CHUNK) {
        await bookmarksApi.import(workspaceId, items.slice(i, i + IMPORT_CHUNK));
      }
      dropLegacyCache();
      if (remote.length > 0) await client.setSavedMessages([]);
      await queryClient.invalidateQueries({ queryKey: ['bookmarks'] });
    })().catch(() => {
      // Kept for the next connect / page load.
      legacyImport = null;
    });
  }, [client, connected, workspaceId, queryClient]);
}

/* --- hooks --------------------------------------------------------------- */

/** Every saved message in the current workspace, newest first. */
export function useSavedMessages(): {
  saved: SavedMessage[];
  isLoading: boolean;
} {
  useLegacySavedMessagesImport();
  const { workspaceId } = useCurrentWorkspace();
  const { data = [], isLoading } = useBookmarks(workspaceId, MESSAGE_BOOKMARK_TYPE);
  const saved = useMemo(() => data.map(bookmarkToSavedMessage), [data]);
  return { saved, isLoading };
}

/** The ids saved in one room, for the conversation's own bookmark toggles. */
export function useSavedIds(roomId: string | undefined): string[] {
  const { saved } = useSavedMessages();
  return useMemo(
    () =>
      roomId
        ? saved.filter((entry) => entry.roomId === roomId).map((e) => e.id)
        : [],
    [saved, roomId],
  );
}

/**
 * Saves or unsaves one message: optimistic, written to the bookmarks API, and
 * rolled back with a toast if the server refuses.
 *
 * Takes the whole snapshot rather than an id: the caller is the only place that
 * still has the message in hand, and the entry has to hold enough of it to
 * render outside the room.
 */
export function useToggleSaved() {
  const { workspaceId } = useCurrentWorkspace();
  const { toggle } = useBookmarkToggle(workspaceId);

  return useCallback(
    (message: SavedMessage, isSaved: boolean) => {
      void toggle(savedMessageToBookmark(message), isSaved);
    },
    [toggle],
  );
}

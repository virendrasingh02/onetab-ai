import type { ChannelBookmark } from '@org/types';
import { toast } from '@org/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Private, per-browser bookmarks for a 1:1 direct message — the DM counterpart
 * of `useChannelBookmarks`.
 *
 * A DM has no server-side record to hang these off (the same reason
 * `useDirectMessagePreferences` is a local store), so they live in
 * `localStorage`, keyed by workspace + peer. The peer id is stable and is
 * available before the Matrix room resolves, so it — not the room id — is the
 * key; the note-to-self conversation keys on the reader's own id and is just as
 * durable as any other.
 *
 * Group DMs deliberately do not get this: it is a 1:1 affordance, matching the
 * rest of `DirectConversation`'s chrome.
 */
export function useDirectMessageBookmarks(
  workspaceId: string | undefined,
  peerId: string | undefined,
) {
  const storageKey = useMemo(
    () => `onetab_dm_bm_${workspaceId || 'default'}_${peerId || 'default'}`,
    [workspaceId, peerId],
  );

  const [bookmarks, setBookmarks] = useState<ChannelBookmark[]>(() => {
    if (typeof window === 'undefined' || !peerId) return [];
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !peerId) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setBookmarks(parsed);
          return;
        }
      }
    } catch {
      // ignore
    }
    setBookmarks([]);
  }, [storageKey, peerId]);

  const addBookmark = useCallback(
    (bookmark: Omit<ChannelBookmark, 'id'>) => {
      setBookmarks((prev) => {
        const newEntry: ChannelBookmark = {
          ...bookmark,
          id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        };
        const updated = [...prev, newEntry];
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // ignore
        }
        toast.success(`Bookmark "${bookmark.label}" saved`);
        return updated;
      });
    },
    [storageKey],
  );

  const removeBookmark = useCallback(
    (id: string) => {
      setBookmarks((prev) => {
        const target = prev.find((b) => b.id === id);
        const updated = prev.filter((b) => b.id !== id);
        try {
          localStorage.setItem(storageKey, JSON.stringify(updated));
        } catch {
          // ignore
        }
        toast.info(
          target ? `Bookmark "${target.label}" removed` : 'Bookmark removed',
        );
        return updated;
      });
    },
    [storageKey],
  );

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
  };
}

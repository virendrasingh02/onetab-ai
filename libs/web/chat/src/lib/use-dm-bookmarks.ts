import type { ChannelBookmark } from '@org/types';
import { toast } from '@org/ui';
import { generateId } from '@org/utils';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  DM_BOOKMARKS_KEY,
  useMemberPreferenceBlob,
} from './use-dm-preferences.js';

type BookmarksByPeer = Record<string, ChannelBookmark[]>;

const NO_BOOKMARKS: ChannelBookmark[] = [];

const isBookmark = (value: unknown): value is ChannelBookmark =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as ChannelBookmark).id === 'string' &&
  typeof (value as ChannelBookmark).label === 'string' &&
  typeof (value as ChannelBookmark).href === 'string';

const toByPeer = (value: unknown): BookmarksByPeer => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: BookmarksByPeer = {};
  for (const [peer, list] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(list)) out[peer] = list.filter(isBookmark);
  }
  return out;
};

/** Pre-server localStorage key prefix: `onetab_dm_bm_<workspace>_<peer>`. */
const legacyPrefix = (workspaceId: string) => `onetab_dm_bm_${workspaceId}_`;

/**
 * Private bookmarks for a 1:1 direct message — the DM counterpart of
 * `useChannelBookmarks`.
 *
 * Stored in the member's server-side workspace preferences (keyed by peer id,
 * which is stable and known before the Matrix room resolves), so they follow
 * the member to every device. The note-to-self conversation keys on the
 * reader's own id.
 *
 * Group DMs deliberately do not get this: it is a 1:1 affordance, matching the
 * rest of `DirectConversation`'s chrome.
 */
export function useDirectMessageBookmarks(
  workspaceId: string | undefined,
  peerId: string | undefined,
) {
  const { query, save, current } = useMemberPreferenceBlob(workspaceId);

  // One-time import of bookmarks this browser kept before they were synced.
  const imported = useRef<string | null>(null);
  useEffect(() => {
    if (!workspaceId || !query.data || imported.current === workspaceId) return;
    imported.current = workspaceId;
    if (DM_BOOKMARKS_KEY in query.data) return;
    try {
      const prefix = legacyPrefix(workspaceId);
      const legacy: BookmarksByPeer = {};
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key?.startsWith(prefix)) continue;
        keys.push(key);
        const list = JSON.parse(localStorage.getItem(key) ?? '[]');
        if (Array.isArray(list) && list.some(isBookmark)) {
          legacy[key.slice(prefix.length)] = list.filter(isBookmark);
        }
      }
      if (Object.keys(legacy).length) save({ [DM_BOOKMARKS_KEY]: legacy });
      for (const key of keys) localStorage.removeItem(key);
    } catch {
      // Unreadable legacy state — nothing worth importing.
    }
  }, [workspaceId, query.data, save]);

  const bookmarks = useMemo(
    () =>
      peerId
        ? (toByPeer(query.data?.[DM_BOOKMARKS_KEY])[peerId] ?? NO_BOOKMARKS)
        : NO_BOOKMARKS,
    [query.data, peerId],
  );

  const write = useCallback(
    (update: (list: ChannelBookmark[]) => ChannelBookmark[]) => {
      if (!workspaceId || !peerId) return;
      const byPeer = toByPeer(current()[DM_BOOKMARKS_KEY]);
      const next = update(byPeer[peerId] ?? []);
      if (next.length) byPeer[peerId] = next;
      else delete byPeer[peerId];
      save({ [DM_BOOKMARKS_KEY]: byPeer });
    },
    [workspaceId, peerId, current, save],
  );

  const addBookmark = useCallback(
    (bookmark: Omit<ChannelBookmark, 'id'>) => {
      write((list) => [...list, { ...bookmark, id: generateId('bm') }]);
      toast.success(`Bookmark "${bookmark.label}" saved`);
    },
    [write],
  );

  const removeBookmark = useCallback(
    (id: string) => {
      const target = bookmarks.find((b) => b.id === id);
      write((list) => list.filter((b) => b.id !== id));
      toast.info(
        target ? `Bookmark "${target.label}" removed` : 'Bookmark removed',
      );
    },
    [write, bookmarks],
  );

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
  };
}

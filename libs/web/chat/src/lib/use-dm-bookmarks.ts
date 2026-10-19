import type { ChannelBookmark } from '@org/types';
import { toast } from '@org/ui';
import { generateId } from '@org/utils';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  DM_BOOKMARKS_KEY,
  useMemberPreferenceBlob,
} from './member-preference-blob.js';

type BookmarksByOwner = Record<string, ChannelBookmark[]>;

/** Preference-blob key for channel bookmarks, keyed by channel id. */
export const CHANNEL_BOOKMARKS_KEY = 'channelBookmarks';

const NO_BOOKMARKS: ChannelBookmark[] = [];

const isBookmark = (value: unknown): value is ChannelBookmark =>
  !!value &&
  typeof value === 'object' &&
  typeof (value as ChannelBookmark).id === 'string' &&
  typeof (value as ChannelBookmark).label === 'string' &&
  typeof (value as ChannelBookmark).href === 'string';

const toByOwner = (value: unknown): BookmarksByOwner => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: BookmarksByOwner = {};
  for (const [owner, list] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(list)) out[owner] = list.filter(isBookmark);
  }
  return out;
};

/**
 * A member's private bookmark lists, one per conversation, kept under
 * `blobKey` in their server-side workspace preferences so they follow the
 * member to every device.
 *
 * `legacyPrefix` is the localStorage key prefix (`<prefix><ownerKey>`) the
 * lists lived under before they were synced; anything found there is imported
 * once — only while the server has never stored `blobKey` — then removed.
 */
function useMemberBookmarks(
  workspaceId: string | undefined,
  blobKey: string,
  ownerKey: string | undefined,
  legacyPrefix: string | undefined,
) {
  const { query, save, current } = useMemberPreferenceBlob(workspaceId);

  const imported = useRef<string | null>(null);
  useEffect(() => {
    if (!workspaceId || !legacyPrefix || !query.data) return;
    if (imported.current === workspaceId) return;
    imported.current = workspaceId;
    if (blobKey in query.data) return;
    try {
      const legacy: BookmarksByOwner = {};
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key?.startsWith(legacyPrefix)) continue;
        keys.push(key);
        const list = JSON.parse(localStorage.getItem(key) ?? '[]');
        if (Array.isArray(list) && list.some(isBookmark)) {
          legacy[key.slice(legacyPrefix.length)] = list.filter(isBookmark);
        }
      }
      if (Object.keys(legacy).length) save({ [blobKey]: legacy });
      for (const key of keys) localStorage.removeItem(key);
    } catch {
      // Unreadable legacy state — nothing worth importing.
    }
  }, [workspaceId, legacyPrefix, blobKey, query.data, save]);

  const bookmarks = useMemo(
    () =>
      ownerKey
        ? (toByOwner(query.data?.[blobKey])[ownerKey] ?? NO_BOOKMARKS)
        : NO_BOOKMARKS,
    [query.data, blobKey, ownerKey],
  );

  const write = useCallback(
    (update: (list: ChannelBookmark[]) => ChannelBookmark[]) => {
      if (!workspaceId || !ownerKey) return;
      const byOwner = toByOwner(current()[blobKey]);
      const next = update(byOwner[ownerKey] ?? []);
      if (next.length) byOwner[ownerKey] = next;
      else delete byOwner[ownerKey];
      save({ [blobKey]: byOwner });
    },
    [workspaceId, ownerKey, blobKey, current, save],
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
    isLoading: query.isLoading,
  };
}

/**
 * Private bookmarks for a 1:1 direct message, keyed by peer id (stable and
 * known before the Matrix room resolves). The note-to-self conversation keys
 * on the reader's own id.
 *
 * Group DMs deliberately do not get this: it is a 1:1 affordance, matching the
 * rest of `DirectConversation`'s chrome.
 */
export function useDirectMessageBookmarks(
  workspaceId: string | undefined,
  peerId: string | undefined,
) {
  return useMemberBookmarks(
    workspaceId,
    DM_BOOKMARKS_KEY,
    peerId,
    workspaceId ? `onetab_dm_bm_${workspaceId}_` : undefined,
  );
}

/**
 * The member's own bookmarks for a channel — the channel's Bookmarks tab.
 * Private to the member, but synced to every device they sign in on.
 */
export function useChannelMemberBookmarks(
  workspaceId: string | undefined,
  channelId: string | undefined,
) {
  return useMemberBookmarks(
    workspaceId,
    CHANNEL_BOOKMARKS_KEY,
    channelId,
    workspaceId ? `onetab_channel_bm_${workspaceId}_` : undefined,
  );
}

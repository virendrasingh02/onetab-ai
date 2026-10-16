import { queryKeys, workspaceApi } from '@org/api-client';
import { toast } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDirectRoomIndex } from './dm-room-index.js';
import { useMatrix } from './matrix-provider.js';

/**
 * Per-conversation preferences for DMs: favorite and mute (and, in
 * `use-dm-bookmarks.ts`, bookmarks). Mute is the exception to the storage
 * described below — see `useDirectMessagePreferences`.
 *
 * A channel keeps these on its membership row, but a DM has no membership
 * record to hang them off. They live in the member's server-side workspace
 * preferences (`/workspaces/:id/settings/member-preferences`) under their own
 * keys, so they follow the member across devices and browsers; a change made
 * elsewhere arrives through the `settings.updated` realtime invalidation of
 * the same query. Ids are a peer's workspace user id for a 1:1 DM, or the
 * Matrix room id for a group DM.
 *
 * Every caller shares one React Query entry, so the header, the sidebar and
 * the sound gate always agree without a client store.
 */
export const DM_FAVORITES_KEY = 'dmFavorites';
export const DM_MUTED_KEY = 'dmMuted';
export const DM_BOOKMARKS_KEY = 'dmBookmarks';

/** Where these lived before they were server-backed; imported once, then dropped. */
const LEGACY_PREFERENCES_KEY = 'onetab-dm-preferences';

/* Shared so a workspace with no preferences yet hands back the *same* array on
   every render — a fresh `[]` per call would invalidate every `useMemo` keyed
   on them. */
const NO_IDS: string[] = [];

const toIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : NO_IDS;

const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];

const errorText = (err: unknown) =>
  err instanceof Error && err.message ? err.message : undefined;

/**
 * The member's preference blob for a workspace, plus an optimistic partial
 * write. Shares its query key with the settings screen and Studio favorites.
 */
export function useMemberPreferenceBlob(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const key = useMemo(
    () => queryKeys.workspaces.memberPreferences(workspaceId ?? ''),
    [workspaceId],
  );

  const query = useQuery({
    queryKey: key,
    queryFn: () => workspaceApi.getMemberPreferences(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: (patch: Record<string, unknown>) =>
      workspaceApi.saveMemberPreferences(workspaceId as string, patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Record<string, unknown>>(key);
      queryClient.setQueryData(key, { ...(previous ?? {}), ...patch });
      return { previous };
    },
    onError: (err, _patch, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
      toast.error('Could not save conversation preference', {
        description: errorText(err),
      });
    },
  });

  /** Reads the freshest cached blob — rapid toggles must build on each other. */
  const current = useCallback(
    () => queryClient.getQueryData<Record<string, unknown>>(key) ?? {},
    [queryClient, key],
  );

  return { query, save: save.mutate, current };
}

/**
 * One-time import of the favorites/mutes this browser kept in localStorage
 * before they were server-backed, so nobody loses them on upgrade. Runs only
 * when the server has never stored either key for this workspace.
 */
function useImportLegacyPreferences(
  workspaceId: string | undefined,
  data: Record<string, unknown> | undefined,
  save: (patch: Record<string, unknown>) => void,
) {
  const done = useRef<string | null>(null);
  useEffect(() => {
    if (!workspaceId || !data || done.current === workspaceId) return;
    done.current = workspaceId;
    if (DM_FAVORITES_KEY in data || DM_MUTED_KEY in data) return;
    try {
      const raw = localStorage.getItem(LEGACY_PREFERENCES_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        state?: {
          byWorkspace?: Record<string, { favorites?: unknown; muted?: unknown }>;
        };
      };
      const byWorkspace = parsed.state?.byWorkspace ?? {};
      const legacy = byWorkspace[workspaceId];
      if (!legacy) return;
      const favorites = toIds(legacy.favorites);
      const muted = toIds(legacy.muted);
      if (favorites.length || muted.length) {
        save({ [DM_FAVORITES_KEY]: favorites, [DM_MUTED_KEY]: muted });
      }
      delete byWorkspace[workspaceId];
      localStorage.setItem(LEGACY_PREFERENCES_KEY, JSON.stringify(parsed));
    } catch {
      // Unreadable legacy state — nothing worth importing.
    }
  }, [workspaceId, data, save]);
}

export interface DirectMessagePreferences {
  favoriteIds: string[];
  mutedIds: string[];
  isFavorite: (peerId: string) => boolean;
  isMuted: (peerId: string) => boolean;
  toggleFavorite: (peerId: string) => void;
  toggleMuted: (peerId: string) => void;
}

export function useDirectMessagePreferences(
  workspaceId: string | undefined,
): DirectMessagePreferences {
  const { query, save, current } = useMemberPreferenceBlob(workspaceId);
  useImportLegacyPreferences(workspaceId, query.data, save);
  const { client } = useMatrix();
  const rooms = useDirectRoomIndex();

  const favoriteIds = useMemo(
    () => toIds(query.data?.[DM_FAVORITES_KEY]),
    [query.data],
  );

  /*
   * Mute lives on the Matrix room as a push rule: it is per account, so it is
   * the same in every workspace and on every device, and it is what actually
   * silences push. The workspace preference only holds "pending" mutes for
   * people with no DM room yet; `useDirectMessageMuteSync` moves each onto
   * its room as soon as the room exists.
   */
  const pendingMutedIds = useMemo(
    () => toIds(query.data?.[DM_MUTED_KEY]),
    [query.data],
  );
  const mutedIds = useMemo(() => {
    const pending = pendingMutedIds.filter((id) => !rooms.roomFor(id));
    return pending.length ? [...rooms.mutedIds, ...pending] : rooms.mutedIds;
  }, [pendingMutedIds, rooms]);

  const toggleKey = useCallback(
    (key: string, id: string) => {
      if (!workspaceId || !id) return;
      save({ [key]: toggle(toIds(current()[key]), id) });
    },
    [workspaceId, save, current],
  );

  const toggleMuted = useCallback(
    (id: string) => {
      if (!id) return;
      const roomId = rooms.roomFor(id);
      if (!roomId || !client) {
        toggleKey(DM_MUTED_KEY, id);
        return;
      }
      client
        .setRoomMuted(roomId, !rooms.isRoomMuted(roomId))
        .catch((err: unknown) =>
          toast.error('Could not update mute', { description: errorText(err) }),
        );
      // A leftover pending entry would re-mute the room on the next sync.
      if (workspaceId && toIds(current()[DM_MUTED_KEY]).includes(id)) {
        toggleKey(DM_MUTED_KEY, id);
      }
    },
    [rooms, client, toggleKey, workspaceId, current],
  );

  return {
    favoriteIds,
    mutedIds,
    isFavorite: (peerId: string) => favoriteIds.includes(peerId),
    isMuted: (peerId: string) => mutedIds.includes(peerId),
    toggleFavorite: (peerId: string) => toggleKey(DM_FAVORITES_KEY, peerId),
    toggleMuted,
  };
}

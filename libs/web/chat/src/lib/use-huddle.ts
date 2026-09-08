import { huddleApi } from '@org/api-client';
import {
  HUDDLE_MAX_RECONNECT_ATTEMPTS,
  huddleConnectionReducer,
  isHuddleConnecting,
  type HuddleConnectionState,
  type HuddleView,
} from '@org/types';
import { toast } from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useReducer, useRef } from 'react';

const roomHuddleKey = (workspaceId: string, roomId: string) =>
  ['huddle', workspaceId, roomId] as const;

/**
 * Binds a conversation's live huddle to the backend (brief §6 / §7).
 *
 * The huddle record, its participants and the "you joined at" marker come from
 * the server; the media surface is Element Call embedded in the huddle's room
 * when `ELEMENT_CALL_URL` is configured, otherwise the huddle is presence-only.
 *
 * The connection state machine is what guarantees a dropped network resolves to
 * `reconnecting → connected` — or, once retries run out, `failed` with Retry /
 * Leave — rather than a stuck spinner. It runs off `window` online/offline for
 * presence-only huddles and off the Element Call iframe's load signal when that
 * surface is embedded.
 */
export function useHuddleSession(
  workspaceId: string | undefined,
  roomId: string | null | undefined,
) {
  const queryClient = useQueryClient();
  const enabled = !!workspaceId && !!roomId;

  const configQuery = useQuery({
    queryKey: ['huddle', workspaceId ?? '', 'config'],
    queryFn: () => huddleApi.config(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });
  const elementCallUrl = configQuery.data?.elementCallUrl ?? null;

  const huddleQuery = useQuery({
    queryKey: roomHuddleKey(workspaceId ?? '', roomId ?? ''),
    queryFn: () => huddleApi.forRoom(workspaceId as string, roomId as string),
    enabled,
    staleTime: 10_000,
  });

  const huddle = huddleQuery.data ?? null;
  const joined = !!huddle?.viewerJoinedAt;

  /* --- connection state machine (brief §6) ------------------------------- */
  const [connection, dispatch] = useReducer(
    huddleConnectionReducer,
    'idle' as HuddleConnectionState,
  );
  const attemptsRef = useRef(0);

  const invalidate = useCallback(
    () =>
      queryClient.invalidateQueries({
        queryKey: roomHuddleKey(workspaceId ?? '', roomId ?? ''),
      }),
    [queryClient, workspaceId, roomId],
  );

  const startOrJoinMutation = useMutation({
    mutationFn: () => {
      if (!enabled) return Promise.resolve<HuddleView | null>(null);
      return huddle
        ? huddleApi.join(workspaceId as string, huddle.id)
        : huddleApi.start(workspaceId as string, {
            matrixRoomId: roomId as string,
          });
    },
    onSuccess: (data) => {
      if (!data) return;
      queryClient.setQueryData(
        roomHuddleKey(workspaceId ?? '', roomId ?? ''),
        data,
      );
      attemptsRef.current = 0;
      dispatch('join');
    },
    onError: () => toast.error('Could not join the huddle'),
  });

  const leaveMutation = useMutation({
    mutationFn: () =>
      enabled && huddle
        ? huddleApi.leave(workspaceId as string, huddle.id)
        : Promise.resolve(),
    onSuccess: () => {
      dispatch('leave');
      void invalidate();
    },
  });

  const endMutation = useMutation({
    mutationFn: () =>
      enabled && huddle
        ? huddleApi.end(workspaceId as string, huddle.id)
        : Promise.resolve(),
    onSuccess: () => {
      dispatch('leave');
      void invalidate();
    },
    onError: () => toast.error('Only the host can end this huddle'),
  });

  const { mutate: startOrJoinMutate } = startOrJoinMutation;
  const { mutate: leaveMutate } = leaveMutation;
  const { mutate: endMutate } = endMutation;
  const startOrJoin = useCallback(
    () => startOrJoinMutate(),
    [startOrJoinMutate],
  );
  const leave = useCallback(() => leaveMutate(), [leaveMutate]);
  const end = useCallback(() => endMutate(), [endMutate]);

  // Drop the machine back to idle whenever the viewer is not in a huddle —
  // a conversation switch, someone else ending it, our own leave landing.
  useEffect(() => {
    if (!joined && connection !== 'idle') {
      dispatch('leave');
      attemptsRef.current = 0;
    }
  }, [joined, roomId, connection]);

  // Presence-only huddles have no media surface to report itself live, so
  // "joined" is "connected" the moment the join lands.
  useEffect(() => {
    if (connection === 'connecting' && !elementCallUrl) dispatch('media_ready');
  }, [connection, elementCallUrl]);

  // Browser network transitions drive connected ⇄ interrupted ⇄ reconnecting.
  useEffect(() => {
    if (!joined) return;
    const onOffline = () => dispatch('network_lost');
    const onOnline = () => {
      attemptsRef.current = 0;
      dispatch('network_back');
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [joined]);

  // The recovery loop: nudge interrupted → reconnecting once the browser is
  // back online, then retry with backoff until media is live or attempts run
  // out. Never leaves the huddle sitting in a silent spinner.
  useEffect(() => {
    if (!joined) return;

    if (connection === 'interrupted') {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const timer = setTimeout(() => dispatch('retry'), 500);
      return () => clearTimeout(timer);
    }

    if (connection === 'reconnecting') {
      if (attemptsRef.current >= HUDDLE_MAX_RECONNECT_ATTEMPTS) {
        dispatch('reconnect_failed');
        return;
      }
      const delay = Math.min(1000 * 2 ** attemptsRef.current, 15_000);
      const timer = setTimeout(() => {
        attemptsRef.current += 1;
        const online =
          typeof navigator === 'undefined' || navigator.onLine;
        // With Element Call embedded, its reload drives `onMediaReady`; without
        // it, being back online is the signal we can act on.
        if (online && !elementCallUrl) dispatch('media_ready');
        else if (!online) dispatch('network_lost');
      }, delay);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [connection, joined, elementCallUrl]);

  /** The embedded media surface reported itself live (iframe load / RTC join). */
  const onMediaReady = useCallback(() => {
    attemptsRef.current = 0;
    dispatch('media_ready');
  }, []);

  const retry = useCallback(() => {
    attemptsRef.current = 0;
    dispatch('retry');
  }, []);

  return {
    /** The active huddle in this room, or null. */
    huddle,
    joined,
    isLoading: enabled && huddleQuery.isLoading,
    elementCallUrl,
    connection,
    isConnecting: isHuddleConnecting(connection),
    /** Start the room's huddle, or join the one already running. */
    startOrJoin,
    /** Leave — the server ends the huddle if nobody is left. */
    leave,
    /** Host-only: end the huddle for everyone. */
    end,
    retry,
    onMediaReady,
    busy:
      startOrJoinMutation.isPending ||
      leaveMutation.isPending ||
      endMutation.isPending,
  };
}

export type HuddleSession = ReturnType<typeof useHuddleSession>;

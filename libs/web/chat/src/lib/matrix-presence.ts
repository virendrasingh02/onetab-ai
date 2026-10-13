import { useCurrentUser } from '@org/auth';
import { useUserPresenceMap } from '@org/realtime';
import { toPlatformUserId, type PresenceState } from '@org/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMatrix } from './matrix-provider.js';

/** Matrix presence narrowed to what `UserAvatar` draws. */
export type AvatarPresence = 'online' | 'away' | 'offline';

const TO_AVATAR: Record<PresenceState, AvatarPresence> = {
  online: 'online',
  away: 'away',
  busy: 'away',
  unavailable: 'away',
  offline: 'offline',
};

/**
 * Live Matrix presence (`m.presence`), keyed by the *platform* user id so it
 * lines up with the realtime presence map. Only users Synapse has actually
 * reported appear — an unknown user is `undefined`, never a fake "offline",
 * so callers can tell "no data" from "offline".
 */
export function useMatrixPresenceResolver(): (
  userId: string,
) => AvatarPresence | undefined {
  const { client } = useMatrix();
  const [map, setMap] = useState<Record<string, AvatarPresence>>({});

  useEffect(() => {
    setMap({});
    if (!client) return;
    return client.on((event) => {
      if (event.type !== 'presence') return;
      const key = toPlatformUserId(event.presence.userId);
      const next = TO_AVATAR[event.presence.state] ?? 'offline';
      setMap((current) =>
        current[key] === next ? current : { ...current, [key]: next },
      );
    });
  }, [client]);

  return useCallback(
    (userId: string) => map[toPlatformUserId(userId)],
    [map],
  );
}

/**
 * Publishes the user's own platform status (online / away / busy / offline,
 * incl. DND and scheduled status) to Matrix, so other Matrix clients and the
 * Matrix-side roster agree with the dot every OneTab surface draws. The
 * platform presence stays authoritative; this is a one-way mirror.
 */
export function useMirrorPresenceToMatrix(): void {
  const { client } = useMatrix();
  const user = useCurrentUser();
  const presenceMap = useUserPresenceMap();
  const mine = user?.id ? presenceMap[user.id] : undefined;
  const status = mine?.status;
  const text = mine?.statusText ?? undefined;
  const lastSent = useRef<string>('');

  useEffect(() => {
    if (!client || !status) return;
    const state: PresenceState = status;
    const signature = `${state}|${text ?? ''}`;
    if (lastSent.current === signature) return;
    lastSent.current = signature;
    client.setPresence(state, text).catch(() => {
      // Presence is best-effort; allow a retry on the next change.
      lastSent.current = '';
    });
  }, [client, status, text]);

  // A fresh client (reconnect) has published nothing yet.
  useEffect(() => {
    lastSent.current = '';
  }, [client]);
}

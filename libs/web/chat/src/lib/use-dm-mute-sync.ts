import { useEffect, useRef } from 'react';
import { useDirectRoomIndex } from './dm-room-index.js';
import { useMatrix } from './matrix-provider.js';
import {
  DM_MUTED_KEY,
  useMemberPreferenceBlob,
} from './use-dm-preferences.js';

/**
 * Moves "pending" DM mutes onto their Matrix rooms.
 *
 * A DM's mute is its room's push rule (per account, so the same in every
 * workspace and on every device). Muting someone you have never messaged has
 * no room to put a rule on, so it waits in this workspace's member
 * preferences. As soon as that room exists — you opened the conversation, or
 * they messaged you — this writes the rule and drops the pending entry, after
 * which Matrix alone decides. Legacy per-workspace mutes migrate the same way.
 *
 * Mount once, inside `<MatrixProvider>` (the app shell does).
 */
export function useDirectMessageMuteSync(workspaceId: string | undefined) {
  const { client } = useMatrix();
  const rooms = useDirectRoomIndex();
  const { query, save, current } = useMemberPreferenceBlob(workspaceId);
  const inFlight = useRef(new Set<string>());

  useEffect(() => {
    if (!client || !rooms.ready || !workspaceId || !query.data) return;
    const pending = query.data[DM_MUTED_KEY];
    if (!Array.isArray(pending)) return;

    for (const id of pending) {
      if (typeof id !== 'string' || inFlight.current.has(id)) continue;
      const roomId = rooms.roomFor(id);
      if (!roomId) continue;
      inFlight.current.add(id);
      client
        .setRoomMuted(roomId, true)
        .then(() => {
          const now = current()[DM_MUTED_KEY];
          const rest = Array.isArray(now) ? now.filter((x) => x !== id) : [];
          save({ [DM_MUTED_KEY]: rest });
        })
        .catch((error: unknown) => {
          console.warn('[dm] could not move mute onto its Matrix room', error);
        })
        .finally(() => inFlight.current.delete(id));
    }
  }, [client, rooms, workspaceId, query.data, save, current]);
}

import { matrixApi } from '@org/api-client';
import type { Room, RoomId } from '@org/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMatrix } from './matrix-provider.js';

/**
 * Where the signed-in user stands in a channel's Matrix room.
 *
 * - `unknown` — not synced yet, or no room; nothing to say.
 * - `joined` — the only state in which a send can succeed.
 * - `joining` — not joined, and the server is being asked to fix that.
 * - `failed` — not joined, and the server could not (or would not) join them.
 */
export type ChannelMembershipState = 'unknown' | 'joined' | 'joining' | 'failed';

/** Pure read of the room's own-membership, so it can be tested without a client. */
export function isJoined(room: Pick<Room, 'myMembership'> | null): boolean {
  return room?.myMembership === 'join';
}

/**
 * Detects a channel member who is not a joined member of the channel's room
 * — an invite nobody accepted, a missed membership mirror — and heals it.
 *
 * Our database is the authority on channel membership; Matrix only enforces
 * it. Without this, the desynced user sees a normal composer whose every send
 * bounces "User … not in room". Instead the server is asked once (per room) to
 * join them, which it only does for a real channel member, and the caller can
 * show a clear notice while that runs or after it fails.
 */
export function useChannelMembership(
  channelId: string,
  roomId: RoomId | null,
): { state: ChannelMembershipState; retry: () => void } {
  const { client, status } = useMatrix();
  const synced = status.state === 'connected';

  const readJoined = useCallback((): boolean | null => {
    if (!client || !roomId || !synced) return null;
    try {
      return isJoined(client.getRoom(roomId));
    } catch {
      // Client present but not ready — `require()` throws.
      return null;
    }
  }, [client, roomId, synced]);

  const [joined, setJoined] = useState<boolean | null>(readJoined);
  const [attempt, setAttempt] = useState<'idle' | 'pending' | 'failed'>('idle');

  useEffect(() => {
    setJoined(readJoined());
    if (!client || !roomId) return;
    return client.on((event) => {
      if (
        (event.type === 'room.upserted' && event.room.id === roomId) ||
        (event.type === 'room.removed' && event.roomId === roomId)
      ) {
        setJoined(readJoined());
      }
    });
  }, [client, roomId, readJoined]);

  // One automatic heal per room; `retry` is the manual one after a failure.
  const healed = useRef<string | null>(null);
  const heal = useCallback(() => {
    setAttempt('pending');
    matrixApi.joinChannelRoom(channelId).then(
      // Stay `pending` until the sync delivers the join — `room.upserted`
      // flips `joined`, which ends the notice.
      () => undefined,
      () => setAttempt('failed'),
    );
  }, [channelId]);

  useEffect(() => {
    if (joined !== false || !roomId) return;
    const key = `${channelId}:${roomId}`;
    if (healed.current === key) return;
    healed.current = key;
    heal();
  }, [joined, channelId, roomId, heal]);

  useEffect(() => {
    if (joined) setAttempt('idle');
  }, [joined]);

  let state: ChannelMembershipState = 'unknown';
  if (joined === true) state = 'joined';
  else if (joined === false) state = attempt === 'failed' ? 'failed' : 'joining';

  return { state, retry: heal };
}

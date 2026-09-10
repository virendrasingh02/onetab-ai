import { useEffect } from 'react';

/**
 * Which conversation the user is currently looking at.
 *
 * A tiny module-level signal rather than a store: only the chat surface writes
 * it (on mount, cleared on unmount), and only the notification-sound bridge
 * reads it — to decide whether an incoming message is one the user can already
 * see, and therefore does not need a sound for. Route params cannot answer this
 * on their own because a Matrix room id is resolved asynchronously from a
 * channel slug / peer id.
 */

let activeRoomId: string | null = null;
const listeners = new Set<() => void>();

export function setActiveConversation(roomId: string | null): void {
  if (activeRoomId === roomId) return;
  activeRoomId = roomId;
  for (const listener of listeners) listener();
}

export function getActiveConversation(): string | null {
  return activeRoomId;
}

export function subscribeActiveConversation(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Registers `roomId` as the on-screen conversation while the calling component
 * is mounted. Safe to call with `undefined` (registers nothing).
 */
export function useRegisterActiveConversation(roomId: string | undefined): void {
  useEffect(() => {
    if (!roomId) return;
    setActiveConversation(roomId);
    return () => {
      // Only clear if we are still the active one — a fast switch may have
      // already pointed this at the next room.
      if (getActiveConversation() === roomId) setActiveConversation(null);
    };
  }, [roomId]);
}

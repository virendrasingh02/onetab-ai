/**
 * Tracks whether the user is currently in an active call or meeting.
 */
let activeCallCount = 0;
const callListeners = new Set<(inCall: boolean) => void>();

export function setActiveCallState(inCall: boolean): void {
  const previous = activeCallCount > 0;
  if (inCall) {
    activeCallCount = Math.max(1, activeCallCount + 1);
  } else {
    activeCallCount = Math.max(0, activeCallCount - 1);
  }
  const current = activeCallCount > 0;
  if (previous !== current) {
    for (const listener of callListeners) {
      listener(current);
    }
  }
}

export function isCallOrMeetingActive(): boolean {
  return activeCallCount > 0;
}

export function subscribeActiveCallState(
  listener: (inCall: boolean) => void,
): () => void {
  callListeners.add(listener);
  return () => callListeners.delete(listener);
}

import { useEffect } from 'react';
import { getDesktopApi, setBadgeCount } from './desktop-api.js';

/**
 * Mirrors an unread count onto the dock/taskbar badge, and bounces the window
 * when the count goes up while the app is in the background.
 *
 * Only one component should own this per app — two callers would fight over
 * the same badge.
 */
export function useDesktopBadge(count: number): void {
  useEffect(() => {
    void setBadgeCount(count);
  }, [count]);

  useEffect(() => {
    const api = getDesktopApi();
    // Flashing on every render would be a strobe; only a non-zero count that
    // arrives while the window is unfocused deserves attention, and the main
    // process drops the call when the window already has focus.
    if (!api || count <= 0) return;
    void api.notifications.flashFrame(true);
    return () => void api.notifications.flashFrame(false);
  }, [count]);
}

import { app, Notification } from 'electron';
import { IPC_EVENT } from '../shared/ipc.js';
import { loadSecureSession, refreshSecureSession } from './auth.js';
import { logger } from './logger.js';
import { setTrayBadge } from './tray.js';
import { getMainWindow, showMainWindow } from './window.js';

/**
 * Keeps the tray badge and native notifications live while the window is
 * minimized to tray or simply not focused.
 *
 * A hidden `BrowserWindow` keeps running its renderer, but Chromium throttles
 * timers on a hidden/occluded window to save power — the same background-tab
 * throttling a browser applies — so the in-app SSE/poll cycle that normally
 * keeps unread counts fresh cannot be relied on to fire promptly. This runs
 * in the main process instead, a plain Node `setInterval` unaffected by that
 * throttling, using the same encrypted session `auth.ts` already persists.
 */

const POLL_INTERVAL_MS = 45_000;
/** Per tick, per workspace — bounds the notification burst after a long absence. */
const MAX_NOTIFICATIONS_PER_WORKSPACE = 3;
/** Caps memory for the seen-id set across a long-running session. */
const MAX_TRACKED_IDS = 500;

interface WorkspaceSummaryLite {
  id: string;
  slug: string;
}

interface NotificationLite {
  id: string;
  title: string;
  body: string | null;
  deepLink: string | null;
}

let apiBaseUrl = 'http://localhost:3000/api/v1';
let pollTimer: ReturnType<typeof setInterval> | null = null;
let polling = false;
const notifiedIds = new Set<string>();

export function setApiUrlForBackgroundSync(url: string): void {
  apiBaseUrl = url.replace(/\/+$/, '');
}

async function authedGet<T>(path: string): Promise<T | null> {
  const session = loadSecureSession();
  if (!session?.accessToken) return null;

  const attempt = async (token: string) =>
    fetch(`${apiBaseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);

  let response = await attempt(session.accessToken);
  if (response?.status === 401) {
    const refreshed = await refreshSecureSession().catch(() => null);
    if (!refreshed?.accessToken) return null;
    response = await attempt(refreshed.accessToken);
  }
  if (!response?.ok) return null;

  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function fireNativeNotification(item: NotificationLite, workspaceSlug: string): void {
  if (!Notification.isSupported()) return;

  const notification = new Notification({
    title: item.title,
    body: item.body ?? '',
    silent: false,
  });
  notification.on('click', () => {
    showMainWindow();
    getMainWindow()?.webContents.send(IPC_EVENT.notificationActivated, {
      id: item.id,
      route: item.deepLink ? `/w/${workspaceSlug}/${item.deepLink}` : `/w/${workspaceSlug}`,
    });
  });
  notification.show();
}

function applyBadge(count: number): void {
  if (process.platform !== 'win32') app.setBadgeCount(count);
  setTrayBadge(count);
}

export async function pollOnce(): Promise<void> {
  if (polling) return;
  polling = true;

  try {
    const session = loadSecureSession();
    if (!session?.accessToken) return;

    const workspaces = await authedGet<WorkspaceSummaryLite[]>('/workspaces');
    if (!workspaces) return;

    const window = getMainWindow();
    // Only worth surfacing a native alert for something the person is not
    // already looking at live in the app.
    const isForeground =
      !!window && !window.isDestroyed() && window.isVisible() && window.isFocused();

    let total = 0;
    for (const workspace of workspaces) {
      const countResult = await authedGet<{ count: number }>(
        `/workspaces/${workspace.id}/notifications/unread-count`,
      );
      total += countResult?.count ?? 0;

      if (isForeground) continue;

      const recent = await authedGet<{ items: NotificationLite[] }>(
        `/workspaces/${workspace.id}/notifications?unreadOnly=true&limit=${MAX_NOTIFICATIONS_PER_WORKSPACE}`,
      );
      for (const item of recent?.items ?? []) {
        if (notifiedIds.has(item.id)) continue;
        notifiedIds.add(item.id);
        fireNativeNotification(item, workspace.slug);
      }
    }

    if (notifiedIds.size > MAX_TRACKED_IDS) {
      const overflow = notifiedIds.size - MAX_TRACKED_IDS;
      const iterator = notifiedIds.values();
      for (let i = 0; i < overflow; i += 1) {
        const next = iterator.next();
        if (next.done) break;
        notifiedIds.delete(next.value);
      }
    }

    applyBadge(total);
  } catch (error) {
    logger.warn('BackgroundSync', 'Poll failed', error);
  } finally {
    polling = false;
  }
}

export function startBackgroundSync(): void {
  if (pollTimer) return;
  void pollOnce();
  pollTimer = setInterval(() => void pollOnce(), POLL_INTERVAL_MS);
}

export function stopBackgroundSync(): void {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = null;
}

/** Called right after sign-in/out so the badge does not wait for the next tick. */
export function triggerBackgroundSyncNow(): void {
  void pollOnce();
}

export function resetBadgeOnSignOut(): void {
  notifiedIds.clear();
  applyBadge(0);
}

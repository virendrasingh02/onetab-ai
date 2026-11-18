import {
  app,
  Notification,
  shell,
  type DownloadItem,
  type Session,
} from 'electron';
import { basename } from 'node:path';
import { logger } from './logger.js';
import { getMainWindow, showMainWindow } from './window.js';

export interface DownloadProgress {
  received: number;
  total: number;
}

/**
 * Combined fraction for the taskbar/dock bar, or a negative value to clear it.
 * A download with no `Content-Length` makes the whole bar indeterminate (2 =
 * Electron's "indeterminate" mode on Windows; macOS/Linux show it as full).
 */
export function aggregateProgress(items: readonly DownloadProgress[]): number {
  if (items.length === 0) return -1;
  if (items.some((item) => item.total <= 0)) return 2;
  const received = items.reduce((sum, item) => sum + item.received, 0);
  const total = items.reduce((sum, item) => sum + item.total, 0);
  return Math.min(1, received / total);
}

/** What the "finished" notification says, per outcome. Null means say nothing. */
export function downloadNotice(
  state: 'completed' | 'cancelled' | 'interrupted',
  fileName: string,
): { title: string; body: string } | null {
  if (state === 'completed') return { title: 'Download complete', body: fileName };
  if (state === 'interrupted') return { title: 'Download failed', body: fileName };
  return null; // the user cancelled it themselves
}

const active = new Map<DownloadItem, DownloadProgress>();

function refreshProgressBar(): void {
  const window = getMainWindow();
  if (!window || window.isDestroyed()) return;
  const progress = aggregateProgress([...active.values()]);
  window.setProgressBar(progress, progress === 2 ? { mode: 'indeterminate' } : undefined);
}

function notify(state: 'completed' | 'cancelled' | 'interrupted', item: DownloadItem): void {
  const savePath = item.getSavePath();
  const notice = downloadNotice(state, basename(savePath || item.getFilename()));
  if (!notice || !Notification.isSupported()) return;
  try {
    const notification = new Notification({ ...notice, silent: true });
    if (state === 'completed' && savePath) {
      notification.on('click', () => shell.showItemInFolder(savePath));
    } else {
      notification.on('click', showMainWindow);
    }
    notification.show();
  } catch (error) {
    logger.debug('Downloads', 'Could not show the download notification', error);
  }
}

/**
 * A browser shows download progress and a "show in folder" afterwards; a bare
 * Electron window shows nothing, so a file saved from chat simply vanished into
 * the Downloads folder. This puts progress on the taskbar/dock icon and a
 * notification at the end (click: reveal the file).
 *
 * The save location is left to Electron's default, which asks with the native
 * save dialog — the same thing the browser build does.
 */
export function applyDownloadHandling(session: Session): void {
  session.on('will-download', (_event, item) => {
    active.set(item, { received: 0, total: item.getTotalBytes() });
    refreshProgressBar();

    item.on('updated', () => {
      active.set(item, {
        received: item.getReceivedBytes(),
        total: item.getTotalBytes(),
      });
      refreshProgressBar();
    });

    item.once('done', (_doneEvent, state) => {
      active.delete(item);
      refreshProgressBar();
      if (state === 'completed' && process.platform === 'darwin') {
        // Bounces the Downloads stack in the Dock, like Safari.
        app.dock?.downloadFinished(item.getSavePath());
      }
      if (state === 'interrupted') {
        logger.warn('Downloads', `Download interrupted: ${item.getFilename()}`);
      }
      notify(state, item);
    });
  });
}

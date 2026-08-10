import { app } from 'electron';
import { IPC_EVENT, type DesktopUpdateStatus } from '../shared/ipc.js';
import { getMainWindow, markQuitting } from './window.js';

/**
 * Auto-update, wired but optional.
 *
 * `electron-updater` is only meaningful once there is a signed release feed, so
 * it is loaded lazily rather than made a hard dependency: an unpackaged dev run
 * (and a CI checkout that never installs it) still boots, and the renderer just
 * sees `not-available` instead of an exception. Install `electron-updater`
 * alongside `electron-builder` and publish a feed to turn this on.
 */
interface AutoUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  on(event: string, listener: (payload?: unknown) => void): void;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

let autoUpdater: AutoUpdaterLike | null = null;
let wired = false;
let lastStatus: DesktopUpdateStatus = { state: 'idle' };

function publish(status: DesktopUpdateStatus): void {
  lastStatus = status;
  getMainWindow()?.webContents.send(IPC_EVENT.updateStatus, status);
}

function loadAutoUpdater(): AutoUpdaterLike | null {
  if (autoUpdater) return autoUpdater;

  try {
    // Resolved at runtime so a workspace without `electron-updater` installed
    // still compiles and boots.
    const mod = require('electron-updater') as { autoUpdater: AutoUpdaterLike };
    autoUpdater = mod.autoUpdater;
  } catch {
    return null;
  }

  if (!wired && autoUpdater) {
    wired = true;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => publish({ state: 'checking' }));
    autoUpdater.on('update-not-available', () => publish({ state: 'not-available' }));
    autoUpdater.on('update-available', (info) =>
      publish({ state: 'available', version: (info as { version?: string })?.version ?? '' }),
    );
    autoUpdater.on('download-progress', (progress) =>
      publish({
        state: 'downloading',
        percent: Math.round((progress as { percent?: number })?.percent ?? 0),
      }),
    );
    autoUpdater.on('update-downloaded', (info) =>
      publish({ state: 'ready', version: (info as { version?: string })?.version ?? '' }),
    );
    autoUpdater.on('error', (error) =>
      publish({ state: 'error', message: (error as Error)?.message ?? 'Update failed.' }),
    );
  }

  return autoUpdater;
}

export function getUpdateStatus(): DesktopUpdateStatus {
  return lastStatus;
}

export async function checkForUpdates(isDev: boolean): Promise<DesktopUpdateStatus> {
  // An unpackaged build has no `app-update.yml`, so a check would only ever
  // throw — report the truthful "nothing to install" instead.
  if (isDev || !app.isPackaged) {
    publish({ state: 'not-available' });
    return lastStatus;
  }

  const updater = loadAutoUpdater();
  if (!updater) {
    publish({ state: 'not-available' });
    return lastStatus;
  }

  try {
    await updater.checkForUpdates();
  } catch (error) {
    publish({ state: 'error', message: (error as Error).message });
  }

  return lastStatus;
}

export function installUpdate(): boolean {
  const updater = loadAutoUpdater();
  if (!updater || lastStatus.state !== 'ready') return false;

  markQuitting();
  updater.quitAndInstall(false, true);
  return true;
}

/** Kicks off a check shortly after launch, then once a day. */
export function scheduleUpdateChecks(isDev: boolean): void {
  if (isDev || !app.isPackaged) return;

  const check = () => void checkForUpdates(isDev);
  // Delayed so the first paint is not competing with a network round trip.
  setTimeout(check, 15_000);
  setInterval(check, 24 * 60 * 60 * 1000);
}

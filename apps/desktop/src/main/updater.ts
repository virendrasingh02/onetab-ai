import { app } from 'electron';
import { IPC_EVENT, type DesktopUpdateStatus } from '../shared/ipc.js';
import { logger } from './logger.js';
import { getMainWindow, markQuitting } from './window.js';

interface AutoUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  on(event: string, listener: (payload?: unknown) => void): void;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

let autoUpdater: AutoUpdaterLike | null = null;
let wired = false;
let lastStatus: DesktopUpdateStatus = { state: 'idle' };

function publish(status: DesktopUpdateStatus): void {
  lastStatus = status;
  logger.info('Updater', `Update status changed: ${status.state}`);
  getMainWindow()?.webContents.send(IPC_EVENT.updateStatus, status);
}

function loadAutoUpdater(): AutoUpdaterLike | null {
  if (autoUpdater) return autoUpdater;

  try {
    const mod = require('electron-updater') as { autoUpdater: AutoUpdaterLike };
    autoUpdater = mod.autoUpdater;
  } catch (err) {
    logger.debug('Updater', 'electron-updater package is not installed or bundled', err);
    return null;
  }

  if (!wired && autoUpdater) {
    wired = true;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => publish({ state: 'checking' }));
    autoUpdater.on('update-not-available', () => publish({ state: 'not-available' }));
    autoUpdater.on('update-available', (info) => {
      const version = (info as { version?: string })?.version ?? 'new version';
      publish({ state: 'available', version });
    });
    autoUpdater.on('download-progress', (progress) =>
      publish({
        state: 'downloading',
        percent: Math.round((progress as { percent?: number })?.percent ?? 0),
      }),
    );
    autoUpdater.on('update-downloaded', (info) => {
      const version = (info as { version?: string })?.version ?? '';
      publish({ state: 'ready', version });
    });
    autoUpdater.on('error', (error) =>
      publish({ state: 'error', message: (error as Error)?.message ?? 'Update failed.' }),
    );
  }

  return autoUpdater;
}

export function getUpdateStatus(): DesktopUpdateStatus {
  return lastStatus;
}

const isMas = Boolean(process.mas || process.env['IS_MAS'] || process.env['APP_STORE']);

export async function checkForUpdates(isDev: boolean): Promise<DesktopUpdateStatus> {
  if (isDev) {
    publish({ state: 'unsupported' });
    return lastStatus;
  }

  if (!app.isPackaged || isMas) {
    publish({ state: 'unsupported' });
    return lastStatus;
  }

  const updater = loadAutoUpdater();
  if (!updater) {
    publish({ state: 'unsupported' });
    return lastStatus;
  }

  try {
    publish({ state: 'checking' });
    await updater.checkForUpdates();
  } catch (error) {
    publish({ state: 'error', message: (error as Error).message });
  }

  return lastStatus;
}

export async function downloadUpdate(): Promise<boolean> {
  const updater = loadAutoUpdater();
  if (!updater) return false;
  try {
    publish({ state: 'downloading', percent: 0 });
    await updater.downloadUpdate();
    return true;
  } catch (error) {
    publish({ state: 'error', message: (error as Error).message });
    return false;
  }
}

export function installUpdate(): boolean {
  if (isMas) return false;
  const updater = loadAutoUpdater();
  if (!updater || lastStatus.state !== 'ready') return false;

  logger.info('Updater', 'Installing update and relaunching');
  markQuitting();
  updater.quitAndInstall(false, true);
  return true;
}

/** Kicks off a check shortly after launch, then once a day. */
export function scheduleUpdateChecks(isDev: boolean): void {
  if (isDev || !app.isPackaged || isMas) return;

  const check = () => void checkForUpdates(isDev);
  setTimeout(check, 15_000);
  setInterval(check, 24 * 60 * 60 * 1000);
}

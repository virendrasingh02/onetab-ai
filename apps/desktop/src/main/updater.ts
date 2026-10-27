import { app, shell } from 'electron';
import { IPC_EVENT, type DesktopUpdateStatus } from '../shared/ipc.js';
import { isMasBuild, isWindowsStoreBuild } from './capabilities.js';
import { logger } from './logger.js';
import { getMainWindow, markQuitting } from './window.js';

interface AutoUpdaterLike {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  setFeedURL(options: { provider: 'generic'; url: string }): void;
  on(event: string, listener: (payload?: unknown) => void): void;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

type AutoUpdaterLoader = () => { autoUpdater: AutoUpdaterLike };

const defaultLoader: AutoUpdaterLoader = () => require('electron-updater');

let loadModule: AutoUpdaterLoader = defaultLoader;
let autoUpdater: AutoUpdaterLike | null = null;
let wired = false;
let configuredApiUrl = 'http://localhost:3000/api/v1';
let feedUrl: string | null = null;
/** True once electron-updater itself has seen a newer release (it must before it can download one). */
let updaterHasUpdate = false;
/** While a download is being driven, the updater's own check/error events must not clobber the status. */
let driving = false;
let lastStatus: DesktopUpdateStatus = { state: 'idle' };

/** The API base (including `/api/v1`) the version check is sent to. */
export function setApiUrlForUpdates(url: string): void {
  configuredApiUrl = url.replace(/\/+$/, '');
}

/**
 * Where `latest.yml` and the installer are published. Without it electron-updater
 * has nothing to read — an app built without `publish` ships no `app-update.yml`
 * — so in-app updating stays off and the download page is used instead.
 */
export function setUpdateFeedUrl(url: string | null): void {
  feedUrl = url ? url.replace(/\/+$/, '') : null;
}

/** Test seam: swaps the `require('electron-updater')` and forgets the previous instance. */
export function setAutoUpdaterLoader(loader: AutoUpdaterLoader | null): void {
  loadModule = loader ?? defaultLoader;
  autoUpdater = null;
  wired = false;
  updaterHasUpdate = false;
}

function publish(status: DesktopUpdateStatus): void {
  lastStatus = status;
  logger.info('Updater', `Update status changed: ${status.state}`);
  getMainWindow()?.webContents.send(IPC_EVENT.updateStatus, status);
}

/** Store-managed builds must not offer a self-updater; the store's own mechanism owns this. */
function isStoreManaged(): boolean {
  return isMasBuild() || isWindowsStoreBuild();
}

function versionOf(info: unknown): string | undefined {
  return (info as { version?: string } | undefined)?.version;
}

/** electron-updater, but only when it can actually do something: installed *and* given a feed. */
function loadAutoUpdater(): AutoUpdaterLike | null {
  if (autoUpdater) return autoUpdater;
  if (!feedUrl) return null;

  let instance: AutoUpdaterLike;
  try {
    instance = loadModule().autoUpdater;
  } catch (err) {
    logger.debug('Updater', 'electron-updater package is not installed or bundled', err);
    return null;
  }

  if (!wired) {
    wired = true;
    instance.setFeedURL({ provider: 'generic', url: feedUrl });
    // Downloading is the person's decision (the dialog's "Update now"), not a
    // side effect of checking.
    instance.autoDownload = false;
    instance.autoInstallOnAppQuit = true;

    instance.on('checking-for-update', () => {
      if (!driving) publish({ state: 'checking' });
    });
    instance.on('update-not-available', () => {
      if (!driving) publish({ state: 'not-available' });
    });
    instance.on('update-available', (info) => {
      updaterHasUpdate = true;
      // The API may already have said this update is mandatory, with notes; the
      // updater only knows the version, and must not downgrade that.
      const prior = lastStatus.state === 'available' ? lastStatus : undefined;
      publish({
        ...prior,
        state: 'available',
        version: versionOf(info) ?? prior?.version ?? 'new version',
        openedInBrowser: false,
      });
    });
    instance.on('download-progress', (progress) =>
      publish({
        state: 'downloading',
        percent: Math.round((progress as { percent?: number })?.percent ?? 0),
      }),
    );
    instance.on('update-downloaded', (info) =>
      publish({ state: 'ready', version: versionOf(info) ?? '' }),
    );
    instance.on('error', (error) => {
      if (driving) return; // `downloadUpdate` handles its own failure and falls back
      publish({ state: 'error', message: (error as Error)?.message ?? 'Update failed.' });
    });
  }

  autoUpdater = instance;
  return autoUpdater;
}

export function getUpdateStatus(): DesktopUpdateStatus {
  return lastStatus;
}

export async function checkForUpdates(
  isDev: boolean,
  apiUrl: string = configuredApiUrl,
): Promise<DesktopUpdateStatus> {
  if (isDev || isStoreManaged()) {
    publish({ state: 'unsupported' });
    return lastStatus;
  }

  const currentVersion =
    typeof app?.getVersion === 'function' ? app.getVersion() : '0.0.1';
  const os =
    process.platform === 'win32'
      ? 'windows'
      : process.platform === 'darwin'
      ? 'macos'
      : 'linux';
  const arch = process.arch;

  // 1. Query centralized version management endpoint
  try {
    const query = new URLSearchParams({
      platform: 'desktop',
      os,
      currentVersion,
      architecture: arch,
      releaseChannel: 'stable',
    });

    const res = await fetch(`${apiUrl.replace(/\/+$/, '')}/app-versions/check-update?${query.toString()}`, {
      headers: { Accept: 'application/json' },
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      if (data && typeof data === 'object') {
        if (data.status === 'update-required' || data.mandatory || data.forceUpdate) {
          publish({
            state: 'available',
            version: data.latestVersion || 'new version',
            mandatory: true,
            forceUpdate: Boolean(data.forceUpdate),
            releaseNotes: data.releaseNotes || 'A required security and feature update is available.',
            downloadUrl: data.downloadUrl,
            changelog: data.changelog,
            minSupportedVersion: data.minimumSupportedVersion,
          });
          return lastStatus;
        }

        if (data.updateAvailable) {
          publish({
            state: 'available',
            version: data.latestVersion || 'new version',
            mandatory: false,
            releaseNotes: data.releaseNotes,
            downloadUrl: data.downloadUrl,
            changelog: data.changelog,
            minSupportedVersion: data.minimumSupportedVersion,
          });
          return lastStatus;
        }

        if (data.status === 'up-to-date') {
          publish({ state: 'not-available' });
          return lastStatus;
        }
      }
    }
  } catch (err) {
    logger.debug('Updater', 'Server version check endpoint unavailable, trying local updater', err);
  }

  // 2. Fallback to electron-updater when the build has a feed to read
  if (!app.isPackaged) {
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

/**
 * Hands the person to the installer's download page. The way an update reaches
 * a build that has no in-app updater — and the way out when the in-app one
 * fails, so "Update now" is never a button that does nothing.
 */
async function openInstallerPage(status: DesktopUpdateStatus): Promise<boolean> {
  const url = status.state === 'available' ? status.downloadUrl : undefined;
  if (status.state !== 'available' || !url || !/^https?:\/\//i.test(url)) {
    publish({
      state: 'error',
      message: 'No installer is published for this version yet. Try again in a little while.',
    });
    return false;
  }

  try {
    await shell.openExternal(url);
  } catch (error) {
    logger.warn('Updater', 'Could not open the installer page', error);
    publish({ state: 'error', message: 'Could not open your browser to download the update.' });
    return false;
  }

  publish({ ...status, openedInBrowser: true });
  return true;
}

export async function downloadUpdate(): Promise<boolean> {
  // A store build is updated by its store; sending it to a direct installer is exactly what its policy forbids.
  if (isStoreManaged()) return false;

  const before = lastStatus;
  const updater = loadAutoUpdater();

  if (updater) {
    driving = true;
    try {
      if (!updaterHasUpdate) await updater.checkForUpdates();
      if (updaterHasUpdate) {
        publish({ state: 'downloading', percent: 0 });
        await updater.downloadUpdate();
        return true;
      }
      logger.info('Updater', 'The update feed has no newer release; using the installer page');
    } catch (error) {
      logger.warn('Updater', 'In-app download failed; using the installer page', error);
    } finally {
      driving = false;
    }
  }

  return openInstallerPage(before);
}

export function installUpdate(): boolean {
  if (isStoreManaged()) return false;
  const updater = loadAutoUpdater();
  if (!updater || lastStatus.state !== 'ready') return false;

  logger.info('Updater', 'Installing update and relaunching');
  markQuitting();
  updater.quitAndInstall(false, true);
  return true;
}

/** Kicks off a check shortly after launch, then once a day. */
export function scheduleUpdateChecks(isDev: boolean): void {
  if (isDev || !app.isPackaged || isStoreManaged()) return;

  const check = () => void checkForUpdates(isDev);
  setTimeout(check, 15_000);
  setInterval(check, 24 * 60 * 60 * 1000);
}

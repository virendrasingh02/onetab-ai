import { app, powerMonitor, shell } from 'electron';
import { IPC_EVENT, type DesktopUpdateStatus } from '../shared/ipc.js';
import { isMasBuild, isWindowsStoreBuild } from './capabilities.js';
import { logger } from './logger.js';
import { getPreference } from './store.js';
import { getMainWindow, markQuitting } from './window.js';

/** Preference: fetch an available update in the background, so it only needs a restart. */
export const AUTO_DOWNLOAD_UPDATES_KEY = 'autoDownloadUpdates';

/** A long-running desktop app should not wait a day to hear about a fix. */
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
/** Waking from sleep / coming back online re-checks, but not more often than this. */
const MIN_CHECK_GAP_MS = 30 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 15_000;

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
/** A scheduled check: failures stay in the log instead of putting a warning in the header. */
let backgroundCheck = false;
/** Whether the update being downloaded / installed was marked mandatory by the API. */
let pendingMandatory = false;
let checkInFlight: Promise<DesktopUpdateStatus> | null = null;
let downloadInFlight: Promise<boolean> | null = null;
let lastCheckAt = 0;
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
  driving = false;
  backgroundCheck = false;
  pendingMandatory = false;
  checkInFlight = null;
  downloadInFlight = null;
  lastCheckAt = 0;
  lastStatus = { state: 'idle' };
}

function publish(status: DesktopUpdateStatus): void {
  lastStatus = status;
  logger.info('Updater', `Update status changed: ${status.state}`);
  const window = getMainWindow();
  if (window && !window.isDestroyed?.())
    window.webContents.send(IPC_EVENT.updateStatus, status);
}

/** Store-managed builds must not offer a self-updater; the store's own mechanism owns this. */
function isStoreManaged(): boolean {
  return isMasBuild() || isWindowsStoreBuild();
}

function versionOf(info: unknown): string | undefined {
  return (info as { version?: string } | undefined)?.version;
}

/** An update is already downloading or downloaded: re-checking can only lose that state. */
function hasUpdateInHand(): boolean {
  return lastStatus.state === 'downloading' || lastStatus.state === 'ready';
}

/** electron-updater, but only when it can actually do something: installed *and* given a feed. */
function loadAutoUpdater(): AutoUpdaterLike | null {
  if (autoUpdater) return autoUpdater;
  if (!feedUrl) return null;

  let instance: AutoUpdaterLike;
  try {
    instance = loadModule().autoUpdater;
  } catch (err) {
    logger.debug(
      'Updater',
      'electron-updater package is not installed or bundled',
      err,
    );
    return null;
  }

  if (!wired) {
    wired = true;
    instance.setFeedURL({ provider: 'generic', url: feedUrl });
    // Downloads are started by this module (background or "Update now"), so a
    // plain check never pulls a 100 MB installer behind the person's back when
    // they turned automatic downloads off.
    instance.autoDownload = false;
    instance.autoInstallOnAppQuit = true;

    instance.on('checking-for-update', () => {
      if (!driving && !backgroundCheck) publish({ state: 'checking' });
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
        ...(pendingMandatory ? { mandatory: true } : {}),
      }),
    );
    instance.on('update-downloaded', (info) =>
      publish({
        state: 'ready',
        version: versionOf(info) ?? '',
        ...(pendingMandatory ? { mandatory: true } : {}),
      }),
    );
    instance.on('error', (error) => {
      // `downloadUpdate` handles its own failure; a background check's failure
      // is not something the person can act on.
      if (driving || backgroundCheck) {
        logger.warn('Updater', 'Background update error', error);
        return;
      }
      publish({
        state: 'error',
        message: (error as Error)?.message ?? 'Update failed.',
      });
    });
  }

  autoUpdater = instance;
  return autoUpdater;
}

export function getUpdateStatus(): DesktopUpdateStatus {
  return lastStatus;
}

/** Body of `GET /app-versions/check-update`; every field is optional on the wire. */
interface CheckUpdateResponse {
  status?: string;
  mandatory?: boolean;
  forceUpdate?: boolean;
  updateAvailable?: boolean;
  latestVersion?: string;
  releaseNotes?: string;
  downloadUrl?: string;
  changelog?: string;
  minimumSupportedVersion?: string;
}

export interface CheckOptions {
  /** A scheduled check: no "Checking…" flicker, and failures are logged rather than shown. */
  background?: boolean;
}

/**
 * Asks the API (then the update feed) whether a newer version exists. When one
 * does and the in-app updater can fetch it, the download starts in the
 * background (unless the person turned that off), so the usual outcome is a
 * quiet "Restart to update" rather than a dialog.
 */
export function checkForUpdates(
  isDev: boolean,
  apiUrl: string = configuredApiUrl,
  options: CheckOptions = {},
): Promise<DesktopUpdateStatus> {
  if (isDev || isStoreManaged()) {
    publish({ state: 'unsupported' });
    return Promise.resolve(lastStatus);
  }
  // Already downloading / downloaded: nothing a re-check could add.
  if (hasUpdateInHand()) return Promise.resolve(lastStatus);
  if (checkInFlight) return checkInFlight;

  checkInFlight = runCheck(apiUrl, Boolean(options.background)).finally(() => {
    checkInFlight = null;
    lastCheckAt = Date.now();
  });
  return checkInFlight;
}

async function runCheck(
  apiUrl: string,
  background: boolean,
): Promise<DesktopUpdateStatus> {
  const before = lastStatus;
  const currentVersion =
    typeof app?.getVersion === 'function' ? app.getVersion() : '0.0.1';
  const os =
    process.platform === 'win32'
      ? 'windows'
      : process.platform === 'darwin'
        ? 'macos'
        : 'linux';

  // 1. Query centralized version management endpoint
  try {
    const query = new URLSearchParams({
      platform: 'desktop',
      os,
      currentVersion,
      architecture: process.arch,
      releaseChannel: 'stable',
    });

    const res = await fetch(
      `${apiUrl.replace(/\/+$/, '')}/app-versions/check-update?${query.toString()}`,
      {
        headers: { Accept: 'application/json' },
      },
    );

    if (res.ok) {
      const data = (await res.json()) as CheckUpdateResponse;
      if (data && typeof data === 'object') {
        const mandatory =
          data.status === 'update-required' ||
          data.mandatory ||
          data.forceUpdate;
        if (mandatory || data.updateAvailable) {
          publish({
            state: 'available',
            version: data.latestVersion || 'new version',
            mandatory: Boolean(mandatory),
            ...(mandatory ? { forceUpdate: Boolean(data.forceUpdate) } : {}),
            releaseNotes:
              data.releaseNotes ||
              (mandatory
                ? 'A required security and feature update is available.'
                : undefined),
            downloadUrl: data.downloadUrl,
            changelog: data.changelog,
            minSupportedVersion: data.minimumSupportedVersion,
          });
          startBackgroundDownload();
          return lastStatus;
        }

        if (data.status === 'up-to-date') {
          publish({ state: 'not-available' });
          return lastStatus;
        }
      }
    }
  } catch (err) {
    logger.debug(
      'Updater',
      'Server version check endpoint unavailable, trying local updater',
      err,
    );
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

  backgroundCheck = background;
  try {
    if (!background) publish({ state: 'checking' });
    await updater.checkForUpdates();
  } catch (error) {
    if (background) {
      logger.warn('Updater', 'Background update check failed', error);
      // Leave whatever the person last saw rather than a warning they can't act on.
      if (lastStatus.state === 'checking') publish(before);
    } else {
      publish({ state: 'error', message: (error as Error).message });
    }
  } finally {
    backgroundCheck = false;
  }

  if (lastStatus.state === 'available') startBackgroundDownload();
  return lastStatus;
}

function autoDownloadEnabled(): boolean {
  return getPreference<boolean>(AUTO_DOWNLOAD_UPDATES_KEY, true) !== false;
}

/** Fetches an available update without asking, when that is possible and allowed. */
function startBackgroundDownload(): void {
  if (!app.isPackaged || !autoDownloadEnabled() || !loadAutoUpdater()) return;
  void downloadUpdate({ background: true });
}

/**
 * Hands the person to the installer's download page. The way an update reaches
 * a build that has no in-app updater — and the way out when the in-app one
 * fails, so "Update now" is never a button that does nothing.
 */
async function openInstallerPage(
  status: DesktopUpdateStatus,
): Promise<boolean> {
  const url = status.state === 'available' ? status.downloadUrl : undefined;
  if (status.state !== 'available' || !url || !/^https?:\/\//i.test(url)) {
    publish({
      state: 'error',
      message:
        'No installer is published for this version yet. Try again in a little while.',
    });
    return false;
  }

  try {
    await shell.openExternal(url);
  } catch (error) {
    logger.warn('Updater', 'Could not open the installer page', error);
    publish({
      state: 'error',
      message: 'Could not open your browser to download the update.',
    });
    return false;
  }

  publish({ ...status, openedInBrowser: true });
  return true;
}

export interface DownloadOptions {
  /**
   * Started by the app, not by "Update now": on failure the update simply stays
   * "available" for the person to retry — no browser window opens on its own.
   */
  background?: boolean;
}

export function downloadUpdate(
  options: DownloadOptions = {},
): Promise<boolean> {
  // A store build is updated by its store; sending it to a direct installer is exactly what its policy forbids.
  if (isStoreManaged()) return Promise.resolve(false);
  if (lastStatus.state === 'ready') return Promise.resolve(true);
  // "Update now" while a background download runs joins it, and still gets the
  // installer-page fallback if that attempt fails.
  if (downloadInFlight) {
    if (options.background) return downloadInFlight;
    return downloadInFlight.then((ok) => ok || downloadUpdate(options));
  }

  downloadInFlight = runDownload(Boolean(options.background)).finally(() => {
    downloadInFlight = null;
  });
  return downloadInFlight;
}

async function runDownload(background: boolean): Promise<boolean> {
  const before = lastStatus;
  const updater = loadAutoUpdater();

  if (updater) {
    driving = true;
    pendingMandatory =
      before.state === 'available' &&
      Boolean(before.mandatory || before.forceUpdate);
    try {
      if (!updaterHasUpdate) await updater.checkForUpdates();
      if (updaterHasUpdate) {
        publish({
          state: 'downloading',
          percent: 0,
          ...(pendingMandatory ? { mandatory: true } : {}),
        });
        await updater.downloadUpdate();
        return true;
      }
      logger.info(
        'Updater',
        'The update feed has no newer release; using the installer page',
      );
    } catch (error) {
      logger.warn('Updater', 'In-app download failed', error);
    } finally {
      driving = false;
    }
  }

  if (background) {
    // Put back what the person saw before (the "Update" button), not a half-done download.
    if (lastStatus !== before) publish(before);
    return false;
  }
  return openInstallerPage(before);
}

export function installUpdate(): boolean {
  if (isStoreManaged()) return false;
  const updater = loadAutoUpdater();
  if (!updater || lastStatus.state !== 'ready') return false;

  logger.info('Updater', 'Installing update and relaunching');
  markQuitting();
  // Windows: run the NSIS installer silently (it reuses the existing install
  // folder) so updating is a restart, not a setup wizard. macOS/Linux ignore it.
  updater.quitAndInstall(process.platform === 'win32', true);
  return true;
}

/** A check when one is due: on wake, on reconnect and on the interval. */
function checkIfDue(isDev: boolean, minGapMs: number): void {
  if (Date.now() - lastCheckAt < minGapMs) return;
  void checkForUpdates(isDev, configuredApiUrl, { background: true });
}

/** Checks shortly after launch, every few hours, and when the machine wakes up. */
export function scheduleUpdateChecks(isDev: boolean): void {
  if (isDev || !app.isPackaged || isStoreManaged()) return;

  setTimeout(() => checkIfDue(isDev, 0), FIRST_CHECK_DELAY_MS);
  // Ticks hourly so a laptop that slept through the 4h mark catches up soon after.
  setInterval(() => checkIfDue(isDev, CHECK_INTERVAL_MS), 60 * 60 * 1000);
  try {
    powerMonitor.on('resume', () => checkIfDue(isDev, MIN_CHECK_GAP_MS));
    powerMonitor.on('unlock-screen', () => checkIfDue(isDev, MIN_CHECK_GAP_MS));
  } catch (error) {
    logger.debug(
      'Updater',
      'powerMonitor unavailable; using the interval only',
      error,
    );
  }
}

import { app, dialog, globalShortcut, nativeTheme, session } from 'electron';
import { appendFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { IPC_EVENT, type DesktopCommand } from './shared/ipc.js';
import { loadSecureSession, setApiUrlForAuth } from './main/auth.js';
import {
  setApiUrlForBackgroundSync,
  startBackgroundSync,
  stopBackgroundSync,
} from './main/background-sync.js';
import {
  deepLinkFromArgv,
  dispatchDeepLink,
  flushPendingDeepLink,
  registerProtocol,
  setApiUrlForDeepLinks,
} from './main/deep-link.js';
import { setSingleInstanceHeld } from './main/diagnostics.js';
import { dispatchFileOpened, fileFromArgv, flushPendingFile } from './main/file-handler.js';
import { dispatchHandoffActivity, flushPendingHandoff } from './main/handoff.js';
import { registerIpcHandlers } from './main/ipc.js';
import { setupWindowsJumpList } from './main/jump-list.js';
import { focusApp } from './main/lifecycle.js';
import { logger } from './main/logger.js';
import { installAppMenu } from './main/menu.js';
import { startStaticServer, type StaticServer } from './main/static-server.js';
import { createTray, destroyTray } from './main/tray.js';
import { scheduleUpdateChecks } from './main/updater.js';
import { shouldStartHidden, syncLoginItemOnLaunch } from './main/startup.js';
import { getPreference } from './main/store.js';
import {
  createMainWindow,
  getMainWindow,
  isHiddenLaunch,
  markQuitting,
  showMainWindow,
} from './main/window.js';

/** Directory of the compiled `dist/main.js`, not of this source file. */
const here = __dirname;
const isDev = !app.isPackaged;

let staticServer: StaticServer | null = null;

/**
 * A second launch must hand its deep link or file to the running app instead of opening
 * a duplicate window. Acquiring the lock has to happen before anything else.
 * The losing process must also *not* go on to register listeners or open a
 * window: `app.quit()` is asynchronous, so everything below is gated on this.
 */
const hasSingleInstanceLock = app.requestSingleInstanceLock({
  pid: process.pid,
  version: app.getVersion(),
});
setSingleInstanceHeld(hasSingleInstanceLock);

if (!hasSingleInstanceLock) {
  logger.info('App', 'Another instance is already running. Handing off and quitting second instance.');
  app.quit();
}

/*
 * Both are needed and neither implies the other. The AppUserModelID is what
 * Windows uses to attribute toast notifications and group taskbar windows; the
 * name is what appears in the About panel, in notification banners, and - since
 * it decides `app.getPath('userData')` - where preferences and window state
 * live.
 */
app.setAppUserModelId('ai.onetab.desktop');
app.setName('Onetab AI');

if (process.platform === 'linux') {
  app.setDesktopName('onetab-ai.desktop');
}

/**
 * GPU acceleration can only be switched off before `ready`, which is why the
 * saved preference is read here and why changing it asks for a restart.
 */
if (hasSingleInstanceLock && !getPreference<boolean>('hardwareAcceleration', true)) {
  app.disableHardwareAcceleration();
}

/**
 * Where the renderer comes from.
 */
async function resolveAppUrl(): Promise<string> {
  const override = process.env['WEB_APP_URL'] || process.env['VITE_WEB_APP_URL'];
  if (override) return override;
  if (isDev) return 'http://localhost:4200';

  // Packaged: `apps/web/dist` is copied next to the compiled main process.
  const candidates = [
    join(here, 'web'),
    join(process.resourcesPath ?? here, 'web'),
    resolve(here, '../../web/dist'),
  ];
  const root = candidates.find((candidate) => existsSync(join(candidate, 'index.html')));

  if (!root) {
    throw new Error(
      `Could not find the web bundle. Looked in:\n${candidates.join('\n')}\nRun \`nx build @org/web\` before packaging.`,
    );
  }

  staticServer = await startStaticServer(root);
  return staticServer.origin;
}

/** `resources/` sits beside the sources in dev and inside the asar in a build. */
function resolveResourcesDir(): string {
  const candidates = [
    join(here, 'resources'),
    resolve(here, '../resources'),
    join(process.resourcesPath ?? here, 'resources'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

/**
 * Renderer permission requests.
 */
function applySessionPolicy(appOrigin: string): void {
  const allowed = new Set(['notifications', 'clipboard-sanitized-write', 'fullscreen']);
  const sameOrigin = (url: string) => {
    try {
      return new URL(url).origin === new URL(appOrigin).origin;
    } catch {
      return false;
    }
  };

  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => {
    callback(sameOrigin(contents.getURL()) && allowed.has(permission));
  });

  session.defaultSession.setPermissionCheckHandler((_contents, permission, origin) =>
    sameOrigin(origin) && allowed.has(permission),
  );
}

function sendCommand(command: DesktopCommand): void {
  showMainWindow();
  getMainWindow()?.webContents.send(IPC_EVENT.command, command);
}

function registerGlobalShortcuts(): void {
  const accelerator = process.platform === 'darwin' ? 'Cmd+Shift+Space' : 'Ctrl+Shift+Space';
  const registered = globalShortcut.register(accelerator, () => sendCommand('open-search'));

  if (!registered) {
    logger.warn('App', `Global shortcut ${accelerator} is unavailable.`);
  }
}

function reportFatal(error: unknown): void {
  const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
  logger.error('App', 'Failed to start desktop app', detail);

  try {
    appendFileSync(
      join(app.getPath('userData'), 'startup-error.log'),
      `${new Date().toISOString()}\n${detail}\n\n`,
    );
  } catch {
    // ignore logging failure
  }

  dialog.showErrorBox('Onetab AI could not start', detail);
}

process.on('uncaughtException', (error) => {
  logger.error('Process', 'Uncaught exception in main process', error);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Process', 'Unhandled rejection in main process', reason);
});

let appInitialized = false;
let windowOpening = false;
let resolvedAppUrl: string | null = null;

/**
 * Everything that must happen exactly once per process. `activate` on macOS can
 * reopen a window long after launch, and re-running this would throw on the
 * second `ipcMain.handle` and stack duplicate listeners and timers.
 */
async function initializeApp(): Promise<string> {
  const appUrl = await resolveAppUrl();
  const apiUrl = process.env['VITE_API_URL'] || 'http://localhost:3000/api/v1';
  setApiUrlForDeepLinks(apiUrl);
  setApiUrlForAuth(apiUrl);
  setApiUrlForBackgroundSync(apiUrl);

  applySessionPolicy(appUrl);
  registerIpcHandlers(isDev, appUrl);
  installAppMenu(isDev);
  configureAboutPanel();

  const savedTheme = getPreference<'system' | 'light' | 'dark'>('theme', 'system');
  nativeTheme.themeSource = savedTheme;
  nativeTheme.on('updated', () => {
    getMainWindow()?.webContents.send(IPC_EVENT.themeChanged, {
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    });
  });

  createTray(join(resolveResourcesDir(), 'tray-icon.png'));
  registerGlobalShortcuts();
  setupWindowsJumpList();
  scheduleUpdateChecks(isDev);
  startBackgroundSync();
  syncLoginItemOnLaunch();

  appInitialized = true;
  return appUrl;
}

function openWindow(appUrl: string, startHidden: boolean): void {
  const window = createMainWindow({ appUrl, preloadPath: join(here, 'preload.js'), startHidden });

  window.webContents.on('did-finish-load', () => {
    if (!isHiddenLaunch()) showMainWindow();
    flushPendingDeepLink();
    flushPendingFile();
    flushPendingHandoff();
    window.webContents.send(IPC_EVENT.onlineStatus, true);

    // If an authenticated session was previously saved in OS safeStorage, deliver it
    const storedSession = loadSecureSession();
    if (storedSession) {
      logger.info('App', 'Delivering restored secure session to renderer');
      window.webContents.send(IPC_EVENT.authSessionChanged, storedSession);
    }
  });

  if (isDev) {
    let attempts = 0;
    window.webContents.on('did-fail-load', (_event, _code, _description, url, isMainFrame) => {
      if (!isMainFrame || url !== appUrl || attempts >= 60) return;
      attempts += 1;
      setTimeout(() => {
        if (!window.isDestroyed()) void window.loadURL(appUrl);
      }, 1000);
    });
  }
}

/** Launch and macOS `activate` both land here; initialization runs only the first time. */
async function bootstrap(): Promise<void> {
  if (windowOpening) return;
  windowOpening = true;
  try {
    if (!appInitialized) {
      logger.info('App', `Starting Onetab AI Desktop (Platform: ${process.platform}, Dev: ${isDev})`);
      resolvedAppUrl = await initializeApp();
    }
    if (!resolvedAppUrl) return;

    // A launch that carries a deep link or file argument is the user asking for the app, so it
    // is never hidden even when started at login.
    const launchLink = deepLinkFromArgv(process.argv);
    const launchFile = fileFromArgv(process.argv);
    openWindow(resolvedAppUrl, !launchLink && !launchFile && shouldStartHidden());

    // Launched by clicking a link (Windows/Linux put it in argv).
    void dispatchDeepLink(launchLink);
    if (launchFile) {
      dispatchFileOpened(launchFile);
    }
  } finally {
    windowOpening = false;
  }
}

/** Native About panel: what the macOS `about` role and Linux show. */
function configureAboutPanel(): void {
  app.setAboutPanelOptions({
    applicationName: 'Onetab AI',
    applicationVersion: app.getVersion(),
    copyright: 'Copyright (c) Onetab AI Inc.',
    website: 'https://onetab.ai',
  });
}

function registerAppListeners(): void {
  app.on('second-instance', (_event, argv) => {
    focusApp();
    void dispatchDeepLink(deepLinkFromArgv(argv));
    const openedFile = fileFromArgv(argv);
    if (openedFile) {
      dispatchFileOpened(openedFile);
    }
  });

  // macOS delivers deep links as an event, before *and* after `whenReady`.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    void dispatchDeepLink(url);
  });

  // macOS delivers file opening as an event (e.g. dropped on dock icon or 'Open With')
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    dispatchFileOpened(filePath);
  });

  // macOS Apple Handoff continuation from nearby devices
  app.on('continue-activity', (event, type, userInfo, details) => {
    event.preventDefault();
    dispatchHandoffActivity({
      activityType: type,
      userInfo: userInfo as Record<string, unknown>,
      webpageURL: details?.webpageURL,
    });
  });

  app.whenReady().then(() => {
    registerProtocol();

    bootstrap().catch((error) => {
      reportFatal(error);
      app.quit();
    });
  });

  app.on('activate', () => {
    if (getMainWindow()) showMainWindow();
    else void bootstrap();
  });

  app.on('before-quit', () => markQuitting());

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    destroyTray();
    stopBackgroundSync();
    void staticServer?.close();
  });

  /*
   * Observability only. None of these handlers calls preventDefault, so the
   * secure default stands: a certificate error still rejects the request, and
   * TLS validation is never relaxed globally.
   */
  app.on('certificate-error', (_event, _contents, url, error) => {
    let origin = url;
    try {
      origin = new URL(url).origin;
    } catch {
      // keep the raw string
    }
    logger.warn('Security', `Rejected certificate for ${origin}: ${error}`);
  });

  app.on('child-process-gone', (_event, details) => {
    logger.error(
      'Process',
      `Child process gone (type: ${details.type}, reason: ${details.reason}, exitCode: ${details.exitCode})`,
    );
  });

  app.on('accessibility-support-changed', (_event, enabled) => {
    logger.info('App', `Accessibility support ${enabled ? 'enabled' : 'disabled'}`);
    getMainWindow()?.webContents.send(IPC_EVENT.accessibilitySupportChanged, enabled);
  });
}

if (hasSingleInstanceLock) registerAppListeners();

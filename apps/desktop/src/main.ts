import { app, globalShortcut, nativeTheme, session } from 'electron';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { IPC_EVENT, type DesktopCommand } from './shared/ipc.js';
import {
  deepLinkFromArgv,
  dispatchDeepLink,
  flushPendingDeepLink,
  registerProtocol,
} from './main/deep-link.js';
import { registerIpcHandlers } from './main/ipc.js';
import { installAppMenu } from './main/menu.js';
import { startStaticServer, type StaticServer } from './main/static-server.js';
import { createTray, destroyTray } from './main/tray.js';
import { scheduleUpdateChecks } from './main/updater.js';
import { createMainWindow, getMainWindow, markQuitting, showMainWindow } from './main/window.js';

/** Directory of the compiled `dist/main.js`, not of this source file. */
const here = __dirname;
const isDev = !app.isPackaged;

let staticServer: StaticServer | null = null;

/**
 * A second launch must hand its deep link to the running app instead of opening
 * a duplicate window. Acquiring the lock has to happen before anything else —
 * `app.quit()` here is the cheapest possible exit for the losing process.
 */
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

/*
 * Both are needed and neither implies the other. The AppUserModelID is what
 * Windows uses to attribute toast notifications and group taskbar windows; the
 * name is what appears in the About panel, in notification banners, and — since
 * it decides `app.getPath('userData')` — where preferences and window state
 * live. Without it an unpackaged run stores them under "Electron".
 */
app.setAppUserModelId('ai.onetab.desktop');
app.setName('OneTab AI');

/**
 * Where the renderer comes from.
 *
 * Dev points at the Vite server so HMR works. Packaged builds serve the bundle
 * from an internal localhost server — see `static-server.ts` for why `file://`
 * is not an option here.
 */
async function resolveAppUrl(): Promise<string> {
  const override = process.env['WEB_APP_URL'];
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
 *
 * Electron grants everything by default, which means any script in the page can
 * silently take the camera. Only the capabilities the product actually uses are
 * allowed, and only from our own origin.
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
  // A single system-wide accelerator: too many and the app starts stealing
  // shortcuts from whatever the user is actually working in.
  const accelerator = process.platform === 'darwin' ? 'Cmd+Shift+Space' : 'Ctrl+Shift+Space';
  const registered = globalShortcut.register(accelerator, () => sendCommand('open-search'));

  if (!registered) {
    // Another app already owns it — not fatal, the in-app Cmd+K still works.
    console.warn(`[desktop] Global shortcut ${accelerator} is unavailable.`);
  }
}

async function bootstrap(): Promise<void> {
  const appUrl = await resolveAppUrl();
  const preloadPath = join(here, 'preload.js');

  applySessionPolicy(appUrl);
  registerIpcHandlers(isDev);
  installAppMenu(isDev);

  const window = createMainWindow({ appUrl, preloadPath });

  window.webContents.on('did-finish-load', () => {
    flushPendingDeepLink();
    window.webContents.send(IPC_EVENT.onlineStatus, true);
  });

  if (isDev) {
    /*
     * `nx serve @org/desktop` usually wins the race against Vite's first
     * compile, so the first load lands on a connection error. Retrying quietly
     * is friendlier than making the developer restart Electron by hand.
     */
    let attempts = 0;
    window.webContents.on('did-fail-load', (_event, _code, _description, url, isMainFrame) => {
      if (!isMainFrame || url !== appUrl || attempts >= 60) return;
      attempts += 1;
      setTimeout(() => {
        if (!window.isDestroyed()) void window.loadURL(appUrl);
      }, 1000);
    });
  }

  createTray(join(resolveResourcesDir(), 'tray-icon.png'));
  registerGlobalShortcuts();
  scheduleUpdateChecks(isDev);

  nativeTheme.on('updated', () => {
    window.webContents.send(IPC_EVENT.themeChanged, {
      shouldUseDarkColors: nativeTheme.shouldUseDarkColors,
    });
  });

  // Launched by clicking a link (Windows/Linux put it in argv).
  dispatchDeepLink(deepLinkFromArgv(process.argv));
}

app.on('second-instance', (_event, argv) => {
  showMainWindow();
  dispatchDeepLink(deepLinkFromArgv(argv));
});

// macOS delivers deep links as an event, before *and* after `whenReady`.
app.on('open-url', (event, url) => {
  event.preventDefault();
  dispatchDeepLink(url);
});

app.whenReady().then(() => {
  registerProtocol();

  bootstrap().catch((error) => {
    console.error('[desktop] Failed to start:', error);
    app.quit();
  });

  // macOS keeps the process alive after the last window closes; clicking the
  // dock icon is how the user asks for it back.
  app.on('activate', () => {
    if (getMainWindow()) showMainWindow();
    else void bootstrap();
  });
});

app.on('before-quit', () => markQuitting());

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  destroyTray();
  void staticServer?.close();
});

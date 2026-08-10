import { BrowserWindow, screen, shell } from 'electron';
import { IPC_EVENT, type DesktopWindowState } from '../shared/ipc.js';
import { getPreference, readStore, writeStore } from './store.js';

/** macOS keeps its own traffic lights; other platforms get our own controls. */
export const USES_CUSTOM_TITLE_BAR = true;
export const TITLE_BAR_INSET = process.platform === 'darwin' ? 78 : 0;

let mainWindow: BrowserWindow | null = null;
let quitting = false;

export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

export function markQuitting(): void {
  quitting = true;
}

export function isQuitting(): boolean {
  return quitting;
}

function readWindowState() {
  const saved = readStore().window ?? { width: 1380, height: 900, isMaximized: false };
  const area = screen.getPrimaryDisplay().workArea;

  // A window restored onto a monitor that has since been unplugged would open
  // off-screen, so bounds are only reused when they still intersect a display.
  const savedX = saved.x;
  const savedY = saved.y;
  const visible =
    savedX !== undefined &&
    savedY !== undefined &&
    screen.getAllDisplays().some((display) => {
      const { x, y, width, height } = display.workArea;
      return (
        savedX < x + width &&
        savedX + saved.width > x &&
        savedY < y + height &&
        savedY + saved.height > y
      );
    });

  return {
    x: visible ? saved.x : undefined,
    y: visible ? saved.y : undefined,
    width: Math.min(saved.width, area.width),
    height: Math.min(saved.height, area.height),
    isMaximized: saved.isMaximized,
  };
}

function persistWindowState(window: BrowserWindow): void {
  if (window.isDestroyed()) return;
  // `getBounds()` on a maximized window returns the maximized size, which would
  // stick permanently — the *normal* bounds are what should be restored.
  const bounds = window.getNormalBounds();
  writeStore({
    window: {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: window.isMaximized(),
    },
  });
}

export function windowState(): DesktopWindowState {
  const window = mainWindow;
  return {
    isMaximized: window?.isMaximized() ?? false,
    isMinimized: window?.isMinimized() ?? false,
    isFullScreen: window?.isFullScreen() ?? false,
    isFocused: window?.isFocused() ?? false,
  };
}

function broadcastWindowState(): void {
  mainWindow?.webContents.send(IPC_EVENT.windowStateChanged, windowState());
}

/**
 * Blocks the two ways a renderer can navigate itself somewhere untrusted:
 * `window.open` and in-page navigation. Both are redirected to the system
 * browser unless they stay inside the app's own origin.
 */
function applyNavigationPolicy(window: BrowserWindow, appOrigin: string): void {
  const isInternal = (url: string) => {
    try {
      return new URL(url).origin === new URL(appOrigin).origin;
    } catch {
      return false;
    }
  };

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });

  window.webContents.on('will-navigate', (event, url) => {
    if (isInternal(url)) return;
    event.preventDefault();
    if (/^https?:/.test(url)) void shell.openExternal(url);
  });

  // Nothing in this app needs a WebView; allowing one is a sandbox escape.
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
}

export interface CreateWindowOptions {
  /** URL the renderer loads — Vite in dev, the internal static server in prod. */
  appUrl: string;
  preloadPath: string;
}

export function createMainWindow({ appUrl, preloadPath }: CreateWindowOptions): BrowserWindow {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  const saved = readWindowState();

  const window = new BrowserWindow({
    x: saved.x,
    y: saved.y,
    width: saved.width,
    height: saved.height,
    minWidth: 940,
    minHeight: 600,
    title: 'OneTab AI',
    // Painting the window only once the renderer has content avoids the white
    // flash that `show: true` produces before first paint.
    show: false,
    backgroundColor: '#0b0b0f',
    autoHideMenuBar: process.platform !== 'darwin',
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin'
      ? { trafficLightPosition: { x: 16, y: 14 } }
      : {}),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      // The renderer only ever loads our own origin, and same-origin policy is
      // what keeps the API calls honest — never relax this.
      webSecurity: true,
      spellcheck: true,
    },
  });

  mainWindow = window;

  if (saved.isMaximized) window.maximize();

  void window.loadURL(appUrl);
  applyNavigationPolicy(window, appUrl);

  window.once('ready-to-show', () => {
    window.show();
    if (saved.isMaximized) window.maximize();
  });

  // Registered one by one rather than in a loop: `BrowserWindow.on` is a set of
  // per-event overloads, so a union of event names does not typecheck.
  window.on('maximize', broadcastWindowState);
  window.on('unmaximize', broadcastWindowState);
  window.on('enter-full-screen', broadcastWindowState);
  window.on('leave-full-screen', broadcastWindowState);
  window.on('minimize', broadcastWindowState);
  window.on('restore', broadcastWindowState);
  window.on('focus', broadcastWindowState);
  window.on('blur', broadcastWindowState);

  let persistTimer: NodeJS.Timeout | null = null;
  const schedulePersist = () => {
    if (persistTimer) clearTimeout(persistTimer);
    // Resize fires continuously while dragging; debounce so the disk is not hit
    // on every frame.
    persistTimer = setTimeout(() => persistWindowState(window), 400);
  };
  window.on('resize', schedulePersist);
  window.on('move', schedulePersist);

  window.on('close', (event) => {
    persistWindowState(window);

    // Closing the last window is a "hide" on macOS by convention, and opt-in
    // elsewhere, so background notifications keep arriving.
    const minimizeToTray = getPreference('minimizeToTray', process.platform === 'darwin');
    if (!quitting && minimizeToTray) {
      event.preventDefault();
      window.hide();
    }
  });

  window.on('closed', () => {
    if (persistTimer) clearTimeout(persistTimer);
    mainWindow = null;
  });

  return window;
}

export function showMainWindow(): void {
  const window = mainWindow;
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

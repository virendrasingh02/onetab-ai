import { app, BrowserWindow, clipboard, Menu, nativeTheme, screen, shell } from 'electron';
import { IPC_EVENT, type DesktopWindowState } from '../shared/ipc.js';
import { buildContextMenuTemplate } from './context-menu.js';
import { logger } from './logger.js';
import { getPreference, readStore, setPreference, writeStore } from './store.js';
import { showTrayHint } from './tray-hint.js';
import {
  defaultMinimizeToTray,
  MINIMIZE_TO_TRAY_KEY,
  resolveCloseAction,
  TRAY_HINT_SHOWN_KEY,
} from './tray-policy.js';

/** macOS keeps its own traffic lights; other platforms get our own controls. */
export const USES_CUSTOM_TITLE_BAR = true;
export const TITLE_BAR_INSET = process.platform === 'darwin' ? 78 : 0;

/** The window paints this before the page does, so it must match the theme or dark users get a white flash. */
export const WINDOW_BACKGROUND = { light: '#fbfbfc', dark: '#0c0d0e' } as const;

export function windowBackground(): string {
  return nativeTheme.shouldUseDarkColors ? WINDOW_BACKGROUND.dark : WINDOW_BACKGROUND.light;
}

let mainWindow: BrowserWindow | null = null;
let quitting = false;
let hiddenLaunch = false;

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

/** Native context menu: spelling fixes, links, images, text editing. */
function applyContextMenu(window: BrowserWindow): void {
  window.webContents.on('context-menu', (_event, params) => {
    const { webContents } = window;
    const template = buildContextMenuTemplate(
      params,
      {
        openExternal: (url) => void shell.openExternal(url),
        copyText: (text) => clipboard.writeText(text),
        replaceMisspelling: (suggestion) => webContents.replaceMisspelling(suggestion),
        addToDictionary: (word) => webContents.session.addWordToSpellCheckerDictionary(word),
        copyImage: (x, y) => webContents.copyImageAt(x, y),
        inspect: (x, y) => webContents.inspectElement(x, y),
      },
      app.isPackaged,
    );

    if (template.length > 0) {
      Menu.buildFromTemplate(template).popup({ window });
    }
  });
}

export interface CreateWindowOptions {
  /** URL the renderer loads — Vite in dev, the internal static server in prod. */
  appUrl: string;
  preloadPath: string;
  /** Launched by the OS at login: stay in the tray until the user asks for the window. */
  startHidden?: boolean;
}

export function createMainWindow({
  appUrl,
  preloadPath,
  startHidden = false,
}: CreateWindowOptions): BrowserWindow {
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
    title: 'Onetab AI',
    show: false,
    backgroundColor: windowBackground(),
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
      webSecurity: true,
      spellcheck: true,
    },
  });

  mainWindow = window;
  hiddenLaunch = startHidden;

  if (saved.isMaximized) window.maximize();

  void window.loadURL(appUrl);
  applyNavigationPolicy(window, appUrl);
  applyContextMenu(window);

  window.webContents.on('render-process-gone', (_event, details) => {
    logger.error('Window', `Renderer process gone (reason: ${details.reason}, exitCode: ${details.exitCode})`);
    if (details.reason !== 'clean-exit' && !quitting) {
      logger.info('Window', 'Attempting to reload main window after crash');
      setTimeout(() => {
        if (!window.isDestroyed()) {
          void window.loadURL(appUrl);
        }
      }, 1000);
    }
  });

  window.once('ready-to-show', () => {
    if (hiddenLaunch) return;
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

    // Closing the last window is a "hide" on Windows and macOS (the user can opt
    // out), so background notifications keep arriving.
    const action = resolveCloseAction({
      quitting,
      minimizeToTray: getPreference(MINIMIZE_TO_TRAY_KEY, defaultMinimizeToTray(process.platform)),
      hintShown: getPreference(TRAY_HINT_SHOWN_KEY, false),
      platform: process.platform,
    });
    if (action === 'quit') return;

    event.preventDefault();
    window.hide();
    if (action === 'hide-with-hint') {
      setPreference(TRAY_HINT_SHOWN_KEY, true);
      showTrayHint(showMainWindow);
    }
  });

  // Windows ends the session (shutdown, restart, log off) by closing windows;
  // a close that is always cancelled into the tray makes the OS wait on us.
  window.on('session-end', markQuitting);

  window.on('closed', () => {
    if (persistTimer) clearTimeout(persistTimer);
    mainWindow = null;
  });

  return window;
}

/** True until the user first asks for a window that was launched hidden. */
export function isHiddenLaunch(): boolean {
  return hiddenLaunch;
}

/**
 * Centres the window on the display under the cursor — which, for a Jump List
 * click, is the display whose taskbar the user just used.
 */
export function moveMainWindowToCurrentDisplay(): void {
  const window = mainWindow;
  if (!window || window.isDestroyed()) return;

  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const wasMaximized = window.isMaximized();
  if (window.isFullScreen()) window.setFullScreen(false);
  if (wasMaximized) window.unmaximize();
  if (window.isMinimized()) window.restore();

  const [currentWidth, currentHeight] = window.getSize();
  const width = Math.min(currentWidth, workArea.width);
  const height = Math.min(currentHeight, workArea.height);
  window.setBounds({
    x: Math.round(workArea.x + (workArea.width - width) / 2),
    y: Math.round(workArea.y + (workArea.height - height) / 2),
    width,
    height,
  });
  if (wasMaximized) window.maximize();
  showMainWindow();
}

export function showMainWindow(): void {
  const window = mainWindow;
  if (!window || window.isDestroyed()) return;
  hiddenLaunch = false;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

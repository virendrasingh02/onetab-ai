import { app, Menu, nativeImage, Tray } from 'electron';
import { existsSync } from 'node:fs';
import { IPC_EVENT, type DesktopCommand } from '../shared/ipc.js';
import { getStartupState, setStartupState } from './startup.js';
import { getPreference, setPreference } from './store.js';
import { defaultMinimizeToTray, MINIMIZE_TO_TRAY_KEY } from './tray-policy.js';
import { getMainWindow, markQuitting, showMainWindow } from './window.js';

let tray: Tray | null = null;

/**
 * A 1×1 transparent PNG.
 *
 * `new Tray()` throws on an empty image, and shipping the real icon is a
 * packaging concern — this keeps the tray working from a plain `nx serve`
 * where `resources/` may not have been copied yet.
 */
const FALLBACK_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

function loadTrayIcon(iconPath: string) {
  const image = existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath)
    : nativeImage.createFromDataURL(FALLBACK_ICON);

  if (image.isEmpty()) return nativeImage.createFromDataURL(FALLBACK_ICON);

  // Tray icons are measured in points, not pixels; a full-size app icon renders
  // as a blurry oversized blob on Windows and Linux without this.
  const resized = image.resize({ width: 16, height: 16 });
  if (process.platform === 'darwin') resized.setTemplateImage(true);
  return resized;
}

function sendCommand(command: DesktopCommand): void {
  showMainWindow();
  getMainWindow()?.webContents.send(IPC_EVENT.command, command);
}

export function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    { label: 'Open Onetab AI', click: () => showMainWindow() },
    { type: 'separator' },
    { label: 'Search…', click: () => sendCommand('open-search') },
    { label: 'Ask AI Assistant', click: () => sendCommand('open-ai-assistant') },
    { label: 'New channel', click: () => sendCommand('new-channel') },
    { label: 'Invite members…', click: () => sendCommand('open-invite') },
    { label: 'Settings…', click: () => sendCommand('open-settings') },
    { type: 'separator' },
    {
      label: 'Keep running in the background',
      type: 'checkbox',
      checked: getPreference(MINIMIZE_TO_TRAY_KEY, defaultMinimizeToTray(process.platform)),
      click: (item) => {
        setPreference(MINIMIZE_TO_TRAY_KEY, item.checked);
        refreshTrayMenu();
      },
    },
    {
      label: 'Launch at login',
      type: 'checkbox',
      checked: getStartupState().openAtLogin,
      enabled: getStartupState().supported,
      click: (item) => {
        setStartupState({ openAtLogin: item.checked });
        refreshTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Onetab AI',
      click: () => {
        markQuitting();
        app.quit();
      },
    },
  ]);
}

export function refreshTrayMenu(): void {
  tray?.setContextMenu(buildTrayMenu());
  if (process.platform === 'darwin') app.dock?.setMenu(buildTrayMenu());
}

export function createTray(iconPath: string): void {
  if (tray) return;

  tray = new Tray(loadTrayIcon(iconPath));
  tray.setToolTip('Onetab AI');
  tray.setContextMenu(buildTrayMenu());
  // Linux tray implementations mostly ignore clicks and only open the menu,
  // so this is a Windows/macOS affordance.
  tray.on('click', () => showMainWindow());
  tray.on('double-click', () => showMainWindow());

  // The dock menu mirrors the tray menu so macOS users get the same shortcuts.
  if (process.platform === 'darwin') app.dock?.setMenu(buildTrayMenu());
}

export function setTrayBadge(count: number): void {
  tray?.setToolTip(count > 0 ? `Onetab AI — ${count} unread` : 'Onetab AI');
}

let currentBadgeCount = 0;
let currentBadgeMention = false;
let windowListenersAttached = false;
const badgeCache = new Map<BadgeTone, Electron.NativeImage>();

/** `activity` = something unread; `mention` = someone is waiting on you. */
export type BadgeTone = 'activity' | 'mention';

// BGR(A) fills — calm accent blue for ambient unread, alert red for mentions.
const BADGE_FILL: Record<BadgeTone, [b: number, g: number, r: number]> = {
  activity: [246, 130, 59], // #3B82F6
  mention: [68, 68, 239], // #EF4444
};

/**
 * Builds the Windows taskbar overlay: a single dot, never a number — the count
 * lives in the app (and the overlay's accessible label). Blue means unread
 * activity, red means a mention. Drawn at 2x for crisp edges on high-DPI
 * taskbars, with a thin white ring so it separates from any app icon.
 */
export function buildOverlayBadge(tone: BadgeTone): Electron.NativeImage {
  const cached = badgeCache.get(tone);
  if (cached) return cached;

  const scale = 2;
  const size = 16 * scale;
  const buffer = Buffer.alloc(size * size * 4);
  const centre = (size - 1) / 2;
  const outer = 5.5 * scale; // ring edge — an ~11pt dot inside the 16pt overlay
  const inner = 4.25 * scale; // fill edge
  const [fillB, fillG, fillR] = BADGE_FILL[tone];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - centre, y - centre);
      if (distance > outer + 0.5) continue;

      const offset = (y * size + x) * 4;
      // 1px anti-aliased outer edge.
      const alpha = Math.round(Math.min(1, outer + 0.5 - distance) * 255);
      // Blend fill → ring across a 1px band so the inner edge is smooth too.
      const fill = Math.min(1, Math.max(0, inner + 0.5 - distance));
      const channel = (value: number) =>
        Math.round(((value * fill + 255 * (1 - fill)) * alpha) / 255);

      // Premultiplied BGRA.
      buffer[offset] = channel(fillB);
      buffer[offset + 1] = channel(fillG);
      buffer[offset + 2] = channel(fillR);
      buffer[offset + 3] = alpha;
    }
  }

  const image = nativeImage.createFromBitmap(buffer, {
    width: size,
    height: size,
    scaleFactor: scale,
  });
  badgeCache.set(tone, image);
  return image;
}

function attachWindowOverlayListeners(): void {
  if (windowListenersAttached) return;
  const window = getMainWindow();
  if (!window || window.isDestroyed()) return;
  window.on('restore', () => refreshBadgeOverlay());
  window.on('show', () => refreshBadgeOverlay());
  windowListenersAttached = true;
}

export function getBadgeCount(): number {
  return currentBadgeCount;
}

export function refreshBadgeOverlay(): void {
  if (process.platform === 'win32') {
    setWindowsOverlay(currentBadgeCount, currentBadgeMention);
  }
}

function setWindowsOverlay(count: number, mention: boolean): void {
  const window = getMainWindow();
  if (!window || window.isDestroyed()) return;
  attachWindowOverlayListeners();

  if (count > 0) {
    const label = mention
      ? `You were mentioned — ${count} unread notification${count === 1 ? '' : 's'}`
      : `${count} unread notification${count === 1 ? '' : 's'}`;
    window.setOverlayIcon(buildOverlayBadge(mention ? 'mention' : 'activity'), label);
  } else {
    window.setOverlayIcon(null, '');
  }
}

/**
 * The one place a badge reaches the OS (dock/launcher badge, taskbar overlay,
 * tray tooltip). `mention` is omitted by callers that cannot tell (the
 * background poller) — the last value the renderer reported is kept while
 * anything is still unread, so a red dot does not flicker back to blue.
 */
export function applyBadgeCount(count: number, mention?: boolean): void {
  currentBadgeCount = count;
  currentBadgeMention = count > 0 && (mention ?? currentBadgeMention);
  if (process.platform === 'win32') {
    setWindowsOverlay(count, currentBadgeMention);
  } else if (process.platform === 'darwin') {
    // A dot, not a number — the dock badge is always red, so it only says
    // "something is waiting".
    if (app.dock?.setBadge) {
      app.dock.setBadge(count > 0 ? '•' : '');
    } else {
      app.setBadgeCount(count);
    }
  } else if (process.platform === 'linux') {
    try {
      app.setBadgeCount(count);
    } catch {
      // Gracefully handle unsupported Linux desktop environments
    }
  }
  setTrayBadge(count);
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

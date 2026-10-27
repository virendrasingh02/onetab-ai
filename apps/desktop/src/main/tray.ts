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
let windowListenersAttached = false;
const badgeCache = new Map<number, Electron.NativeImage>();

// 3x5 bitmap font for digits 1-9 centered on 16x16 overlay
const DIGIT_GLYPHS: Record<number, number[]> = {
  1: [0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1],
  2: [1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 0, 0, 1, 1, 1],
  3: [1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1],
  4: [1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 1],
  5: [1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1],
  6: [1, 1, 1, 1, 0, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1],
  7: [1, 1, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  8: [1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1],
  9: [1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1, 1, 1, 1],
};

/**
 * Builds a Slack-style blue notification indicator badge for Windows taskbar.
 *
 * For counts 1-9: renders a Slack-blue circle with a white border and crisp white count.
 * For counts > 9: renders a Slack-blue notification dot with a crisp white border ring.
 * Uses BGRA bitmap format with anti-aliased edges for crisp contrast on light and dark taskbars.
 */
export function buildOverlayBadge(count: number): Electron.NativeImage {
  const cacheKey = count > 0 && count <= 9 ? count : 10;
  const cached = badgeCache.get(cacheKey);
  if (cached) return cached;

  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  const centre = (size - 1) / 2;

  // Slack notification blue (#007AFF -> B: 255, G: 122, R: 0)
  const BLUE_B = 255;
  const BLUE_G = 122;
  const BLUE_R = 0;

  const glyph = count > 0 && count <= 9 ? DIGIT_GLYPHS[count] : null;
  const glyphStartX = 6;
  const glyphStartY = 5;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - centre, y - centre);
      if (distance > 7.3) continue;

      const offset = (y * size + x) * 4;
      const alpha = distance > 6.3 ? Math.round((7.3 - distance) * 255) : 255;

      const isWhiteRing = distance >= 5.5 && distance <= 7.0;

      // Check if this pixel falls inside the digit glyph
      const gx = x - glyphStartX;
      const gy = y - glyphStartY;
      const isDigitPixel =
        glyph &&
        gx >= 0 &&
        gx < 3 &&
        gy >= 0 &&
        gy < 5 &&
        glyph[gy * 3 + gx] === 1;

      if (isDigitPixel || isWhiteRing) {
        // Crisp white ring or digit (#FFFFFF)
        buffer[offset] = Math.round((255 * alpha) / 255); // B
        buffer[offset + 1] = Math.round((255 * alpha) / 255); // G
        buffer[offset + 2] = Math.round((255 * alpha) / 255); // R
      } else {
        // Vibrant Slack Blue (#007AFF)
        buffer[offset] = Math.round((BLUE_B * alpha) / 255); // B
        buffer[offset + 1] = Math.round((BLUE_G * alpha) / 255); // G
        buffer[offset + 2] = Math.round((BLUE_R * alpha) / 255); // R
      }
      buffer[offset + 3] = alpha;
    }
  }

  const image = nativeImage.createFromBitmap(buffer, { width: size, height: size });
  badgeCache.set(cacheKey, image);
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
    setWindowsOverlay(currentBadgeCount);
  }
}

function setWindowsOverlay(count: number): void {
  const window = getMainWindow();
  if (!window || window.isDestroyed()) return;
  attachWindowOverlayListeners();

  if (count > 0) {
    const label = `${count} unread notification${count === 1 ? '' : 's'}`;
    window.setOverlayIcon(buildOverlayBadge(count), label);
  } else {
    window.setOverlayIcon(null, '');
  }
}

/** The one place a badge count reaches the OS (dock/launcher badge, taskbar overlay, tray tooltip). */
export function applyBadgeCount(count: number): void {
  currentBadgeCount = count;
  if (process.platform === 'win32') {
    setWindowsOverlay(count);
  } else if (process.platform === 'darwin') {
    if (app.dock?.setBadge) {
      app.dock.setBadge(count > 0 ? (count > 99 ? '99+' : String(count)) : '');
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

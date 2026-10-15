import { app, Menu, nativeImage, Tray } from 'electron';
import { existsSync } from 'node:fs';
import { IPC_EVENT, type DesktopCommand } from '../shared/ipc.js';
import { getStartupState, setStartupState } from './startup.js';
import { getPreference, setPreference } from './store.js';
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
      checked: getPreference('minimizeToTray', process.platform === 'darwin'),
      click: (item) => {
        setPreference('minimizeToTray', item.checked);
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

let overlayIcon: Electron.NativeImage | null = null;

/**
 * Windows has no numeric badge API, only a small overlay on the taskbar icon.
 * A plain red dot is drawn from raw pixels (BGRA, premultiplied is not needed
 * for fully opaque pixels) so no icon asset has to ship; the exact count goes
 * in the accessible description.
 */
function buildOverlayDot(): Electron.NativeImage {
  if (overlayIcon) return overlayIcon;
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  const centre = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const distance = Math.hypot(x - centre, y - centre);
      if (distance > 7.2) continue;
      const offset = (y * size + x) * 4;
      // Anti-alias the rim; the interior is solid so premultiplication is moot.
      const alpha = distance > 6.2 ? Math.round((7.2 - distance) * 255) : 255;
      buffer[offset] = Math.round((0x3b * alpha) / 255); // B
      buffer[offset + 1] = Math.round((0x3b * alpha) / 255); // G
      buffer[offset + 2] = Math.round((0xe5 * alpha) / 255); // R
      buffer[offset + 3] = alpha;
    }
  }
  overlayIcon = nativeImage.createFromBitmap(buffer, { width: size, height: size });
  return overlayIcon;
}

function setWindowsOverlay(count: number): void {
  const window = getMainWindow();
  if (!window || window.isDestroyed()) return;
  if (count > 0) {
    window.setOverlayIcon(buildOverlayDot(), `${count} unread`);
  } else {
    window.setOverlayIcon(null, '');
  }
}

/** The one place a badge count reaches the OS (dock/launcher badge, taskbar overlay, tray tooltip). */
export function applyBadgeCount(count: number): void {
  if (process.platform === 'win32') setWindowsOverlay(count);
  else app.setBadgeCount(count);
  setTrayBadge(count);
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

import { app, Menu, nativeImage, Tray } from 'electron';
import { existsSync } from 'node:fs';
import { IPC_EVENT, type DesktopCommand } from '../shared/ipc.js';
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
    { label: 'Open OneTab AI', click: () => showMainWindow() },
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
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => {
        app.setLoginItemSettings({ openAtLogin: item.checked, openAsHidden: true });
        setPreference('launchAtLogin', item.checked);
        refreshTrayMenu();
      },
    },
    { type: 'separator' },
    {
      label: 'Quit OneTab AI',
      click: () => {
        markQuitting();
        app.quit();
      },
    },
  ]);
}

export function refreshTrayMenu(): void {
  tray?.setContextMenu(buildTrayMenu());
}

export function createTray(iconPath: string): void {
  if (tray) return;

  tray = new Tray(loadTrayIcon(iconPath));
  tray.setToolTip('OneTab AI');
  tray.setContextMenu(buildTrayMenu());
  // Linux tray implementations mostly ignore clicks and only open the menu,
  // so this is a Windows/macOS affordance.
  tray.on('click', () => showMainWindow());
  tray.on('double-click', () => showMainWindow());
}

export function setTrayBadge(count: number): void {
  tray?.setToolTip(count > 0 ? `OneTab AI — ${count} unread` : 'OneTab AI');
}

export function destroyTray(): void {
  tray?.destroy();
  tray = null;
}

import {
  app,
  clipboard,
  dialog,
  ipcMain,
  nativeTheme,
  Notification,
  shell,
  type IpcMainInvokeEvent,
} from 'electron';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import {
  IPC,
  IPC_EVENT,
  MAX_INLINE_FILE_BYTES,
  type DesktopAppInfo,
  type DesktopAppMetadata,
  type DesktopCapabilities,
  type DesktopDownloadRequest,
  type DesktopHandoffRequest,
  type DesktopNotificationRequest,
  type DesktopOpenFilesRequest,
  type DesktopPickedFile,
  type DesktopPlatform,
  type DesktopSaveFileRequest,
  type DesktopSaveResult,
} from '../shared/ipc.js';
import {
  clearSecureSession,
  loadSecureSession,
  refreshSecureSession,
  startBrowserLogin,
} from './auth.js';
import { detectDesktopCapabilities, detectDistribution, isMasBuild } from './capabilities.js';
import { logger } from './logger.js';
import { checkForUpdates, downloadUpdate, installUpdate } from './updater.js';
import { getPreference, setPreference } from './store.js';
import { refreshTrayMenu, setTrayBadge } from './tray.js';
import {
  getMainWindow,
  markQuitting,
  showMainWindow,
  TITLE_BAR_INSET,
  USES_CUSTOM_TITLE_BAR,
  windowState,
} from './window.js';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.zip': 'application/zip',
};

function guessMimeType(path: string): string {
  return MIME_BY_EXTENSION[extname(path).toLowerCase()] ?? 'application/octet-stream';
}

function fromMainWindow(event: IpcMainInvokeEvent): boolean {
  const window = getMainWindow();
  return !!window && event.sender.id === window.webContents.id;
}

function guard<TArgs extends unknown[], TResult>(
  handler: (event: IpcMainInvokeEvent, ...args: TArgs) => TResult,
) {
  return (event: IpcMainInvokeEvent, ...args: TArgs): TResult => {
    if (!fromMainWindow(event)) {
      logger.warn('IPC', 'Rejected an IPC call from an unexpected frame');
      throw new Error('Rejected an IPC call from an unexpected frame.');
    }
    return handler(event, ...args);
  };
}

async function readPickedFile(path: string): Promise<DesktopPickedFile> {
  const info = await stat(path);
  const oversized = info.size > MAX_INLINE_FILE_BYTES;

  return {
    path,
    name: basename(path),
    size: info.size,
    mimeType: guessMimeType(path),
    data: oversized || info.isDirectory() ? undefined : (await readFile(path)).toString('base64'),
    truncated: oversized,
  };
}

export function registerIpcHandlers(isDev: boolean, webAppUrl: string): void {
  ipcMain.handle(
    IPC.appInfo,
    guard((): DesktopAppInfo => ({
      version: app.getVersion(),
      electronVersion: process.versions.electron ?? '',
      chromeVersion: process.versions.chrome ?? '',
      platform: process.platform as DesktopPlatform,
      arch: process.arch,
      isPackaged: app.isPackaged,
      isMas: isMasBuild(),
      distribution: detectDistribution(),
      usesCustomTitleBar: USES_CUSTOM_TITLE_BAR,
      titleBarInset: TITLE_BAR_INSET,
      locale: app.getLocale(),
    })),
  );

  ipcMain.handle(
    IPC.getAppMetadata,
    guard((): DesktopAppMetadata => ({
      name: 'onetab-ai',
      productName: 'OneTab AI',
      version: app.getVersion() || '0.0.1',
      build: process.env['BUILD_ID'] || '2026.08.1-prod',
      publisher: 'OneTab AI Inc.',
      copyright: 'Copyright © OneTab AI Inc. All rights reserved.',
      website: 'https://onetab.ai',
      supportUrl: 'https://onetab.ai/support',
      privacyUrl: 'https://onetab.ai/privacy',
      termsUrl: 'https://onetab.ai/terms',
      license: 'MIT / Proprietary Enterprise',
      description: 'OneTab AI — Unified Collaborative Workspace & AI Agents Platform',
    })),
  );

  ipcMain.handle(
    IPC.getCapabilities,
    guard((): DesktopCapabilities => detectDesktopCapabilities()),
  );

  /* --- authentication --------------------------------------------------- */

  ipcMain.handle(
    IPC.authStartBrowserLogin,
    guard(async () => {
      return startBrowserLogin(webAppUrl);
    }),
  );

  ipcMain.handle(
    IPC.authGetSession,
    guard(() => {
      return loadSecureSession();
    }),
  );

  ipcMain.handle(
    IPC.authClearSession,
    guard(() => {
      clearSecureSession();
    }),
  );

  // Not wrapped in a try/catch: `refreshSecureSession` throws only on a
  // definitive rejection (expired/revoked refresh token), and that throw is
  // meant to propagate — `ipcRenderer.invoke` turns it into a rejected
  // promise, which is the renderer's signal to sign out rather than retry.
  ipcMain.handle(IPC.authRefreshSession, guard(() => refreshSecureSession()));

  /* --- window controls -------------------------------------------------- */

  ipcMain.handle(IPC.windowState, guard(() => windowState()));

  ipcMain.handle(
    IPC.windowMinimize,
    guard(() => {
      getMainWindow()?.minimize();
    }),
  );

  ipcMain.handle(
    IPC.windowToggleMaximize,
    guard(() => {
      const window = getMainWindow();
      if (!window) return;
      if (window.isMaximized()) window.unmaximize();
      else window.maximize();
    }),
  );

  ipcMain.handle(
    IPC.windowClose,
    guard(() => {
      getMainWindow()?.close();
    }),
  );

  ipcMain.handle(
    IPC.windowSetFullScreen,
    guard((_event, value: boolean) => {
      getMainWindow()?.setFullScreen(value);
    }),
  );

  /* --- notifications & badges ------------------------------------------- */

  ipcMain.handle(
    IPC.notify,
    guard((_event, request: DesktopNotificationRequest) => {
      if (!Notification.isSupported()) return false;

      const notification = new Notification({
        title: request.title,
        body: request.body,
        silent: request.silent ?? false,
      });

      notification.on('click', () => {
        showMainWindow();
        getMainWindow()?.webContents.send(IPC_EVENT.notificationActivated, {
          id: request.id,
          route: request.route,
        });
      });

      notification.show();
      return true;
    }),
  );

  ipcMain.handle(
    IPC.setBadgeCount,
    guard((_event, count: number) => {
      const value = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
      if (process.platform !== 'win32') app.setBadgeCount(value);
      setTrayBadge(value);
    }),
  );

  ipcMain.handle(
    IPC.flashFrame,
    guard((_event, value: boolean) => {
      const window = getMainWindow();
      if (window && !window.isFocused()) window.flashFrame(value);
    }),
  );

  /* --- shell & handoff -------------------------------------------------- */

  ipcMain.handle(
    IPC.openExternal,
    guard(async (_event, url: string) => {
      if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url)) return false;
      await shell.openExternal(url);
      return true;
    }),
  );

  ipcMain.handle(
    IPC.openAppOrWeb,
    guard(async (_event, request: DesktopHandoffRequest) => {
      const targetUrl = request.fallbackUrl || `${webAppUrl}${request.route}`;
      if (!/^https?:\/\//i.test(targetUrl)) return false;
      await shell.openExternal(targetUrl);
      return true;
    }),
  );

  ipcMain.handle(
    IPC.showItemInFolder,
    guard((_event, path: string) => {
      shell.showItemInFolder(path);
    }),
  );

  ipcMain.handle(
    IPC.openSystemSettings,
    guard(async (_event, setting: string) => {
      if (process.platform === 'win32') {
        if (setting === 'taskbar') {
          await shell.openExternal('ms-settings:taskbar');
          return true;
        }
        if (setting === 'notifications') {
          await shell.openExternal('ms-settings:notifications');
          return true;
        }
      }
      return false;
    }),
  );

  /* --- files ------------------------------------------------------------ */

  ipcMain.handle(
    IPC.openFiles,
    guard(async (_event, request: DesktopOpenFilesRequest = {}): Promise<DesktopPickedFile[]> => {
      const window = getMainWindow();
      if (!window) return [];

      const result = await dialog.showOpenDialog(window, {
        filters: request.filters,
        properties: [
          request.directories ? 'openDirectory' : 'openFile',
          ...(request.multiple ? (['multiSelections'] as const) : []),
        ],
      });

      if (result.canceled) return [];
      return Promise.all(result.filePaths.map(readPickedFile));
    }),
  );

  ipcMain.handle(
    IPC.saveFile,
    guard(async (_event, request: DesktopSaveFileRequest): Promise<DesktopSaveResult> => {
      const window = getMainWindow();
      if (!window) return { canceled: true };

      const result = await dialog.showSaveDialog(window, {
        defaultPath: join(app.getPath('downloads'), request.suggestedName),
        filters: request.filters,
      });

      if (result.canceled || !result.filePath) return { canceled: true };

      await writeFile(result.filePath, Buffer.from(request.data, 'base64'));
      return { canceled: false, path: result.filePath };
    }),
  );

  ipcMain.handle(
    IPC.downloadFile,
    guard(async (_event, request: DesktopDownloadRequest) => {
      const window = getMainWindow();
      if (!window || !/^https?:\/\//i.test(request.url)) return false;
      window.webContents.downloadURL(request.url);
      return true;
    }),
  );

  /* --- clipboard -------------------------------------------------------- */

  ipcMain.handle(
    IPC.clipboardWriteText,
    guard((_event, text: string) => clipboard.writeText(text)),
  );
  ipcMain.handle(
    IPC.clipboardReadText,
    guard(() => clipboard.readText()),
  );

  /* --- preferences ------------------------------------------------------ */

  ipcMain.handle(
    IPC.getPreference,
    guard((_event, key: string) => getPreference<unknown>(key, null)),
  );

  ipcMain.handle(
    IPC.setPreference,
    guard((_event, key: string, value: unknown) => {
      setPreference(key, value);
      if (key === 'launchAtLogin') {
        app.setLoginItemSettings({ openAtLogin: Boolean(value), openAsHidden: true });
      }
      refreshTrayMenu();
    }),
  );

  ipcMain.handle(
    IPC.setThemeSource,
    guard((_event, source: 'system' | 'light' | 'dark') => {
      nativeTheme.themeSource = source;
      setPreference('theme', source);
      const window = getMainWindow();
      if (window && !window.isDestroyed()) {
        const isDark =
          source === 'dark' || (source === 'system' && nativeTheme.shouldUseDarkColors);
        window.setBackgroundColor(isDark ? '#0c0d0e' : '#fbfbfc');
      }
    }),
  );

  /* --- updates ---------------------------------------------------------- */

  ipcMain.handle(
    IPC.checkForUpdates,
    guard(() => checkForUpdates(isDev)),
  );
  ipcMain.handle(
    IPC.downloadUpdate,
    guard(() => downloadUpdate()),
  );
  ipcMain.handle(
    IPC.installUpdate,
    guard(() => installUpdate()),
  );

  ipcMain.handle(
    IPC.relaunch,
    guard(() => {
      markQuitting();
      app.relaunch();
      app.exit(0);
    }),
  );
}

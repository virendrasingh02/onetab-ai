import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  IPC as IpcContract,
  IPC_EVENT as IpcEventContract,
  DesktopAppInfo,
  DesktopCommand,
  DesktopDeepLink,
  DesktopDownloadRequest,
  DesktopNotificationRequest,
  DesktopOpenFilesRequest,
  DesktopPickedFile,
  DesktopSaveFileRequest,
  DesktopSaveResult,
  DesktopUpdateStatus,
  DesktopWindowState,
} from './shared/ipc.js';

/**
 * The only surface the renderer sees.
 *
 * Nothing here hands out an `ipcRenderer` handle or lets the page choose its own
 * channel — every entry is a named, typed call, so the attack surface is exactly
 * this list. The mirrored renderer-side type lives in `@org/web-desktop`.
 *
 * The window runs with `sandbox: true`, where a preload script may only
 * `require('electron')` and a few built-ins — a relative import of the contract
 * module would throw at load. So the channel names are repeated here as literals
 * and pinned to the contract with `satisfies`: rename a channel in `ipc.ts` and
 * this file fails to compile. Everything else is imported with `import type`,
 * which erases entirely.
 */

const IPC = {
  appInfo: 'onetab:app-info',
  windowState: 'onetab:window-state',
  windowMinimize: 'onetab:window/minimize',
  windowToggleMaximize: 'onetab:window/toggle-maximize',
  windowClose: 'onetab:window/close',
  windowSetFullScreen: 'onetab:window/set-full-screen',
  notify: 'onetab:notify',
  setBadgeCount: 'onetab:set-badge-count',
  flashFrame: 'onetab:flash-frame',
  openExternal: 'onetab:open-external',
  showItemInFolder: 'onetab:show-item-in-folder',
  openFiles: 'onetab:dialog/open-files',
  saveFile: 'onetab:dialog/save-file',
  downloadFile: 'onetab:download-file',
  clipboardWriteText: 'onetab:clipboard/write-text',
  clipboardReadText: 'onetab:clipboard/read-text',
  getPreference: 'onetab:prefs/get',
  setPreference: 'onetab:prefs/set',
  setThemeSource: 'onetab:theme/set-source',
  checkForUpdates: 'onetab:updates/check',
  installUpdate: 'onetab:updates/install',
  relaunch: 'onetab:relaunch',
} as const satisfies typeof IpcContract;

const IPC_EVENT = {
  deepLink: 'onetab:event/deep-link',
  windowStateChanged: 'onetab:event/window-state',
  themeChanged: 'onetab:event/theme-changed',
  updateStatus: 'onetab:event/update-status',
  notificationActivated: 'onetab:event/notification-activated',
  command: 'onetab:event/command',
  onlineStatus: 'onetab:event/online-status',
} as const satisfies typeof IpcEventContract;

type Unsubscribe = () => void;

/** Wraps `ipcRenderer.on` so callers get a disposer instead of leaking listeners. */
function subscribe<T>(channel: string, handler: (payload: T) => void): Unsubscribe {
  const listener = (_event: IpcRendererEvent, payload: T) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

const api = {
  /** Sentinel the renderer checks before assuming any of this exists. */
  isDesktop: true as const,

  getAppInfo: (): Promise<DesktopAppInfo> => ipcRenderer.invoke(IPC.appInfo),

  window: {
    getState: (): Promise<DesktopWindowState> => ipcRenderer.invoke(IPC.windowState),
    minimize: (): Promise<void> => ipcRenderer.invoke(IPC.windowMinimize),
    toggleMaximize: (): Promise<void> => ipcRenderer.invoke(IPC.windowToggleMaximize),
    close: (): Promise<void> => ipcRenderer.invoke(IPC.windowClose),
    setFullScreen: (value: boolean): Promise<void> =>
      ipcRenderer.invoke(IPC.windowSetFullScreen, value),
    onStateChange: (handler: (state: DesktopWindowState) => void): Unsubscribe =>
      subscribe(IPC_EVENT.windowStateChanged, handler),
  },

  notifications: {
    show: (request: DesktopNotificationRequest): Promise<boolean> =>
      ipcRenderer.invoke(IPC.notify, request),
    setBadgeCount: (count: number): Promise<void> =>
      ipcRenderer.invoke(IPC.setBadgeCount, count),
    flashFrame: (value: boolean): Promise<void> => ipcRenderer.invoke(IPC.flashFrame, value),
    onActivated: (handler: (payload: { id?: string; route?: string }) => void): Unsubscribe =>
      subscribe(IPC_EVENT.notificationActivated, handler),
  },

  shell: {
    openExternal: (url: string): Promise<boolean> => ipcRenderer.invoke(IPC.openExternal, url),
    showItemInFolder: (path: string): Promise<void> =>
      ipcRenderer.invoke(IPC.showItemInFolder, path),
  },

  files: {
    open: (request?: DesktopOpenFilesRequest): Promise<DesktopPickedFile[]> =>
      ipcRenderer.invoke(IPC.openFiles, request ?? {}),
    save: (request: DesktopSaveFileRequest): Promise<DesktopSaveResult> =>
      ipcRenderer.invoke(IPC.saveFile, request),
    download: (request: DesktopDownloadRequest): Promise<boolean> =>
      ipcRenderer.invoke(IPC.downloadFile, request),
  },

  clipboard: {
    writeText: (text: string): Promise<void> => ipcRenderer.invoke(IPC.clipboardWriteText, text),
    readText: (): Promise<string> => ipcRenderer.invoke(IPC.clipboardReadText),
  },

  preferences: {
    get: (key: string): Promise<unknown> => ipcRenderer.invoke(IPC.getPreference, key),
    set: (key: string, value: unknown): Promise<void> =>
      ipcRenderer.invoke(IPC.setPreference, key, value),
  },

  theme: {
    setSource: (source: 'system' | 'light' | 'dark'): Promise<void> =>
      ipcRenderer.invoke(IPC.setThemeSource, source),
    onNativeThemeChange: (
      handler: (payload: { shouldUseDarkColors: boolean }) => void,
    ): Unsubscribe => subscribe(IPC_EVENT.themeChanged, handler),
  },

  updates: {
    check: (): Promise<DesktopUpdateStatus> => ipcRenderer.invoke(IPC.checkForUpdates),
    install: (): Promise<boolean> => ipcRenderer.invoke(IPC.installUpdate),
    onStatus: (handler: (status: DesktopUpdateStatus) => void): Unsubscribe =>
      subscribe(IPC_EVENT.updateStatus, handler),
  },

  app: {
    relaunch: (): Promise<void> => ipcRenderer.invoke(IPC.relaunch),
  },

  onDeepLink: (handler: (link: DesktopDeepLink) => void): Unsubscribe =>
    subscribe(IPC_EVENT.deepLink, handler),

  onCommand: (handler: (command: DesktopCommand) => void): Unsubscribe =>
    subscribe(IPC_EVENT.command, handler),
};

contextBridge.exposeInMainWorld('onetabDesktop', api);

export type OneTabDesktopApi = typeof api;

/**
 * The IPC contract shared by the main process and the preload script.
 *
 * The renderer never imports this file — it only ever touches the object the
 * preload publishes on `window.onetab`. The *shape* of that object is declared
 * separately in `@org/web-desktop` (`desktop-api.ts`); keep the two in sync when
 * adding a capability here.
 */

/** Renderer → main, awaiting a reply. */
export const IPC = {
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
} as const;

/** Main → renderer, fire and forget. */
export const IPC_EVENT = {
  deepLink: 'onetab:event/deep-link',
  windowStateChanged: 'onetab:event/window-state',
  themeChanged: 'onetab:event/theme-changed',
  updateStatus: 'onetab:event/update-status',
  notificationActivated: 'onetab:event/notification-activated',
  command: 'onetab:event/command',
  onlineStatus: 'onetab:event/online-status',
} as const;

export type DesktopPlatform = 'win32' | 'darwin' | 'linux';

export interface DesktopAppInfo {
  version: string;
  electronVersion: string;
  chromeVersion: string;
  platform: DesktopPlatform;
  arch: string;
  isPackaged: boolean;
  /** True when running inside a Mac App Store build where self-updates are forbidden. */
  isMas: boolean;
  /** True when the OS draws no frame and the renderer owns the title bar. */
  usesCustomTitleBar: boolean;
  /** Reserved inset (px) for macOS traffic lights so content can offset. */
  titleBarInset: number;
  locale: string;
}

export interface DesktopWindowState {
  isMaximized: boolean;
  isMinimized: boolean;
  isFullScreen: boolean;
  isFocused: boolean;
}

export interface DesktopNotificationRequest {
  title: string;
  body: string;
  /** Echoed back on `notificationActivated` so the renderer can route. */
  id?: string;
  silent?: boolean;
  /** In-app route to open when the notification is clicked. */
  route?: string;
}

export interface DesktopOpenFilesRequest {
  /** Extension groups, e.g. `[{ name: 'Images', extensions: ['png'] }]`. */
  filters?: Array<{ name: string; extensions: string[] }>;
  multiple?: boolean;
  directories?: boolean;
}

export interface DesktopPickedFile {
  path: string;
  name: string;
  size: number;
  mimeType: string;
  /** Base64 contents; omitted for directories and files over the read cap. */
  data?: string;
  /** True when the file was too large to inline and must stream from `path`. */
  truncated: boolean;
}

export interface DesktopSaveFileRequest {
  suggestedName: string;
  /** Base64 payload. */
  data: string;
  filters?: Array<{ name: string; extensions: string[] }>;
}

export interface DesktopSaveResult {
  canceled: boolean;
  path?: string;
}

export interface DesktopDownloadRequest {
  url: string;
  suggestedName?: string;
}

export type DesktopUpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'not-available' }
  | { state: 'error'; message: string };

/** Menu/tray/global-shortcut actions pushed into the renderer. */
export type DesktopCommand =
  | 'open-search'
  | 'open-ai-assistant'
  | 'new-channel'
  | 'toggle-sidebar'
  | 'open-settings'
  | 'open-shortcuts';

export interface DesktopDeepLink {
  /** Path portion, always leading-slash, e.g. `/w/acme/inbox`. */
  route: string;
  raw: string;
}

/** Files bigger than this are handed over as a path instead of base64. */
export const MAX_INLINE_FILE_BYTES = 25 * 1024 * 1024;

/** Custom protocol the OS routes back into the running instance. */
export const DEEP_LINK_PROTOCOL = 'onetab';

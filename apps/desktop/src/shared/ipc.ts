/**
 * The IPC contract shared by the main process and the preload script.
 *
 * The renderer never imports this file directly — it only ever touches the object the
 * preload publishes on `window.onetabDesktop`. The shape of that object is declared
 * separately in `@org/web-desktop` (`desktop-api.ts`); keep the two in sync when
 * adding a capability here.
 */

/** Renderer → main, awaiting a reply. */
export const IPC = {
  appInfo: 'onetab:app-info',
  getAppMetadata: 'onetab:app/metadata',
  getCapabilities: 'onetab:capabilities/get',
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
  downloadUpdate: 'onetab:updates/download',
  installUpdate: 'onetab:updates/install',
  relaunch: 'onetab:relaunch',
  authStartBrowserLogin: 'onetab:auth/start-browser-login',
  authGetSession: 'onetab:auth/get-session',
  authClearSession: 'onetab:auth/clear-session',
  authRefreshSession: 'onetab:auth/refresh-session',
  openAppOrWeb: 'onetab:shell/open-app-or-web',
  openSystemSettings: 'onetab:shell/open-system-settings',
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
  authSessionChanged: 'onetab:event/auth-session',
  capabilitiesChanged: 'onetab:event/capabilities-changed',
} as const;

export type DesktopPlatform = 'win32' | 'darwin' | 'linux';

/**
 * Who controls updates, review, and payments for this build. `'direct'`
 * covers both a Windows .exe and a notarized macOS DMG/ZIP — pair it with
 * `DesktopPlatform` to tell those apart, the same way `@org/platform`'s
 * `resolvePolicy(platform, distribution)` does on the renderer side.
 */
export type DesktopDistribution = 'direct' | 'microsoft-store' | 'mac-app-store';

export interface DesktopAppInfo {
  version: string;
  electronVersion: string;
  chromeVersion: string;
  platform: DesktopPlatform;
  arch: string;
  isPackaged: boolean;
  /** True when running inside a Mac App Store build where self-updates are forbidden. */
  isMas: boolean;
  distribution: DesktopDistribution;
  /** True when the OS draws no frame and the renderer owns the title bar. */
  usesCustomTitleBar: boolean;
  /** Reserved inset (px) for macOS traffic lights so content can offset. */
  titleBarInset: number;
  locale: string;
}

export interface DesktopAppMetadata {
  name: string;
  productName: string;
  version: string;
  build: string;
  publisher: string;
  copyright: string;
  website: string;
  supportUrl: string;
  privacyUrl: string;
  termsUrl: string;
  license: string;
  description: string;
}

export interface DesktopCapabilities {
  isDesktop: true;
  platform: DesktopPlatform;
  distribution: DesktopDistribution;
  architecture: string;
  authentication: boolean;
  notifications: boolean;
  deepLinks: boolean;
  appUpdates: boolean;
  autoLaunch: boolean;
  filesystem: boolean;
  clipboard: boolean;
  screenshots: boolean;
  windowControls: boolean;
  supportedFeatures: string[];
  unsupportedFeatures: string[];
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
  icon?: string;
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
  | { state: 'available'; version: string; releaseNotes?: string }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'not-available' }
  | { state: 'unsupported' }
  | { state: 'error'; message: string };

/** Menu/tray/global-shortcut actions pushed into the renderer. */
export type DesktopCommand =
  | 'open-search'
  | 'open-ai-assistant'
  | 'new-channel'
  | 'open-invite'
  | 'toggle-sidebar'
  | 'open-settings'
  | 'open-shortcuts';

export interface DesktopDeepLink {
  /** Path portion, always leading-slash, e.g. `/w/acme/inbox` or `/auth/callback?code=...`. */
  route: string;
  raw: string;
  params?: Record<string, string>;
}

export interface DesktopAuthSession {
  user: {
    id: string;
    email: string;
    name: string;
    displayName?: string | null;
    avatarUrl?: string | null;
  } | null;
  accessToken: string | null;
  refreshToken?: string | null;
}

export interface DesktopHandoffRequest {
  route: string;
  fallbackUrl?: string;
}

/** Files bigger than this are handed over as a path instead of base64. */
export const MAX_INLINE_FILE_BYTES = 25 * 1024 * 1024;

/** Supported custom protocols the OS routes back into the running instance. */
export const DEEP_LINK_PROTOCOLS = ['onetab', 'mie'] as const;
export const PRIMARY_DEEP_LINK_PROTOCOL = 'onetab';

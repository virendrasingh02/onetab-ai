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
  quit: 'onetab:quit',
  getDiagnostics: 'onetab:diagnostics/get',
  getStartup: 'onetab:startup/get',
  setStartup: 'onetab:startup/set',
  openPath: 'onetab:shell/open-path',
  authStartBrowserLogin: 'onetab:auth/start-browser-login',
  authGetSession: 'onetab:auth/get-session',
  authClearSession: 'onetab:auth/clear-session',
  authRefreshSession: 'onetab:auth/refresh-session',
  authCancelBrowserLogin: 'onetab:auth/cancel-browser-login',
  openAppOrWeb: 'onetab:shell/open-app-or-web',
  openSystemSettings: 'onetab:shell/open-system-settings',
  agentExecute: 'onetab:agent/execute',
  showAboutPanel: 'onetab:app/show-about',
  focus: 'onetab:app/focus',
  getPath: 'onetab:app/get-path',
  removeProtocol: 'onetab:protocol/remove',
  setUserTasks: 'onetab:windows/set-user-tasks',
  setJumpListWorkspaces: 'onetab:windows/set-jump-list-workspaces',
  clearRecentDocuments: 'onetab:app/clear-recent-documents',
  addRecentDocument: 'onetab:app/add-recent-document',
  setAccessibilitySupport: 'onetab:app/set-accessibility',
  setUserActivity: 'onetab:handoff/set-user-activity',
  invalidateUserActivity: 'onetab:handoff/invalidate-user-activity',
  dockBounce: 'onetab:dock/bounce',
  displayMediaRespond: 'onetab:display-media/respond',
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
  authFlowStatus: 'onetab:event/auth-flow-status',
  capabilitiesChanged: 'onetab:event/capabilities-changed',
  fileOpened: 'onetab:event/file-opened',
  handoffActivity: 'onetab:event/handoff-activity',
  accessibilitySupportChanged: 'onetab:event/accessibility-changed',
  displayMediaRequest: 'onetab:event/display-media-request',
} as const;

/** Named folders the renderer may ask the OS to reveal or inspect. Never an arbitrary path. */
export const DESKTOP_PATH_KEYS = [
  'userData',
  'logs',
  'crashDumps',
  'temp',
  'sessionData',
  'downloads',
  'documents',
  'desktop',
  'appData',
  'home',
  'exe',
] as const;
export type DesktopPathKey = (typeof DESKTOP_PATH_KEYS)[number];

export interface DesktopStartupState {
  /** False in dev builds, on Linux, and anywhere the OS has no login-item API. */
  supported: boolean;
  reason?: string;
  openAtLogin: boolean;
  /** Launch to the tray without showing the window. */
  startHidden: boolean;
  /** True when this very process was started by the OS at login. */
  launchedAtLogin: boolean;
  wasOpenedAsHidden?: boolean;
  restoreState?: boolean;
  status?: string;
  executableWillLaunchAtLogin?: boolean;
}

export interface DesktopStartupRequest {
  openAtLogin?: boolean;
  startHidden?: boolean;
  openAsHidden?: boolean;
}

export interface DesktopProcessMetric {
  pid: number;
  type: string;
  name?: string;
  cpuPercent: number;
  workingSetKb: number;
  peakWorkingSetKb?: number;
}

export interface DesktopProtocolStatus {
  scheme: string;
  /** Whether the OS currently routes this scheme to this app. */
  registered: boolean;
}

/** One entry in the Windows Jump List "Workspaces" category. */
export interface DesktopJumpListWorkspace {
  name: string;
  slug: string;
}

export interface DesktopUserTask {
  program?: string;
  arguments?: string;
  title: string;
  description?: string;
  iconPath?: string;
  iconIndex?: number;
}

export interface DesktopFileOpened {
  path: string;
  name: string;
  mimeType?: string;
}

export interface DesktopUserActivityPayload {
  activityType: string;
  userInfo?: Record<string, unknown>;
  webpageURL?: string;
}

export interface DesktopDiagnostics {
  collectedAt: string;
  identity: {
    name: string;
    version: string;
    isPackaged: boolean;
    isReady: boolean;
    appUserModelId: string | null;
    desktopName: string | null;
    appPath: string;
    uptimeSeconds: number;
  };
  runtime: {
    electron: string;
    chrome: string;
    node: string;
    v8: string;
    platform: DesktopPlatform;
    arch: string;
    osVersion: string;
    runningUnderTranslation: boolean;
  };
  locale: {
    app: string;
    system: string;
    preferred: string[];
    countryCode: string | null;
  };
  paths: Record<DesktopPathKey, string>;
  gpu: {
    hardwareAccelerationEnabled: boolean;
    /** The saved preference; differs from the above until the next restart. */
    hardwareAccelerationPreference: boolean;
    featureStatus: Record<string, string>;
    renderer: string | null;
  };
  accessibilitySupportEnabled: boolean;
  singleInstance: boolean;
  startup: DesktopStartupState;
  protocols: DesktopProtocolStatus[];
  jumpList?: {
    supported: boolean;
    tasksCount: number;
    workspacesCount?: number;
  };
  metrics: DesktopProcessMetric[];
}

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
  | {
      state: 'available';
      version: string;
      releaseNotes?: string;
      mandatory?: boolean;
      forceUpdate?: boolean;
      downloadUrl?: string;
      changelog?: string;
      minSupportedVersion?: string;
      /** The installer's page was opened in the system browser (no in-app updater is configured). */
      openedInBrowser?: boolean;
    }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'not-available' }
  | { state: 'unsupported' }
  | { state: 'error'; message: string };

/** One screen or window the user can pick to share. */
export interface DesktopCaptureSource {
  /** Opaque id, passed back to `displayMedia.respond`. */
  id: string;
  name: string;
  kind: 'screen' | 'window';
  /** A small JPEG data URL. */
  thumbnail: string;
  /** The owning app's icon, for windows, when the OS has one. */
  appIcon?: string;
}

/**
 * Pushed when a page calls `getDisplayMedia` (screen share). Electron has no
 * built-in picker, so the renderer shows one and answers with
 * `displayMedia.respond`; an unanswered request is cancelled after a minute.
 */
export interface DesktopDisplayMediaRequest {
  requestId: string;
  sources: DesktopCaptureSource[];
  /** Why `sources` is empty, when the cause is not "nothing to share". */
  blocked?: 'os-permission';
}

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

/** Which browser page a "sign in with browser" hand-off opens. */
export type DesktopBrowserAuthIntent = 'sign-in' | 'sign-up';

/**
 * Progress of a browser sign-in, pushed to the renderer so the desktop sign-in
 * screen can say what is happening instead of waiting silently forever.
 */
export interface DesktopAuthFlowStatus {
  state: 'waiting' | 'success' | 'cancelled' | 'expired' | 'timeout' | 'error';
  message?: string;
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

export interface DesktopAgentExecuteRequest {
  agentId: string;
  input: string | Record<string, unknown>;
  apiKey?: string;
  sessionId?: string;
  context?: Record<string, unknown>;
}

export interface DesktopAgentExecuteResponse {
  runId: string;
  status: string;
  result?: string;
  error?: string;
  tools?: unknown[];
}

/**
 * The renderer's view of the Electron preload bridge.
 *
 * This mirrors `apps/desktop/src/preload.ts`. It is declared here rather than
 * imported because the web app must build and run with no knowledge of the
 * desktop app at all — in a browser `window.onetabDesktop` is simply absent,
 * and every helper below degrades to a web-native fallback or a no-op.
 */

export type DesktopPlatform = 'win32' | 'darwin' | 'linux';

/**
 * Mirrors `DesktopDistribution` in `apps/desktop/src/shared/ipc.ts` — kept as
 * a second, independent declaration rather than a shared import for the same
 * reason `DesktopPlatform` above is: the web app must build with zero
 * knowledge of the desktop app, and the desktop app's main process
 * deliberately imports nothing outside `electron`/Node built-ins (see
 * docs/desktop-app.md, "Packaging notes").
 */
export type DesktopDistribution = 'direct' | 'microsoft-store' | 'mac-app-store';

export interface DesktopAppInfo {
  version: string;
  electronVersion: string;
  chromeVersion: string;
  platform: DesktopPlatform;
  arch: string;
  isPackaged: boolean;
  isMas?: boolean;
  distribution: DesktopDistribution;
  usesCustomTitleBar: boolean;
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
  isDesktop: boolean;
  platform: DesktopPlatform | 'web';
  /** Meaningful only when `isDesktop` is true; a web session has no distribution channel. */
  distribution?: DesktopDistribution;
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
  id?: string;
  silent?: boolean;
  /** In-app route opened when the OS notification is clicked. */
  route?: string;
  icon?: string;
}

export interface DesktopOpenFilesRequest {
  filters?: Array<{ name: string; extensions: string[] }>;
  multiple?: boolean;
  directories?: boolean;
}

export interface DesktopPickedFile {
  path: string;
  name: string;
  size: number;
  mimeType: string;
  /** Base64 contents; absent for directories and files over the inline cap. */
  data?: string;
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

export type DesktopUpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseNotes?: string }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'not-available' }
  | { state: 'unsupported' }
  | { state: 'error'; message: string };

export type DesktopCommand =
  | 'open-search'
  | 'open-ai-assistant'
  | 'new-channel'
  | 'open-invite'
  | 'toggle-sidebar'
  | 'open-settings'
  | 'open-shortcuts';

export interface DesktopDeepLink {
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

type Unsubscribe = () => void;

export interface OneTabDesktopApi {
  isDesktop: true;
  getAppInfo: () => Promise<DesktopAppInfo>;
  getAppMetadata: () => Promise<DesktopAppMetadata>;
  capabilities: {
    get: () => Promise<DesktopCapabilities>;
    onChange: (handler: (caps: DesktopCapabilities) => void) => Unsubscribe;
  };
  auth: {
    startBrowserLogin: () => Promise<boolean>;
    getSession: () => Promise<DesktopAuthSession | null>;
    clearSession: () => Promise<void>;
    /**
     * Renews the stored session via the desktop's own stored refresh token.
     * Resolves `null` for a transient failure (network, API restarting) —
     * the caller should leave the session alone and try again later — and
     * only for that; a definitive rejection (expired/revoked refresh token)
     * rejects the promise instead, which is the signal to sign out.
     */
    refreshSession: () => Promise<DesktopAuthSession | null>;
    onSessionChange: (handler: (session: DesktopAuthSession) => void) => Unsubscribe;
  };
  window: {
    getState: () => Promise<DesktopWindowState>;
    minimize: () => Promise<void>;
    toggleMaximize: () => Promise<void>;
    close: () => Promise<void>;
    setFullScreen: (value: boolean) => Promise<void>;
    onStateChange: (handler: (state: DesktopWindowState) => void) => Unsubscribe;
  };
  notifications: {
    show: (request: DesktopNotificationRequest) => Promise<boolean>;
    setBadgeCount: (count: number) => Promise<void>;
    flashFrame: (value: boolean) => Promise<void>;
    onActivated: (
      handler: (payload: { id?: string; route?: string }) => void,
    ) => Unsubscribe;
  };
  shell: {
    openExternal: (url: string) => Promise<boolean>;
    showItemInFolder: (path: string) => Promise<void>;
    openSystemSettings?: (setting: string) => Promise<boolean>;
  };
  handoff: {
    openAppOrWeb: (request: DesktopHandoffRequest) => Promise<boolean>;
  };
  files: {
    open: (request?: DesktopOpenFilesRequest) => Promise<DesktopPickedFile[]>;
    save: (request: DesktopSaveFileRequest) => Promise<DesktopSaveResult>;
    download: (request: { url: string; suggestedName?: string }) => Promise<boolean>;
  };
  clipboard: {
    writeText: (text: string) => Promise<void>;
    readText: () => Promise<string>;
  };
  preferences: {
    get: (key: string) => Promise<unknown>;
    set: (key: string, value: unknown) => Promise<void>;
  };
  theme: {
    setSource: (source: 'system' | 'light' | 'dark') => Promise<void>;
    onNativeThemeChange: (
      handler: (payload: { shouldUseDarkColors: boolean }) => void,
    ) => Unsubscribe;
  };
  updates: {
    check: () => Promise<DesktopUpdateStatus>;
    download: () => Promise<boolean>;
    install: () => Promise<boolean>;
    onStatus: (handler: (status: DesktopUpdateStatus) => void) => Unsubscribe;
  };
  app: {
    relaunch: () => Promise<void>;
  };
  onDeepLink: (handler: (link: DesktopDeepLink) => void) => Unsubscribe;
  onCommand: (handler: (command: DesktopCommand) => void) => Unsubscribe;
}

declare global {
  interface Window {
    onetabDesktop?: OneTabDesktopApi;
  }
}

/** The bridge, or `null` when running in a plain browser. */
export function getDesktopApi(): OneTabDesktopApi | null {
  if (typeof window === 'undefined') return null;
  return window.onetabDesktop ?? null;
}

/**
 * Whether this build is running inside the Electron shell.
 */
export const isDesktop: boolean = getDesktopApi() !== null;

/* --- capability-aware helpers -------------------------------------------- */

/**
 * Opens a URL outside the app.
 */
export async function openExternal(url: string): Promise<boolean> {
  const api = getDesktopApi();
  if (api) return api.shell.openExternal(url);

  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  return opened !== null;
}

/** Clipboard write that works even where `navigator.clipboard` is unavailable. */
export async function copyText(text: string): Promise<boolean> {
  const api = getDesktopApi();
  if (api) {
    await api.clipboard.writeText(text);
    return true;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shows a notification through whichever channel is available.
 */
export async function notify(request: DesktopNotificationRequest): Promise<boolean> {
  const api = getDesktopApi();
  if (api) return api.notifications.show(request);

  if (typeof Notification === 'undefined') return false;

  try {
    const permission =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;

    if (permission !== 'granted') return false;
    new Notification(request.title, {
      body: request.body,
      silent: request.silent,
      icon: request.icon,
    });
    return true;
  } catch {
    return false;
  }
}

/** Unread count on the dock/taskbar; a no-op in the browser. */
export async function setBadgeCount(count: number): Promise<void> {
  const api = getDesktopApi();
  if (api) {
    await api.notifications.setBadgeCount(count);
    return;
  }

  const badging = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0) await badging.setAppBadge?.(count);
    else await badging.clearAppBadge?.();
  } catch {
    // ignore
  }
}

/**
 * Flashes the application window / taskbar frame on desktop; no-op in browser.
 */
export async function flashFrame(value: boolean): Promise<void> {
  const api = getDesktopApi();
  if (api) {
    await api.notifications.flashFrame(value);
  }
}

/**
 * Opens system settings page (e.g. "taskbar") if supported by OS / desktop shell.
 */
export async function openSystemSettings(setting: string): Promise<boolean> {
  const api = getDesktopApi();
  if (api && api.shell && typeof api.shell.openSystemSettings === 'function') {
    return api.shell.openSystemSettings(setting);
  }
  return false;
}

/**
 * Saves a blob to disk with native save dialog on desktop or anchor download in web.
 */
export async function saveFile(
  filename: string,
  blob: Blob,
): Promise<{ canceled: boolean; path?: string }> {
  const api = getDesktopApi();

  if (api) {
    const buffer = await blob.arrayBuffer();
    return api.files.save({ suggestedName: filename, data: toBase64(buffer) });
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { canceled: false };
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Picks files with the native dialog when available, falling back to a hidden `<input type="file">`.
 */
export async function pickFiles(options: {
  accept?: string;
  multiple?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
} = {}): Promise<File[]> {
  const api = getDesktopApi();

  if (api) {
    const picked = await api.files.open({
      multiple: options.multiple,
      filters: options.filters,
    });

    return picked.flatMap((entry) => {
      if (entry.data === undefined) return [];
      const binary = atob(entry.data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return [new File([bytes], entry.name, { type: entry.mimeType })];
    });
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (options.accept) input.accept = options.accept;
    input.multiple = options.multiple ?? false;
    input.addEventListener('change', () => resolve(Array.from(input.files ?? [])), {
      once: true,
    });
    input.addEventListener('cancel', () => resolve([]), { once: true });
    input.click();
  });
}

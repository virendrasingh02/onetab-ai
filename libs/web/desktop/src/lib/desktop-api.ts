/**
 * The renderer's view of the Electron preload bridge.
 *
 * This mirrors `apps/desktop/src/preload.ts`. It is declared here rather than
 * imported because the web app must build and run with no knowledge of the
 * desktop app at all — in a browser `window.onetabDesktop` is simply absent,
 * and every helper below degrades to a web-native fallback or a no-op.
 */

export type DesktopPlatform = 'win32' | 'darwin' | 'linux';

export interface DesktopAppInfo {
  version: string;
  electronVersion: string;
  chromeVersion: string;
  platform: DesktopPlatform;
  arch: string;
  isPackaged: boolean;
  usesCustomTitleBar: boolean;
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
  id?: string;
  silent?: boolean;
  /** In-app route opened when the OS notification is clicked. */
  route?: string;
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
  | { state: 'available'; version: string }
  | { state: 'downloading'; percent: number }
  | { state: 'ready'; version: string }
  | { state: 'not-available' }
  | { state: 'error'; message: string };

export type DesktopCommand =
  | 'open-search'
  | 'open-ai-assistant'
  | 'new-channel'
  | 'toggle-sidebar'
  | 'open-settings'
  | 'open-shortcuts';

export interface DesktopDeepLink {
  route: string;
  raw: string;
}

type Unsubscribe = () => void;

export interface OneTabDesktopApi {
  isDesktop: true;
  getAppInfo: () => Promise<DesktopAppInfo>;
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
 *
 * Read once at module load: the preload runs strictly before any renderer
 * script, so the answer cannot change during the session, and treating it as a
 * constant keeps it usable outside React.
 */
export const isDesktop: boolean = getDesktopApi() !== null;

/* --- capability-aware helpers -------------------------------------------- */

/**
 * Opens a URL outside the app.
 *
 * In Electron `window.open` is denied by the navigation policy (an in-app
 * browser window with no chrome is a phishing surface), so links have to go
 * through the shell. On the web this is just `window.open`.
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
    // Requires a secure context; plain-http staging origins do not have it.
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shows a notification through whichever channel is available.
 *
 * Desktop notifications survive the window being hidden or minimised and can
 * carry a route to open on click; the web `Notification` API only fires while
 * a tab is alive and needs an explicit permission grant.
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
    new Notification(request.title, { body: request.body, silent: request.silent });
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

  // The Badging API only works for installed PWAs, so failures are expected.
  const badging = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (count > 0) await badging.setAppBadge?.(count);
    else await badging.clearAppBadge?.();
  } catch {
    // Not supported here — the in-app badge still renders.
  }
}

/**
 * Saves a blob to disk.
 *
 * Electron gets a real "Save as…" dialog and writes the file itself; the web
 * falls back to an anchor download, which lands wherever the browser is
 * configured to put downloads with no say from the user.
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
  // Revoking synchronously can cancel the download in Safari and Firefox.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { canceled: false };
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Chunked because `String.fromCharCode(...bytes)` blows the argument limit
  // somewhere around 100 kB.
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/**
 * Picks files with the native dialog when available, falling back to a hidden
 * `<input type="file">`. Both paths return real `File` objects, so callers —
 * including `useFileUpload` — need no branching.
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

    // Entries without `data` are directories or files past the inline cap;
    // there is no `File` to build for those.
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
    // Cancelling the dialog fires no `change` event in most browsers; `cancel`
    // is the newer signal and keeps the promise from hanging forever.
    input.addEventListener('cancel', () => resolve([]), { once: true });
    input.click();
  });
}

import { useTheme } from '@org/design-system';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { DEFAULT_APP_METADATA } from './app-metadata.js';
import { WEB_DEFAULT_CAPABILITIES } from './capabilities.js';
import {
  getDesktopApi,
  isDesktop,
  type DesktopAppInfo,
  type DesktopAppMetadata,
  type DesktopAuthSession,
  type DesktopCapabilities,
  type DesktopCommand,
  type DesktopUpdateStatus,
  type DesktopWindowState,
} from './desktop-api.js';

interface DesktopContextValue {
  isDesktop: boolean;
  appInfo: DesktopAppInfo | null;
  appMetadata: DesktopAppMetadata;
  capabilities: DesktopCapabilities;
  windowState: DesktopWindowState;
  updateStatus: DesktopUpdateStatus;
  authSession: DesktopAuthSession | null;
  /** Registers a handler for a menu/tray/shortcut command. Returns a disposer. */
  onCommand: (command: DesktopCommand, handler: () => void) => () => void;
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  checkForUpdates: () => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  startBrowserLogin: () => Promise<boolean>;
  clearAuthSession: () => Promise<void>;
}

const WEB_WINDOW_STATE: DesktopWindowState = {
  isMaximized: false,
  isMinimized: false,
  isFullScreen: false,
  isFocused: true,
};

const DesktopContext = createContext<DesktopContextValue | null>(null);

/**
 * Bridges the Electron shell into the React tree.
 *
 * Sits inside the router: deep links and clicked notifications resolve to
 * in-app routes, and routing them is the whole point of the connection.
 */
export function DesktopProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { resolvedTheme, theme } = useTheme();

  const [appInfo, setAppInfo] = useState<DesktopAppInfo | null>(null);
  const [appMetadata, setAppMetadata] = useState<DesktopAppMetadata>(DEFAULT_APP_METADATA);
  const [capabilities, setCapabilities] = useState<DesktopCapabilities>(WEB_DEFAULT_CAPABILITIES);
  const [windowState, setWindowState] = useState<DesktopWindowState>(WEB_WINDOW_STATE);
  const [updateStatus, setUpdateStatus] = useState<DesktopUpdateStatus>({ state: 'idle' });
  const [authSession, setAuthSession] = useState<DesktopAuthSession | null>(null);

  const handlers = useRef(new Map<DesktopCommand, Set<() => void>>());

  const onCommand = useCallback((command: DesktopCommand, handler: () => void) => {
    const existing = handlers.current.get(command) ?? new Set();
    existing.add(handler);
    handlers.current.set(command, existing);
    return () => {
      existing.delete(handler);
    };
  }, []);

  // Initialize facts from desktop bridge
  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return;

    let active = true;
    void api.getAppInfo().then((info) => {
      if (active) setAppInfo(info);
    });
    void api.getAppMetadata().then((meta) => {
      if (active && meta) setAppMetadata(meta);
    });
    void api.capabilities.get().then((caps) => {
      if (active && caps) setCapabilities(caps);
    });
    void api.window.getState().then((state) => {
      if (active) setWindowState(state);
    });
    void api.auth.getSession().then((sess) => {
      if (active && sess) setAuthSession(sess);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return;

    const disposers = [
      api.window.onStateChange(setWindowState),
      api.capabilities.onChange(setCapabilities),
      api.auth.onSessionChange((sess) => {
        setAuthSession(sess);
        if (sess?.user) {
          // If in login or callback view, navigate to home on successful authentication
          if (window.location.pathname.startsWith('/login') || window.location.pathname.startsWith('/auth/callback')) {
            navigate('/', { replace: true });
          }
        }
      }),
      api.onDeepLink((link) => {
        if (link.route) navigate(link.route);
      }),
      api.notifications.onActivated((payload) => {
        if (payload.route) navigate(payload.route);
      }),
      api.onCommand((command) => {
        for (const handler of handlers.current.get(command) ?? []) handler();
      }),
      api.updates.onStatus(setUpdateStatus),
    ];

    return () => {
      for (const dispose of disposers) dispose();
    };
  }, [navigate]);

  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return;
    void api.theme.setSource(theme === 'system' ? 'system' : resolvedTheme);
  }, [theme, resolvedTheme]);

  const minimize = useCallback(() => void getDesktopApi()?.window.minimize(), []);
  const toggleMaximize = useCallback(() => void getDesktopApi()?.window.toggleMaximize(), []);
  const close = useCallback(() => void getDesktopApi()?.window.close(), []);

  const checkForUpdates = useCallback(async () => {
    const api = getDesktopApi();
    if (!api) return;
    setUpdateStatus(await api.updates.check());
  }, []);

  const downloadUpdate = useCallback(async () => {
    const api = getDesktopApi();
    if (!api) return;
    await api.updates.download();
  }, []);

  const installUpdate = useCallback(async () => {
    await getDesktopApi()?.updates.install();
  }, []);

  const startBrowserLogin = useCallback(async () => {
    const api = getDesktopApi();
    if (!api) return false;
    return api.auth.startBrowserLogin();
  }, []);

  const clearAuthSession = useCallback(async () => {
    const api = getDesktopApi();
    if (!api) return;
    await api.auth.clearSession();
    setAuthSession(null);
  }, []);

  const value = useMemo<DesktopContextValue>(
    () => ({
      isDesktop,
      appInfo,
      appMetadata,
      capabilities,
      windowState,
      updateStatus,
      authSession,
      onCommand,
      minimize,
      toggleMaximize,
      close,
      checkForUpdates,
      downloadUpdate,
      installUpdate,
      startBrowserLogin,
      clearAuthSession,
    }),
    [
      appInfo,
      appMetadata,
      capabilities,
      windowState,
      updateStatus,
      authSession,
      onCommand,
      minimize,
      toggleMaximize,
      close,
      checkForUpdates,
      downloadUpdate,
      installUpdate,
      startBrowserLogin,
      clearAuthSession,
    ],
  );

  return <DesktopContext value={value}>{children}</DesktopContext>;
}

export function useDesktop(): DesktopContextValue {
  const context = use(DesktopContext);
  return (
    context ?? {
      isDesktop: false,
      appInfo: null,
      appMetadata: DEFAULT_APP_METADATA,
      capabilities: WEB_DEFAULT_CAPABILITIES,
      windowState: WEB_WINDOW_STATE,
      updateStatus: { state: 'idle' },
      authSession: null,
      onCommand: () => () => undefined,
      minimize: () => undefined,
      toggleMaximize: () => undefined,
      close: () => undefined,
      checkForUpdates: async () => undefined,
      downloadUpdate: async () => undefined,
      installUpdate: async () => undefined,
      startBrowserLogin: async () => false,
      clearAuthSession: async () => undefined,
    }
  );
}

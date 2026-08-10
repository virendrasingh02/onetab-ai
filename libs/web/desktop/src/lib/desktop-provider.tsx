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
import {
  getDesktopApi,
  isDesktop,
  type DesktopAppInfo,
  type DesktopCommand,
  type DesktopUpdateStatus,
  type DesktopWindowState,
} from './desktop-api.js';

interface DesktopContextValue {
  isDesktop: boolean;
  appInfo: DesktopAppInfo | null;
  windowState: DesktopWindowState;
  updateStatus: DesktopUpdateStatus;
  /** Registers a handler for a menu/tray/shortcut command. Returns a disposer. */
  onCommand: (command: DesktopCommand, handler: () => void) => () => void;
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
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
 * Must sit inside the router: deep links and clicked notifications resolve to
 * in-app routes, and routing them is the whole point of the connection. In a
 * browser every effect below short-circuits and the provider costs one context.
 */
export function DesktopProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { resolvedTheme, theme } = useTheme();

  const [appInfo, setAppInfo] = useState<DesktopAppInfo | null>(null);
  const [windowState, setWindowState] = useState<DesktopWindowState>(WEB_WINDOW_STATE);
  const [updateStatus, setUpdateStatus] = useState<DesktopUpdateStatus>({ state: 'idle' });

  /*
   * Command subscribers live in a ref, not state: menu items fire from outside
   * React and re-rendering the whole tree to add a listener would be wasteful.
   */
  const handlers = useRef(new Map<DesktopCommand, Set<() => void>>());

  const onCommand = useCallback((command: DesktopCommand, handler: () => void) => {
    const existing = handlers.current.get(command) ?? new Set();
    existing.add(handler);
    handlers.current.set(command, existing);
    return () => {
      existing.delete(handler);
    };
  }, []);

  // Static shell facts: version, platform, whether we own the title bar.
  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return;

    let active = true;
    void api.getAppInfo().then((info) => {
      if (active) setAppInfo(info);
    });
    void api.window.getState().then((state) => {
      if (active) setWindowState(state);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return;
    return api.window.onStateChange(setWindowState);
  }, []);

  // Deep links (`onetab://w/acme/inbox`) and clicked notifications both resolve
  // to an in-app route.
  useEffect(() => {
    const api = getDesktopApi();
    if (!api) return;

    const disposers = [
      api.onDeepLink((link) => navigate(link.route)),
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

  /*
   * Native chrome — context menus, scrollbars, the window frame — is drawn by
   * the OS and does not read our CSS, so it has to be told about theme changes
   * separately or the app looks half-converted after a toggle.
   */
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

  const installUpdate = useCallback(async () => {
    await getDesktopApi()?.updates.install();
  }, []);

  const value = useMemo<DesktopContextValue>(
    () => ({
      isDesktop,
      appInfo,
      windowState,
      updateStatus,
      onCommand,
      minimize,
      toggleMaximize,
      close,
      checkForUpdates,
      installUpdate,
    }),
    [
      appInfo,
      windowState,
      updateStatus,
      onCommand,
      minimize,
      toggleMaximize,
      close,
      checkForUpdates,
      installUpdate,
    ],
  );

  return <DesktopContext value={value}>{children}</DesktopContext>;
}

/**
 * Desktop state and actions.
 *
 * Safe to call outside `DesktopProvider` — it returns an inert web-shaped
 * value rather than throwing, so shared components can use it unconditionally.
 */
export function useDesktop(): DesktopContextValue {
  const context = use(DesktopContext);
  return (
    context ?? {
      isDesktop: false,
      appInfo: null,
      windowState: WEB_WINDOW_STATE,
      updateStatus: { state: 'idle' },
      onCommand: () => () => undefined,
      minimize: () => undefined,
      toggleMaximize: () => undefined,
      close: () => undefined,
      checkForUpdates: async () => undefined,
      installUpdate: async () => undefined,
    }
  );
}

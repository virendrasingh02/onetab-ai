import { useRealtime } from '@org/realtime';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { BackgroundSyncManager } from './background-sync-manager.js';
import { registerDefaultOfflineExecutors } from './offline-executors.js';

interface SyncContextValue {
  manager: BackgroundSyncManager;
}

const SyncContext = createContext<SyncContextValue | null>(null);

export interface SyncProviderProps {
  children: ReactNode;
  /** The active workspace id. Background sync is scoped strictly to this. */
  workspaceId?: string | null;
  /** The signed-in user id — reserved for future per-user scoping. */
  userId?: string | null;
}

/**
 * Wires the {@link BackgroundSyncManager} to the app.
 *
 * Must render **inside** `<RealtimeProvider>` (it needs the realtime bus and
 * connection state) and inside a `<QueryClientProvider>`. Mount it once, high in
 * the tree — `providers.tsx` does, just inside `RealtimeAppBridge`.
 */
export function SyncProvider({ children, workspaceId, userId }: SyncProviderProps) {
  const queryClient = useQueryClient();
  const { bus, client, connectionState } = useRealtime();
  const [manager] = useState(() => new BackgroundSyncManager());
  const attachedRef = useRef(false);

  // Attach once — the manager is stable for the provider's lifetime.
  useEffect(() => {
    if (attachedRef.current) return;
    attachedRef.current = true;
    manager.attach({ queryClient, bus });
    registerDefaultOfflineExecutors(manager);
    return () => {
      manager.dispose();
    };
  }, [manager, queryClient, bus]);

  useEffect(() => {
    manager.setRealtimeClient(client);
  }, [manager, client]);

  useEffect(() => {
    manager.setConnectionState(connectionState);
  }, [manager, connectionState]);

  useEffect(() => {
    void manager.setWorkspace(workspaceId ?? null);
  }, [manager, workspaceId]);

  // `userId` is accepted now so the provider signature is stable when per-user
  // scoping (e.g. a user-level offline queue) lands.
  void userId;

  return (
    <SyncContext.Provider value={{ manager }}>{children}</SyncContext.Provider>
  );
}

export function useBackgroundSync(): BackgroundSyncManager {
  const ctx = useContext(SyncContext);
  if (!ctx) {
    throw new Error('useBackgroundSync must be used within a <SyncProvider>');
  }
  return ctx.manager;
}

/** Non-throwing variant for components that may render outside the provider. */
export function useOptionalBackgroundSync(): BackgroundSyncManager | null {
  return useContext(SyncContext)?.manager ?? null;
}

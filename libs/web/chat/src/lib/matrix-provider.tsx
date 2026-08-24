import { getAccessToken, matrixApi } from '@org/api-client';
import {
  createMatrixClient,
  type ConnectionStatus,
  type MatrixClientEvent,
  type OneTabMatrixClient,
} from '@org/matrix-client';
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

interface MatrixContextValue {
  client: OneTabMatrixClient | null;
  status: ConnectionStatus;
  /** False when this deployment has no homeserver configured. */
  enabled: boolean;
  error: string | null;
}

const MatrixContext = createContext<MatrixContextValue | null>(null);

/**
 * Owns the Matrix connection for the application.
 *
 * The browser never holds Matrix credentials of its own: it asks our API for a
 * short-lived login token and exchanges it here. Chat degrades to unavailable
 * rather than breaking the app when the bridge is switched off, which is the
 * normal state in local development.
 */
export function MatrixProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<OneTabMatrixClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>({
    state: 'disconnected',
  });
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connectingForToken = useRef<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let instance: OneTabMatrixClient | null = null;
    let unsubscribe: (() => void) | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failureCount = 0;

    /**
     * A failed attempt still has to mark `token` as handled, or the 1 s poll
     * below re-fires `syncConnection` every tick forever — which, when the
     * failure is a 401, means hammering `/auth/refresh` fast enough to trip
     * its rate limit and take authenticated requests down app-wide, not just
     * chat. Backing off (capped at 30 s) still lets a transient failure heal
     * once the token rotates or the homeserver comes back.
     */
    function scheduleRetry(token: string) {
      failureCount += 1;
      const delay = Math.min(1000 * 2 ** failureCount, 30_000);
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (!disposed && connectingForToken.current === token) {
          connectingForToken.current = null;
        }
      }, delay);
    }

    async function syncConnection() {
      const token = getAccessToken();
      if (!token) {
        if (instance) {
          instance.stop();
          instance = null;
          setClient(null);
          setStatus({ state: 'disconnected' });
        }
        connectingForToken.current = null;
        setEnabled(false);
        return;
      }

      // Marked *before* any awaits so a failure still claims this token —
      // otherwise the interval below sees no change and retries immediately.
      if (connectingForToken.current === token) return;
      connectingForToken.current = token;

      try {
        const config = await matrixApi.config();

        if (!config.enabled || !config.homeserverUrl || disposed) {
          setEnabled(false);
          failureCount = 0;
          return;
        }
        setEnabled(true);

        instance = createMatrixClient({
          homeserverUrl: config.homeserverUrl,
          // The deployment decides: a homeserver that cannot hand out
          // device-bound sessions cannot do end-to-end encryption either.
          enableEncryption: config.encryption,
        });

        unsubscribe = instance.on((event: MatrixClientEvent) => {
          if (event.type === 'connection') setStatus(event.status);
        });

        // Resuming the stored session keeps the browser on one Matrix device,
        // which is what makes its encryption keys — and therefore its history
        // in private channels — survive a reload. Without an identity to match
        // it against there is nothing to resume *safely*: a session left by
        // whoever used this browser last would be someone else's.
        const resumed = config.matrixUserId
          ? await instance.restore(config.matrixUserId)
          : false;

        if (!resumed) {
          const session = await matrixApi.session();
          if (disposed) return;
          await instance.adoptSession({
            userId: session.matrixUserId,
            accessToken: session.accessToken,
            deviceId: session.deviceId,
          });
        }

        if (!disposed) {
          setClient(instance);
          setError(null);
          failureCount = 0;
        }
      } catch (caught) {
        if (!disposed) {
          setEnabled(false);
          setError(
            caught instanceof Error
              ? caught.message
              : 'Could not connect to chat.',
          );
          setStatus({ state: 'error' });
          scheduleRetry(token);
        }
      }
    }

    void syncConnection();

    const interval = setInterval(() => {
      const token = getAccessToken();
      if (token !== connectingForToken.current) {
        void syncConnection();
      }
    }, 1000);

    return () => {
      disposed = true;
      clearInterval(interval);
      clearTimeout(retryTimer);
      unsubscribe?.();
      instance?.stop();
    };
  }, []);

  const value = useMemo(
    () => ({ client, status, enabled, error }),
    [client, status, enabled, error],
  );

  return <MatrixContext value={value}>{children}</MatrixContext>;
}

export function useMatrix(): MatrixContextValue {
  const context = use(MatrixContext);
  if (!context) {
    throw new Error('useMatrix must be used within a <MatrixProvider>.');
  }
  return context;
}

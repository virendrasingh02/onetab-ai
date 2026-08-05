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

    async function syncConnection() {
      try {
        const config = await matrixApi.config();

        if (!config.enabled || disposed) {
          setEnabled(false);
          return;
        }
        setEnabled(true);

        const token = getAccessToken();
        if (!token) {
          if (instance) {
            instance.stop();
            instance = null;
            setClient(null);
            setStatus({ state: 'disconnected' });
          }
          connectingForToken.current = null;
          return;
        }

        if (connectingForToken.current === token) return;
        connectingForToken.current = token;

        const session = await matrixApi.session();
        if (disposed) return;

        instance = createMatrixClient({
          homeserverUrl: session.homeserverUrl,
          enableEncryption: true,
        });

        unsubscribe = instance.on((event: MatrixClientEvent) => {
          if (event.type === 'connection') setStatus(event.status);
        });

        await instance.loginWithToken(session.loginToken);
        if (!disposed) setClient(instance);
      } catch (caught) {
        if (!disposed) {
          setEnabled(false);
          setError(
            caught instanceof Error
              ? caught.message
              : 'Could not connect to chat.',
          );
          setStatus({ state: 'error' });
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

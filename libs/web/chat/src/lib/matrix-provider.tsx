import { getAccessToken, matrixApi } from '@org/api-client';
import {
  createMatrixClient,
  MatrixError,
  type ConnectionStatus,
  type MatrixClientEvent,
  type OneTabMatrixClient,
} from '@org/matrix-client';
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

/**
 * 'checking' is the async gap between mount and the homeserver config coming
 * back — distinct from 'disabled' so a caller rendering a terminal "chat is
 * not configured" empty state can tell "confirmed off" from "not sure yet"
 * and wait through the latter instead of flashing the former on every load.
 *
 * 'disabled' is only ever the API's own answer (`enabled: false`). A request
 * that failed — API restarting, network blip, homeserver slow to answer — says
 * nothing about whether the deployment has chat, so it surfaces as `error`
 * with an automatic retry, never as "not configured".
 */
export type MatrixConfigStatus = 'checking' | 'enabled' | 'disabled';

interface MatrixContextValue {
  client: OneTabMatrixClient | null;
  status: ConnectionStatus;
  /** Shorthand for `configStatus === 'enabled'`. */
  enabled: boolean;
  configStatus: MatrixConfigStatus;
  /**
   * Why the last connection attempt failed. Cleared once connected. A retry
   * is always already scheduled while this is set.
   */
  error: string | null;
  /** Retries a failed connection now instead of waiting out the backoff. */
  retry: () => void;
}

const MatrixContext = createContext<MatrixContextValue | null>(null);

/** Backoff between failed attempts: 2 s, 4 s, 8 s … capped at 30 s. */
const MAX_RETRY_DELAY_MS = 30_000;

/** How often the API session is checked for a sign-in / sign-out / switch. */
const IDENTITY_POLL_MS = 1000;

/**
 * Who an API access token belongs to — its JWT `sub`.
 *
 * The Matrix session is bound to the *user*, not to a particular API token:
 * the access token rotates every few minutes, and reconnecting Matrix on each
 * rotation is what used to churn the client (and, when one of those needless
 * reconnects hit a blip, knock chat over). Only a real change of user — sign
 * in, sign out, account switch — should touch the connection.
 */
function sessionIdentity(token: string): string {
  try {
    const payload = token.split('.')[1] ?? '';
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const sub = (JSON.parse(json) as { sub?: unknown }).sub;
    if (typeof sub === 'string' && sub) return sub;
  } catch {
    // Not a JWT — fall through to the token itself.
  }
  return token;
}

/** A sentence, so callers can append their own ("… Retrying automatically"). */
function describeFailure(caught: unknown): string {
  const message = caught instanceof Error ? caught.message.trim() : '';
  if (!message) return 'Could not connect to chat.';
  return /[.!?…]$/.test(message) ? message : `${message}.`;
}

/** Thrown inside `connect()` to unwind an attempt a newer one replaced. */
class SupersededAttempt extends Error {}

/**
 * Owns the Matrix connection for the application.
 *
 * The browser never holds Matrix credentials of its own: it asks our API for a
 * session and adopts it here. Three rules keep that connection dependable:
 *
 * - **One live client.** A client is stopped before its replacement starts,
 *   and an attempt that was overtaken (the user changed mid-connect) discards
 *   whatever it built instead of publishing it.
 * - **Reconnect on identity, not on token.** See {@link sessionIdentity}.
 * - **Failures retry; they don't disable.** Anything short of the API saying
 *   `enabled: false` is transient: it is reported through `error`, retried
 *   with backoff, and retried immediately when the browser comes back online
 *   or the caller asks via `retry()`.
 */
export function MatrixProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<OneTabMatrixClient | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>({
    state: 'disconnected',
  });
  const [configStatus, setConfigStatus] =
    useState<MatrixConfigStatus>('checking');
  const [error, setError] = useState<string | null>(null);
  const retryNow = useRef<() => void>(() => undefined);

  useEffect(() => {
    let disposed = false;
    /** Bumped on every attempt; an attempt that sees it move was superseded. */
    let generation = 0;
    /** The user the connection is for, or `null` when signed out. */
    let identity: string | null = null;
    let live: { instance: OneTabMatrixClient; unsubscribe: () => void } | null =
      null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let failureCount = 0;
    /** A failed attempt is waiting on `retryTimer`. */
    let awaitingRetry = false;

    function stopLive() {
      if (!live) return;
      live.unsubscribe();
      live.instance.stop();
      live = null;
    }

    function scheduleRetry(retryAfterMs?: number) {
      failureCount += 1;
      const backoff = Math.min(1000 * 2 ** failureCount, MAX_RETRY_DELAY_MS);
      // Jitter, so every tab that lost the homeserver at once doesn't come
      // back in lockstep. A server-supplied `retry_after_ms` is a floor.
      const delay = Math.max(
        backoff * (0.75 + Math.random() * 0.5),
        retryAfterMs ?? 0,
      );
      awaitingRetry = true;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void connect(), delay);
    }

    /**
     * The homeserver dropped our token mid-session (device deleted, token
     * revoked). The API can mint a fresh one, so reconnect rather than strand
     * the user on a dead timeline until they reload.
     */
    function recoverExpired() {
      stopLive();
      setClient(null);
      setStatus({ state: 'reconnecting' });
      scheduleRetry();
    }

    async function connect() {
      const attempt = ++generation;
      const superseded = () => disposed || attempt !== generation;

      clearTimeout(retryTimer);
      awaitingRetry = false;
      stopLive();
      setClient(null);
      setStatus({ state: 'connecting' });

      let instance: OneTabMatrixClient | null = null;
      let unsubscribe: (() => void) | undefined;

      try {
        const config = await matrixApi.config();
        if (superseded()) return;

        if (!config.enabled || !config.homeserverUrl) {
          // The one definitive "no": the API itself says chat is off.
          setConfigStatus('disabled');
          setStatus({ state: 'disconnected' });
          setError(null);
          failureCount = 0;
          return;
        }
        setConfigStatus('enabled');

        const created = createMatrixClient({
          homeserverUrl: config.homeserverUrl,
          // The deployment decides: a homeserver that cannot hand out
          // device-bound sessions cannot do end-to-end encryption either.
          enableEncryption: config.encryption,
        });
        instance = created;

        unsubscribe = created.on((event: MatrixClientEvent) => {
          if (event.type !== 'connection' || superseded()) return;
          if (event.status.state === 'expired') {
            // Before this instance is live that is `restore()` finding a
            // stale stored session, which falls through to minting a new one
            // below — not something to show, let alone act on.
            if (live?.instance === created) recoverExpired();
            return;
          }
          if (event.status.state === 'connected') {
            // Reset here rather than when `connect()` resolves: a session
            // that starts and is then refused would otherwise reconnect in a
            // tight loop, each "success" wiping the backoff.
            failureCount = 0;
          }
          setStatus(event.status);
        });

        // Resuming the stored session keeps the browser on one Matrix device,
        // which is what makes its encryption keys — and therefore its history
        // in private channels — survive a reload. Without an identity to match
        // it against there is nothing to resume *safely*: a session left by
        // whoever used this browser last would be someone else's.
        const resumed = config.matrixUserId
          ? await created.restore(config.matrixUserId)
          : false;
        if (superseded()) throw new SupersededAttempt();

        if (!resumed) {
          const session = await matrixApi.session();
          if (superseded()) throw new SupersededAttempt();
          await created.adoptSession({
            userId: session.matrixUserId,
            accessToken: session.accessToken,
            deviceId: session.deviceId,
          });
          if (superseded()) throw new SupersededAttempt();
        }

        live = { instance: created, unsubscribe };
        setClient(created);
        setError(null);
        // A token refused between `startClient` returning and the line above
        // fired while this instance was not live yet, so the listener let it
        // pass; catch it here.
        const current = created.getConnectionStatus();
        if (current.state === 'expired') recoverExpired();
        else setStatus(current);
      } catch (caught) {
        unsubscribe?.();
        instance?.stop();
        if (superseded()) return;

        const message = describeFailure(caught);
        setError(message);
        setStatus({ state: 'error', error: message });
        scheduleRetry(
          caught instanceof MatrixError ? caught.retryAfterMs : undefined,
        );
      }
    }

    /** Reconnects only when the signed-in user actually changed. */
    function syncIdentity() {
      const token = getAccessToken();
      const next = token ? sessionIdentity(token) : null;
      if (next === identity) return;
      identity = next;

      generation += 1; // abandon any attempt made for the previous user
      clearTimeout(retryTimer);
      awaitingRetry = false;
      failureCount = 0;
      stopLive();
      setClient(null);
      setError(null);

      if (!next) {
        setStatus({ state: 'disconnected' });
        return;
      }
      void connect();
    }

    retryNow.current = () => {
      if (disposed || !identity || !awaitingRetry) return;
      failureCount = 0;
      void connect();
    };

    // Coming back online is the most common way a failed attempt heals; don't
    // make the user sit out the rest of a 30 s backoff for it.
    const onOnline = () => retryNow.current();

    syncIdentity();
    const interval = setInterval(syncIdentity, IDENTITY_POLL_MS);
    window.addEventListener('online', onOnline);

    return () => {
      disposed = true;
      clearInterval(interval);
      clearTimeout(retryTimer);
      window.removeEventListener('online', onOnline);
      retryNow.current = () => undefined;
      stopLive();
    };
  }, []);

  const retry = useCallback(() => retryNow.current(), []);

  const value = useMemo(
    () => ({
      client,
      status,
      enabled: configStatus === 'enabled',
      configStatus,
      error,
      retry,
    }),
    [client, status, configStatus, error, retry],
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

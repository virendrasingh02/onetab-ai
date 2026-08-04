import type { MatrixSession } from './types.js';

/**
 * Where a Matrix session is persisted between page loads.
 *
 * A Matrix access token is long-lived and, unlike our own JWT, cannot simply be
 * re-minted from a refresh cookie — losing it means re-verifying the device and
 * losing access to encrypted history on that device. It therefore has to be
 * persisted, which makes *where* a security decision rather than a detail.
 */
export interface SessionStore {
  load(): Promise<MatrixSession | null>;
  save(session: MatrixSession): Promise<void>;
  clear(): Promise<void>;
}

const STORAGE_KEY = 'onetab.matrix.session';

/**
 * Default store, backed by `localStorage`.
 *
 * This is the same trade-off Element makes: the crypto store already lives in
 * IndexedDB and is readable by any script on the origin, so keeping the token
 * in memory alone would buy little while breaking session restore. The real
 * mitigations are a strict CSP and keeping third-party scripts off this origin.
 *
 * Swap in a different implementation via `createMatrixClient({ sessionStore })`
 * if you have a more constrained requirement.
 */
export class LocalStorageSessionStore implements SessionStore {
  constructor(private readonly storageKey: string = STORAGE_KEY) {}

  async load(): Promise<MatrixSession | null> {
    try {
      const raw = globalThis.localStorage?.getItem(this.storageKey);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as MatrixSession;
      // A partially written record is worse than none — it produces confusing
      // 401s deep inside the SDK instead of a clean "signed out".
      if (!parsed.accessToken || !parsed.userId || !parsed.deviceId) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async save(session: MatrixSession): Promise<void> {
    try {
      globalThis.localStorage?.setItem(
        this.storageKey,
        JSON.stringify(session),
      );
    } catch {
      // Private mode or a full quota: the session still works for this tab.
    }
  }

  async clear(): Promise<void> {
    try {
      globalThis.localStorage?.removeItem(this.storageKey);
    } catch {
      // Nothing actionable.
    }
  }
}

/** In-memory store, for tests and for callers that refuse any persistence. */
export class MemorySessionStore implements SessionStore {
  private session: MatrixSession | null = null;

  async load(): Promise<MatrixSession | null> {
    return this.session;
  }

  async save(session: MatrixSession): Promise<void> {
    this.session = session;
  }

  async clear(): Promise<void> {
    this.session = null;
  }
}

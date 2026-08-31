import { ApiErrorCode, type ApiErrorBody, type AuthTokens } from '@org/types';
import axios, {
  type AxiosError,
  type AxiosInstance,
  type InternalAxiosRequestConfig,
} from 'axios';

/**
 * The access token, held in memory and mirrored to localStorage.
 *
 * The mirror is a cache, not an authority: a cold load still has to exchange
 * the refresh cookie at `/auth/refresh` before the session counts as real.
 */
let accessToken: string | null = null;

/** Called when refreshing fails — the app should route to /login. */
let onSessionExpired: (() => void) | null = null;

const TOKEN_KEY = 'onetab_auth_token';

export function setAccessToken(token: string | null): void {
  accessToken = token;
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // Storage can be blocked by policy; the in-memory copy still works.
  }
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return accessToken ?? readStoredToken();
}

/*
 * The refresh cookie is per-browser, not per-tab, and rotating it invalidates
 * the previous value. So a second tab holding the token this tab just replaced
 * would present a spent token, which the API reads as theft and answers by
 * revoking every session for the user. Adopting a sibling's token keeps the
 * tabs on one session instead of racing to rotate it.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY || event.storageArea !== localStorage) return;
    accessToken = event.newValue;
  });
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

/**
 * Thrown by a {@link RefreshTokenProvider} to mean "the API definitively
 * refused this refresh" — as opposed to a network hiccup, which should leave
 * the session alone and let the caller's own retry try again later.
 */
export class SessionRejectedError extends Error {}

/**
 * Overrides how a spent access token gets renewed.
 *
 * The default renews via the httpOnly refresh cookie, which only exists in a
 * browser that actually completed the cookie-setting login request. A desktop
 * session is established by the Electron main process's own `fetch` — a
 * separate network stack with no cookie jar shared with the renderer — so it
 * has no such cookie to send. The desktop shell registers a provider here
 * that instead asks the main process to refresh via the refresh token it
 * persisted to disk.
 */
type RefreshTokenProvider = () => Promise<string>;
let refreshTokenProvider: RefreshTokenProvider | null = null;

export function setRefreshTokenProvider(provider: RefreshTokenProvider | null): void {
  refreshTokenProvider = provider;
}

const configuredBaseURL =
  (import.meta.env?.['VITE_API_URL'] as string | undefined) ??
  'http://localhost:3000/api/v1';

let activeBaseURL = configuredBaseURL;
let baseURLResolution: Promise<string> | null = null;

function normalizeBaseURL(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function getLocalBaseURLCandidates(value: string): string[] {
  try {
    const url = new URL(value);
    const isLocalHost =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const port = Number(url.port);

    if (!isLocalHost || !Number.isInteger(port) || port < 3000 || port > 3009) {
      return [normalizeBaseURL(value)];
    }

    return Array.from({ length: 10 }, (_, index) => {
      const candidate = new URL(url);
      candidate.port = String(3000 + index);
      return normalizeBaseURL(candidate.toString());
    });
  } catch {
    return [normalizeBaseURL(value)];
  }
}

const localBaseURLCandidates = getLocalBaseURLCandidates(configuredBaseURL);

async function resolveBaseURL(): Promise<string> {
  if (localBaseURLCandidates.length === 1) {
    return activeBaseURL;
  }

  if (activeBaseURL !== configuredBaseURL) {
    return activeBaseURL;
  }

  baseURLResolution ??= (async () => {
    /**
     * Probe all candidate ports in parallel and take the first that responds.
     * This reduces worst-case wait from N×750 ms (sequential) to a single
     * 750 ms window regardless of how many ports are checked.
     */
    const winner = await Promise.any(
      localBaseURLCandidates.map((candidate) =>
        axios
          .get(`${candidate}/health`, {
            timeout: 750,
            withCredentials: false,
          })
          .then(() => candidate),
      ),
    ).catch(() => null);

    if (winner) {
      activeBaseURL = winner;
      http.defaults.baseURL = winner;
    } else {
      baseURLResolution = null;
    }

    return activeBaseURL;
  })();

  return baseURLResolution;
}

export const http: AxiosInstance = axios.create({
  baseURL: activeBaseURL,
  // Sends the httpOnly refresh cookie on /auth/* calls.
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  // 15 s keeps the session-bootstrap loading state short enough that users
  // aren't stuck staring at a spinner if the API is slow to start.
  timeout: 15_000,
});

/**
 * Turns an API-relative asset path into something an `<img>` can load.
 *
 * Some media URLs are stored relative (`/workspaces/:id/logo`) because the API
 * host is not fixed — it is configurable per environment and hops ports in
 * development. Absolute URLs and data URLs are already loadable and pass
 * straight through.
 */
export function resolveMediaUrl(
  url: string | null | undefined,
): string | undefined {
  if (!url) return undefined;
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  return `${activeBaseURL}${url.startsWith('/') ? '' : '/'}${url}`;
}

http.interceptors.request.use(async (config) => {
  config.baseURL = await resolveBaseURL();

  // A caller that set its own `Authorization` wins — the multi-account switcher
  // reads another account's data with that account's token, not the active one.
  if (accessToken && !config.headers.has('Authorization')) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

interface RetriableRequest extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

declare module 'axios' {
  interface AxiosRequestConfig {
    /**
     * Skip the shared 401 → refresh-and-retry. Set by a request made for a
     * *non-active* account: refreshing the active session and retrying with its
     * token would silently return the wrong identity's data.
     */
    skipAuthRefresh?: boolean;
  }
}

/**
 * Concurrent 401s must not each trigger their own refresh — that would rotate
 * the refresh token N times and invalidate the session. The first failure
 * starts a refresh; the rest await the same promise.
 */
let refreshInFlight: Promise<string> | null = null;

/**
 * Serialises the rotation across tabs, not just within this one.
 *
 * Web Locks is Chromium/Firefox/Safari 15.4+, which covers the browsers the app
 * supports and the Electron shell; where it is missing the callback still runs,
 * leaving the single-tab guarantee `refreshInFlight` already provides.
 */
async function withRefreshLock<T>(run: () => Promise<T>): Promise<T> {
  if (!navigator.locks) return run();
  return navigator.locks.request('onetab-auth-refresh', run);
}

async function refreshAccessToken(usedToken: string | null): Promise<string> {
  refreshInFlight ??= withRefreshLock(async () => {
    /*
     * Whoever held the lock before us may have already rotated the cookie. Its
     * token is the live one and ours is spent, so take theirs; rotating again
     * would present a revoked token and take down every session for the user.
     */
    const current = readStoredToken();
    if (current && current !== usedToken) {
      accessToken = current;
      return current;
    }

    if (refreshTokenProvider) {
      const token = await refreshTokenProvider();
      setAccessToken(token);
      return token;
    }

    const response = await axios.post<AuthTokens>(
      `${await resolveBaseURL()}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    setAccessToken(response.data.accessToken);
    return response.data.accessToken;
  }).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/**
 * Whether a failed refresh actually means the session is over.
 *
 * Only the API can retire a session. A timeout, an offline browser or a 502
 * from an API mid-restart says nothing about the refresh cookie, and treating
 * those as expiry is what signed people out for a blip in the network.
 */
function isSessionRejection(error: unknown): boolean {
  if (error instanceof SessionRejectedError) return true;
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  return status === 401 || status === 403;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const request = error.config as RetriableRequest | undefined;
    const status = error.response?.status;

    const isAuthEndpoint = request?.url?.includes('/auth/');
    const canRetry =
      !!request &&
      !request._retried &&
      !isAuthEndpoint &&
      !request.skipAuthRefresh;

    if (status === 401 && canRetry) {
      request._retried = true;

      // The token this request actually carried, which may already be a
      // generation behind if another tab refreshed while it was in flight.
      const sent = request.headers.get?.('Authorization');
      const usedToken =
        typeof sent === 'string' ? sent.replace(/^Bearer /, '') : null;

      try {
        const token = await refreshAccessToken(usedToken);
        request.headers.set('Authorization', `Bearer ${token}`);
        return http(request);
      } catch (refreshError) {
        /*
         * Sign out only when the API refused the cookie. Anything else — no
         * network, a timeout, an API restarting under the dev server — leaves
         * the session untouched, so the caller sees the original failure and
         * the next request tries again with the same cookie.
         */
        if (isSessionRejection(refreshError)) {
          setAccessToken(null);
          onSessionExpired?.();
        }
      }
    }

    return Promise.reject(error);
  },
);

/** Normalised error surfaced to UI code. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = body.statusCode;
    this.code = body.code;
    this.fieldErrors = body.errors;
  }
}

/**
 * Converts an axios failure into an `ApiError`.
 *
 * Network failures have no response body, so they get a synthetic INTERNAL
 * error rather than leaking `undefined` into the UI.
 */
export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    if (error.response?.data?.code) {
      return new ApiError(error.response.data);
    }
    return new ApiError({
      statusCode: error.response?.status ?? 0,
      code: ApiErrorCode.INTERNAL,
      message:
        error.code === 'ECONNABORTED'
          ? 'The request timed out. Please try again.'
          : 'Could not reach the server. Check your connection.',
      path: error.config?.url ?? '',
      timestamp: new Date().toISOString(),
    });
  }

  return new ApiError({
    statusCode: 0,
    code: ApiErrorCode.INTERNAL,
    message: error instanceof Error ? error.message : 'Something went wrong.',
    path: '',
    timestamp: new Date().toISOString(),
  });
}

/** Unwraps `response.data` and rethrows failures as `ApiError`. */
export async function request<T>(promise: Promise<{ data: T }>): Promise<T> {
  try {
    return (await promise).data;
  } catch (error) {
    throw toApiError(error);
  }
}

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

export function setAccessToken(token: string | null): void {
  accessToken = token;
  try {
    if (token) {
      localStorage.setItem('onetab_auth_token', token);
    } else {
      localStorage.removeItem('onetab_auth_token');
    }
  } catch {
    // Storage can be blocked by policy; the in-memory copy still works.
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  try {
    return localStorage.getItem('onetab_auth_token');
  } catch {
    return null;
  }
}

export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
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

http.interceptors.request.use(async (config) => {
  config.baseURL = await resolveBaseURL();

  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

interface RetriableRequest extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

/**
 * Concurrent 401s must not each trigger their own refresh — that would rotate
 * the refresh token N times and invalidate the session. The first failure
 * starts a refresh; the rest await the same promise.
 */
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  refreshInFlight ??= axios
    .post<AuthTokens>(
      `${await resolveBaseURL()}/auth/refresh`,
      {},
      { withCredentials: true },
    )
    .then((response) => {
      setAccessToken(response.data.accessToken);
      return response.data.accessToken;
    })
    .finally(() => {
      refreshInFlight = null;
    });

  return refreshInFlight;
}

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const request = error.config as RetriableRequest | undefined;
    const status = error.response?.status;

    const isAuthEndpoint = request?.url?.includes('/auth/');
    const canRetry = !!request && !request._retried && !isAuthEndpoint;

    if (status === 401 && canRetry) {
      request._retried = true;
      try {
        const token = await refreshAccessToken();
        request.headers.set('Authorization', `Bearer ${token}`);
        return http(request);
      } catch {
        setAccessToken(null);
        onSessionExpired?.();
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

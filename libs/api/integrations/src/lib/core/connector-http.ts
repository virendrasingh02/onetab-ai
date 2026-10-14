import axios, { type AxiosRequestConfig } from 'axios';

/**
 * One HTTP client for connector adapters: a timeout, bounded retries and
 * errors that name the app without ever echoing a request header or token.
 *
 * Retries are limited to what is safe. A rate-limited request (429) was
 * refused, so any method may repeat it after the delay the app asks for.
 * Server errors and dropped connections are only repeated for reads and
 * idempotent writes — a POST that may have landed is never sent twice.
 */
export interface ConnectorHttpRequest {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  data?: unknown;
  auth?: { username: string; password: string };
  timeoutMs?: number;
  /** Extra attempts after the first. Default 2. */
  retries?: number;
  httpAgent?: unknown;
  httpsAgent?: unknown;
}

export interface ConnectorHttpResponse<T = any> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

export class ConnectorHttpError extends Error {
  constructor(
    message: string,
    readonly status: number | undefined,
    readonly retryable: boolean,
    /** The app's own error code (Meta's `error.code`, Shopify's `code`…), when it sent one. */
    readonly providerCode?: number | string,
  ) {
    super(message);
    this.name = 'ConnectorHttpError';
  }
}

const IDEMPOTENT = new Set(['GET', 'HEAD', 'PUT', 'DELETE']);
const MAX_RETRY_WAIT_MS = 10_000;

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Seconds (or an HTTP date) from a `Retry-After` header, as milliseconds. */
export function retryAfterMs(value: unknown, now = Date.now()): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(String(value));
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

/** What the app said went wrong, reduced to one safe line. */
export function describeApiError(data: unknown, fallback: string): string {
  if (typeof data === 'string' && data.trim()) return data.trim().slice(0, 300);
  if (data && typeof data === 'object') {
    const d = data as Record<string, any>;
    const candidate =
      d['error']?.message ?? d['message'] ?? d['errors'] ?? d['error_description'] ?? d['error'];
    if (typeof candidate === 'string') return candidate.slice(0, 300);
    if (candidate && typeof candidate === 'object') return JSON.stringify(candidate).slice(0, 300);
  }
  return fallback;
}

export async function connectorRequest<T = any>(
  app: string,
  req: ConnectorHttpRequest,
  wait: (ms: number) => Promise<void> = sleep,
): Promise<ConnectorHttpResponse<T>> {
  const maxRetries = Math.max(0, Math.min(req.retries ?? 2, 4));
  let attempt = 0;
  for (;;) {
    try {
      const config: AxiosRequestConfig = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        params: req.params,
        data: req.data,
        auth: req.auth,
        timeout: req.timeoutMs ?? 15_000,
        maxRedirects: 0,
        validateStatus: () => true,
        ...(req.httpAgent ? { httpAgent: req.httpAgent } : {}),
        ...(req.httpsAgent ? { httpsAgent: req.httpsAgent } : {}),
      };
      const res = await axios.request(config);
      if (res.status >= 200 && res.status < 300) {
        return { status: res.status, data: res.data as T, headers: (res.headers ?? {}) as Record<string, string> };
      }
      const retryable = res.status === 429 || (res.status >= 500 && IDEMPOTENT.has(req.method));
      if (retryable && attempt < maxRetries) {
        const asked = res.status === 429 ? retryAfterMs((res.headers as any)?.['retry-after']) : undefined;
        await wait(Math.min(asked ?? 500 * 2 ** attempt, MAX_RETRY_WAIT_MS));
        attempt += 1;
        continue;
      }
      throw new ConnectorHttpError(
        statusMessage(app, res.status, describeApiError(res.data, `HTTP ${res.status}`)),
        res.status,
        retryable,
        providerErrorCode(res.data),
      );
    } catch (error) {
      if (error instanceof ConnectorHttpError) throw error;
      const code = (error as { code?: string }).code;
      const transient = IDEMPOTENT.has(req.method) && attempt < maxRetries;
      if (transient) {
        await wait(Math.min(500 * 2 ** attempt, MAX_RETRY_WAIT_MS));
        attempt += 1;
        continue;
      }
      const reason = code === 'ECONNABORTED' ? 'timed out' : code ? `couldn’t be reached (${code})` : 'couldn’t be reached';
      throw new ConnectorHttpError(`${app} ${reason}.`, undefined, true);
    }
  }
}

function providerErrorCode(data: unknown): number | string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const d = data as Record<string, any>;
  const code = d['error']?.code ?? d['code'];
  return typeof code === 'number' || typeof code === 'string' ? code : undefined;
}

function statusMessage(app: string, status: number, detail: string): string {
  if (status === 401) return `${app} rejected the credentials — they may have been revoked. Reconnect ${app}. (${detail})`;
  if (status === 403) return `${app} refused this request: the connection doesn’t have permission for it. (${detail})`;
  if (status === 404) return `${app} couldn’t find that. (${detail})`;
  if (status === 429) return `${app} is rate limiting requests. Try again shortly.`;
  return `${app} error ${status}: ${detail}`;
}

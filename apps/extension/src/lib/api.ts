import type { ChannelSummary, CurrentUser, WorkspaceSummary } from '@org/types';
import { createPinSchema, type CreatePinInput } from '@org/validation';

/**
 * The extension's client for our API.
 *
 * Deliberately not `@org/api-client`: that module is axios-based and keeps the
 * access token in a module-level variable backed by `localStorage`, neither of
 * which survives in a service worker that the browser stops and restarts
 * between events. The endpoints and the request/response shapes are still the
 * shared ones, so the contract cannot drift — only the transport differs.
 */

const DEFAULT_BASE_URL = 'http://localhost:3000/api/v1';
const BASE_URL_KEY = 'onetab.api.baseUrl';

export class ExtensionApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ExtensionApiError';
    this.status = status;
  }
}

/**
 * Finds the API.
 *
 * The dev API walks forward from port 3000 when the port is taken, so a
 * hard-coded URL breaks as soon as anything else holds 3000. This probes the
 * same 3000–3009 window the web client does and caches the winner, so the cost
 * is paid once per worker lifetime rather than per request.
 */
async function probeBaseUrl(): Promise<string> {
  const candidates = Array.from(
    { length: 10 },
    (_, index) => `http://localhost:${3000 + index}/api/v1`,
  );

  const attempts = candidates.map(async (candidate) => {
    const response = await fetch(`${candidate}/health`, {
      signal: AbortSignal.timeout(1500),
    });
    if (!response.ok) throw new Error('unhealthy');
    return candidate;
  });

  try {
    return await Promise.any(attempts);
  } catch {
    return DEFAULT_BASE_URL;
  }
}

let baseUrlPromise: Promise<string> | null = null;

export async function getBaseUrl(): Promise<string> {
  baseUrlPromise ??= (async () => {
    const stored = await chrome.storage.local.get(BASE_URL_KEY);
    const cached = stored[BASE_URL_KEY] as string | undefined;

    // Trust the cache only if it still answers; the API may have moved ports
    // since it was written.
    if (cached) {
      try {
        const response = await fetch(`${cached}/health`, {
          signal: AbortSignal.timeout(1500),
        });
        if (response.ok) return cached;
      } catch {
        // Fall through to a fresh probe.
      }
    }

    const found = await probeBaseUrl();
    await chrome.storage.local.set({ [BASE_URL_KEY]: found });
    return found;
  })().catch(() => DEFAULT_BASE_URL);

  return baseUrlPromise;
}

/** Forgets the cached API address, so the next call probes again. */
export function resetBaseUrl(): void {
  baseUrlPromise = null;
  void chrome.storage.local.remove(BASE_URL_KEY);
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  token: string | null;
}

async function apiRequest<T>(
  path: string,
  { method = 'GET', body, token }: RequestOptions,
): Promise<T> {
  const baseUrl = await getBaseUrl();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    // A cached base URL that has gone stale looks exactly like the API being
    // down. Drop it so the next attempt re-probes instead of failing forever.
    resetBaseUrl();
    throw new ExtensionApiError(
      error instanceof DOMException && error.name === 'TimeoutError'
        ? 'The request timed out.'
        : 'Could not reach OneTab AI. Is the API running?',
      0,
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new ExtensionApiError(
      typeof payload?.message === 'string'
        ? payload.message
        : `Request failed (${response.status}).`,
      response.status,
    );
  }

  return payload as T;
}

export const api = {
  me: (token: string | null) => apiRequest<CurrentUser>('/auth/me', { token }),

  workspaces: (token: string | null) =>
    apiRequest<WorkspaceSummary[]>('/workspaces', { token }),

  channels: (token: string | null, workspaceId: string) =>
    apiRequest<ChannelSummary[]>(`/workspaces/${workspaceId}/channels`, {
      token,
    }),

  /**
   * Saves a page as a channel pin.
   *
   * Validated with the same schema the API validates against, so a page with a
   * 300-character title is rejected here with a usable message instead of
   * coming back as a 400 from the server.
   */
  createPin: (
    token: string | null,
    workspaceId: string,
    channelId: string,
    input: CreatePinInput,
  ) => {
    const parsed = createPinSchema.safeParse(input);
    if (!parsed.success) {
      throw new ExtensionApiError(
        parsed.error.issues[0]?.message ?? 'That page cannot be saved.',
        400,
      );
    }
    return apiRequest<{ id: string }>(
      `/workspaces/${workspaceId}/channels/${channelId}/pins`,
      { method: 'POST', body: parsed.data, token },
    );
  },

  /**
   * Answers a prompt. The API routes this to Ollama when it is reachable and
   * falls back to a canned reply otherwise, so the call is meaningful with or
   * without `npm run infra:start`.
   */
  chat: (
    token: string | null,
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  ) =>
    apiRequest<{ message: { role: string; content: string } }>('/ai/chat', {
      method: 'POST',
      body: { messages },
      token,
    }),

  summarize: (token: string | null, text: string) =>
    apiRequest<{ summary: string }>('/ai/summarize', {
      method: 'POST',
      body: { text },
      token,
    }),
};

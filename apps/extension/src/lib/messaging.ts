/**
 * The message protocol between the popup, the background worker and the
 * content scripts.
 *
 * Extension contexts can only exchange structured-cloneable values over
 * `chrome.runtime.sendMessage`, which is untyped at runtime. Modelling every
 * message as one discriminated union means a new message cannot be added on
 * one side and forgotten on the other — `handleMessage` below stops compiling.
 */

/** The web app origins the session bridge is allowed to read a token from. */
export const APP_ORIGINS = [
  'http://localhost:4200',
  'http://localhost:4201',
] as const;

export interface SessionState {
  accessToken: string | null;
  /** The origin the token came from, so the popup can link back to it. */
  origin: string | null;
  /** Epoch ms the token was observed; used to expire a stale cache. */
  observedAt: number | null;
}

export interface CapturedPage {
  url: string;
  title: string;
  /** The current selection, or the page's readable text when nothing is selected. */
  text: string;
  /** True when `text` came from a selection rather than the whole page. */
  fromSelection: boolean;
}

/** Popup/content → background. */
export type ExtensionRequest =
  | { type: 'session:get' }
  | { type: 'session:refresh' }
  | { type: 'session:set'; token: string | null; origin: string }
  | { type: 'page:capture' }
  | { type: 'ai:ask'; prompt: string; context?: string }
  | { type: 'ai:summarize'; text: string }
  | { type: 'workspaces:list' }
  | { type: 'channels:list'; workspaceId: string }
  | {
      type: 'capture:save';
      // Pins are addressed by workspace *and* channel, matching
      // `POST /workspaces/:workspaceId/channels/:channelId/pins`.
      workspaceId: string;
      channelId: string;
      page: CapturedPage;
      note?: string;
    };

/** Background → content script. */
export type ContentRequest =
  { type: 'content:read-session' } | { type: 'content:capture' };

/**
 * Every response is wrapped rather than thrown.
 *
 * An exception inside a `chrome.runtime.onMessage` handler is swallowed by the
 * runtime and surfaces to the caller as `undefined` with the real reason only
 * in `chrome.runtime.lastError`. Returning the failure as a value keeps it.
 */
export type Result<T> =
  { ok: true; data: T } | { ok: false; error: string; status?: number };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(error: string, status?: number): Result<never> {
  return { ok: false, error, status };
}

/** Sends a typed request to the background worker. */
export function sendToBackground<T>(
  message: ExtensionRequest,
): Promise<Result<T>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response: Result<T> | undefined) => {
      if (chrome.runtime.lastError) {
        resolve(err(chrome.runtime.lastError.message ?? 'Extension error.'));
        return;
      }
      resolve(response ?? err('The background worker did not respond.'));
    });
  });
}

/** Sends a typed request to a tab's content script. */
export function sendToTab<T>(
  tabId: number,
  message: ContentRequest,
): Promise<Result<T>> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      message,
      (response: Result<T> | undefined) => {
        if (chrome.runtime.lastError) {
          // The usual cause is no content script in that tab (a chrome:// page,
          // the web store, or a tab that loaded before the extension did).
          resolve(
            err(chrome.runtime.lastError.message ?? 'No content script.'),
          );
          return;
        }
        resolve(response ?? err('The page did not respond.'));
      },
    );
  });
}

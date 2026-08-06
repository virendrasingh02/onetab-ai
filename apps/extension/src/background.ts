import { api, ExtensionApiError, resetBaseUrl } from './lib/api.js';
import {
  APP_ORIGINS,
  err,
  ok,
  sendToTab,
  type CapturedPage,
  type ExtensionRequest,
  type Result,
  type SessionState,
} from './lib/messaging.js';

/**
 * The extension's only privileged context.
 *
 * The popup is destroyed every time it closes and content scripts are confined
 * to their page, so all network access and all token handling happen here. The
 * popup asks; this answers.
 */

const SESSION_KEY = 'onetab.session';
/** A cached token older than this is re-read from the app rather than trusted. */
const SESSION_MAX_AGE_MS = 10 * 60 * 1000;

const EMPTY_SESSION: SessionState = {
  accessToken: null,
  origin: null,
  observedAt: null,
};

async function readCachedSession(): Promise<SessionState> {
  // `storage.session` is memory-backed and cleared when the browser closes,
  // which is the right lifetime for an access token — `storage.local` would
  // write it to disk.
  const stored = await chrome.storage.session.get(SESSION_KEY);
  return (stored[SESSION_KEY] as SessionState | undefined) ?? EMPTY_SESSION;
}

async function writeCachedSession(session: SessionState): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: session });
  // The toolbar badge is the only signal the user gets while the popup is
  // closed, so it tracks whether we currently hold a usable token.
  await chrome.action.setBadgeText({ text: session.accessToken ? '' : '!' });
  await chrome.action.setBadgeBackgroundColor({ color: '#6E56CF' });
}

/**
 * Reads the access token out of an open OneTab AI tab.
 *
 * The web app persists it under `onetab_auth_token`, and it refreshes that
 * value on its own schedule. Borrowing it means the extension inherits the
 * app's session — one sign-in, one refresh flow, no second credential store —
 * and it is why the extension needs no login screen of its own.
 */
async function readSessionFromApp(): Promise<SessionState> {
  const tabs = await chrome.tabs.query({
    url: APP_ORIGINS.map((o) => `${o}/*`),
  });

  for (const tab of tabs) {
    if (tab.id === undefined) continue;

    const response = await sendToTab<{ token: string | null }>(tab.id, {
      type: 'content:read-session',
    });

    if (response.ok && response.data.token) {
      return {
        accessToken: response.data.token,
        origin: new URL(tab.url ?? APP_ORIGINS[0]).origin,
        observedAt: Date.now(),
      };
    }
  }

  return EMPTY_SESSION;
}

/**
 * Returns a usable token, refreshing from the app when the cache is empty or
 * stale. Access tokens are short-lived, so a cached one is only trusted for a
 * few minutes before being re-read.
 */
async function getSession(force = false): Promise<SessionState> {
  const cached = await readCachedSession();
  const fresh =
    cached.accessToken !== null &&
    cached.observedAt !== null &&
    Date.now() - cached.observedAt < SESSION_MAX_AGE_MS;

  if (!force && fresh) return cached;

  const found = await readSessionFromApp();
  // Keep a stale token rather than dropping to signed-out when no app tab is
  // open: it may still be valid, and a 401 will correct us.
  const next = found.accessToken ? found : cached;
  await writeCachedSession(next);
  return next;
}

/**
 * Runs an API call, retrying once against a freshly-read token on 401.
 *
 * The token is borrowed, so it can expire between the popup opening and the
 * user pressing a button. One forced re-read turns that into a transparent
 * retry instead of an error the user has to understand.
 */
async function withToken<T>(
  call: (token: string | null) => Promise<T>,
): Promise<Result<T>> {
  const session = await getSession();

  if (!session.accessToken) {
    return err('Sign in to OneTab AI in your browser first.', 401);
  }

  try {
    return ok(await call(session.accessToken));
  } catch (error) {
    if (error instanceof ExtensionApiError && error.status === 401) {
      const refreshed = await getSession(true);
      if (
        refreshed.accessToken &&
        refreshed.accessToken !== session.accessToken
      ) {
        try {
          return ok(await call(refreshed.accessToken));
        } catch (retryError) {
          return err(describe(retryError), statusOf(retryError));
        }
      }
      await writeCachedSession(EMPTY_SESSION);
      return err('Your session expired. Sign in again in your browser.', 401);
    }
    return err(describe(error), statusOf(error));
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

function statusOf(error: unknown): number | undefined {
  return error instanceof ExtensionApiError ? error.status : undefined;
}

/** Asks the active tab's content script for its URL, title and text. */
async function capturePage(): Promise<Result<CapturedPage>> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !tab.url) {
    return err('No page to capture.');
  }
  if (!/^https?:/.test(tab.url)) {
    // Content scripts are not injected into chrome://, the web store, or
    // file:// pages, so there is nothing to ask.
    return err('This page cannot be captured.');
  }

  const response = await sendToTab<CapturedPage>(tab.id, {
    type: 'content:capture',
  });

  if (response.ok) return response;

  // The content script may not be there if the tab predates the extension
  // being installed or reloaded. Fall back to what the tab itself reports.
  return ok({
    url: tab.url,
    title: tab.title ?? tab.url,
    text: '',
    fromSelection: false,
  });
}

async function handle(message: ExtensionRequest): Promise<Result<unknown>> {
  switch (message.type) {
    case 'session:get':
      return ok(await getSession());

    case 'session:refresh':
      resetBaseUrl();
      return ok(await getSession(true));

    case 'session:set': {
      const next: SessionState = message.token
        ? {
            accessToken: message.token,
            origin: message.origin,
            observedAt: Date.now(),
          }
        : EMPTY_SESSION;
      await writeCachedSession(next);
      return ok(next);
    }

    case 'page:capture':
      return capturePage();

    case 'workspaces:list':
      return withToken((token) => api.workspaces(token));

    case 'channels:list':
      return withToken((token) => api.channels(token, message.workspaceId));

    case 'capture:save':
      return withToken((token) =>
        api.createPin(token, message.workspaceId, message.channelId, {
          // Pin titles cap at 160 characters; page titles regularly exceed it.
          title: message.page.title.slice(0, 160) || message.page.url,
          url: message.page.url,
          note: (message.note ?? '').slice(0, 500),
        }),
      );

    case 'ai:ask':
      return withToken(async (token) => {
        const response = await api.chat(token, [
          ...(message.context
            ? [
                {
                  role: 'system' as const,
                  content: `The user is reading this page. Use it as context.\n\n${message.context.slice(0, 4000)}`,
                },
              ]
            : []),
          { role: 'user' as const, content: message.prompt },
        ]);
        return response.message.content;
      });

    case 'ai:summarize':
      return withToken(async (token) => {
        const response = await api.summarize(token, message.text);
        return response.summary;
      });

    default: {
      // Exhaustiveness: adding a request without a case fails to compile.
      const unreachable: never = message;
      return err(`Unknown request: ${JSON.stringify(unreachable)}`);
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message: ExtensionRequest, _sender, respond) => {
    // `handle` is async, so the channel has to be held open by returning true —
    // without it the caller receives `undefined` before the work finishes.
    handle(message)
      .then(respond)
      .catch((error: unknown) => respond(err(describe(error))));
    return true;
  },
);

// --- Context menu ------------------------------------------------------------
//
// Registered on install rather than on every worker start: the worker is
// restarted constantly, and `create` throws on a duplicate id.
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'onetab-ask-ai',
    title: 'Ask OneTab AI about "%s"',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'onetab-save-page',
    title: 'Save this page to OneTab AI',
    contexts: ['page'],
  });
  void writeCachedSession(EMPTY_SESSION);
});

chrome.contextMenus.onClicked.addListener((info) => {
  // The popup cannot be opened programmatically with a payload, so the
  // selection is parked in storage and picked up when the popup mounts.
  if (info.menuItemId === 'onetab-ask-ai' && info.selectionText) {
    void chrome.storage.session
      .set({ 'onetab.pendingPrompt': info.selectionText })
      .then(() => chrome.action.openPopup().catch(() => undefined));
  }
  if (info.menuItemId === 'onetab-save-page') {
    void chrome.storage.session
      .set({ 'onetab.pendingCapture': true })
      .then(() => chrome.action.openPopup().catch(() => undefined));
  }
});

// Keyboard shortcut declared in the manifest under `commands`.
chrome.commands?.onCommand.addListener((command) => {
  if (command === 'open-popup') {
    void chrome.action.openPopup().catch(() => undefined);
  }
});

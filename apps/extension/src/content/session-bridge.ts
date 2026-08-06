/**
 * Runs only on OneTab AI's own origins.
 *
 * Its whole job is to hand the extension the access token the web app already
 * holds, so the extension inherits the app's session instead of asking the user
 * to sign in a second time. Nothing is read from any other site — the manifest
 * restricts this script to the app origins, and it reads exactly one key.
 */
import { ok, type ContentRequest, type Result } from '../lib/messaging.js';

/** The key `@org/api-client` persists the access token under. */
const TOKEN_KEY = 'onetab_auth_token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Storage can be blocked by policy; treat that as signed out.
    return null;
  }
}

function publish(): void {
  // The worker may be asleep, in which case this resolves to an error we do
  // not care about — it will pull the token itself when it next needs one.
  chrome.runtime
    .sendMessage({
      type: 'session:set',
      token: readToken(),
      origin: location.origin,
    })
    .catch(() => undefined);
}

chrome.runtime.onMessage.addListener(
  (message: ContentRequest, _sender, respond: (r: Result<unknown>) => void) => {
    if (message.type === 'content:read-session') {
      respond(ok({ token: readToken() }));
    }
    return true;
  },
);

// Push the token up front so the popup is ready before it is opened.
publish();

/**
 * `storage` only fires for changes made in *other* tabs, so it catches a sign
 * in or out elsewhere but not one in this tab. The interval covers this tab's
 * own token rotation, which the app performs roughly every fifteen minutes.
 */
window.addEventListener('storage', (event) => {
  if (event.key === TOKEN_KEY) publish();
});

let lastSeen = readToken();
setInterval(() => {
  const current = readToken();
  if (current !== lastSeen) {
    lastSeen = current;
    publish();
  }
}, 5000);

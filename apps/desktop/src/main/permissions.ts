import { session, systemPreferences } from 'electron';
import { logger } from './logger.js';

/** Permissions the app's own pages may use with no further question. */
const BASE_PERMISSIONS = new Set(['notifications', 'clipboard-sanitized-write', 'fullscreen']);

/**
 * `media` is `getUserMedia` — voice messages, huddles and calls. `speaker-selection`
 * is `setSinkId`, which the call device picker uses. `display-capture` is
 * `getDisplayMedia` (screen share): this is only the gate, the person still
 * has to pick what to share in the picker `display-media.ts` shows. None of
 * them is ever shown a Chromium prompt in Electron, so denying them here is the
 * same as the feature not existing (the voice recorder reads `denied` and
 * disables itself).
 */
const MEDIA_PERMISSIONS = new Set(['media', 'speaker-selection', 'display-capture']);

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export interface PermissionContext {
  /** The page the request belongs to. */
  topLevelUrl: string;
  /** The frame that asked — the page itself, or an iframe inside it. */
  requestingUrl: string;
}

/**
 * Base permissions need the *asking* frame to be the app. Media is judged on the
 * page instead: Element Call is a cross-origin iframe the app embeds on purpose,
 * and Chromium's permissions policy already stops any frame the app did not
 * delegate `allow="microphone"` to from asking at all.
 */
export function isPermissionAllowed(
  permission: string,
  { topLevelUrl, requestingUrl }: PermissionContext,
  appOrigin: string,
): boolean {
  const app = originOf(appOrigin);
  if (!app) return false;
  if (BASE_PERMISSIONS.has(permission)) return originOf(requestingUrl) === app;
  if (MEDIA_PERMISSIONS.has(permission)) return originOf(topLevelUrl) === app;
  return false;
}

type MediaKind = 'microphone' | 'camera';

function kindsFor(mediaTypes: readonly string[] | undefined): MediaKind[] {
  const kinds: MediaKind[] = [];
  if (!mediaTypes || mediaTypes.includes('audio')) kinds.push('microphone');
  if (mediaTypes?.includes('video')) kinds.push('camera');
  return kinds;
}

/**
 * macOS gates the microphone and camera behind its own consent sheet, and
 * `getUserMedia` fails without ever showing it unless the app asks first.
 * Windows and Linux have no per-app prompt here, so they pass straight through.
 */
export async function ensureOsMediaAccess(
  mediaTypes: readonly string[] | undefined,
): Promise<boolean> {
  if (process.platform !== 'darwin') return true;

  for (const kind of kindsFor(mediaTypes)) {
    const status = systemPreferences.getMediaAccessStatus(kind);
    if (status === 'granted') continue;
    if (status === 'not-determined' && (await systemPreferences.askForMediaAccess(kind))) continue;
    logger.warn('Permissions', `The OS has not granted ${kind} access to Onetab AI (${status}).`);
    return false;
  }
  return true;
}

/** Default-deny, same-origin only: the single place a renderer permission is decided. */
export function applySessionPolicy(appOrigin: string): void {
  const { defaultSession } = session;

  defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    const topLevelUrl = contents.getURL();
    const requestingUrl = (details as { requestingUrl?: string } | undefined)?.requestingUrl || topLevelUrl;
    if (!isPermissionAllowed(permission, { topLevelUrl, requestingUrl }, appOrigin)) {
      callback(false);
      return;
    }
    if (permission !== 'media') {
      callback(true);
      return;
    }
    const mediaTypes = (details as { mediaTypes?: string[] } | undefined)?.mediaTypes;
    void ensureOsMediaAccess(mediaTypes).then(callback, () => callback(false));
  });

  defaultSession.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => {
    // For a sub-frame the embedding origin is the page; for the page itself it is absent.
    const embedding = (details as { embeddingOrigin?: string } | undefined)?.embeddingOrigin;
    return isPermissionAllowed(
      permission,
      { topLevelUrl: embedding || contents?.getURL() || requestingOrigin, requestingUrl: requestingOrigin },
      appOrigin,
    );
  });
}

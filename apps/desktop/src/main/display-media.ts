import { randomUUID } from 'node:crypto';
import { desktopCapturer, session, systemPreferences, type DesktopCapturerSource } from 'electron';
import {
  IPC_EVENT,
  type DesktopCaptureSource,
  type DesktopDisplayMediaRequest,
} from '../shared/ipc.js';
import { logger } from './logger.js';
import { isPermissionAllowed } from './permissions.js';
import { getMainWindow } from './window.js';

/** An unanswered picker must not leave `getDisplayMedia` pending forever. */
const REQUEST_TIMEOUT_MS = 60_000;

interface Pending {
  requestId: string;
  allowedIds: ReadonlySet<string>;
  settle: (sourceId: string | null) => void;
}

/**
 * Tracks the one screen-share request that can be open at a time.
 *
 * Electron hands `getDisplayMedia` to a main-process callback with no UI of its
 * own, so the renderer shows the picker and this matches its answer back to the
 * request. A newer request replaces an older one, and an answer is only honoured
 * for a source that was actually offered — the renderer is not trusted to
 * name an arbitrary window id.
 */
export class DisplayMediaBroker {
  private pending: Pending | null = null;

  constructor(
    private readonly timeoutMs = REQUEST_TIMEOUT_MS,
    private readonly newId: () => string = randomUUID,
  ) {}

  /** Resolves with the chosen source id, or `null` (cancelled, timed out, replaced, or no window). */
  request(
    sources: DesktopCaptureSource[],
    blocked: DesktopDisplayMediaRequest['blocked'],
    emit: (request: DesktopDisplayMediaRequest) => boolean,
  ): Promise<string | null> {
    this.cancel();
    const requestId = this.newId();

    return new Promise<string | null>((resolve) => {
      const timer = setTimeout(() => settle(null), this.timeoutMs);
      const settle = (sourceId: string | null) => {
        if (this.pending?.requestId !== requestId) return;
        clearTimeout(timer);
        this.pending = null;
        resolve(sourceId);
      };

      this.pending = { requestId, allowedIds: new Set(sources.map((s) => s.id)), settle };
      if (!emit({ requestId, sources, ...(blocked ? { blocked } : {}) })) settle(null);
    });
  }

  /** The renderer's answer. Returns whether it matched the open request. */
  respond(requestId: string, sourceId: string | null): boolean {
    const pending = this.pending;
    if (!pending || pending.requestId !== requestId) return false;
    pending.settle(sourceId !== null && pending.allowedIds.has(sourceId) ? sourceId : null);
    return true;
  }

  cancel(): void {
    this.pending?.settle(null);
  }
}

export const displayMediaBroker = new DisplayMediaBroker();

function toCaptureSource(source: DesktopCapturerSource): DesktopCaptureSource | null {
  const kind = source.id.startsWith('screen:') ? 'screen' : 'window';
  // A minimised or cloaked window comes back with an empty frame; offering it
  // would share a black rectangle.
  if (kind === 'window' && source.thumbnail.isEmpty()) return null;

  const icon = source.appIcon && !source.appIcon.isEmpty() ? source.appIcon.toDataURL() : undefined;
  return {
    id: source.id,
    name: source.name,
    kind,
    thumbnail: `data:image/jpeg;base64,${source.thumbnail.toJPEG(70).toString('base64')}`,
    ...(icon ? { appIcon: icon } : {}),
  };
}

/** macOS asks for Screen Recording once and then silently returns nothing. */
function screenAccessBlocked(): boolean {
  if (process.platform !== 'darwin') return false;
  const status = systemPreferences.getMediaAccessStatus('screen');
  return status === 'denied' || status === 'restricted';
}

/**
 * Wires `getDisplayMedia` (huddle and call screen share) to the renderer's
 * picker. On macOS 15+ the system picker takes over and this is not called.
 */
export function applyDisplayMediaPolicy(appOrigin: string): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (request, rawCallback) => {
      // Electron throws if a request is answered twice, and an exception from
      // the answer itself must not turn into a second answer in the `catch`.
      let answered = false;
      const answer = (streams: Parameters<typeof rawCallback>[0] | null) => {
        if (answered) return;
        answered = true;
        try {
          // `{}` also denies, but only after throwing "Video was requested, but
          // no video stream was provided"; `null` is the quiet way to say no.
          rawCallback(streams as Parameters<typeof rawCallback>[0]);
        } catch (error) {
          logger.warn('DisplayMedia', 'Electron rejected the screen-share answer', error);
        }
      };

      const frame = request.frame;
      const page = frame?.top?.url || frame?.url || '';
      if (!isPermissionAllowed('display-capture', { topLevelUrl: page, requestingUrl: page }, appOrigin)) {
        logger.warn('DisplayMedia', 'Denied a screen-share request from outside the app');
        answer(null);
        return;
      }

      try {
        const blocked = screenAccessBlocked();
        const captured = blocked
          ? []
          : await desktopCapturer.getSources({
              types: ['screen', 'window'],
              thumbnailSize: { width: 320, height: 180 },
              fetchWindowIcons: true,
            });
        const sources = captured
          .map(toCaptureSource)
          .filter((source): source is DesktopCaptureSource => source !== null)
          .sort((a, b) => Number(b.kind === 'screen') - Number(a.kind === 'screen'));

        const chosenId = await displayMediaBroker.request(
          sources,
          blocked ? 'os-permission' : undefined,
          (payload) => {
            const window = getMainWindow();
            if (!window || window.isDestroyed()) return false;
            window.webContents.send(IPC_EVENT.displayMediaRequest, payload);
            return true;
          },
        );

        const chosen = chosenId ? captured.find((source) => source.id === chosenId) : undefined;
        answer(chosen ? { video: chosen } : null);
      } catch (error) {
        logger.warn('DisplayMedia', 'Could not list screens and windows to share', error);
        answer(null);
      }
    },
    { useSystemPicker: true },
  );
}

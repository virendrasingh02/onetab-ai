import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopCaptureSource, DesktopDisplayMediaRequest } from '../shared/ipc.js';

vi.mock('electron', () => ({
  desktopCapturer: { getSources: vi.fn() },
  session: { defaultSession: {} },
  systemPreferences: { getMediaAccessStatus: vi.fn() },
}));
vi.mock('./logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('./permissions.js', () => ({ isPermissionAllowed: vi.fn() }));
vi.mock('./window.js', () => ({ getMainWindow: vi.fn() }));

const { DisplayMediaBroker } = await import('./display-media.js');

const source = (id: string, kind: 'screen' | 'window' = 'screen'): DesktopCaptureSource => ({
  id,
  name: id,
  kind,
  thumbnail: 'data:image/jpeg;base64,AA==',
});

describe('DisplayMediaBroker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const make = () => {
    let n = 0;
    return new DisplayMediaBroker(1000, () => `req-${(n += 1)}`);
  };
  const sources = [source('screen:0:0'), source('window:42:0', 'window')];

  it('resolves with the source the renderer picked', async () => {
    const broker = make();
    const emitted: DesktopDisplayMediaRequest[] = [];
    const answer = broker.request(sources, undefined, (r) => (emitted.push(r), true));

    expect(emitted).toEqual([{ requestId: 'req-1', sources }]);
    expect(broker.respond('req-1', 'window:42:0')).toBe(true);
    await expect(answer).resolves.toBe('window:42:0');
  });

  it('treats an id that was never offered as a cancel', async () => {
    const broker = make();
    const answer = broker.request(sources, undefined, () => true);
    expect(broker.respond('req-1', 'window:999:0')).toBe(true);
    await expect(answer).resolves.toBeNull();
  });

  it('resolves null when the user cancels', async () => {
    const broker = make();
    const answer = broker.request(sources, undefined, () => true);
    broker.respond('req-1', null);
    await expect(answer).resolves.toBeNull();
  });

  it('ignores an answer for a stale or unknown request', async () => {
    const broker = make();
    const first = broker.request(sources, undefined, () => true);
    const second = broker.request(sources, undefined, () => true);

    await expect(first).resolves.toBeNull(); // replaced by the newer request
    expect(broker.respond('req-1', 'screen:0:0')).toBe(false);
    expect(broker.respond('req-2', 'screen:0:0')).toBe(true);
    await expect(second).resolves.toBe('screen:0:0');
  });

  it('gives up on an unanswered picker instead of hanging getDisplayMedia', async () => {
    const broker = make();
    const answer = broker.request(sources, undefined, () => true);
    await vi.advanceTimersByTimeAsync(1001);
    await expect(answer).resolves.toBeNull();
  });

  it('cancels at once when there is no window to show the picker in', async () => {
    const broker = make();
    await expect(broker.request(sources, undefined, () => false)).resolves.toBeNull();
  });

  it('tells the picker when the OS is what is blocking the list', () => {
    const broker = make();
    const emitted: DesktopDisplayMediaRequest[] = [];
    void broker.request([], 'os-permission', (r) => (emitted.push(r), true));
    expect(emitted[0]).toMatchObject({ sources: [], blocked: 'os-permission' });
  });
});

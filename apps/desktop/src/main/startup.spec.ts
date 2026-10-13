import { beforeEach, describe, expect, it, vi } from 'vitest';

const prefs: Record<string, unknown> = {};
const setLoginItemSettings = vi.fn();
const getLoginItemSettings = vi.fn(() => ({ openAtLogin: false, wasOpenedAtLogin: false }));
const electronApp = { isPackaged: true, setLoginItemSettings, getLoginItemSettings };

vi.mock('electron', () => ({ app: electronApp }));
vi.mock('./logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('./capabilities.js', () => ({ detectDistribution: () => 'direct' }));
vi.mock('./store.js', () => ({
  getPreference: (key: string, fallback: unknown) => (key in prefs ? prefs[key] : fallback),
  setPreference: (key: string, value: unknown) => {
    prefs[key] = value;
  },
}));

const startup = await import('./startup.js');

const realPlatform = process.platform;
function setPlatform(value: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value });
}

describe('startup service', () => {
  beforeEach(() => {
    for (const key of Object.keys(prefs)) delete prefs[key];
    vi.clearAllMocks();
    electronApp.isPackaged = true;
    setPlatform('win32');
  });

  it('is unsupported in unpackaged builds and never touches the login item', () => {
    electronApp.isPackaged = false;
    const state = startup.setStartupState({ openAtLogin: true });
    expect(state.supported).toBe(false);
    expect(setLoginItemSettings).not.toHaveBeenCalled();
  });

  it('is unsupported on Linux', () => {
    setPlatform('linux');
    expect(startup.getStartupState().supported).toBe(false);
    setPlatform(realPlatform);
  });

  it('registers the hidden flag only when start-hidden is on', () => {
    startup.setStartupState({ openAtLogin: true, startHidden: true });
    expect(setLoginItemSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ openAtLogin: true, args: ['--hidden'] }),
    );
    startup.setStartupState({ startHidden: false });
    expect(setLoginItemSettings).toHaveBeenLastCalledWith(
      expect.objectContaining({ args: [] }),
    );
  });

  it('reports the OS state, not a stale saved flag', () => {
    prefs['launchAtLogin'] = true;
    getLoginItemSettings.mockReturnValueOnce({ openAtLogin: false, wasOpenedAtLogin: false });
    expect(startup.getStartupState().openAtLogin).toBe(false);
  });

  it('rejects a malformed request', () => {
    expect(() => startup.setStartupState(null as never)).toThrow();
  });

  it('detects a login launch from argv and honours the hidden preference', () => {
    expect(startup.wasLaunchedAtLogin(['app.exe', '--hidden'])).toBe(true);
    expect(startup.wasLaunchedAtLogin(['app.exe'])).toBe(false);
    expect(startup.shouldStartHidden(['app.exe', '--hidden'])).toBe(true);
    prefs['startHidden'] = false;
    expect(startup.shouldStartHidden(['app.exe', '--hidden'])).toBe(false);
    expect(startup.shouldStartHidden(['app.exe'])).toBe(false);
  });

  it('only re-syncs the login item when the user opted in', () => {
    startup.syncLoginItemOnLaunch();
    expect(setLoginItemSettings).not.toHaveBeenCalled();
    prefs['launchAtLogin'] = true;
    startup.syncLoginItemOnLaunch();
    expect(setLoginItemSettings).toHaveBeenCalledTimes(1);
  });
});

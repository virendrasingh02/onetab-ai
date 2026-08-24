import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: true },
  Notification: { isSupported: vi.fn(() => true) },
}));

const { detectDesktopCapabilities, detectDistribution, isMasBuild, isWindowsStoreBuild } =
  await import('./capabilities.js');

describe('detectDesktopCapabilities', () => {
  it('returns valid desktop capabilities with runtime facts', () => {
    const caps = detectDesktopCapabilities();

    expect(caps.isDesktop).toBe(true);
    expect(caps.authentication).toBe(true);
    expect(caps.deepLinks).toBe(true);
    expect(caps.notifications).toBe(true);
    expect(caps.filesystem).toBe(true);
    expect(caps.clipboard).toBe(true);
    expect(caps.windowControls).toBe(true);
    expect(caps.distribution).toBe('direct');
    expect(caps.supportedFeatures).toContain('authentication');
    expect(caps.supportedFeatures).toContain('deepLinks');
  });
});

describe('detectDistribution', () => {
  // `process.mas`/`process.windowsStore` are declared `readonly` by Electron's
  // types (they are ordinarily set by the Electron binary itself, never by
  // app code), so simulating one for a test goes through
  // `Object.defineProperty` rather than assignment.
  const originalMas = process.mas;
  const originalAppStoreEnv = process.env['APP_STORE'];
  const originalWindowsStore = process.windowsStore;

  function setMas(value: boolean | undefined): void {
    Object.defineProperty(process, 'mas', { value, configurable: true });
  }
  function setWindowsStore(value: boolean | undefined): void {
    Object.defineProperty(process, 'windowsStore', { value, configurable: true });
  }

  afterEach(() => {
    setMas(originalMas);
    setWindowsStore(originalWindowsStore);
    if (originalAppStoreEnv === undefined) delete process.env['APP_STORE'];
    else process.env['APP_STORE'] = originalAppStoreEnv;
  });

  it('reports "direct" when neither store flag is set', () => {
    setMas(false);
    setWindowsStore(false);
    delete process.env['APP_STORE'];

    expect(isMasBuild()).toBe(false);
    expect(isWindowsStoreBuild()).toBe(false);
    expect(detectDistribution()).toBe('direct');
  });

  it('reports "mac-app-store" when process.mas is set', () => {
    setMas(true);

    expect(isMasBuild()).toBe(true);
    expect(detectDistribution()).toBe('mac-app-store');
  });

  it('reports "mac-app-store" when APP_STORE is set, simulating one without an actual mas build', () => {
    setMas(false);
    process.env['APP_STORE'] = '1';

    expect(detectDistribution()).toBe('mac-app-store');
  });

  it('reports "microsoft-store" only on win32 with process.windowsStore set', () => {
    setMas(false);
    delete process.env['APP_STORE'];
    setWindowsStore(true);

    // `process.platform` in this test run is whatever the host actually is —
    // isWindowsStoreBuild() must require both win32 *and* the flag, so the
    // result on a non-Windows CI runner is 'direct', not a false positive.
    if (process.platform === 'win32') {
      expect(isWindowsStoreBuild()).toBe(true);
      expect(detectDistribution()).toBe('microsoft-store');
    } else {
      expect(isWindowsStoreBuild()).toBe(false);
    }
  });
});

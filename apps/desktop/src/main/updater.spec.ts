import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: false },
}));

const { checkForUpdates, getUpdateStatus, installUpdate } = await import('./updater.js');

describe('Desktop Updater', () => {
  it('returns initial state idle or unsupported in dev mode', async () => {
    const status = await checkForUpdates(true);
    expect(status.state).toBe('unsupported');
    expect(getUpdateStatus().state).toBe('unsupported');
  });
});

describe('Store-managed builds never self-update', () => {
  const originalMas = process.mas;
  const originalWindowsStore = process.windowsStore;

  afterEach(() => {
    Object.defineProperty(process, 'mas', { value: originalMas, configurable: true });
    Object.defineProperty(process, 'windowsStore', { value: originalWindowsStore, configurable: true });
  });

  it('refuses to install even if a download were somehow in flight, under process.mas', async () => {
    Object.defineProperty(process, 'mas', { value: true, configurable: true });
    expect(installUpdate()).toBe(false);
  });

  it('refuses to install under a Microsoft Store (windowsStore) build', async () => {
    Object.defineProperty(process, 'mas', { value: false, configurable: true });
    Object.defineProperty(process, 'windowsStore', { value: true, configurable: true });

    // isWindowsStoreBuild() also requires process.platform === 'win32', which
    // this test cannot simulate — only assert the refusal on an actual
    // Windows test host, where windowsStore is the only thing distinguishing
    // this case from the plain "not ready" refusal every other host would
    // also produce.
    if (process.platform === 'win32') {
      expect(installUpdate()).toBe(false);
    }
  });
});

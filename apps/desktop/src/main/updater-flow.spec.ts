import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesktopUpdateStatus } from '../shared/ipc.js';

const sent: DesktopUpdateStatus[] = [];
const openExternal = vi.fn(async (_url: string) => undefined);
const storeManaged = vi.hoisted(() => ({ value: false }));

vi.mock('electron', () => ({
  app: { isPackaged: true, getVersion: () => '1.0.0' },
  shell: { openExternal },
}));
vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('./capabilities.js', () => ({
  isMasBuild: () => storeManaged.value,
  isWindowsStoreBuild: () => false,
}));
vi.mock('./window.js', () => ({
  getMainWindow: () => ({
    webContents: { send: (_channel: string, status: DesktopUpdateStatus) => sent.push(status) },
  }),
  markQuitting: vi.fn(),
}));

const updater = await import('./updater.js');

const API = 'https://api.example.com/api/v1';
const INSTALLER = 'https://downloads.example.com/OneTab-AI-Setup-1.1.0.exe';

function stubApi(body: unknown) {
  const fetchMock = vi.fn(async () => ({ ok: true, json: async () => body }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

/** Just enough of electron-updater to drive: it fires the events the real one does. */
function fakeUpdater(options: { newerRelease?: boolean; downloadFails?: boolean } = {}) {
  const listeners = new Map<string, (payload?: unknown) => void>();
  const emit = (event: string, payload?: unknown) => listeners.get(event)?.(payload);
  const fake = {
    autoDownload: true,
    autoInstallOnAppQuit: false,
    setFeedURL: vi.fn(),
    on: vi.fn((event: string, listener: (payload?: unknown) => void) => {
      listeners.set(event, listener);
    }),
    checkForUpdates: vi.fn(async () => {
      emit('checking-for-update');
      if (options.newerRelease === false) emit('update-not-available');
      else emit('update-available', { version: '1.1.0' });
    }),
    downloadUpdate: vi.fn(async () => {
      if (options.downloadFails) {
        emit('error', new Error('net::ERR_CONNECTION_RESET'));
        throw new Error('net::ERR_CONNECTION_RESET');
      }
      emit('download-progress', { percent: 42.4 });
      emit('update-downloaded', { version: '1.1.0' });
    }),
    quitAndInstall: vi.fn(),
  };
  return fake;
}

const last = () => sent.at(-1);

beforeEach(() => {
  sent.length = 0;
  openExternal.mockClear();
  storeManaged.value = false;
  updater.setApiUrlForUpdates(API);
  updater.setUpdateFeedUrl(null);
  updater.setAutoUpdaterLoader(null);
});

afterEach(() => vi.unstubAllGlobals());

describe('checking for updates', () => {
  it('asks the configured API, not the renderer origin', async () => {
    const fetchMock = stubApi({ status: 'up-to-date' });
    await updater.checkForUpdates(false);
    const url = String((fetchMock.mock.calls as unknown[][])[0][0]);
    expect(url.startsWith(`${API}/app-versions/check-update?`)).toBe(true);
    expect(url).toContain('currentVersion=1.0.0');
  });

  it('never offers a store build an installer from outside its store', async () => {
    storeManaged.value = true;
    const fetchMock = stubApi({ updateAvailable: true, latestVersion: '2', downloadUrl: INSTALLER });
    await updater.checkForUpdates(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(last()).toEqual({ state: 'unsupported' });
    await expect(updater.downloadUpdate()).resolves.toBe(false);
    expect(openExternal).not.toHaveBeenCalled();
  });
});

describe('"Update now" without an in-app updater (no feed configured)', () => {
  it('opens the installer page instead of doing nothing, and says so', async () => {
    stubApi({ updateAvailable: true, latestVersion: '1.1.0', downloadUrl: INSTALLER, releaseNotes: 'Fixes' });
    await updater.checkForUpdates(false);

    await expect(updater.downloadUpdate()).resolves.toBe(true);
    expect(openExternal).toHaveBeenCalledWith(INSTALLER);
    expect(last()).toMatchObject({
      state: 'available',
      version: '1.1.0',
      releaseNotes: 'Fixes',
      openedInBrowser: true,
    });
  });

  it('keeps a mandatory update mandatory after sending the person to the page', async () => {
    stubApi({ status: 'update-required', latestVersion: '2.0.0', downloadUrl: INSTALLER });
    await updater.checkForUpdates(false);
    await updater.downloadUpdate();
    expect(last()).toMatchObject({ state: 'available', mandatory: true, openedInBrowser: true });
  });

  it('reports an error rather than a dead button when no installer is published', async () => {
    stubApi({ updateAvailable: true, latestVersion: '1.1.0' });
    await updater.checkForUpdates(false);
    await expect(updater.downloadUpdate()).resolves.toBe(false);
    expect(last()).toMatchObject({ state: 'error' });
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('refuses a download URL that is not http(s)', async () => {
    stubApi({ updateAvailable: true, latestVersion: '1.1.0', downloadUrl: 'file:///C:/Windows/System32/calc.exe' });
    await updater.checkForUpdates(false);
    await expect(updater.downloadUpdate()).resolves.toBe(false);
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('does not touch electron-updater at all without a feed', async () => {
    const loader = vi.fn(() => ({ autoUpdater: fakeUpdater() }));
    updater.setAutoUpdaterLoader(loader);
    stubApi({ updateAvailable: true, latestVersion: '1.1.0', downloadUrl: INSTALLER });
    await updater.checkForUpdates(false);
    await updater.downloadUpdate();
    expect(loader).not.toHaveBeenCalled();
  });
});

describe('in-app updating (feed configured)', () => {
  const FEED = 'https://downloads.example.com/desktop/';

  it('points electron-updater at the feed and leaves downloading to the person', async () => {
    const fake = fakeUpdater();
    updater.setUpdateFeedUrl(FEED);
    updater.setAutoUpdaterLoader(() => ({ autoUpdater: fake }));
    stubApi({}); // the API has no opinion: fall through to the feed

    await updater.checkForUpdates(false);
    expect(fake.setFeedURL).toHaveBeenCalledWith({
      provider: 'generic',
      url: 'https://downloads.example.com/desktop',
    });
    expect(fake.autoDownload).toBe(false);
    expect(last()).toMatchObject({ state: 'available', version: '1.1.0' });
    expect(fake.downloadUpdate).not.toHaveBeenCalled();
  });

  it('downloads to ready, keeping what the API said about the update', async () => {
    const fake = fakeUpdater();
    updater.setUpdateFeedUrl(FEED);
    updater.setAutoUpdaterLoader(() => ({ autoUpdater: fake }));
    stubApi({ status: 'update-required', latestVersion: '1.1.0', downloadUrl: INSTALLER, releaseNotes: 'Security' });
    await updater.checkForUpdates(false);

    await expect(updater.downloadUpdate()).resolves.toBe(true);

    const states = sent.map((s) => s.state);
    expect(states).toContain('downloading');
    expect(last()).toEqual({ state: 'ready', version: '1.1.0' });
    // The mandatory flag survived the updater's own `update-available` event,
    // so the blocking dialog never turned dismissable mid-update.
    const reAvailable = sent.filter((s) => s.state === 'available').at(-1);
    expect(reAvailable).toMatchObject({ mandatory: true, releaseNotes: 'Security', openedInBrowser: false });
    expect(openExternal).not.toHaveBeenCalled();

    expect(updater.installUpdate()).toBe(true);
    expect(fake.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it('falls back to the installer page when the in-app download fails', async () => {
    const fake = fakeUpdater({ downloadFails: true });
    updater.setUpdateFeedUrl(FEED);
    updater.setAutoUpdaterLoader(() => ({ autoUpdater: fake }));
    stubApi({ updateAvailable: true, latestVersion: '1.1.0', downloadUrl: INSTALLER });
    await updater.checkForUpdates(false);

    await expect(updater.downloadUpdate()).resolves.toBe(true);
    expect(openExternal).toHaveBeenCalledWith(INSTALLER);
    expect(last()).toMatchObject({ state: 'available', openedInBrowser: true });
    expect(sent.some((s) => s.state === 'error')).toBe(false);
  });

  it('uses the installer page when the feed has nothing newer than the API announced', async () => {
    const fake = fakeUpdater({ newerRelease: false });
    updater.setUpdateFeedUrl(FEED);
    updater.setAutoUpdaterLoader(() => ({ autoUpdater: fake }));
    stubApi({ updateAvailable: true, latestVersion: '1.1.0', downloadUrl: INSTALLER });
    await updater.checkForUpdates(false);

    await expect(updater.downloadUpdate()).resolves.toBe(true);
    expect(fake.downloadUpdate).not.toHaveBeenCalled();
    expect(openExternal).toHaveBeenCalledWith(INSTALLER);
    // The dialog must not have flashed to "up to date" while the feed was consulted.
    expect(sent.some((s) => s.state === 'not-available')).toBe(false);
  });

  it('falls back quietly when electron-updater cannot be loaded', async () => {
    updater.setUpdateFeedUrl(FEED);
    updater.setAutoUpdaterLoader(() => {
      throw new Error("Cannot find module 'electron-updater'");
    });
    stubApi({ updateAvailable: true, latestVersion: '1.1.0', downloadUrl: INSTALLER });
    await updater.checkForUpdates(false);
    await expect(updater.downloadUpdate()).resolves.toBe(true);
    expect(openExternal).toHaveBeenCalledWith(INSTALLER);
  });
});

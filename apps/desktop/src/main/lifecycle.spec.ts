import { beforeEach, describe, expect, it, vi } from 'vitest';

const relaunch = vi.fn();
const quit = vi.fn();
const exit = vi.fn();
const focus = vi.fn();
const showAboutPanelMock = vi.fn();
const dockBounceMock = vi.fn(() => 42);
const markQuitting = vi.fn();
const showMainWindow = vi.fn();

vi.mock('electron', () => ({
  app: {
    relaunch,
    quit,
    exit,
    focus,
    showAboutPanel: showAboutPanelMock,
    dock: {
      bounce: dockBounceMock,
    },
  },
}));
vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('./window.js', () => ({
  markQuitting: (...a: unknown[]) => markQuitting(...a),
  showMainWindow: (...a: unknown[]) => showMainWindow(...a),
}));

const { relaunchArgs, restartApp, quitApp, focusApp, showAboutPanel, dockBounce } = await import(
  './lifecycle.js'
);

describe('relaunchArgs', () => {
  it('drops the replayed deep link and the hidden-launch flag, keeps real flags', () => {
    expect(
      relaunchArgs(['electron.exe', '--inspect', '--hidden', 'onetab://w/acme/inbox', 'mie://x']),
    ).toEqual(['--inspect']);
  });
});

describe('restartApp / quitApp', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restarts through app.quit so will-quit cleanup runs, never app.exit', () => {
    restartApp();
    expect(markQuitting).toHaveBeenCalled();
    expect(relaunch).toHaveBeenCalledTimes(1);
    expect(quit).toHaveBeenCalledTimes(1);
    expect(exit).not.toHaveBeenCalled();
  });

  it('quit marks the app as quitting so close-to-tray does not swallow it', () => {
    quitApp();
    expect(markQuitting).toHaveBeenCalled();
    expect(quit).toHaveBeenCalled();
  });

  it('quitApp accepts optional custom exitCode', () => {
    quitApp(1);
    expect(process.exitCode).toBe(1);
    expect(quit).toHaveBeenCalled();
    process.exitCode = undefined;
  });
});

describe('focusApp & showAboutPanel & dockBounce', () => {
  beforeEach(() => vi.clearAllMocks());

  it('focusApp invokes app.focus and shows main window', () => {
    focusApp();
    expect(focus).toHaveBeenCalledWith({ steal: true });
    expect(showMainWindow).toHaveBeenCalled();
  });

  it('showAboutPanel delegates to app.showAboutPanel', () => {
    showAboutPanel();
    expect(showAboutPanelMock).toHaveBeenCalled();
  });

  it('dockBounce executes dock bounce on darwin', () => {
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    const id = dockBounce('critical');
    expect(dockBounceMock).toHaveBeenCalledWith('critical');
    expect(id).toBe(42);

    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });
});

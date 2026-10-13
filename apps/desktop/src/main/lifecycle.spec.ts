import { beforeEach, describe, expect, it, vi } from 'vitest';

const relaunch = vi.fn();
const quit = vi.fn();
const exit = vi.fn();
const markQuitting = vi.fn();

vi.mock('electron', () => ({ app: { relaunch, quit, exit } }));
vi.mock('./logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('./window.js', () => ({ markQuitting: (...a: unknown[]) => markQuitting(...a) }));

const { relaunchArgs, restartApp, quitApp } = await import('./lifecycle.js');

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
});

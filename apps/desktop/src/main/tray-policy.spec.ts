import { describe, expect, it } from 'vitest';
import { defaultMinimizeToTray, resolveCloseAction } from './tray-policy.js';

describe('defaultMinimizeToTray', () => {
  it('keeps the app running by default where the tray is dependable', () => {
    expect(defaultMinimizeToTray('win32')).toBe(true);
    expect(defaultMinimizeToTray('darwin')).toBe(true);
  });

  it('stays opt-in on Linux, where there may be no tray to get the window back from', () => {
    expect(defaultMinimizeToTray('linux')).toBe(false);
  });
});

describe('resolveCloseAction', () => {
  const base = { quitting: false, minimizeToTray: true, hintShown: false, platform: 'win32' as const };

  it('explains the first close, once', () => {
    expect(resolveCloseAction(base)).toBe('hide-with-hint');
    expect(resolveCloseAction({ ...base, hintShown: true })).toBe('hide');
  });

  it('never hints on macOS, where closing a window leaves the app in the Dock', () => {
    expect(resolveCloseAction({ ...base, platform: 'darwin' })).toBe('hide');
  });

  it('lets the close through when the user turned the tray off', () => {
    expect(resolveCloseAction({ ...base, minimizeToTray: false })).toBe('quit');
  });

  it('never traps a real quit (menu, tray, updater, shutdown) behind the hide', () => {
    expect(resolveCloseAction({ ...base, quitting: true })).toBe('quit');
    expect(resolveCloseAction({ ...base, quitting: true, hintShown: true })).toBe('quit');
  });
});

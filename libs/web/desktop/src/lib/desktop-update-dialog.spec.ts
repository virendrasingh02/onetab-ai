import { describe, expect, it } from 'vitest';
import type { DesktopUpdateStatus } from './desktop-api.js';

describe('DesktopUpdateStatus states', () => {
  it('supports idle, checking, not-available, and unsupported states', () => {
    const idle: DesktopUpdateStatus = { state: 'idle' };
    const checking: DesktopUpdateStatus = { state: 'checking' };
    const notAvailable: DesktopUpdateStatus = { state: 'not-available' };
    const unsupported: DesktopUpdateStatus = { state: 'unsupported' };

    expect(idle.state).toBe('idle');
    expect(checking.state).toBe('checking');
    expect(notAvailable.state).toBe('not-available');
    expect(unsupported.state).toBe('unsupported');
  });

  it('supports available status with release notes and downloadUrl', () => {
    const available: DesktopUpdateStatus = {
      state: 'available',
      version: '2.8.5',
      releaseNotes: 'Performance improvements and bug fixes',
      downloadUrl: 'https://download.onetab.ai/desktop/windows/setup.exe',
      mandatory: false,
    };

    expect(available.state).toBe('available');
    expect(available.version).toBe('2.8.5');
    expect(available.mandatory).toBe(false);
    expect(available.releaseNotes).toContain('Performance');
  });

  it('supports mandatory update flag for server-enforced minimum versions', () => {
    const mandatory: DesktopUpdateStatus = {
      state: 'available',
      version: '2.8.5',
      mandatory: true,
      forceUpdate: true,
      minSupportedVersion: '2.7.0',
    };

    expect(mandatory.state).toBe('available');
    expect(mandatory.mandatory).toBe(true);
    expect(mandatory.forceUpdate).toBe(true);
    expect(mandatory.minSupportedVersion).toBe('2.7.0');
  });

  it('supports downloading progress and ready states', () => {
    const downloading: DesktopUpdateStatus = {
      state: 'downloading',
      percent: 65,
    };
    const ready: DesktopUpdateStatus = {
      state: 'ready',
      version: '2.8.5',
    };

    expect(downloading.state).toBe('downloading');
    expect(downloading.percent).toBe(65);
    expect(ready.state).toBe('ready');
    expect(ready.version).toBe('2.8.5');
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { isPackaged: true },
  Notification: { isSupported: vi.fn(() => true) },
}));

const { detectDesktopCapabilities } = await import('./capabilities.js');

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
    expect(caps.supportedFeatures).toContain('authentication');
    expect(caps.supportedFeatures).toContain('deepLinks');
  });
});

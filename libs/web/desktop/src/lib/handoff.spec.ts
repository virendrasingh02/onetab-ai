import { describe, expect, it } from 'vitest';
import { DEFAULT_APP_METADATA } from './app-metadata.js';
import { isMobileDevice, openDesktopApp } from './handoff.js';

// The old FEATURE_MATRIX (a static, unread platform/web boolean table) lived
// here and was tested here. It's gone — `FEATURE_REGISTRY` in `@org/platform`
// replaces it with the same feature ids plus the state machine
// `evaluateFeature` needs; its own tests live in
// `libs/shared/platform/src/lib/feature-manager.spec.ts`.

describe('DEFAULT_APP_METADATA', () => {
  it('contains valid publisher and application metadata', () => {
    expect(DEFAULT_APP_METADATA.name).toBe('onetab-ai');
    expect(DEFAULT_APP_METADATA.productName).toBe('OneTab AI');
    expect(DEFAULT_APP_METADATA.publisher).toBeDefined();
    expect(DEFAULT_APP_METADATA.website).toContain('http');
  });
});

describe('openDesktopApp & isMobileDevice', () => {
  it('detects isMobileDevice function safely', () => {
    const isMobile = isMobileDevice();
    expect(typeof isMobile).toBe('boolean');
  });

  it('runs openDesktopApp function returning a promise', async () => {
    const res = openDesktopApp({
      route: 'auth/device',
      requestId: 'req_123',
      timeout: 50,
    });
    expect(res).toBeInstanceOf(Promise);
  });
});

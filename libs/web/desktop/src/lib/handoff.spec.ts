import { describe, expect, it } from 'vitest';
import { FEATURE_MATRIX } from './feature-matrix.js';
import { DEFAULT_APP_METADATA } from './app-metadata.js';
import { isMobileDevice, openDesktopApp } from './handoff.js';

describe('FEATURE_MATRIX', () => {
  it('defines all required platform features and fallbacks', () => {
    expect(FEATURE_MATRIX.browserAuth).toBeDefined();
    expect(FEATURE_MATRIX.deepLinks).toBeDefined();
    expect(FEATURE_MATRIX.nativeNotifications).toBeDefined();
    expect(FEATURE_MATRIX.appUpdates).toBeDefined();
    expect(FEATURE_MATRIX.safeStorage).toBeDefined();
    expect(FEATURE_MATRIX.singleInstance).toBeDefined();

    expect(FEATURE_MATRIX.deepLinks.desktop).toBe(true);
    expect(FEATURE_MATRIX.deepLinks.web).toBe(false);
    expect(FEATURE_MATRIX.deepLinks.fallback).not.toBeNull();
  });
});

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

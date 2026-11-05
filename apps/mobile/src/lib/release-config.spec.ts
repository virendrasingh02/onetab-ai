import type { ExpoConfig } from 'expo/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

/** app.config.ts reads the environment at import, so each case loads it fresh. */
async function loadConfig(env: Record<string, string>) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  // A variable path: the config sits outside this project's TypeScript root.
  const path = '../../app.config';
  const module = (await import(/* @vite-ignore */ path)) as {
    default: ExpoConfig;
  };
  return module.default;
}

const PRODUCTION = {
  APP_VARIANT: 'production',
  EXPO_PUBLIC_API_URL: 'https://api.example.com/api/v1',
  EXPO_PUBLIC_WEB_URL: 'https://app.example.com',
  EXPO_PUBLIC_PRIVACY_URL: 'https://example.com/privacy',
  EXPO_PUBLIC_TERMS_URL: 'https://example.com/terms',
  EXPO_PUBLIC_SUPPORT_URL: 'https://example.com/support',
};

afterEach(() => vi.unstubAllEnvs());

describe('pull to refresh', () => {
  it('forwards the scroll content, or every refreshable screen is blank on Android', () => {
    const ui = readFileSync(
      join(import.meta.dirname, '..', 'components', 'ui.tsx'),
      'utf8',
    );
    expect(ui).toMatch(/<RefreshControl\s+\{\.\.\.rest\}/);
  });
});

describe('production guard', () => {
  it('refuses a build pointing at a dev machine', async () => {
    await expect(
      loadConfig({
        ...PRODUCTION,
        EXPO_PUBLIC_API_URL: 'http://192.168.1.20:3000/api/v1',
      }),
    ).rejects.toThrow('apiUrl');
  });

  it('refuses a build without a privacy policy', async () => {
    await expect(
      loadConfig({ ...PRODUCTION, EXPO_PUBLIC_PRIVACY_URL: '' }),
    ).rejects.toThrow('privacyUrl');
  });

  it('leaves development builds alone', async () => {
    const config = await loadConfig({ APP_VARIANT: 'development' });
    expect(config.android?.package).toBe('ai.onetab.mobile.dev');
  });
});

describe('store configuration', () => {
  it('declares no tracking and its required-reason APIs on iOS', async () => {
    const config = await loadConfig(PRODUCTION);
    const manifest = config.ios?.privacyManifests;
    expect(manifest?.NSPrivacyTracking).toBe(false);
    expect(manifest?.NSPrivacyAccessedAPITypes?.length).toBeGreaterThan(0);
  });

  it('explains every iOS permission it can ask for', async () => {
    const plist = (await loadConfig(PRODUCTION)).ios?.infoPlist ?? {};
    for (const key of [
      'NSCameraUsageDescription',
      'NSPhotoLibraryUsageDescription',
      'NSFaceIDUsageDescription',
    ]) {
      expect(plist[key], key).toBeTruthy();
    }
  });

  it('keeps sensitive Android permissions out of store builds', async () => {
    const { android } = await loadConfig(PRODUCTION);
    expect(android?.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.RECORD_AUDIO',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ]),
    );
    expect(android?.allowBackup).toBe(false);
  });

  it('adds verified links only when a host is configured', async () => {
    const without = await loadConfig(PRODUCTION);
    expect(without.ios?.associatedDomains).toBeUndefined();

    const withHost = await loadConfig({
      ...PRODUCTION,
      EXPO_PUBLIC_LINK_HOST: 'app.example.com',
    });
    expect(withHost.ios?.associatedDomains).toEqual([
      'applinks:app.example.com',
    ]);
    expect(
      withHost.android?.intentFilters?.some((filter) => filter.autoVerify),
    ).toBe(true);
  });
});

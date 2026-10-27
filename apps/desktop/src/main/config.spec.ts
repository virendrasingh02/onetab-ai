import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { CONFIG_FILE_NAME, DEFAULT_API_URL, loadRuntimeConfig, normalizeUrl, resolveRuntimeConfig } =
  await import('./config.js');

const APP = 'http://localhost:4203';

describe('normalizeUrl', () => {
  it('keeps absolute http(s) URLs and drops trailing slashes', () => {
    expect(normalizeUrl('https://api.example.com/api/v1/')).toBe('https://api.example.com/api/v1');
    expect(normalizeUrl('  http://localhost:3000/api/v1  ')).toBe('http://localhost:3000/api/v1');
  });

  it('rejects anything the main process could not fetch', () => {
    for (const bad of ['', '/api/v1', 'ftp://x.example', 'javascript:alert(1)', 'nope', undefined, 42]) {
      expect(normalizeUrl(bad)).toBeNull();
    }
  });
});

describe('resolveRuntimeConfig', () => {
  it('prefers the environment, then the packaged file, then the default', () => {
    const fromEnv = resolveRuntimeConfig({
      appUrl: APP,
      env: { VITE_API_URL: 'https://env.example.com/api/v1' },
      buildConfig: { apiUrl: 'https://file.example.com/api/v1' },
    });
    expect(fromEnv.apiUrl).toBe('https://env.example.com/api/v1');
    expect(fromEnv.sources.apiUrl).toBe('env');

    const fromFile = resolveRuntimeConfig({
      appUrl: APP,
      env: {},
      buildConfig: { apiUrl: 'https://file.example.com/api/v1/' },
    });
    expect(fromFile.apiUrl).toBe('https://file.example.com/api/v1');
    expect(fromFile.sources.apiUrl).toBe('build-config');

    const fallback = resolveRuntimeConfig({ appUrl: APP, env: {}, buildConfig: {} });
    expect(fallback.apiUrl).toBe(DEFAULT_API_URL);
    expect(fallback.sources.apiUrl).toBe('default');
  });

  it('lets ONETAB_API_URL beat VITE_API_URL', () => {
    const config = resolveRuntimeConfig({
      appUrl: APP,
      env: { ONETAB_API_URL: 'https://a.example.com/api/v1', VITE_API_URL: 'https://b.example.com/api/v1' },
      buildConfig: {},
    });
    expect(config.apiUrl).toBe('https://a.example.com/api/v1');
  });

  it('skips a relative VITE_API_URL (the dev proxy form) instead of using it', () => {
    const config = resolveRuntimeConfig({
      appUrl: APP,
      env: { VITE_API_URL: '/api/v1' },
      buildConfig: { apiUrl: 'https://file.example.com/api/v1' },
    });
    expect(config.apiUrl).toBe('https://file.example.com/api/v1');
  });

  it('leaves in-app updates off unless a feed is configured', () => {
    expect(resolveRuntimeConfig({ appUrl: APP, env: {}, buildConfig: {} }).updateUrl).toBeNull();
    expect(
      resolveRuntimeConfig({
        appUrl: APP,
        env: { ONETAB_UPDATE_URL: 'https://env.example.com/desktop/' },
        buildConfig: { updateUrl: 'https://file.example.com/desktop' },
      }).updateUrl,
    ).toBe('https://env.example.com/desktop');
    expect(
      resolveRuntimeConfig({
        appUrl: APP,
        env: {},
        buildConfig: { updateUrl: 'https://file.example.com/desktop' },
      }).updateUrl,
    ).toBe('https://file.example.com/desktop');
  });

  it('sends the system browser to the public web app, not the internal server', () => {
    const configured = resolveRuntimeConfig({
      appUrl: APP,
      env: {},
      buildConfig: { webUrl: 'https://app.example.com' },
    });
    expect(configured.webUrl).toBe('https://app.example.com');
    expect(configured.appUrl).toBe(APP);

    const unconfigured = resolveRuntimeConfig({ appUrl: APP, env: {}, buildConfig: {} });
    expect(unconfigured.webUrl).toBe(APP);
    expect(unconfigured.sources.webUrl).toBe('default');
  });
});

describe('loadRuntimeConfig', () => {
  const dirs: string[] = [];
  const withPackagedConfig = () => {
    const dir = mkdtempSync(join(tmpdir(), 'onetab-config-'));
    dirs.push(dir);
    writeFileSync(
      join(dir, CONFIG_FILE_NAME),
      JSON.stringify({ apiUrl: 'https://prod.example.com/api/v1', updateUrl: 'https://prod.example.com/dl' }),
    );
    return dir;
  };

  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it('reads the baked file in a packaged build', () => {
    vi.stubEnv('ONETAB_API_URL', '');
    vi.stubEnv('VITE_API_URL', '');
    const config = loadRuntimeConfig(APP, withPackagedConfig(), false);
    expect(config.apiUrl).toBe('https://prod.example.com/api/v1');
    expect(config.updateUrl).toBe('https://prod.example.com/dl');
  });

  it('ignores a leftover file in development, so nx serve never talks to a packaged environment', () => {
    vi.stubEnv('ONETAB_API_URL', '');
    vi.stubEnv('VITE_API_URL', '');
    const config = loadRuntimeConfig(APP, withPackagedConfig(), true);
    expect(config.apiUrl).toBe(DEFAULT_API_URL);
    expect(config.updateUrl).toBeNull();
  });
});

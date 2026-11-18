import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error -- plain ESM build script, no type declarations
import * as pkg from '../../scripts/package.mjs';

/** Packaging rules a store or Gatekeeper review would catch, checked on every test run. */
const desktopRoot = join(import.meta.dirname, '..', '..');
const builder = JSON.parse(
  readFileSync(join(desktopRoot, 'electron-builder.json'), 'utf8'),
);
const entitlements = readFileSync(
  join(desktopRoot, 'resources', 'entitlements.mac.plist'),
  'utf8',
);
const windowSource = readFileSync(
  join(desktopRoot, 'src', 'main', 'window.ts'),
  'utf8',
);

describe('electron fuses', () => {
  it('closes the ways to run code inside the signed binary', () => {
    expect(builder.electronFuses).toMatchObject({
      runAsNode: false,
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false,
      onlyLoadAppFromAsar: true,
      enableEmbeddedAsarIntegrityValidation: true,
      grantFileProtocolExtraPrivileges: false,
    });
    expect(builder.asar).toBe(true);
  });
});

describe('macOS', () => {
  it('uses the hardened runtime and declares why it needs the camera and mic', () => {
    expect(builder.mac.hardenedRuntime).toBe(true);
    expect(builder.mac.extendInfo.NSMicrophoneUsageDescription).toBeTruthy();
    expect(builder.mac.extendInfo.NSCameraUsageDescription).toBeTruthy();
  });

  it('keeps entitlements to what the app uses', () => {
    expect(entitlements).toContain('com.apple.security.cs.allow-jit');
    expect(entitlements).not.toContain('disable-library-validation');
    expect(entitlements).not.toContain('allow-unsigned-executable-memory');
  });
});

describe('signing', () => {
  it('holds no credentials in the repository', () => {
    const text = JSON.stringify(builder);
    expect(text).not.toMatch(/cscLink|certificatePassword|appleIdPassword/i);
  });
});

describe('renderer isolation', () => {
  it('keeps the BrowserWindow locked down', () => {
    expect(windowSource).toContain('contextIsolation: true');
    expect(windowSource).toContain('nodeIntegration: false');
    expect(windowSource).toContain('sandbox: true');
    expect(windowSource).toContain('webSecurity: true');
    expect(windowSource).toContain('webviewTag: false');
    expect(windowSource).toContain('devTools: !app.isPackaged');
  });
});

describe('cross-platform packaging', () => {
  it('builds installers for Windows, macOS and Linux', () => {
    expect(builder.win.target).toBeTruthy();
    expect(builder.mac.target).toBeTruthy();
    expect(builder.linux.target).toBeTruthy();
    const macArchs = builder.mac.target.flatMap((t: { arch: string[] }) => t.arch);
    expect(macArchs).toEqual(expect.arrayContaining(['x64', 'arm64']));
  });

  it('never pins every target to the host Electron binary', () => {
    // A fixed `electronDist` packs the host's Electron into macOS/Linux/arm64 builds;
    // scripts/package.mjs decides per target instead.
    expect(builder.electronDist).toBeUndefined();
  });

  it('gives each platform/arch its own artifact name', () => {
    expect(builder.artifactName).toContain('${arch}');
    expect(builder.artifactName).toContain('${os}');
  });
});

describe('scripts/package.mjs', () => {

  it('reuses the installed Electron only for the host platform and arch', () => {
    const host = { platform: 'win32', arch: 'x64' } as const;
    expect(pkg.electronDistFor({ platformName: 'darwin', arch: 'arm64' }, host)).toBeNull();
    expect(pkg.electronDistFor({ platformName: 'win32', arch: 'arm64' }, host)).toBeNull();
    expect(pkg.electronDistFor({ platformName: 'linux', arch: 'x64' }, host)).toBeNull();
  });

  it('builds only what the host can, and says what it skipped', () => {
    expect(pkg.planTargets([], 'win')).toEqual({ build: ['win'], skipped: [] });
    expect(pkg.planTargets([], 'mac')).toEqual({ build: ['mac', 'linux'], skipped: [] });
    expect(pkg.planTargets(['win', 'mac', 'linux'], 'win')).toEqual({
      build: ['win'],
      skipped: ['mac', 'linux'],
    });
  });

  it('parses platform and arch flags', () => {
    expect(pkg.parseArgs(['--all', '--arm64'])).toEqual({
      platforms: ['win', 'mac', 'linux'],
      archs: ['arm64'],
      dir: false,
    });
    expect(() => pkg.parseArgs(['--windoze'])).toThrow(/Unknown option/);
  });

  it('adds a generic publish feed when an update URL is given', () => {
    const config = pkg.buildConfig(builder, { updateUrl: 'https://dl.example.com/desktop' });
    expect(config.publish).toEqual([{ provider: 'generic', url: 'https://dl.example.com/desktop' }]);
    expect(JSON.stringify(config.extraResources)).not.toContain('app-update.yml');
    expect(pkg.buildConfig(builder).publish).toBeUndefined();
  });
});

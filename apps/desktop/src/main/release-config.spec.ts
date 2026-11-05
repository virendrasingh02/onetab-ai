import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

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

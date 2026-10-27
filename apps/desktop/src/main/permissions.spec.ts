import { afterEach, describe, expect, it, vi } from 'vitest';

const getMediaAccessStatus = vi.fn();
const askForMediaAccess = vi.fn();

vi.mock('electron', () => ({
  session: { defaultSession: {} },
  systemPreferences: { getMediaAccessStatus, askForMediaAccess },
}));
vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { isPermissionAllowed, ensureOsMediaAccess } = await import('./permissions.js');

const APP = 'http://localhost:4200';
const page = { topLevelUrl: `${APP}/w/acme/chat`, requestingUrl: `${APP}/w/acme/chat` };
const embeddedCall = { topLevelUrl: `${APP}/w/acme/chat`, requestingUrl: 'https://call.example.com/room' };
const foreign = { topLevelUrl: 'https://evil.example.com/', requestingUrl: 'https://evil.example.com/' };

describe('isPermissionAllowed', () => {
  it('lets the app use the microphone and camera (voice messages, calls)', () => {
    expect(isPermissionAllowed('media', page, APP)).toBe(true);
    expect(isPermissionAllowed('speaker-selection', page, APP)).toBe(true);
  });

  it('lets the app and its embedded call frame ask to share the screen', () => {
    expect(isPermissionAllowed('display-capture', page, APP)).toBe(true);
    expect(isPermissionAllowed('display-capture', embeddedCall, APP)).toBe(true);
    expect(isPermissionAllowed('display-capture', foreign, APP)).toBe(false);
  });

  it('lets an embedded call frame use media because the app embedded it', () => {
    expect(isPermissionAllowed('media', embeddedCall, APP)).toBe(true);
  });

  it('keeps notifications and clipboard writes to the app itself', () => {
    expect(isPermissionAllowed('notifications', page, APP)).toBe(true);
    expect(isPermissionAllowed('notifications', embeddedCall, APP)).toBe(false);
    expect(isPermissionAllowed('clipboard-sanitized-write', page, APP)).toBe(true);
  });

  it('denies every permission to another origin', () => {
    for (const permission of ['media', 'notifications', 'fullscreen']) {
      expect(isPermissionAllowed(permission, foreign, APP)).toBe(false);
    }
  });

  it('stays default-deny for anything not on the list', () => {
    for (const permission of ['geolocation', 'midi', 'clipboard-read']) {
      expect(isPermissionAllowed(permission, page, APP)).toBe(false);
    }
  });

  it('denies everything when the app origin is not a URL', () => {
    expect(isPermissionAllowed('media', page, 'not a url')).toBe(false);
  });
});

describe('ensureOsMediaAccess', () => {
  const platform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: platform });
    getMediaAccessStatus.mockReset();
    askForMediaAccess.mockReset();
  });

  const setPlatform = (value: NodeJS.Platform) =>
    Object.defineProperty(process, 'platform', { value });

  it('does not ask the OS anything outside macOS', async () => {
    setPlatform('win32');
    await expect(ensureOsMediaAccess(['audio'])).resolves.toBe(true);
    expect(getMediaAccessStatus).not.toHaveBeenCalled();
  });

  it('asks macOS once when the microphone has never been decided', async () => {
    setPlatform('darwin');
    getMediaAccessStatus.mockReturnValue('not-determined');
    askForMediaAccess.mockResolvedValue(true);
    await expect(ensureOsMediaAccess(['audio'])).resolves.toBe(true);
    expect(askForMediaAccess).toHaveBeenCalledWith('microphone');
  });

  it('does not nag again once the user has denied it in System Settings', async () => {
    setPlatform('darwin');
    getMediaAccessStatus.mockReturnValue('denied');
    await expect(ensureOsMediaAccess(['audio'])).resolves.toBe(false);
    expect(askForMediaAccess).not.toHaveBeenCalled();
  });

  it('needs the camera too when video is requested', async () => {
    setPlatform('darwin');
    getMediaAccessStatus.mockImplementation((kind: string) =>
      kind === 'microphone' ? 'granted' : 'denied',
    );
    await expect(ensureOsMediaAccess(['audio', 'video'])).resolves.toBe(false);
  });
});

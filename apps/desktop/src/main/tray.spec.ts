import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSetBadgeCount = vi.fn();
const mockSetBadge = vi.fn();
const mockSetOverlayIcon = vi.fn();
const mockWindowOn = vi.fn();

const mockWindow = {
  isDestroyed: vi.fn(() => false),
  setOverlayIcon: mockSetOverlayIcon,
  on: mockWindowOn,
  webContents: { send: vi.fn() },
};

vi.mock('electron', () => ({
  app: {
    setBadgeCount: mockSetBadgeCount,
    dock: {
      setBadge: mockSetBadge,
      setMenu: vi.fn(),
    },
    quit: vi.fn(),
  },
  Menu: {
    buildFromTemplate: vi.fn(() => ({})),
  },
  nativeImage: {
    createFromBitmap: vi.fn((buffer, options) => ({
      buffer,
      options,
      isEmpty: () => false,
    })),
    createFromPath: vi.fn(),
    createFromDataURL: vi.fn(),
  },
  Tray: vi.fn().mockImplementation(() => ({
    setToolTip: vi.fn(),
    setContextMenu: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
  })),
}));

vi.mock('./startup.js', () => ({
  getStartupState: vi.fn(() => ({ openAtLogin: false, supported: true })),
  setStartupState: vi.fn(),
}));

vi.mock('./store.js', () => ({
  getPreference: vi.fn(() => false),
  setPreference: vi.fn(),
}));

vi.mock('./window.js', () => ({
  getMainWindow: vi.fn(() => mockWindow),
  markQuitting: vi.fn(),
  showMainWindow: vi.fn(),
}));

const { applyBadgeCount, buildOverlayBadge, getBadgeCount, refreshBadgeOverlay } = await import(
  './tray.js'
);

describe('Desktop Tray and App Icon Badge', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWindow.isDestroyed.mockReturnValue(false);
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('buildOverlayBadge draws one cached dot per tone, never a count', () => {
    const activity = buildOverlayBadge('activity');
    expect(buildOverlayBadge('activity')).toBe(activity);

    const mention = buildOverlayBadge('mention');
    expect(mention).not.toBe(activity);

    // Centre pixel (premultiplied BGRA, 32px @2x): blue for activity, red for mention.
    const centre = (16 * 32 + 16) * 4;
    const pixel = (image: unknown) =>
      Array.from((image as { buffer: Buffer }).buffer.subarray(centre, centre + 4));
    expect(pixel(activity)).toEqual([246, 130, 59, 255]);
    expect(pixel(mention)).toEqual([68, 68, 239, 255]);
  });

  it('turns the Windows overlay red for a mention and keeps it through count-only updates', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    applyBadgeCount(2, true);
    expect(mockSetOverlayIcon).toHaveBeenLastCalledWith(
      buildOverlayBadge('mention'),
      'You were mentioned — 2 unread notifications',
    );

    // The background poller does not know about mentions — stay red.
    applyBadgeCount(3);
    expect(mockSetOverlayIcon).toHaveBeenLastCalledWith(
      buildOverlayBadge('mention'),
      'You were mentioned — 3 unread notifications',
    );

    applyBadgeCount(3, false);
    expect(mockSetOverlayIcon).toHaveBeenLastCalledWith(
      buildOverlayBadge('activity'),
      '3 unread notifications',
    );

    // Clearing resets the mention state.
    applyBadgeCount(0);
    applyBadgeCount(1);
    expect(mockSetOverlayIcon).toHaveBeenLastCalledWith(
      buildOverlayBadge('activity'),
      '1 unread notification',
    );
  });

  it('applies taskbar overlay icon on Windows when unread count > 0', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    applyBadgeCount(5, false);
    expect(getBadgeCount()).toBe(5);
    expect(mockSetOverlayIcon).toHaveBeenCalledWith(expect.anything(), '5 unread notifications');
  });

  it('clears taskbar overlay icon on Windows when count is 0', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    applyBadgeCount(0);
    expect(getBadgeCount()).toBe(0);
    expect(mockSetOverlayIcon).toHaveBeenCalledWith(null, '');
  });

  it('shows a dot (not a count) on the macOS dock', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    applyBadgeCount(4);
    expect(mockSetBadge).toHaveBeenCalledWith('•');

    applyBadgeCount(120);
    expect(mockSetBadge).toHaveBeenLastCalledWith('•');

    applyBadgeCount(0);
    expect(mockSetBadge).toHaveBeenCalledWith('');
  });

  it('refreshBadgeOverlay re-applies the overlay icon on Windows when restored', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    applyBadgeCount(7, false);
    mockSetOverlayIcon.mockClear();

    refreshBadgeOverlay();
    expect(mockSetOverlayIcon).toHaveBeenCalledWith(expect.anything(), '7 unread notifications');
  });
});

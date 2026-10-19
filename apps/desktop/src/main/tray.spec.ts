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

  it('buildOverlayBadge creates a blue notification indicator bitmap', () => {
    const badge = buildOverlayBadge(3);
    expect(badge).toBeDefined();

    // Verify cache returns identical instance
    const badgeAgain = buildOverlayBadge(3);
    expect(badgeAgain).toBe(badge);

    // Verify higher count badge (e.g. >9)
    const badgeHigh = buildOverlayBadge(25);
    expect(badgeHigh).toBeDefined();
  });

  it('applies taskbar overlay icon on Windows when unread count > 0', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    applyBadgeCount(5);
    expect(getBadgeCount()).toBe(5);
    expect(mockSetOverlayIcon).toHaveBeenCalledWith(expect.anything(), '5 unread notifications');
  });

  it('clears taskbar overlay icon on Windows when count is 0', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    applyBadgeCount(0);
    expect(getBadgeCount()).toBe(0);
    expect(mockSetOverlayIcon).toHaveBeenCalledWith(null, '');
  });

  it('uses app.dock.setBadge on macOS', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    applyBadgeCount(4);
    expect(mockSetBadge).toHaveBeenCalledWith('4');

    applyBadgeCount(120);
    expect(mockSetBadge).toHaveBeenCalledWith('99+');

    applyBadgeCount(0);
    expect(mockSetBadge).toHaveBeenCalledWith('');
  });

  it('refreshBadgeOverlay re-applies the overlay icon on Windows when restored', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    applyBadgeCount(7);
    mockSetOverlayIcon.mockClear();

    refreshBadgeOverlay();
    expect(mockSetOverlayIcon).toHaveBeenCalledWith(expect.anything(), '7 unread notifications');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const setUserActivityMock = vi.fn();
const invalidateCurrentActivityMock = vi.fn();
const getCurrentActivityTypeMock = vi.fn(() => 'ai.onetab.chat');
const mockSend = vi.fn();
const mockIsLoading = vi.fn(() => false);
const mockIsDestroyed = vi.fn(() => false);

const mockWindow = {
  webContents: {
    send: mockSend,
    isLoading: mockIsLoading,
  },
  isDestroyed: mockIsDestroyed,
};

vi.mock('electron', () => ({
  app: {
    setUserActivity: setUserActivityMock,
    invalidateCurrentActivity: invalidateCurrentActivityMock,
    getCurrentActivityType: getCurrentActivityTypeMock,
  },
}));
vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));
vi.mock('./window.js', () => ({
  getMainWindow: vi.fn(() => mockWindow),
  showMainWindow: vi.fn(),
}));

const {
  setUserActivity,
  invalidateUserActivity,
  getCurrentActivityType,
  dispatchHandoffActivity,
  flushPendingHandoff,
} = await import('./handoff.js');

describe('Apple Handoff & User Activity', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading.mockReturnValue(false);
    mockIsDestroyed.mockReturnValue(false);
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('manages user activity on darwin', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    const setSuccess = setUserActivity('ai.onetab.workspace', { workspaceId: 'ws_1' }, 'https://onetab.ai/w/ws_1');
    expect(setSuccess).toBe(true);
    expect(setUserActivityMock).toHaveBeenCalledWith('ai.onetab.workspace', { workspaceId: 'ws_1' }, 'https://onetab.ai/w/ws_1');

    expect(getCurrentActivityType()).toBe('ai.onetab.chat');

    invalidateUserActivity();
    expect(invalidateCurrentActivityMock).toHaveBeenCalled();
  });

  it('safely skips handoff activity methods on non-darwin platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    expect(setUserActivity('ai.onetab.workspace')).toBe(false);
    expect(setUserActivityMock).not.toHaveBeenCalled();
    expect(getCurrentActivityType()).toBeNull();

    invalidateUserActivity();
    expect(invalidateCurrentActivityMock).not.toHaveBeenCalled();
  });

  it('dispatches and flushes handoff activity events to renderer', () => {
    dispatchHandoffActivity({ activityType: 'ai.onetab.doc', userInfo: { docId: 'doc_123' } });
    expect(mockSend).toHaveBeenCalledWith(
      'onetab:event/handoff-activity',
      expect.objectContaining({ activityType: 'ai.onetab.doc' }),
    );

    mockSend.mockClear();
    mockIsLoading.mockReturnValue(true);
    dispatchHandoffActivity({ activityType: 'ai.onetab.queued' });
    expect(mockSend).not.toHaveBeenCalled();

    mockIsLoading.mockReturnValue(false);
    flushPendingHandoff();
    expect(mockSend).toHaveBeenCalledWith(
      'onetab:event/handoff-activity',
      expect.objectContaining({ activityType: 'ai.onetab.queued' }),
    );
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const setUserTasks = vi.fn(() => true);
const clearRecentDocumentsMock = vi.fn();
const addRecentDocumentMock = vi.fn();

vi.mock('electron', () => ({
  app: {
    setUserTasks,
    clearRecentDocuments: clearRecentDocumentsMock,
    addRecentDocument: addRecentDocumentMock,
  },
}));
vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { setupWindowsJumpList, getJumpListStatus, clearRecentDocuments, addRecentDocument } =
  await import('./jump-list.js');

describe('Windows Jump List & OS Recent Documents', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('installs default jump list tasks on win32', () => {
    Object.defineProperty(process, 'platform', { value: 'win32' });

    const success = setupWindowsJumpList();
    expect(success).toBe(true);
    expect(setUserTasks).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ title: 'New Channel', arguments: 'onetab://channels/new' }),
        expect.objectContaining({ title: 'Ask AI Assistant', arguments: 'onetab://ai' }),
        expect.objectContaining({ title: 'Search', arguments: 'onetab://search' }),
        expect.objectContaining({ title: 'Settings', arguments: 'onetab://settings' }),
      ]),
    );

    const status = getJumpListStatus();
    expect(status.supported).toBe(true);
    expect(status.tasksCount).toBe(4);
  });

  it('gracefully no-ops on non-win32 platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    const success = setupWindowsJumpList();
    expect(success).toBe(false);
    expect(setUserTasks).not.toHaveBeenCalled();

    const status = getJumpListStatus();
    expect(status.supported).toBe(false);
    expect(status.tasksCount).toBe(0);
  });

  it('delegates clearRecentDocuments and addRecentDocument to electron app', () => {
    clearRecentDocuments();
    expect(clearRecentDocumentsMock).toHaveBeenCalled();

    addRecentDocument('/path/to/doc.pdf');
    expect(addRecentDocumentMock).toHaveBeenCalledWith('/path/to/doc.pdf');
  });
});

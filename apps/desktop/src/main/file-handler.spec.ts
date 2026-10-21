import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    addRecentDocument: vi.fn(),
  },
}));
vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));
vi.mock('./jump-list.js', () => ({
  addRecentDocument: vi.fn(),
}));
vi.mock('./window.js', () => ({
  getMainWindow: vi.fn(() => mockWindow),
  showMainWindow: vi.fn(),
}));

// Mock node:fs existsSync and statSync
vi.mock('node:fs', () => ({
  existsSync: vi.fn((path: string) => path.includes('exists')),
  statSync: vi.fn((path: string) => ({
    isFile: () => !path.includes('dir'),
  })),
}));

const {
  guessFileMimeType,
  isFilePathArg,
  fileFromArgv,
  dispatchFileOpened,
  flushPendingFile,
} = await import('./file-handler.js');

describe('FileHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading.mockReturnValue(false);
    mockIsDestroyed.mockReturnValue(false);
  });

  it('guesses file mime types correctly', () => {
    expect(guessFileMimeType('photo.png')).toBe('image/png');
    expect(guessFileMimeType('doc.pdf')).toBe('application/pdf');
    expect(guessFileMimeType('data.json')).toBe('application/json');
    expect(guessFileMimeType('unknown.xyz')).toBe('application/octet-stream');
  });

  it('validates file paths from arguments correctly', () => {
    expect(isFilePathArg('--flag')).toBe(false);
    expect(isFilePathArg('onetab://some/route')).toBe(false);
    expect(isFilePathArg('does-not-exist.txt')).toBe(false);
    expect(isFilePathArg('sample-exists.txt')).toBe(true);
    expect(isFilePathArg('folder-exists-dir')).toBe(false);
  });

  it('extracts file path from argv array', () => {
    const argv = ['node.exe', 'sample-exists.txt', '--hidden'];
    expect(fileFromArgv(argv)).toBe('sample-exists.txt');
  });

  it('dispatches fileOpened event when window is ready', () => {
    const dispatched = dispatchFileOpened('my-exists.png');
    expect(dispatched).toBe(true);
    expect(mockSend).toHaveBeenCalledWith(
      'onetab:event/file-opened',
      expect.objectContaining({
        name: 'my-exists.png',
        mimeType: 'image/png',
      }),
    );
  });

  it('queues pending file when window is loading and flushes later', () => {
    mockIsLoading.mockReturnValue(true);
    dispatchFileOpened('queued-exists.pdf');
    expect(mockSend).not.toHaveBeenCalled();

    mockIsLoading.mockReturnValue(false);
    flushPendingFile();
    expect(mockSend).toHaveBeenCalledWith(
      'onetab:event/file-opened',
      expect.objectContaining({
        name: 'queued-exists.pdf',
        mimeType: 'application/pdf',
      }),
    );
  });
});

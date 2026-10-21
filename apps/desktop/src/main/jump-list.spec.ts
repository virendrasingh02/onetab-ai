import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const setJumpList = vi.fn((_categories: unknown) => 'ok');
const clearRecentDocumentsMock = vi.fn();
const addRecentDocumentMock = vi.fn();

vi.mock('electron', () => ({
  app: {
    setJumpList,
    getPath: vi.fn(() => '/mock/userData'),
    clearRecentDocuments: clearRecentDocumentsMock,
    addRecentDocument: addRecentDocumentMock,
  },
  nativeImage: { createFromPath: vi.fn() },
}));
vi.mock('./logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const {
  setupWindowsJumpList,
  setJumpListWorkspaces,
  getJumpListStatus,
  clearRecentDocuments,
  addRecentDocument,
} = await import('./jump-list.js');

type Category = { type: string; name?: string; items: Array<{ title: string; args: string }> };
const lastCategories = () => setJumpList.mock.calls.at(-1)?.[0] as unknown as Category[];

describe('Windows Jump List & OS Recent Documents', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process, 'platform', { value: 'win32' });
    setJumpListWorkspaces([]);
    setupWindowsJumpList();
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
  });

  it('installs the default tasks as command links', () => {
    expect(setupWindowsJumpList()).toBe(true);
    const categories = lastCategories();
    expect(categories).toHaveLength(1);
    expect(categories[0].type).toBe('tasks');
    expect(categories[0].items.map((item) => item.title)).toEqual([
      'Search',
      'Ask AI Assistant',
      'Move Onetab AI to Current Display',
    ]);
    expect(categories[0].items[0].args).toContain('onetab://command/open-search');
    expect(getJumpListStatus()).toEqual({ supported: true, tasksCount: 3, workspacesCount: 0 });
  });

  it('adds a Workspaces category ahead of the tasks', () => {
    expect(
      setJumpListWorkspaces([
        { name: 'Relibit Labs', slug: 'relibit-labs' },
        { name: 'Onetab', slug: 'onetab' },
      ]),
    ).toBe(true);
    const [workspaces, tasks] = lastCategories();
    expect(workspaces).toMatchObject({ type: 'custom', name: 'Workspaces' });
    expect(workspaces.items.map((item) => item.title)).toEqual(['Relibit Labs', 'Onetab']);
    expect(workspaces.items[0].args).toContain('onetab://w/relibit-labs');
    expect(tasks.type).toBe('tasks');
    expect(getJumpListStatus().workspacesCount).toBe(2);
  });

  it('drops malformed, duplicate and unsafe workspace entries', () => {
    setJumpListWorkspaces([
      { name: 'Good', slug: 'good' },
      { name: 'Dupe', slug: 'good' },
      { name: 'Evil', slug: '../settings' },
      { name: '', slug: 'blank' },
      null,
      'nope',
    ]);
    expect(lastCategories()[0].items.map((item) => item.title)).toEqual(['Good']);
  });

  it('skips rebuilding when the workspace list is unchanged', () => {
    setJumpListWorkspaces([{ name: 'Onetab', slug: 'onetab' }]);
    setJumpListWorkspaces([{ name: 'Onetab', slug: 'onetab' }]);
    expect(setJumpList).toHaveBeenCalledTimes(1);
  });

  it('falls back to tasks only when Windows denies custom categories', () => {
    setJumpList.mockReturnValueOnce('customCategoryAccessDeniedError');
    expect(setJumpListWorkspaces([{ name: 'Onetab', slug: 'onetab' }])).toBe(true);
    expect(setJumpList).toHaveBeenCalledTimes(2);
    expect(lastCategories().map((category) => category.type)).toEqual(['tasks']);
  });

  it('gracefully no-ops on non-win32 platforms', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin' });

    expect(setupWindowsJumpList()).toBe(false);
    expect(setJumpList).not.toHaveBeenCalled();
    expect(getJumpListStatus()).toEqual({ supported: false, tasksCount: 0, workspacesCount: 0 });
  });

  it('delegates clearRecentDocuments and addRecentDocument to electron app', () => {
    clearRecentDocuments();
    expect(clearRecentDocumentsMock).toHaveBeenCalled();

    addRecentDocument('/path/to/doc.pdf');
    expect(addRecentDocumentMock).toHaveBeenCalledWith('/path/to/doc.pdf');
  });
});

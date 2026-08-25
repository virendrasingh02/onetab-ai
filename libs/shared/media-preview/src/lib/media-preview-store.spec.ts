import type { MediaItem } from './types.js';
import { useMediaPreviewStore } from './media-preview-store.js';

function item(overrides: Partial<MediaItem>): MediaItem {
  return {
    id: overrides.id ?? 'item',
    name: 'file',
    mimeType: 'text/plain',
    category: 'text',
    ...overrides,
  };
}

afterEach(() => {
  useMediaPreviewStore.getState().close();
});

describe('useMediaPreviewStore', () => {
  it('opens with the given items and start index', () => {
    const items = [item({ id: 'a' }), item({ id: 'b' })];
    useMediaPreviewStore.getState().open(items, 1);

    const state = useMediaPreviewStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.items).toEqual(items);
    expect(state.activeIndex).toBe(1);
  });

  it('clamps an out-of-range start index', () => {
    useMediaPreviewStore.getState().open([item({ id: 'a' })], 5);
    expect(useMediaPreviewStore.getState().activeIndex).toBe(0);
  });

  it('closes without clearing items, so a closing animation has something to render', () => {
    const items = [item({ id: 'a' })];
    useMediaPreviewStore.getState().open(items);
    useMediaPreviewStore.getState().close();

    const state = useMediaPreviewStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.items).toEqual(items);
  });

  it('wraps around with next/previous, and no-ops for a single item', () => {
    useMediaPreviewStore.getState().open([item({ id: 'a' })]);
    useMediaPreviewStore.getState().next();
    expect(useMediaPreviewStore.getState().activeIndex).toBe(0);

    useMediaPreviewStore
      .getState()
      .open([item({ id: 'a' }), item({ id: 'b' }), item({ id: 'c' })], 2);
    useMediaPreviewStore.getState().next();
    expect(useMediaPreviewStore.getState().activeIndex).toBe(0);

    useMediaPreviewStore.getState().previous();
    expect(useMediaPreviewStore.getState().activeIndex).toBe(2);
  });

  it('goTo ignores an out-of-range index', () => {
    useMediaPreviewStore.getState().open([item({ id: 'a' }), item({ id: 'b' })]);
    useMediaPreviewStore.getState().goTo(9);
    expect(useMediaPreviewStore.getState().activeIndex).toBe(0);
    useMediaPreviewStore.getState().goTo(1);
    expect(useMediaPreviewStore.getState().activeIndex).toBe(1);
  });

  describe('resolve', () => {
    it('returns a caller-supplied url immediately, without touching resolvedUrls', async () => {
      const target = item({ id: 'a', url: 'https://example.test/a.png' });
      const url = await useMediaPreviewStore.getState().resolve(target);

      expect(url).toBe('https://example.test/a.png');
      expect(useMediaPreviewStore.getState().resolvedUrls['a']).toBeUndefined();
    });

    it('caches a lazily-resolved url and revokes it only on close', async () => {
      const revokeSpy = vi
        .spyOn(URL, 'revokeObjectURL')
        .mockImplementation(() => undefined);
      const resolveUrl = vi.fn().mockResolvedValue('blob:resolved-a');
      const target = item({ id: 'a', url: undefined, resolveUrl });

      useMediaPreviewStore.getState().open([target]);
      const url = await useMediaPreviewStore.getState().resolve(target);
      expect(url).toBe('blob:resolved-a');
      expect(resolveUrl).toHaveBeenCalledTimes(1);

      // Second call reuses the cached value, no second fetch.
      await useMediaPreviewStore.getState().resolve(target);
      expect(resolveUrl).toHaveBeenCalledTimes(1);

      useMediaPreviewStore.getState().close();
      expect(revokeSpy).toHaveBeenCalledWith('blob:resolved-a');

      revokeSpy.mockRestore();
    });

    it('never revokes a caller-supplied item.url on close', async () => {
      const revokeSpy = vi
        .spyOn(URL, 'revokeObjectURL')
        .mockImplementation(() => undefined);
      const target = item({ id: 'a', url: 'https://example.test/a.png' });

      useMediaPreviewStore.getState().open([target]);
      await useMediaPreviewStore.getState().resolve(target);
      useMediaPreviewStore.getState().close();

      expect(revokeSpy).not.toHaveBeenCalled();
      revokeSpy.mockRestore();
    });

    it('records an error and clears the loading flag when resolveUrl rejects', async () => {
      const resolveUrl = vi.fn().mockRejectedValue(new Error('network down'));
      const target = item({ id: 'a', url: undefined, resolveUrl });

      useMediaPreviewStore.getState().open([target]);
      await useMediaPreviewStore.getState().resolve(target);

      const state = useMediaPreviewStore.getState();
      expect(state.errors['a']).toBe('network down');
      expect(state.resolvingIds['a']).toBe(false);
    });
  });
});

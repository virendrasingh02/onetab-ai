import { act, renderHook, waitFor } from '@testing-library/react';
import { useMentionNavigation } from './use-mention-navigation.js';

/** A scroll viewport whose top/bottom edges are 0..500, with rows placed by y. */
function fakeViewport(rows: Record<string, { top: number; bottom: number }>) {
  const el = document.createElement('div');
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    bottom: 500,
    left: 0,
    right: 400,
    width: 400,
    height: 500,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);

  el.querySelector = ((selector: string) => {
    const match = /data-message-id="([^"]+)"/.exec(selector);
    const id = match?.[1];
    if (!id || !rows[id]) return null;
    const row = document.createElement('div');
    vi.spyOn(row, 'getBoundingClientRect').mockReturnValue({
      ...rows[id],
      left: 0,
      right: 400,
      width: 400,
      height: rows[id].bottom - rows[id].top,
      x: 0,
      y: rows[id].top,
      toJSON: () => ({}),
    } as DOMRect);
    return row;
  }) as typeof el.querySelector;

  return el;
}

describe('useMentionNavigation', () => {
  it('points down when the nearest unread mention is below the viewport', async () => {
    const scrollToMessage = vi.fn().mockResolvedValue(true);
    const viewport = fakeViewport({
      m1: { top: 700, bottom: 740 },
      m2: { top: 900, bottom: 940 },
    });

    const { result } = renderHook(() =>
      useMentionNavigation({
        ids: ['m1', 'm2'],
        unloadedCount: 0,
        scrollElement: viewport,
        scrollToMessage,
      }),
    );

    await waitFor(() => expect(result.current.direction).toBe('down'));
    expect(result.current.remaining).toBe(2);
  });

  it('points up when every loaded mention is above the viewport', async () => {
    const viewport = fakeViewport({
      m1: { top: -200, bottom: -160 },
      m2: { top: -80, bottom: -40 },
    });

    const { result } = renderHook(() =>
      useMentionNavigation({
        ids: ['m1', 'm2'],
        unloadedCount: 0,
        scrollElement: viewport,
        scrollToMessage: vi.fn().mockResolvedValue(true),
      }),
    );

    await waitFor(() => expect(result.current.direction).toBe('up'));
  });

  it('points up when only older, unloaded mentions remain', async () => {
    const { result } = renderHook(() =>
      useMentionNavigation({
        ids: [],
        unloadedCount: 2,
        scrollElement: fakeViewport({}),
        scrollToMessage: vi.fn().mockResolvedValue(true),
      }),
    );

    await waitFor(() => expect(result.current.direction).toBe('up'));
    expect(result.current.remaining).toBe(2);
  });

  it('hides (direction null) when the remaining mentions are all in view', async () => {
    const viewport = fakeViewport({ m1: { top: 100, bottom: 140 } });

    const { result } = renderHook(() =>
      useMentionNavigation({
        ids: ['m1'],
        unloadedCount: 0,
        scrollElement: viewport,
        scrollToMessage: vi.fn().mockResolvedValue(true),
      }),
    );

    await waitFor(() => expect(result.current.direction).toBeNull());
  });

  it('jumps to the nearest mention below, then reports it reached', async () => {
    const scrollToMessage = vi.fn().mockResolvedValue(true);
    const onMentionReached = vi.fn();
    const viewport = fakeViewport({
      m1: { top: 700, bottom: 740 },
      m2: { top: 900, bottom: 940 },
    });

    const { result } = renderHook(() =>
      useMentionNavigation({
        ids: ['m1', 'm2'],
        unloadedCount: 0,
        scrollElement: viewport,
        scrollToMessage,
        onMentionReached,
      }),
    );

    await act(async () => {
      result.current.jumpToNext();
    });

    expect(scrollToMessage).toHaveBeenCalledWith('m1');
    await waitFor(() => expect(onMentionReached).toHaveBeenCalledWith('m1'));
  });
});

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLongPress } from './use-long-press.js';

type PointerLike = Partial<{
  pointerType: string;
  button: number;
  clientX: number;
  clientY: number;
}>;

const down = (o: PointerLike = {}) =>
  ({ pointerType: 'touch', button: 0, clientX: 0, clientY: 0, ...o }) as never;

describe('useLongPress', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('fires after the hold delay', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, { delay: 400 }));

    act(() => result.current.onPointerDown(down()));
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(399));
    expect(onLongPress).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('cancels when the pointer lifts early', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress, { delay: 400 }));

    act(() => result.current.onPointerDown(down()));
    act(() => vi.advanceTimersByTime(200));
    act(() => result.current.onPointerUp(down()));
    act(() => vi.advanceTimersByTime(400));

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('cancels when the pointer drifts past the move tolerance (a scroll)', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress(onLongPress, { delay: 400, moveTolerance: 10 }),
    );

    act(() => result.current.onPointerDown(down({ clientX: 0, clientY: 0 })));
    act(() => result.current.onPointerMove(down({ clientX: 0, clientY: 40 })));
    act(() => vi.advanceTimersByTime(400));

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('ignores non-primary mouse buttons', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));

    act(() =>
      result.current.onPointerDown(down({ pointerType: 'mouse', button: 2 })),
    );
    act(() => vi.advanceTimersByTime(1000));

    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('fires once on contextmenu and suppresses the native menu', () => {
    const onLongPress = vi.fn();
    const preventDefault = vi.fn();
    const { result } = renderHook(() => useLongPress(onLongPress));

    act(() =>
      result.current.onContextMenu({ preventDefault } as never),
    );
    expect(preventDefault).toHaveBeenCalled();
    expect(onLongPress).toHaveBeenCalledTimes(1);

    // A contextmenu raised right after a touch long-press must not double-fire.
    act(() => result.current.onPointerDown(down()));
    act(() => vi.advanceTimersByTime(500));
    expect(onLongPress).toHaveBeenCalledTimes(2);
    act(() => result.current.onContextMenu({ preventDefault } as never));
    expect(onLongPress).toHaveBeenCalledTimes(2);
  });

  it('does nothing when disabled', () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() =>
      useLongPress(onLongPress, { disabled: true }),
    );

    act(() => result.current.onPointerDown(down()));
    act(() => vi.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();
  });
});

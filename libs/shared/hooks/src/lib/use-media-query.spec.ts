import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  useBreakpoint,
  useIsMobile,
  useKeyboardInset,
  useMediaQuery,
} from './use-media-query.js';

/**
 * A `matchMedia` stand-in that evaluates `(min-width: Npx)` / `(max-width: Npx)`
 * against a mutable width and notifies listeners when `setWidth` crosses a
 * boundary — enough to exercise the hooks without a real layout engine.
 */
function installMatchMedia(initialWidth: number) {
  let width = initialWidth;
  const lists = new Set<{
    query: string;
    listeners: Set<() => void>;
    matches: boolean;
  }>();

  const evaluate = (query: string): boolean => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    if (min && width < Number(min[1])) return false;
    if (max && width > Number(max[1])) return false;
    return Boolean(min || max);
  };

  window.matchMedia = ((query: string) => {
    const entry = {
      query,
      listeners: new Set<() => void>(),
      matches: evaluate(query),
    };
    lists.add(entry);
    return {
      get matches() {
        return evaluate(query);
      },
      media: query,
      addEventListener: (_: string, cb: () => void) => entry.listeners.add(cb),
      removeEventListener: (_: string, cb: () => void) =>
        entry.listeners.delete(cb),
      addListener: (cb: () => void) => entry.listeners.add(cb),
      removeListener: (cb: () => void) => entry.listeners.delete(cb),
      dispatchEvent: () => true,
      onchange: null,
    } as unknown as MediaQueryList;
  }) as typeof window.matchMedia;

  return {
    setWidth(next: number) {
      width = next;
      for (const entry of lists) {
        const now = evaluate(entry.query);
        if (now !== entry.matches) {
          entry.matches = now;
          entry.listeners.forEach((cb) => cb());
        }
      }
    },
  };
}

describe('useMediaQuery', () => {
  afterEach(() => {
    // @ts-expect-error — reset between tests
    delete window.matchMedia;
  });

  it('reflects the initial match and updates when the boundary is crossed', () => {
    const mm = installMatchMedia(1200);
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(true);

    act(() => mm.setWidth(800));
    expect(result.current).toBe(false);

    act(() => mm.setWidth(1024));
    expect(result.current).toBe(true);
  });
});

describe('useIsMobile', () => {
  afterEach(() => {
    // @ts-expect-error — reset between tests
    delete window.matchMedia;
  });

  it('is true below 768px and false at/above it', () => {
    const mm = installMatchMedia(375);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);

    act(() => mm.setWidth(768));
    expect(result.current).toBe(false);
  });
});

describe('useBreakpoint', () => {
  afterEach(() => {
    // @ts-expect-error — reset between tests
    delete window.matchMedia;
  });

  it('classifies phone / tablet / desktop and exposes up/down helpers', () => {
    const mm = installMatchMedia(375);
    const { result } = renderHook(() => useBreakpoint());

    expect(result.current.isMobile).toBe(true);
    expect(result.current.active).toBe('base');
    expect(result.current.up('md')).toBe(false);
    expect(result.current.down('md')).toBe(true);

    act(() => mm.setWidth(834)); // iPad portrait
    expect(result.current.isTablet).toBe(true);
    expect(result.current.isMobile).toBe(false);
    expect(result.current.active).toBe('md');

    act(() => mm.setWidth(1440));
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.up('xl')).toBe(true);
    expect(result.current.active).toBe('xl');
  });
});

describe('useKeyboardInset', () => {
  const original = Object.getOwnPropertyDescriptor(window, 'visualViewport');

  beforeEach(() => {
    (window as unknown as { innerHeight: number }).innerHeight = 800;
  });

  afterEach(() => {
    if (original) Object.defineProperty(window, 'visualViewport', original);
  });

  it('reports the covered height from visualViewport and flags open state', async () => {
    const listeners: Record<string, Set<() => void>> = {
      resize: new Set(),
      scroll: new Set(),
    };
    const vv = {
      height: 800,
      offsetTop: 0,
      addEventListener: (e: string, cb: () => void) => listeners[e]?.add(cb),
      removeEventListener: (e: string, cb: () => void) =>
        listeners[e]?.delete(cb),
    };
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: vv,
    });

    const { result } = renderHook(() => useKeyboardInset());

    await act(async () => {
      await new Promise((r) => requestAnimationFrame(r));
    });
    expect(result.current.height).toBe(0);
    expect(result.current.isOpen).toBe(false);

    await act(async () => {
      vv.height = 460; // keyboard opened, ~340px tall
      listeners.resize.forEach((cb) => cb());
      await new Promise((r) => requestAnimationFrame(r));
    });
    expect(result.current.height).toBe(340);
    expect(result.current.isOpen).toBe(true);
  });
});

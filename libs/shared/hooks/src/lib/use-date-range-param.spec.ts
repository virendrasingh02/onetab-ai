import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDateRangeParam } from './use-date-range-param.js';

function useHarness(initial: string, storageKey?: string) {
  const [params, setParams] = useState(() => new URLSearchParams(initial));
  const [range, setRange] = useDateRangeParam(params, setParams, { storageKey });
  return { params, range, setRange };
}

afterEach(() => window.sessionStorage.clear());

describe('useDateRangeParam', () => {
  it('reads the range from the URL', () => {
    const { result } = renderHook(() => useHarness('range=last_7_days'));
    expect(result.current.range).toEqual({ preset: 'last_7_days' });
  });

  it('defaults to the last 30 days', () => {
    const { result } = renderHook(() => useHarness(''));
    expect(result.current.range).toEqual({ preset: 'last_30_days' });
  });

  it('writes custom ranges and keeps unrelated params', () => {
    const { result } = renderHook(() => useHarness('tab=users'));
    act(() =>
      result.current.setRange({ preset: 'custom', from: '2026-09-01', to: '2026-09-05' }),
    );
    expect(result.current.params.get('tab')).toBe('users');
    expect(result.current.params.get('range')).toBe('custom');
    expect(result.current.range).toEqual({
      preset: 'custom',
      from: '2026-09-01',
      to: '2026-09-05',
    });
  });

  it('remembers the choice for the next screen without a range in its URL', () => {
    const first = renderHook(() => useHarness('', 'analytics:ws1'));
    act(() => first.result.current.setRange({ preset: 'this_month' }));

    const next = renderHook(() => useHarness('', 'analytics:ws1'));
    expect(next.result.current.range).toEqual({ preset: 'this_month' });

    // A different scope does not inherit it.
    const other = renderHook(() => useHarness('', 'analytics:ws2'));
    expect(other.result.current.range).toEqual({ preset: 'last_30_days' });
  });
});

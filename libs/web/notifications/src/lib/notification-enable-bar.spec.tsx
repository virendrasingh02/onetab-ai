import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationPermissionBar } from './notification-enable-bar.js';

describe('useNotificationPermissionBar', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('initializes with default permission state', () => {
    const { result } = renderHook(() => useNotificationPermissionBar());
    expect(result.current.permission).toBeDefined();
    expect(result.current.isSnoozed).toBe(false);
    expect(result.current.isDismissed).toBe(false);
  });

  it('handles snooze state properly', () => {
    const { result } = renderHook(() => useNotificationPermissionBar());

    act(() => {
      result.current.snooze(24);
    });

    expect(result.current.isSnoozed).toBe(true);

    act(() => {
      result.current.resetBarState();
    });

    expect(result.current.isSnoozed).toBe(false);
  });

  it('handles permanent dismissal state', () => {
    const { result } = renderHook(() => useNotificationPermissionBar());

    act(() => {
      result.current.dismissPermanently();
    });

    expect(result.current.isDismissed).toBe(true);

    act(() => {
      result.current.resetBarState();
    });

    expect(result.current.isDismissed).toBe(false);
  });
});

import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useMicrophonePermission } from './use-microphone-permission.js';

function installGetUserMedia() {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: async () => ({ getTracks: () => [] }) },
  });
}

function removeGetUserMedia() {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: undefined,
  });
}

describe('useMicrophonePermission', () => {
  afterEach(() => {
    removeGetUserMedia();
    // @ts-expect-error — reset between tests
    delete navigator.permissions;
  });

  it('reports unsupported when the browser has no getUserMedia at all', () => {
    removeGetUserMedia();
    const { result } = renderHook(() => useMicrophonePermission());
    expect(result.current).toBe('unsupported');
  });

  it('stays "prompt" when getUserMedia exists but there is no Permissions API for it (Safari/Firefox)', () => {
    installGetUserMedia();
    const { result } = renderHook(() => useMicrophonePermission());
    expect(result.current).toBe('prompt');
  });

  it('reflects the live Permissions API state and its change events (Chrome/Edge)', async () => {
    installGetUserMedia();
    let onChange: (() => void) | null = null;
    const status = {
      state: 'granted' as PermissionState,
      addEventListener: (_: string, cb: () => void) => {
        onChange = cb;
      },
      removeEventListener: () => undefined,
    };
    Object.defineProperty(navigator, 'permissions', {
      configurable: true,
      value: { query: async () => status },
    });

    const { result } = renderHook(() => useMicrophonePermission());
    await waitFor(() => expect(result.current).toBe('granted'));

    act(() => {
      status.state = 'denied';
      onChange?.();
    });
    expect(result.current).toBe('denied');
  });
});

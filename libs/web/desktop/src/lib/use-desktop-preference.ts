import { useCallback, useEffect, useState } from 'react';
import { getDesktopApi } from './desktop-api.js';

/**
 * A preference owned by the desktop shell rather than the web app.
 *
 * These live in the shell's own store because the main process acts on them
 * (registering a login item, deciding whether closing the window really quits),
 * so `localStorage` in the renderer would be the wrong home.
 *
 * In a browser the value stays at `fallback` and writes are dropped — callers
 * should hide the control entirely rather than rely on that, but it keeps a
 * stray render from throwing.
 */
export function useDesktopPreference<T>(
  key: string,
  fallback: T,
): [T, (value: T) => void, { ready: boolean }] {
  const [value, setValue] = useState<T>(fallback);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const api = getDesktopApi();
    if (!api) {
      setReady(true);
      return;
    }

    let active = true;
    void api.preferences.get(key).then((stored) => {
      if (!active) return;
      // `null` means "never set", which must not clobber a `false` default.
      if (stored !== null && stored !== undefined) setValue(stored as T);
      setReady(true);
    });

    return () => {
      active = false;
    };
  }, [key]);

  const update = useCallback(
    (next: T) => {
      // Optimistic: the write is fire-and-forget and the toggle should not sit
      // in a stale position while a round trip completes.
      setValue(next);
      void getDesktopApi()?.preferences.set(key, next);
    },
    [key],
  );

  return [value, update, { ready }];
}

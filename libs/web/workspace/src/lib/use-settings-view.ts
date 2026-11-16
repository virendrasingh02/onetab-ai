import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * The selected sub-page of a settings section, kept in `?view=` so a sub-page
 * survives reloads and can be deep-linked (`/settings/security?view=sessions`).
 * Unknown or missing values fall back to the first id; `aliases` maps legacy
 * values (e.g. `work` → `contact`).
 */
export function useSettingsView<T extends string>(
  ids: readonly T[],
  aliases: Record<string, T> = {},
): [T, (next: string) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('view') ?? '';
  const resolved = (aliases[raw] ?? raw) as T;
  const value = ids.includes(resolved) ? resolved : ids[0];

  const setValue = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          if (next === ids[0]) params.delete('view');
          else params.set('view', next);
          return params;
        },
        { replace: true },
      );
    },
    // `ids` is a module constant at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSearchParams, ids[0]],
  );

  return [value, setValue];
}

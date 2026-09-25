import {
  DEFAULT_DATE_RANGE,
  parseDateRangeParams,
  writeDateRangeParams,
  type DateRangeValue,
} from '@org/utils';
import { useCallback, useMemo } from 'react';

type SetSearchParams = (
  next: URLSearchParams,
  options?: { replace?: boolean },
) => void;

export interface UseDateRangeParamOptions {
  /**
   * `sessionStorage` key remembering the last choice, so moving between the
   * screens of one analytics area keeps the range even though each screen's
   * URL starts without `?range=`. Scope it per area (and per workspace where a
   * workspace is in scope) so one area's range never leaks into another.
   */
  storageKey?: string;
  fallback?: DateRangeValue;
}

function readRemembered(key: string | undefined): DateRangeValue | null {
  if (!key) return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? parseDateRangeParams(new URLSearchParams(raw), DEFAULT_DATE_RANGE) : null;
  } catch {
    // Storage blocked (private mode, sandboxed frame): the URL alone still works.
    return null;
  }
}

function remember(key: string | undefined, value: DateRangeValue): void {
  if (!key) return;
  try {
    window.sessionStorage.setItem(
      key,
      writeDateRangeParams(new URLSearchParams(), value).toString(),
    );
  } catch {
    // Best effort only; see readRemembered.
  }
}

/**
 * URL-backed date-range state for an analytics screen (`?range=…&from=…&to=…`).
 *
 * Router-agnostic on purpose — callers pass their router's search params and
 * setter (`useSearchParams()` in react-router) — so the web app and the admin
 * console share one implementation without this library depending on a
 * router. The URL wins; the remembered session value is only the default for
 * a URL that has no range yet.
 */
export function useDateRangeParam(
  searchParams: URLSearchParams,
  setSearchParams: SetSearchParams,
  { storageKey, fallback = DEFAULT_DATE_RANGE }: UseDateRangeParamOptions = {},
): [DateRangeValue, (next: DateRangeValue) => void] {
  const serialized = searchParams.toString();

  const value = useMemo(() => {
    const params = new URLSearchParams(serialized);
    if (params.has('range')) return parseDateRangeParams(params, fallback);
    return readRemembered(storageKey) ?? fallback;
  }, [serialized, storageKey, fallback]);

  const setValue = useCallback(
    (next: DateRangeValue) => {
      remember(storageKey, next);
      setSearchParams(writeDateRangeParams(new URLSearchParams(serialized), next), {
        replace: true,
      });
    },
    [serialized, setSearchParams, storageKey],
  );

  return [value, setValue];
}

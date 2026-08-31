import { userApi } from '@org/api-client';
import {
  useTheme,
  type Accent,
  type Density,
  type RadiusPreset,
  type Theme,
} from '@org/design-system';
import type { ThemeConfig } from '@org/types';
import { useEffect, useRef } from 'react';

const SAVE_DEBOUNCE_MS = 900;

interface ThemeBlob {
  theme?: Theme;
  density?: Density;
  accent?: Accent;
  radius?: RadiusPreset;
  customTheme?: ThemeConfig | null;
}

/**
 * Keeps the user's appearance settings in sync with the server.
 *
 * `ThemeProvider` still writes every choice to localStorage for instant first
 * paint, but the server copy (`/users/me/theme`) is authoritative: on mount it
 * is fetched and applied, and every subsequent change to mode / density /
 * accent / radius / custom theme is debounced back with `PUT`. This is what
 * makes a customized theme survive logout and follow the user to another
 * device — the same contract as `useSidebarSync`.
 *
 * Rendered once, inside `<ThemeProvider>`, by `Providers`.
 */
export function useThemeSync(enabled: boolean): void {
  const {
    theme,
    density,
    accent,
    radius,
    customTheme,
    setTheme,
    setDensity,
    setAccent,
    setRadius,
    setCustomTheme,
  } = useTheme();

  const hydratedRef = useRef(false);
  const lastSavedRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Pull the server copy once and apply it over the local defaults.
  useEffect(() => {
    if (!enabled || hydratedRef.current) return;
    let cancelled = false;

    userApi
      .themeSettings()
      .then((remote) => {
        if (cancelled || !remote || typeof remote !== 'object') return;
        const r = remote as ThemeBlob;
        // customTheme carries its own mode, so apply it before setTheme.
        if (r.customTheme !== undefined) setCustomTheme(r.customTheme ?? null);
        if (r.density) setDensity(r.density);
        if (r.accent) setAccent(r.accent);
        if (r.radius) setRadius(r.radius);
        if (r.theme) setTheme(r.theme);
      })
      .catch(() => {
        // Offline or unauthenticated — the localStorage copy stands in.
      })
      .finally(() => {
        if (!cancelled) hydratedRef.current = true;
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, setTheme, setDensity, setAccent, setRadius, setCustomTheme]);

  // 2. Push local changes back, debounced, once hydrated.
  useEffect(() => {
    if (!enabled || !hydratedRef.current) return;

    const blob: ThemeBlob = {
      theme,
      density,
      accent,
      radius,
      customTheme: customTheme ?? null,
    };
    const serialized = JSON.stringify(blob);
    if (serialized === lastSavedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastSavedRef.current = serialized;
      userApi
        .saveThemeSettings(blob as unknown as Record<string, unknown>)
        .catch(() => {
          // A failed save just means the next change retries; the local
          // store and its localStorage copy are unaffected.
          lastSavedRef.current = '';
        });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, theme, density, accent, radius, customTheme]);
}

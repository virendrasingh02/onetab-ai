import { queryKeys, userApi, workspaceApi } from '@org/api-client';
import { useTheme } from '@org/design-system';
import {
  DESIGN_SYSTEM_DEFAULT_APPEARANCE,
  type ResolvedAppearance,
  type ThemeAppearance,
} from '@org/types';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useActiveWorkspaceId } from './use-active-workspace-id';

const SAVE_DEBOUNCE_MS = 900;

function snapshot(a: {
  theme: string;
  density: string;
  accent: string;
  radius: string;
  customTheme: unknown;
}): string {
  return JSON.stringify({
    theme: a.theme,
    density: a.density,
    accent: a.accent,
    radius: a.radius,
    customTheme: a.customTheme ?? null,
  });
}

/**
 * Keeps the painted appearance in sync with the **active workspace's** stored
 * appearance, and persists the user's changes back to that workspace.
 *
 * This is the workspace-scoped successor to `useThemeSync`:
 *
 *  - On mount and on every workspace switch it reads
 *    `GET /workspaces/:id/settings/appearance` and applies `resolved`
 *    (member override → workspace default → user-global → design-system
 *    default) through the `ThemeProvider`.
 *  - Subsequent changes the user makes via the theme UI are debounced back to
 *    `PUT /workspaces/:id/settings/appearance/me` — the member's own override
 *    for *this* workspace, so it never affects another workspace or another
 *    member. The workspace *default* is edited separately, in workspace
 *    settings, and lands here as a query invalidation.
 *  - With no active workspace (e.g. the create-workspace screen) it falls back
 *    to the legacy user-global `/users/me/theme`, preserving prior behaviour.
 *
 * Rendered once, inside `<ThemeProvider>`, by `Providers`.
 */
export function useWorkspaceAppearanceSync(enabled: boolean): void {
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

  const activeWorkspaceId = useActiveWorkspaceId();

  const hydratedRef = useRef(false);
  const lastAppliedRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The workspace the currently-hydrated appearance belongs to. A switch resets
  // `hydratedRef` so the re-hydration from localStorage is never echoed back as
  // a "change" and saved.
  const hydratedForRef = useRef<string | null>(null);

  const appearanceQuery = useQuery({
    queryKey: queryKeys.workspaces.appearance(activeWorkspaceId ?? ''),
    queryFn: () => workspaceApi.appearance(activeWorkspaceId as string),
    enabled: enabled && !!activeWorkspaceId,
    staleTime: 60_000,
    // Pick up a change made on another device / the desktop app.
    refetchOnWindowFocus: true,
  });

  const applyResolved = (resolved: ResolvedAppearance) => {
    // `customTheme` first: it can carry its own mode.
    setCustomTheme(resolved.customTheme ?? null);
    setDensity(resolved.density);
    setAccent(resolved.accent);
    setRadius(resolved.radius);
    setTheme(resolved.theme);
    lastAppliedRef.current = snapshot({ ...resolved });
    hydratedRef.current = true;
    hydratedForRef.current = activeWorkspaceId ?? null;
  };

  // A workspace switch: stop echoing until the new workspace's blob lands.
  useEffect(() => {
    if (hydratedForRef.current !== (activeWorkspaceId ?? null)) {
      hydratedRef.current = false;
    }
  }, [activeWorkspaceId]);

  // 1a. Apply the workspace's resolved appearance whenever it (re)loads.
  useEffect(() => {
    if (!enabled || !activeWorkspaceId) return;
    const data = appearanceQuery.data;
    if (!data) return;
    const next = snapshot({ ...data.resolved });
    if (next !== lastAppliedRef.current || !hydratedRef.current) {
      applyResolved(data.resolved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, activeWorkspaceId, appearanceQuery.data]);

  // 1b. No active workspace — fall back to the legacy user-global blob.
  useEffect(() => {
    if (!enabled || activeWorkspaceId) return;
    let cancelled = false;
    userApi
      .themeSettings()
      .then((remote) => {
        if (cancelled || !remote || typeof remote !== 'object') return;
        const r = remote as ThemeAppearance;
        applyResolved({
          theme: r.theme ?? DESIGN_SYSTEM_DEFAULT_APPEARANCE.theme,
          density: r.density ?? DESIGN_SYSTEM_DEFAULT_APPEARANCE.density,
          accent: r.accent ?? DESIGN_SYSTEM_DEFAULT_APPEARANCE.accent,
          radius: r.radius ?? DESIGN_SYSTEM_DEFAULT_APPEARANCE.radius,
          customTheme: r.customTheme ?? null,
        });
      })
      .catch(() => {
        hydratedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, activeWorkspaceId]);

  // 2. Push the user's changes back, debounced, once hydrated.
  useEffect(() => {
    if (!enabled || !hydratedRef.current) return;

    const blob: ThemeAppearance = {
      theme,
      density,
      accent,
      radius,
      customTheme: customTheme ?? null,
    };
    const serialized = snapshot({ theme, density, accent, radius, customTheme });
    if (serialized === lastAppliedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastAppliedRef.current = serialized;
      const save = activeWorkspaceId
        ? workspaceApi.saveMyWorkspaceAppearance(activeWorkspaceId, blob)
        : userApi.saveThemeSettings(blob as unknown as Record<string, unknown>);
      Promise.resolve(save).catch(() => {
        // Retry on the next change; the local store + its localStorage copy
        // are unaffected.
        lastAppliedRef.current = '';
      });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, activeWorkspaceId, theme, density, accent, radius, customTheme]);
}

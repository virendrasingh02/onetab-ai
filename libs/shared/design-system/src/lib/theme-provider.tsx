import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ThemeConfig } from '@org/types';
import type { Accent, Density, RadiusPreset } from './tokens.js';
import { generateThemeVariables } from './theme-color-generator.js';

export type Theme = 'light' | 'dark' | 'system';
/** The theme actually painted, after `system` has been resolved. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'onetab.theme';
export const DENSITY_STORAGE_KEY = 'onetab.density';
export const ACCENT_STORAGE_KEY = 'onetab.accent';
export const RADIUS_STORAGE_KEY = 'onetab.radius';
export const CUSTOM_THEME_STORAGE_KEY = 'onetab.custom_theme';

/** localStorage key holding the id of the workspace the user last had open. */
export const ACTIVE_WORKSPACE_STORAGE_KEY = 'onetab_active_workspace_id';

const MODES = ['light', 'dark', 'system'] as const;
const DENSITY_VALUES = ['compact', 'default', 'comfortable'] as const;
const ACCENT_VALUES = [
  'mint', 'violet', 'blue', 'green', 'amber', 'pink', 'cyan', 'orange', 'indigo', 'teal', 'rose',
] as const;
const RADIUS_VALUES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

/**
 * Appearance is stored per workspace, so the same browser paints a different
 * theme depending on which workspace is open and one workspace's look never
 * leaks into another. `scopeKey` (the active workspace id) suffixes every
 * storage key; the unscoped keys are still written on each change as a
 * "last painted" mirror the pre-paint script falls back to.
 */
interface ScopedKeys {
  theme: string;
  density: string;
  accent: string;
  radius: string;
  custom: string;
}

function baseKeys(): ScopedKeys {
  return {
    theme: THEME_STORAGE_KEY,
    density: DENSITY_STORAGE_KEY,
    accent: ACCENT_STORAGE_KEY,
    radius: RADIUS_STORAGE_KEY,
    custom: CUSTOM_THEME_STORAGE_KEY,
  };
}

function scopedKeys(scopeKey: string | null | undefined): ScopedKeys {
  if (!scopeKey) return baseKeys();
  const s = `::${scopeKey}`;
  return {
    theme: THEME_STORAGE_KEY + s,
    density: DENSITY_STORAGE_KEY + s,
    accent: ACCENT_STORAGE_KEY + s,
    radius: RADIUS_STORAGE_KEY + s,
    custom: CUSTOM_THEME_STORAGE_KEY + s,
  };
}

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  density: Density;
  accent: Accent;
  radius: RadiusPreset;
  customTheme: ThemeConfig | null;
  draftTheme: ThemeConfig | null;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
  setAccent: (accent: Accent) => void;
  setRadius: (radius: RadiusPreset) => void;
  setCustomTheme: (config: ThemeConfig | null) => void;
  setDraftTheme: (config: ThemeConfig | null) => void;
  resetTheme: () => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function prefersDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStoredValue<T extends string>(
  storageKey: string,
  defaultValue: T,
  validValues: readonly T[],
): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored && (validValues as readonly string[]).includes(stored)) {
      return stored as T;
    }
  } catch {
    // Storage disabled / private browsing
  }
  return defaultValue;
}

function readStoredCustomTheme(storageKey: string): ThemeConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      return JSON.parse(stored) as ThemeConfig;
    }
  } catch {
    // Storage disabled / invalid
  }
  return null;
}

/** Writes to the scoped key and mirrors to the unscoped key for first paint. */
function persist(scopedKey: string, baseKey: string, value: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(scopedKey, value);
    if (scopedKey !== baseKey) window.localStorage.setItem(baseKey, value);
  } catch {
    // Non-fatal
  }
}

function clearKey(scopedKey: string, baseKey: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(scopedKey);
    if (scopedKey !== baseKey) window.localStorage.removeItem(baseKey);
  } catch {
    // Non-fatal
  }
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light';
  return theme;
}

/** Injects or clears custom CSS variables style block. */
function applyCustomThemeVariables(config: ThemeConfig | null, resolved: ResolvedTheme) {
  if (typeof document === 'undefined') return;

  const styleId = 'onetab-custom-theme-vars';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

  const hasCustomData =
    config &&
    (config.type !== 'default' ||
      Boolean(config.brandColor) ||
      Boolean(config.neutralColor) ||
      (config.colors && Object.keys(config.colors).length > 0) ||
      (config.gradients && Object.keys(config.gradients).length > 0) ||
      (config.typography && Object.keys(config.typography).length > 0) ||
      (config.shape && Object.keys(config.shape).length > 0) ||
      (config.shadows && Object.keys(config.shadows).length > 0) ||
      (config.backgrounds && Object.keys(config.backgrounds).length > 0));

  if (!config || !hasCustomData) {
    if (styleEl) {
      styleEl.remove();
    }
    return;
  }

  const vars = generateThemeVariables(config, undefined, resolved);

  const cssLines = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v} !important;`)
    .join('\n');

  const cssText = `:root, html, html.dark {\n${cssLines}\n}`;

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = cssText;
}

/** Applies the resolved theme, density, accent, radius, and custom theme variables to <html>. */
function applyAppearance(
  resolved: ResolvedTheme,
  density: Density,
  accent: Accent,
  radius: RadiusPreset,
  activeThemeConfig: ThemeConfig | null,
) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  root.setAttribute('data-density', density);
  root.setAttribute('data-accent', accent);
  root.setAttribute('data-radius', radius);
  applyCustomThemeVariables(activeThemeConfig, resolved);
}

export interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
  defaultDensity?: Density;
  defaultAccent?: Accent;
  defaultRadius?: RadiusPreset;
  storageKey?: string;
  /**
   * The active workspace id. When set, every appearance value is read from and
   * written to a workspace-namespaced key, so switching workspace swaps the
   * whole look and no change bleeds across workspaces. Persistence to the
   * server (per workspace) is handled separately by `WorkspaceAppearanceSync`.
   */
  scopeKey?: string | null;
}

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  defaultDensity = 'default',
  defaultAccent = 'mint',
  defaultRadius = 'md',
  storageKey = THEME_STORAGE_KEY,
  scopeKey = null,
}: ThemeProviderProps) {
  void storageKey; // kept for API compatibility; keys derive from scopeKey now

  const keys = useMemo(() => scopedKeys(scopeKey), [scopeKey]);
  const base = useMemo(() => baseKeys(), []);
  // Setters need the current keys without being torn down on every scope
  // change, so read them from a ref.
  const keysRef = useRef(keys);
  keysRef.current = keys;

  const [customTheme, setCustomThemeState] = useState<ThemeConfig | null>(() =>
    readStoredCustomTheme(scopedKeys(scopeKey).custom),
  );
  const [draftTheme, setDraftTheme] = useState<ThemeConfig | null>(null);

  const activeCustomTheme = draftTheme !== null ? draftTheme : customTheme;

  const [theme, setThemeState] = useState<Theme>(
    () =>
      activeCustomTheme?.mode ??
      readStoredValue(scopedKeys(scopeKey).theme, defaultTheme, MODES),
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolve(
      activeCustomTheme?.mode ??
        readStoredValue(scopedKeys(scopeKey).theme, defaultTheme, MODES),
    ),
  );

  const [density, setDensityState] = useState<Density>(() =>
    readStoredValue(scopedKeys(scopeKey).density, defaultDensity, DENSITY_VALUES),
  );
  const [accent, setAccentState] = useState<Accent>(() =>
    readStoredValue(scopedKeys(scopeKey).accent, defaultAccent, ACCENT_VALUES),
  );
  const [radius, setRadiusState] = useState<RadiusPreset>(() =>
    readStoredValue(scopedKeys(scopeKey).radius, defaultRadius, RADIUS_VALUES),
  );

  // Current painted values, for the scope-switch re-hydration below: a key the
  // new workspace has never stored keeps what's on screen rather than flashing
  // to a default, and `WorkspaceAppearanceSync` supplies the real value moments
  // later.
  const currentRef = useRef({ theme, density, accent, radius, customTheme });
  currentRef.current = { theme, density, accent, radius, customTheme };

  useEffect(() => {
    const next = resolve(theme);
    setResolvedTheme(next);
    applyAppearance(next, density, accent, radius, activeCustomTheme);
  }, [theme, density, accent, radius, activeCustomTheme]);

  // Track OS changes, but only while the user is on `system`.
  useEffect(() => {
    if (theme !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next: ResolvedTheme = query.matches ? 'dark' : 'light';
      setResolvedTheme(next);
      applyAppearance(next, density, accent, radius, activeCustomTheme);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [theme, density, accent, radius, activeCustomTheme]);

  // On a workspace switch, re-hydrate appearance from the new workspace's
  // namespace. Keys the new workspace has cached (from a prior visit) apply
  // instantly; keys it has never stored keep the current on-screen value rather
  // than flashing to a default, and `WorkspaceAppearanceSync` then overwrites
  // them with the server-resolved blob. Nothing here writes back to storage, so
  // holding the previous value briefly cannot leak into the new workspace's
  // saved appearance.
  const prevScopeRef = useRef<string | null | undefined>(scopeKey);
  useEffect(() => {
    if (prevScopeRef.current === scopeKey) return;
    prevScopeRef.current = scopeKey;

    const k = scopedKeys(scopeKey);
    const cur = currentRef.current;

    const rawCustom =
      typeof window !== 'undefined'
        ? (() => {
            try {
              return window.localStorage.getItem(k.custom);
            } catch {
              return null;
            }
          })()
        : null;
    const nextCustom =
      rawCustom !== null ? readStoredCustomTheme(k.custom) : cur.customTheme;
    const nextMode =
      nextCustom?.mode ??
      readStoredValue(k.theme, cur.theme, MODES);

    setCustomThemeState(nextCustom);
    setDraftTheme(null);
    setThemeState(nextMode);
    setDensityState(readStoredValue(k.density, cur.density, DENSITY_VALUES));
    setAccentState(readStoredValue(k.accent, cur.accent, ACCENT_VALUES));
    setRadiusState(readStoredValue(k.radius, cur.radius, RADIUS_VALUES));
    // The main effect re-applies to <html> because the state above changed.
  }, [scopeKey]);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      persist(keysRef.current.theme, base.theme, next);
      setCustomThemeState((current) => {
        if (!current) return current;
        const updated: ThemeConfig = { ...current, mode: next };
        persist(keysRef.current.custom, base.custom, JSON.stringify(updated));
        return updated;
      });
    },
    [base],
  );

  const setCustomTheme = useCallback(
    (next: ThemeConfig | null) => {
      setCustomThemeState(next);
      setDraftTheme(null);
      if (next) {
        setThemeState(next.mode);
        persist(keysRef.current.custom, base.custom, JSON.stringify(next));
        persist(keysRef.current.theme, base.theme, next.mode);
      } else {
        clearKey(keysRef.current.custom, base.custom);
      }
    },
    [base],
  );

  const setDensity = useCallback(
    (next: Density) => {
      setDensityState(next);
      persist(keysRef.current.density, base.density, next);
    },
    [base],
  );

  const setAccent = useCallback(
    (next: Accent) => {
      setAccentState(next);
      persist(keysRef.current.accent, base.accent, next);
    },
    [base],
  );

  const setRadius = useCallback(
    (next: RadiusPreset) => {
      setRadiusState(next);
      persist(keysRef.current.radius, base.radius, next);
    },
    [base],
  );

  const resetTheme = useCallback(() => {
    setCustomTheme(null);
    setTheme('dark');
    setDensity('default');
    setAccent('mint');
    setRadius('md');
  }, [setCustomTheme, setTheme, setDensity, setAccent, setRadius]);

  const toggleTheme = useCallback(() => {
    setTheme(resolve(theme) === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      density,
      accent,
      radius,
      customTheme,
      draftTheme,
      setTheme,
      setDensity,
      setAccent,
      setRadius,
      setCustomTheme,
      setDraftTheme,
      resetTheme,
      toggleTheme,
    }),
    [
      theme,
      resolvedTheme,
      density,
      accent,
      radius,
      customTheme,
      draftTheme,
      setTheme,
      setDensity,
      setAccent,
      setRadius,
      setCustomTheme,
      setDraftTheme,
      resetTheme,
      toggleTheme,
    ],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a <ThemeProvider>.');
  }
  return context;
}

/**
 * Inline script that applies stored appearance attributes before first paint.
 *
 * Reads the workspace-scoped keys (`<key>::<workspaceId>`) when a workspace id
 * is stored, falling back to the unscoped keys — so a reload lands on the
 * current workspace's theme, and an app with no workspace concept (admin)
 * behaves exactly as before.
 *
 * Must stay behaviourally identical to the inline copies in
 * `apps/web/index.html` and `apps/admin/index.html`.
 */
export const themeInitScript = `(function(){try{
  var el=document.documentElement;
  var ws=null;try{ws=localStorage.getItem('${ACTIVE_WORKSPACE_STORAGE_KEY}');}catch(e){}
  function g(base){var v=null;if(ws){try{v=localStorage.getItem(base+'::'+ws);}catch(e){}}if(v==null){try{v=localStorage.getItem(base);}catch(e){}}return v;}
  var k=g('${THEME_STORAGE_KEY}');
  var d=k==='dark'||(k==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
  el.classList.toggle('dark',d);
  el.style.colorScheme=d?'dark':'light';
  el.setAttribute('data-density',g('${DENSITY_STORAGE_KEY}')||'default');
  el.setAttribute('data-accent',g('${ACCENT_STORAGE_KEY}')||'mint');
  el.setAttribute('data-radius',g('${RADIUS_STORAGE_KEY}')||'md');
}catch(e){}})();`;

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
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

function readStoredValue<T extends string>(storageKey: string, defaultValue: T, validValues: readonly T[]): T {
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

function readStoredCustomTheme(): ThemeConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as ThemeConfig;
    }
  } catch {
    // Storage disabled / invalid
  }
  return null;
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

  if (!config || config.type === 'default' || (!config.brandColor && !config.neutralColor)) {
    if (styleEl) {
      styleEl.remove();
    }
    return;
  }

  const brand = config.brandColor || '#60c686';
  const neutral = config.neutralColor || (resolved === 'dark' ? '#0a0a0a' : '#fcfbf8');
  const vars = generateThemeVariables(brand, neutral, resolved);

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
}

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  defaultDensity = 'default',
  defaultAccent = 'mint',
  defaultRadius = 'md',
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  const [customTheme, setCustomThemeState] = useState<ThemeConfig | null>(readStoredCustomTheme);
  const [draftTheme, setDraftTheme] = useState<ThemeConfig | null>(null);

  const activeCustomTheme = draftTheme !== null ? draftTheme : customTheme;
  const activeMode = activeCustomTheme?.mode ?? readStoredValue(storageKey, defaultTheme, ['light', 'dark', 'system'] as const);

  const [theme, setThemeState] = useState<Theme>(activeMode);
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolve(activeMode));

  const [density, setDensityState] = useState<Density>(() =>
    readStoredValue(DENSITY_STORAGE_KEY, defaultDensity, ['compact', 'default', 'comfortable'] as const),
  );
  const [accent, setAccentState] = useState<Accent>(() =>
    readStoredValue(ACCENT_STORAGE_KEY, defaultAccent, [
      'mint', 'violet', 'blue', 'green', 'amber', 'pink', 'cyan', 'orange', 'indigo', 'teal', 'rose'
    ] as const),
  );
  const [radius, setRadiusState] = useState<RadiusPreset>(() =>
    readStoredValue(RADIUS_STORAGE_KEY, defaultRadius, ['xs', 'sm', 'md', 'lg', 'xl'] as const),
  );

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

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // Non-fatal
      }
      if (customTheme) {
        const updated: ThemeConfig = { ...customTheme, mode: next };
        setCustomThemeState(updated);
        try {
          window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Non-fatal
        }
      }
    },
    [storageKey, customTheme],
  );

  const setCustomTheme = useCallback(
    (next: ThemeConfig | null) => {
      setCustomThemeState(next);
      setDraftTheme(null);
      if (next) {
        setThemeState(next.mode);
        try {
          window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(next));
          window.localStorage.setItem(storageKey, next.mode);
        } catch {
          // Non-fatal
        }
      } else {
        try {
          window.localStorage.removeItem(CUSTOM_THEME_STORAGE_KEY);
        } catch {
          // Non-fatal
        }
      }
    },
    [storageKey],
  );

  const resetTheme = useCallback(() => {
    setCustomTheme(null);
    setTheme('dark');
    setDensity('default');
    setAccent('mint');
    setRadius('md');
  }, [setCustomTheme, setTheme]);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    try {
      window.localStorage.setItem(DENSITY_STORAGE_KEY, next);
    } catch {
      // Non-fatal
    }
  }, []);

  const setAccent = useCallback((next: Accent) => {
    setAccentState(next);
    try {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, next);
    } catch {
      // Non-fatal
    }
  }, []);

  const setRadius = useCallback((next: RadiusPreset) => {
    setRadiusState(next);
    try {
      window.localStorage.setItem(RADIUS_STORAGE_KEY, next);
    } catch {
      // Non-fatal
    }
  }, []);

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
 */
export const themeInitScript = `(function(){try{
  var k=localStorage.getItem('${THEME_STORAGE_KEY}');
  var d=k==='dark'||(k==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark',d);
  document.documentElement.style.colorScheme=d?'dark':'light';
  var den=localStorage.getItem('${DENSITY_STORAGE_KEY}')||'default';
  document.documentElement.setAttribute('data-density',den);
  var acc=localStorage.getItem('${ACCENT_STORAGE_KEY}')||'mint';
  document.documentElement.setAttribute('data-accent',acc);
  var rad=localStorage.getItem('${RADIUS_STORAGE_KEY}')||'md';
  document.documentElement.setAttribute('data-radius',rad);
}catch(e){}})();`;

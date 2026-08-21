import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Accent, Density, RadiusPreset } from './tokens.js';

export type Theme = 'light' | 'dark' | 'system';
/** The theme actually painted, after `system` has been resolved. */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'onetab.theme';
export const DENSITY_STORAGE_KEY = 'onetab.density';
export const ACCENT_STORAGE_KEY = 'onetab.accent';
export const RADIUS_STORAGE_KEY = 'onetab.radius';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  density: Density;
  accent: Accent;
  radius: RadiusPreset;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
  setAccent: (accent: Accent) => void;
  setRadius: (radius: RadiusPreset) => void;
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

function resolve(theme: Theme): ResolvedTheme {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light';
  return theme;
}

/** Applies the resolved theme, density, accent, and radius to <html> and document root. */
function applyAppearance(
  resolved: ResolvedTheme,
  density: Density,
  accent: Accent,
  radius: RadiusPreset,
) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
  root.setAttribute('data-density', density);
  root.setAttribute('data-accent', accent);
  root.setAttribute('data-radius', radius);
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
  const [theme, setThemeState] = useState<Theme>(() =>
    readStoredValue(storageKey, defaultTheme, ['light', 'dark', 'system'] as const),
  );
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolve(readStoredValue(storageKey, defaultTheme, ['light', 'dark', 'system'] as const)),
  );
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
    applyAppearance(next, density, accent, radius);
  }, [theme, density, accent, radius]);

  // Track OS changes, but only while the user is on `system`.
  useEffect(() => {
    if (theme !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const next: ResolvedTheme = query.matches ? 'dark' : 'light';
      setResolvedTheme(next);
      applyAppearance(next, density, accent, radius);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [theme, density, accent, radius]);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      try {
        window.localStorage.setItem(storageKey, next);
      } catch {
        // Non-fatal
      }
    },
    [storageKey],
  );

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
      setTheme,
      setDensity,
      setAccent,
      setRadius,
      toggleTheme,
    }),
    [theme, resolvedTheme, density, accent, radius, setTheme, setDensity, setAccent, setRadius, toggleTheme],
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


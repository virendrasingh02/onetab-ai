/**
 * TypeScript mirror of the CSS custom properties in `styles/theme.css`.
 *
 * Use these when a value must reach JavaScript (chart libraries, canvas,
 * inline styles). For anything rendered in the DOM prefer Tailwind utilities
 * so the token stays live under theme switches.
 */

/** Semantic colours, as `var(--token)` references that follow the theme. */
export const colorTokens = {
  background: 'var(--background)',
  foreground: 'var(--foreground)',
  card: 'var(--card)',
  popover: 'var(--popover)',
  primary: 'var(--primary)',
  primaryForeground: 'var(--primary-foreground)',
  secondary: 'var(--secondary)',
  muted: 'var(--muted)',
  mutedForeground: 'var(--muted-foreground)',
  accent: 'var(--accent)',
  destructive: 'var(--destructive)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  info: 'var(--info)',
  border: 'var(--border)',
  ring: 'var(--ring)',
  sidebar: 'var(--sidebar)',
  sidebarForeground: 'var(--sidebar-foreground)',
  surface: 'var(--surface)',
  surfaceMuted: 'var(--surface-muted)',
  surfaceRaised: 'var(--surface-raised)',
  surfaceInset: 'var(--surface-inset)',
} as const;

export type ColorToken = keyof typeof colorTokens;

/**
 * Categorical accents, in the order charts should consume them. Adjacent
 * entries are separated in hue so a series stays distinguishable.
 */
export const ACCENTS = [
  'violet',
  'blue',
  'green',
  'amber',
  'pink',
  'cyan',
  'orange',
  'indigo',
  'teal',
  'rose',
] as const;

export type Accent = (typeof ACCENTS)[number];

/** `var(--accent-*)` references for JS consumers (canvas, chart libraries). */
export const accentTokens = Object.fromEntries(
  ACCENTS.map((name) => [name, `var(--accent-${name})`]),
) as Record<Accent, string>;

/** Stable accent for an arbitrary key, so a label keeps its colour. */
export function accentFor(seed: string): Accent {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return ACCENTS[Math.abs(hash) % ACCENTS.length];
}

/** Motion, mirroring the `--animate-duration-*` / `--ease-*` tokens. */
export const motion = {
  fast: 0.15,
  base: 0.2,
  slow: 0.25,
  easeStandard: [0.2, 0, 0, 1],
  easeEntrance: [0, 0, 0, 1],
  easeExit: [0.3, 0, 1, 1],
} as const;

/** Stacking order. Mirrors the `--z-*` custom properties. */
export const zIndex = {
  base: 0,
  sticky: 10,
  rail: 20,
  dropdown: 30,
  overlay: 40,
  modal: 50,
  toast: 60,
  tooltip: 70,
} as const;

/** Fixed layout rails. Kept in TS because JS measures against them. */
export const layout = {
  workspaceRailWidth: 68,
  sidebarWidth: 260,
  sidebarMinWidth: 200,
  sidebarMaxWidth: 420,
  headerHeight: 56,
  rightPanelWidth: 320,
} as const;

/** Tailwind's default breakpoints, for `matchMedia` in JS. */
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof breakpoints;

/**
 * Deterministic avatar tint for a user or workspace with no uploaded image.
 * Hashing the id keeps the colour stable across sessions and devices.
 */
const AVATAR_TINTS = [
  'oklch(0.62 0.18 25)',
  'oklch(0.65 0.16 62)',
  'oklch(0.68 0.15 108)',
  'oklch(0.63 0.15 158)',
  'oklch(0.62 0.14 205)',
  'oklch(0.58 0.19 258)',
  'oklch(0.55 0.22 286)',
  'oklch(0.60 0.20 328)',
] as const;

export function avatarTint(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

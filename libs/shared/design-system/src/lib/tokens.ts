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
  selected: 'var(--selected)',
  subtle: 'var(--subtle)',
  disabled: 'var(--disabled)',
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
 * Density Scale definitions
 */
export const DENSITIES = ['compact', 'default', 'comfortable'] as const;
export type Density = (typeof DENSITIES)[number];

/**
 * Radius presets
 */
export const RADII = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
export type RadiusPreset = (typeof RADII)[number];

export const radiusScale = {
  xs: '4px',
  sm: '6px',
  md: '8px',
  lg: '10px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
} as const;

/** Spacing scale matching the design spec (4px to 128px) */
export const spacingScale = {
  0: '0px',
  1: '4px',
  1.5: '6px',
  2: '8px',
  2.5: '10px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
  32: '128px',
} as const;

/** Typography hierarchy */
export const typography = {
  fontSans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  sizes: {
    display: { fontSize: '32px', lineHeight: '38px', letterSpacing: '-0.03em', fontWeight: '700' },
    h1: { fontSize: '24px', lineHeight: '30px', letterSpacing: '-0.025em', fontWeight: '600' },
    h2: { fontSize: '20px', lineHeight: '26px', letterSpacing: '-0.02em', fontWeight: '600' },
    h3: { fontSize: '16px', lineHeight: '22px', letterSpacing: '-0.015em', fontWeight: '600' },
    h4: { fontSize: '14px', lineHeight: '20px', letterSpacing: '-0.01em', fontWeight: '600' },
    bodyLarge: { fontSize: '15px', lineHeight: '22px', letterSpacing: '-0.01em', fontWeight: '400' },
    body: { fontSize: '14px', lineHeight: '20px', letterSpacing: '-0.011em', fontWeight: '400' },
    bodySmall: { fontSize: '13px', lineHeight: '18px', letterSpacing: '-0.005em', fontWeight: '400' },
    caption: { fontSize: '12px', lineHeight: '16px', letterSpacing: '0em', fontWeight: '400' },
    label: { fontSize: '12px', lineHeight: '16px', letterSpacing: '0.01em', fontWeight: '500' },
    code: { fontSize: '13px', lineHeight: '18px', letterSpacing: '0em', fontWeight: '400' },
  },
} as const;

/**
 * Categorical accents, in the order charts should consume them. Adjacent
 * entries are separated in hue so a series stays distinguishable.
 */
export const ACCENTS = [
  'mint',
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
  ACCENTS.map((name) => [name, name === 'mint' ? 'var(--primary)' : `var(--accent-${name})`]),
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
  fast: 0.12,
  base: 0.18,
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
  workspaceRailWidth: 60,
  sidebarWidth: 240,
  sidebarMinWidth: 200,
  sidebarMaxWidth: 420,
  sidebarCollapsedWidth: 64,
  headerHeight: 48,
  toolbarHeight: 40,
  rightPanelWidth: 320,
  contentMaxWidth: 1600,
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
  '#EB5757',
  '#FC7840',
  '#F2C94C',
  '#4CB782',
  '#0F9B8E',
  '#26B5CE',
  '#4EA7FC',
  '#5E6AD2',
  '#6771D4',
  '#E07BB8',
] as const;

export function avatarTint(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_TINTS[Math.abs(hash) % AVATAR_TINTS.length];
}

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
  sidebarActive: 'var(--sidebar-active)',
  sidebarActiveForeground: 'var(--sidebar-active-foreground)',
  sidebarHover: 'var(--sidebar-hover)',
  sidebarBorder: 'var(--sidebar-border)',
  sidebarRing: 'var(--sidebar-ring)',
  appGradient: 'var(--app-gradient)',
  surfaceGradient: 'var(--surface-gradient)',
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
 * The avatar palette: 16 analogous two-stop gradients, a lighter stop flowing
 * into a deeper one of the *same* hue family. Same-family stops never pass
 * through the muddy grey a complementary pair (red → teal) produces, and the
 * deep stop keeps white initials legible.
 *
 * A member's slot is stored per workspace (`WorkspaceMember.avatarColor`,
 * assigned by the API so teammates stay distinct) and resolved by `UserAvatar`
 * through `AvatarColorProvider`; anyone without a stored slot (a chat
 * participant outside the roster, an app) falls back to a hash of their id.
 * Its length is `AVATAR_COLOR_COUNT` in `@org/types` — keep them in step.
 */
export const AVATAR_PALETTE = [
  { name: 'Coral', from: '#FF8A7A', to: '#E0434B' },
  { name: 'Tangerine', from: '#FFA45E', to: '#E0601F' },
  { name: 'Amber', from: '#F6B940', to: '#C9700A' },
  { name: 'Lime', from: '#9ACD52', to: '#4E8A22' },
  { name: 'Emerald', from: '#4FCF8E', to: '#1A8F5A' },
  { name: 'Teal', from: '#3CCBBB', to: '#0E8279' },
  { name: 'Cyan', from: '#4DC4EE', to: '#1680B5' },
  { name: 'Sky', from: '#6AB0FF', to: '#2A68D6' },
  { name: 'Indigo', from: '#8C93FF', to: '#4A4FD0' },
  { name: 'Violet', from: '#A88BFF', to: '#6A43D9' },
  { name: 'Grape', from: '#C67BFA', to: '#8737C7' },
  { name: 'Fuchsia', from: '#F07AD0', to: '#B8318F' },
  { name: 'Rose', from: '#FF84A6', to: '#CF3866' },
  { name: 'Ocean', from: '#5CAAC6', to: '#2A6585' },
  { name: 'Mocha', from: '#C79E78', to: '#80593A' },
  { name: 'Slate', from: '#94A3B8', to: '#4F5D72' },
] as const;

export type AvatarSwatch = (typeof AVATAR_PALETTE)[number];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Collapses the spellings of one identity onto a single hash input, so a person
 * gets the same fallback colour on every surface.
 *
 * Chat seeds an avatar with the Matrix user id the bridge minted for the
 * account (`@onetab_<id>:server`), while every other surface seeds it with the
 * bare database id. Left alone those hash differently and the same person shows
 * two different gradients. Unwrapping the bridge's `onetab_` prefix and the
 * `:server` suffix maps the chat spelling back to `<id>`; any other string
 * (including a raw id, an agent/app seed, or a fallback name) passes through
 * untouched, so no existing avatar changes colour.
 */
export function normalizeAvatarSeed(seed: string): string {
  // `@onetab_<id>:server` — or `:server:port` — collapses to `<id>`. The
  // localpart never contains a colon, so the first `:` ends the id.
  const match = /^@?onetab_([^:]+):.+$/.exec(seed.trim());
  return match ? match[1] : seed;
}

/**
 * The palette slot for an avatar: the stored per-workspace `color` when there
 * is a valid one, otherwise a stable hash of the (normalized) seed.
 */
export function avatarColorIndex(seed: string, color?: number | null): number {
  if (
    typeof color === 'number' &&
    Number.isInteger(color) &&
    color >= 0 &&
    color < AVATAR_PALETTE.length
  ) {
    return color;
  }
  return hashSeed(normalizeAvatarSeed(seed)) % AVATAR_PALETTE.length;
}

/** The swatch {@link avatarColorIndex} resolves to. */
export function avatarSwatch(seed: string, color?: number | null): AvatarSwatch {
  return AVATAR_PALETTE[avatarColorIndex(seed, color)];
}

/**
 * Solid fallback for an avatar — the swatch's deep stop, so initials on a flat
 * tile (workspace tiles, renderers that drop gradients) stay legible.
 */
export function avatarTint(seed: string, color?: number | null): string {
  return avatarSwatch(seed, color).to;
}

/**
 * The two-stop gradient for an avatar with no uploaded image. Every avatar uses
 * the same light-to-deep 135° direction, so a list of people reads as one set
 * and only the hue tells them apart. Returns a CSS `linear-gradient()` value
 * for `background-image`.
 */
export function avatarGradient(seed: string, color?: number | null): string {
  const { from, to } = avatarSwatch(seed, color);
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

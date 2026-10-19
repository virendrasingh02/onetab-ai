/**
 * Native mirror of the semantic tokens in
 * `libs/shared/design-system/src/styles/theme.css` (the default theme the web
 * app ships). CSS variables cannot reach React Native, so the values are
 * copied; keep the two in step when the palette changes.
 */
export interface Palette {
  background: string;
  foreground: string;
  card: string;
  primary: string;
  primaryForeground: string;
  primaryText: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  selected: string;
  subtle: string;
  disabled: string;
  destructive: string;
  destructiveForeground: string;
  destructiveText: string;
  success: string;
  successText: string;
  warning: string;
  warningText: string;
  info: string;
  infoText: string;
  border: string;
  borderStrong: string;
  input: string;
  ring: string;
}

export const lightPalette: Palette = {
  background: '#fcfbf8',
  foreground: '#11271f',
  card: '#ffffff',
  primary: '#60c686',
  primaryForeground: '#11271f',
  primaryText: '#037152',
  secondary: '#f5f5f5',
  secondaryForeground: '#33473f',
  muted: '#f8f8f8',
  mutedForeground: '#67766f',
  accent: '#f1f0ec',
  selected: '#e6ede8',
  subtle: '#8a958f',
  disabled: '#b4bcb7',
  destructive: '#e40014',
  destructiveForeground: '#ffffff',
  destructiveText: '#c40011',
  success: '#037152',
  successText: '#044e34',
  warning: '#e8a33c',
  warningText: '#8a5a12',
  info: '#4d6dd6',
  infoText: '#2f52b5',
  border: '#eeece6',
  borderStrong: '#ddd9cf',
  input: '#e5e5e5',
  ring: '#037152',
};

export const darkPalette: Palette = {
  background: '#0a0a0a',
  foreground: '#fafafa',
  card: '#171717',
  primary: '#60c686',
  primaryForeground: '#11271f',
  primaryText: '#60c686',
  secondary: '#262626',
  secondaryForeground: '#fafafa',
  muted: '#262626',
  mutedForeground: '#aeaeae',
  accent: '#262626',
  selected: '#1f2e26',
  subtle: '#8a8a8a',
  disabled: '#525252',
  destructive: '#ff6568',
  destructiveForeground: '#0a0a0a',
  destructiveText: '#ff8a8c',
  success: '#37b06f',
  successText: '#5fd394',
  warning: '#e8a33c',
  warningText: '#f2c072',
  info: '#7b96ea',
  infoText: '#9eb4f6',
  border: '#2e2e2e',
  borderStrong: '#3d3d3d',
  input: '#333333',
  ring: '#60c686',
};

/** `--radius` (6px) and the derived steps the web components use. */
export const radius = { sm: 4, md: 6, lg: 10, xl: 14, full: 999 } as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

/** Content never stretches wider than this on tablets. */
export const maxContentWidth = 760;

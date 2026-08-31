/**
 * Deterministic color mathematics, WCAG contrast analyzer & palette generation engine.
 *
 * Converts user-selected brand/neutral/custom color tokens and gradient configurations
 * into full WCAG-compliant CSS custom property variables for both light and dark modes.
 */

import type { ThemeConfig } from '@org/types';
import { generateCssGradient } from './gradient-engine.js';

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

/** Parses standard 3-digit or 6-digit hex string into RGB. */
export function hexToRgb(hex: string): RgbColor {
  const cleanHex = hex.replace(/^#/, '').trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return { r: isNaN(r) ? 0 : r, g: isNaN(g) ? 0 : g, b: isNaN(b) ? 0 : b };
  }
  return { r: 96, g: 198, b: 134 }; // Fallback mint
}

/** Converts RGB to 6-digit Hex. */
export function rgbToHex(rgb: RgbColor): string {
  const r = Math.max(0, Math.min(255, Math.round(rgb.r))).toString(16).padStart(2, '0');
  const g = Math.max(0, Math.min(255, Math.round(rgb.g))).toString(16).padStart(2, '0');
  const b = Math.max(0, Math.min(255, Math.round(rgb.b))).toString(16).padStart(2, '0');
  return `#${r}${g}${b}`;
}

/** Converts RGB to HSL. */
export function rgbToHsl(rgb: RgbColor): HslColor {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/** Converts HSL to RGB. */
export function hslToRgb(hsl: HslColor): RgbColor {
  const h = (hsl.h % 360) / 360;
  const s = Math.max(0, Math.min(100, hsl.s)) / 100;
  const l = Math.max(0, Math.min(100, hsl.l)) / 100;

  if (s === 0) {
    const val = Math.round(l * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let normalizedT = t;
    if (normalizedT < 0) normalizedT += 1;
    if (normalizedT > 1) normalizedT -= 1;
    if (normalizedT < 1 / 6) return p + (q - p) * 6 * normalizedT;
    if (normalizedT < 1 / 2) return q;
    if (normalizedT < 2 / 3) return p + (q - p) * (2 / 3 - normalizedT) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);

  return { r, g, b };
}

export function hslToHex(hsl: HslColor): string {
  return rgbToHex(hslToRgb(hsl));
}

/** Calculates Relative Luminance per WCAG 2.1 specs. */
export function getRelativeLuminance(rgb: RgbColor): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(rgb.r) + 0.7152 * toLinear(rgb.g) + 0.0722 * toLinear(rgb.b);
}

/** Calculates Contrast Ratio between two RGB colors (1:1 to 21:1). */
export function getContrastRatio(rgb1: RgbColor, rgb2: RgbColor): number {
  const l1 = getRelativeLuminance(rgb1);
  const l2 = getRelativeLuminance(rgb2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Validates whether a string is a valid Hex color code. */
export function isValidHexColor(hex: string | undefined | null): hex is string {
  if (!hex || typeof hex !== 'string') return false;
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
}

/** Result of WCAG contrast ratio analysis between foreground and background. */
export interface ContrastCheckResult {
  ratio: number;
  formattedRatio: string;
  passesAA: boolean; // >= 4.5:1 for normal text
  passesAALarge: boolean; // >= 3:1 for large text / UI elements
  passesAAA: boolean; // >= 7:1
  level: 'AAA' | 'AA' | 'Fail';
}

/** Checks WCAG 2.1 contrast ratio between two hex colors. */
export function checkContrast(fgHex: string, bgHex: string): ContrastCheckResult {
  const fgRgb = hexToRgb(isValidHexColor(fgHex) ? fgHex : '#ffffff');
  const bgRgb = hexToRgb(isValidHexColor(bgHex) ? bgHex : '#000000');
  const ratio = getContrastRatio(fgRgb, bgRgb);
  const roundedRatio = Math.round(ratio * 10) / 10;

  const passesAA = ratio >= 4.5;
  const passesAALarge = ratio >= 3.0;
  const passesAAA = ratio >= 7.0;

  return {
    ratio: roundedRatio,
    formattedRatio: `${roundedRatio}:1`,
    passesAA,
    passesAALarge,
    passesAAA,
    level: passesAAA ? 'AAA' : passesAA ? 'AA' : 'Fail',
  };
}

/** Derives optimal accessible foreground (dark or light) for any given background. */
export function getAccessibleForeground(bgHex: string): string {
  const rgb = hexToRgb(isValidHexColor(bgHex) ? bgHex : '#ffffff');
  const lum = getRelativeLuminance(rgb);
  return lum > 0.42 ? '#11271f' : '#ffffff';
}

/** Adjusts lightness of a hex color. */
export function adjustLightness(hex: string, deltaPercent: number): string {
  const hsl = rgbToHsl(hexToRgb(hex));
  const newL = Math.max(0, Math.min(100, hsl.l + deltaPercent));
  return hslToHex({ ...hsl, l: newL });
}

/** Generates a 10-step shade ramp (50..900) from a base color. */
export function generateShadeRamp(baseHex: string): Record<number, string> {
  const hsl = rgbToHsl(hexToRgb(baseHex));
  const steps: Record<number, string> = {
    50: hslToHex({ ...hsl, l: 96, s: Math.max(10, hsl.s * 0.4) }),
    100: hslToHex({ ...hsl, l: 92, s: Math.max(15, hsl.s * 0.5) }),
    200: hslToHex({ ...hsl, l: 84, s: Math.max(20, hsl.s * 0.65) }),
    300: hslToHex({ ...hsl, l: 74, s: Math.max(25, hsl.s * 0.8) }),
    400: hslToHex({ ...hsl, l: 62, s: hsl.s }),
    500: hslToHex({ ...hsl, l: 50, s: hsl.s }),
    600: hslToHex({ ...hsl, l: 40, s: Math.min(100, hsl.s * 1.05) }),
    700: hslToHex({ ...hsl, l: 30, s: Math.min(100, hsl.s * 1.1) }),
    800: hslToHex({ ...hsl, l: 20, s: Math.min(100, hsl.s * 1.15) }),
    900: hslToHex({ ...hsl, l: 12, s: Math.min(100, hsl.s * 1.2) }),
  };
  return steps;
}

export type GeneratedThemeCssVariables = Record<string, string>;

/**
 * Computes all CSS variables for custom themes dynamically from brand/neutral or full ThemeConfig.
 */
export function generateThemeVariables(
  brandHexOrConfig: string | ThemeConfig,
  neutralHexOrMode?: string | 'light' | 'dark',
  resolvedModeArg?: 'light' | 'dark',
): GeneratedThemeCssVariables {
  let config: ThemeConfig;
  let mode: 'light' | 'dark';

  if (typeof brandHexOrConfig === 'object' && brandHexOrConfig !== null) {
    config = brandHexOrConfig;
    mode = resolvedModeArg || (config.mode === 'dark' ? 'dark' : 'light');
  } else {
    const brand = brandHexOrConfig;
    const neutral = typeof neutralHexOrMode === 'string' && neutralHexOrMode !== 'light' && neutralHexOrMode !== 'dark'
      ? neutralHexOrMode
      : undefined;
    mode = resolvedModeArg || (neutralHexOrMode === 'dark' || neutralHexOrMode === 'light' ? neutralHexOrMode : 'light');
    config = {
      mode,
      type: 'custom',
      brandColor: brand,
      neutralColor: neutral,
    };
  }

  const customColors = config.colors || {};
  const customGradients = config.gradients || {};
  const customTypography = config.typography || {};
  const customShape = config.shape || {};
  const customShadows = config.shadows || {};
  const customBackgrounds = config.backgrounds || {};

  const safeBrand = isValidHexColor(customColors.primary)
    ? customColors.primary
    : isValidHexColor(config.brandColor)
      ? config.brandColor!
      : '#60c686';

  const safeNeutral = isValidHexColor(customColors.background)
    ? customColors.background
    : isValidHexColor(config.neutralColor)
      ? config.neutralColor!
      : mode === 'dark'
        ? '#0a0a0a'
        : '#fcfbf8';

  const brandRgb = hexToRgb(safeBrand);
  const brandHsl = rgbToHsl(brandRgb);
  const neutralHsl = rgbToHsl(hexToRgb(safeNeutral));

  const brandForeground = customColors.primaryForeground || getAccessibleForeground(safeBrand);

  const variables: Record<string, string> = {};

  if (mode === 'dark') {
    const darkHue = neutralHsl.h;
    const darkSat = Math.min(neutralHsl.s, 22);

    const bg = customColors.background || hslToHex({ h: darkHue, s: darkSat, l: 4 });
    const fg = customColors.foreground || '#fafafa';
    const card = customColors.card || hslToHex({ h: darkHue, s: darkSat, l: 8 });
    const cardFg = customColors.cardForeground || fg;
    const popover = hslToHex({ h: darkHue, s: darkSat, l: 11 });
    const surface = hslToHex({ h: darkHue, s: darkSat, l: 8 });
    const surfaceMuted = hslToHex({ h: darkHue, s: darkSat, l: 10 });
    const surfaceRaised = hslToHex({ h: darkHue, s: darkSat, l: 13 });
    const surfaceInset = hslToHex({ h: darkHue, s: darkSat, l: 15 });

    const border = customColors.border || hslToHex({ h: darkHue, s: darkSat, l: 18 });
    const borderStrong = hslToHex({ h: darkHue, s: darkSat, l: 24 });
    const input = customColors.input || 'rgba(255, 255, 255, 0.15)';

    const muted = customColors.muted || hslToHex({ h: darkHue, s: darkSat, l: 15 });
    const mutedFg = customColors.mutedForeground || hslToHex({ h: darkHue, s: Math.max(5, darkSat * 0.4), l: 68 });
    const accent = customColors.accent || hslToHex({ h: darkHue, s: darkSat, l: 15 });
    const accentFg = customColors.accentForeground || fg;
    const selected = hslToHex({ h: brandHsl.h, s: Math.min(60, brandHsl.s), l: 12 });

    const primaryHover = adjustLightness(safeBrand, 8);
    const primaryText = adjustLightness(safeBrand, 12);

    // Status
    const destructive = customColors.destructive || '#ff6568';
    const destructiveFg = customColors.destructiveForeground || '#2b0a0c';
    const success = customColors.success || '#37b06f';
    const successFg = customColors.successForeground || '#071812';
    const warning = customColors.warning || '#e8a33c';
    const warningFg = customColors.warningForeground || '#2a1f08';
    const info = customColors.info || '#92aaf0';
    const infoFg = customColors.infoForeground || '#080d20';

    Object.assign(variables, {
      '--primary': safeBrand,
      '--color-primary': safeBrand,
      '--primary-foreground': brandForeground,
      '--color-primary-foreground': brandForeground,
      '--primary-hover': primaryHover,
      '--color-primary-hover': primaryHover,
      '--primary-text': primaryText,
      '--ring': customColors.ring || safeBrand,
      '--color-ring': customColors.ring || safeBrand,

      '--secondary': customColors.secondary || '#071812',
      '--color-secondary': customColors.secondary || '#071812',
      '--secondary-foreground': customColors.secondaryForeground || '#fafafa',
      '--color-secondary-foreground': customColors.secondaryForeground || '#fafafa',

      '--background': bg,
      '--color-background': bg,
      '--foreground': fg,
      '--color-foreground': fg,

      '--card': card,
      '--color-card': card,
      '--card-foreground': cardFg,
      '--color-card-foreground': cardFg,

      '--popover': popover,
      '--color-popover': popover,
      '--popover-foreground': fg,
      '--color-popover-foreground': fg,

      '--surface': surface,
      '--color-surface': surface,
      '--surface-muted': surfaceMuted,
      '--color-surface-muted': surfaceMuted,
      '--surface-raised': surfaceRaised,
      '--color-surface-raised': surfaceRaised,
      '--surface-inset': surfaceInset,
      '--color-surface-inset': surfaceInset,

      '--border': border,
      '--color-border': border,
      '--border-strong': borderStrong,
      '--color-border-strong': borderStrong,
      '--input': input,
      '--color-input': input,

      '--muted': muted,
      '--color-muted': muted,
      '--muted-foreground': mutedFg,
      '--color-muted-foreground': mutedFg,

      '--accent': accent,
      '--color-accent': accent,
      '--accent-foreground': accentFg,
      '--color-accent-foreground': accentFg,
      '--selected': selected,

      '--destructive': destructive,
      '--color-destructive': destructive,
      '--destructive-foreground': destructiveFg,
      '--color-destructive-foreground': destructiveFg,

      '--success': success,
      '--color-success': success,
      '--success-foreground': successFg,
      '--color-success-foreground': successFg,

      '--warning': warning,
      '--color-warning': warning,
      '--warning-foreground': warningFg,
      '--color-warning-foreground': warningFg,

      '--info': info,
      '--color-info': info,
      '--info-foreground': infoFg,
      '--color-info-foreground': infoFg,

      '--sidebar': customColors.sidebar || bg,
      '--color-sidebar': customColors.sidebar || bg,
      '--sidebar-foreground': customColors.sidebarForeground || fg,
      '--color-sidebar-foreground': customColors.sidebarForeground || fg,
      '--sidebar-border': customColors.sidebarBorder || border,
      '--color-sidebar-border': customColors.sidebarBorder || border,
      '--sidebar-ring': safeBrand,
    });
  } else {
    const lightHue = neutralHsl.h;
    const lightSat = Math.min(neutralHsl.s, 16);

    const bg = customColors.background || hslToHex({ h: lightHue, s: lightSat, l: 98 });
    const fg = customColors.foreground || hslToHex({ h: lightHue, s: Math.min(30, lightSat * 2), l: 11 });
    const card = customColors.card || '#ffffff';
    const cardFg = customColors.cardForeground || fg;
    const popover = '#ffffff';
    const surface = '#ffffff';
    const surfaceMuted = hslToHex({ h: lightHue, s: lightSat, l: 97 });
    const surfaceRaised = hslToHex({ h: lightHue, s: lightSat, l: 95 });
    const surfaceInset = hslToHex({ h: lightHue, s: lightSat, l: 93 });

    const border = customColors.border || hslToHex({ h: lightHue, s: lightSat, l: 92 });
    const borderStrong = hslToHex({ h: lightHue, s: lightSat, l: 85 });
    const input = customColors.input || hslToHex({ h: lightHue, s: lightSat, l: 90 });

    const muted = customColors.muted || hslToHex({ h: lightHue, s: lightSat, l: 96 });
    const mutedFg = customColors.mutedForeground || hslToHex({ h: lightHue, s: Math.max(5, lightSat * 0.8), l: 45 });
    const accent = customColors.accent || hslToHex({ h: lightHue, s: lightSat, l: 94 });
    const accentFg = customColors.accentForeground || fg;
    const selected = hslToHex({ h: brandHsl.h, s: Math.min(40, brandHsl.s * 0.5), l: 92 });

    const primaryHover = adjustLightness(safeBrand, -8);
    const primaryText = adjustLightness(safeBrand, -20);

    // Status
    const destructive = customColors.destructive || '#e40014';
    const destructiveFg = customColors.destructiveForeground || '#ffffff';
    const success = customColors.success || '#037152';
    const successFg = customColors.successForeground || '#ffffff';
    const warning = customColors.warning || '#e8a33c';
    const warningFg = customColors.warningForeground || '#2a1f08';
    const info = customColors.info || '#4d6dd6';
    const infoFg = customColors.infoForeground || '#ffffff';

    Object.assign(variables, {
      '--primary': safeBrand,
      '--color-primary': safeBrand,
      '--primary-foreground': brandForeground,
      '--color-primary-foreground': brandForeground,
      '--primary-hover': primaryHover,
      '--color-primary-hover': primaryHover,
      '--primary-text': primaryText,
      '--ring': customColors.ring || primaryText,
      '--color-ring': customColors.ring || primaryText,

      '--secondary': customColors.secondary || '#f5f5f5',
      '--color-secondary': customColors.secondary || '#f5f5f5',
      '--secondary-foreground': customColors.secondaryForeground || '#33473f',
      '--color-secondary-foreground': customColors.secondaryForeground || '#33473f',

      '--background': bg,
      '--color-background': bg,
      '--foreground': fg,
      '--color-foreground': fg,

      '--card': card,
      '--color-card': card,
      '--card-foreground': cardFg,
      '--color-card-foreground': cardFg,

      '--popover': popover,
      '--color-popover': popover,
      '--popover-foreground': fg,
      '--color-popover-foreground': fg,

      '--surface': surface,
      '--color-surface': surface,
      '--surface-muted': surfaceMuted,
      '--color-surface-muted': surfaceMuted,
      '--surface-raised': surfaceRaised,
      '--color-surface-raised': surfaceRaised,
      '--surface-inset': surfaceInset,
      '--color-surface-inset': surfaceInset,

      '--border': border,
      '--color-border': border,
      '--border-strong': borderStrong,
      '--color-border-strong': borderStrong,
      '--input': input,
      '--color-input': input,

      '--muted': muted,
      '--color-muted': muted,
      '--muted-foreground': mutedFg,
      '--color-muted-foreground': mutedFg,

      '--accent': accent,
      '--color-accent': accent,
      '--accent-foreground': accentFg,
      '--color-accent-foreground': accentFg,
      '--selected': selected,

      '--destructive': destructive,
      '--color-destructive': destructive,
      '--destructive-foreground': destructiveFg,
      '--color-destructive-foreground': destructiveFg,

      '--success': success,
      '--color-success': success,
      '--success-foreground': successFg,
      '--color-success-foreground': successFg,

      '--warning': warning,
      '--color-warning': warning,
      '--warning-foreground': warningFg,
      '--color-warning-foreground': warningFg,

      '--info': info,
      '--color-info': info,
      '--info-foreground': infoFg,
      '--color-info-foreground': infoFg,

      '--sidebar': customColors.sidebar || bg,
      '--color-sidebar': customColors.sidebar || bg,
      '--sidebar-foreground': customColors.sidebarForeground || fg,
      '--color-sidebar-foreground': customColors.sidebarForeground || fg,
      '--sidebar-border': customColors.sidebarBorder || border,
      '--color-sidebar-border': customColors.sidebarBorder || border,
      '--sidebar-ring': primaryText,
    });
  }

  // --- Gradients Processing ---
  const defaultPrimaryGradient = `linear-gradient(135deg, ${safeBrand} 0%, ${adjustLightness(safeBrand, mode === 'dark' ? 15 : -15)} 100%)`;
  const defaultAccentGradient = `linear-gradient(135deg, ${safeBrand} 0%, #3b82f6 100%)`;
  const defaultHeroGradient = `radial-gradient(circle at 50% 0%, ${safeBrand}22 0%, transparent 70%)`;
  const defaultSidebarGradient = `linear-gradient(180deg, ${variables['--sidebar']} 0%, ${adjustLightness(variables['--sidebar'], mode === 'dark' ? 5 : -3)} 100%)`;

  variables['--gradient-primary'] = generateCssGradient(customGradients.primary, defaultPrimaryGradient);
  variables['--gradient-secondary'] = generateCssGradient(customGradients.secondary, defaultAccentGradient);
  variables['--gradient-accent'] = generateCssGradient(customGradients.accent, defaultAccentGradient);
  variables['--gradient-hero'] = generateCssGradient(customGradients.hero, defaultHeroGradient);
  variables['--gradient-sidebar'] = generateCssGradient(customGradients.sidebar, defaultSidebarGradient);
  variables['--gradient-button'] = generateCssGradient(customGradients.button, variables['--gradient-primary']);
  variables['--gradient-surface'] = generateCssGradient(customGradients.surface, `linear-gradient(180deg, ${variables['--surface']} 0%, ${variables['--surface-muted']} 100%)`);
  variables['--gradient-background'] = generateCssGradient(customGradients.background, variables['--background']);

  // Background types
  if (customBackgrounds.pageType === 'gradient' && customGradients.background) {
    variables['--app-gradient'] = generateCssGradient(customGradients.background);
  }

  // --- Geometry & Radius Processing ---
  if (customShape.radiusBase) {
    variables['--radius'] = customShape.radiusBase;
  }
  if (customShape.radiusButton) {
    variables['--radius-btn'] = customShape.radiusButton;
  }
  if (customShape.radiusCard) {
    variables['--radius-card'] = customShape.radiusCard;
  }
  if (customShape.radiusInput) {
    variables['--radius-input'] = customShape.radiusInput;
  }
  if (customShape.radiusDialog) {
    variables['--radius-dialog'] = customShape.radiusDialog;
  }

  // --- Typography Processing ---
  if (customTypography.fontFamily) {
    variables['--font-sans-stack'] = `'${customTypography.fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
  }
  if (customTypography.monoFamily) {
    variables['--font-mono-stack'] = `'${customTypography.monoFamily}', ui-monospace, SFMono-Regular, Menlo, monospace`;
  }
  if (customTypography.baseFontSize) {
    variables['--font-size-base'] = customTypography.baseFontSize;
  }
  if (customTypography.headingWeight) {
    variables['--font-heading-weight'] = customTypography.headingWeight;
  }
  if (customTypography.bodyWeight) {
    variables['--font-body-weight'] = customTypography.bodyWeight;
  }
  if (customTypography.lineHeight) {
    variables['--line-height-base'] = customTypography.lineHeight;
  }

  // --- Shadows & Elevation Processing ---
  if (customShadows.elevation) {
    if (customShadows.elevation === 'none') {
      variables['--shadow-elevated-value'] = 'none';
      variables['--shadow-overlay-value'] = 'none';
    } else if (customShadows.elevation === 'subtle') {
      variables['--shadow-elevated-value'] = '0 1px 3px rgba(0, 0, 0, 0.05)';
      variables['--shadow-overlay-value'] = '0 4px 12px rgba(0, 0, 0, 0.08)';
    } else if (customShadows.elevation === 'dramatic') {
      variables['--shadow-elevated-value'] = '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)';
      variables['--shadow-overlay-value'] = '0 25px 50px -12px rgba(0, 0, 0, 0.35)';
    }
  }

  return variables;
}

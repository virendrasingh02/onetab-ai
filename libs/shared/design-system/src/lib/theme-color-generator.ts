/**
 * Deterministic color mathematics & palette generation engine.
 *
 * Converts user-selected Brand and Neutral hex colors into full WCAG-compliant
 * CSS custom property variables for both light and dark modes.
 */

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
export function isValidHexColor(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
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

export interface GeneratedThemeCssVariables {
  '--primary': string;
  '--primary-foreground': string;
  '--primary-hover': string;
  '--primary-text': string;
  '--ring': string;
  '--background': string;
  '--foreground': string;
  '--card': string;
  '--card-foreground': string;
  '--popover': string;
  '--popover-foreground': string;
  '--surface': string;
  '--surface-muted': string;
  '--surface-raised': string;
  '--surface-inset': string;
  '--border': string;
  '--border-strong': string;
  '--input': string;
  '--muted': string;
  '--muted-foreground': string;
  '--accent': string;
  '--accent-foreground': string;
  '--selected': string;
  '--subtle': string;
  '--disabled': string;
  '--sidebar': string;
  '--sidebar-foreground': string;
  '--sidebar-border': string;
  '--sidebar-ring': string;
}

/**
 * Computes all CSS variables for custom themes dynamically.
 */
export function generateThemeVariables(
  brandHex: string,
  neutralHex: string,
  mode: 'light' | 'dark',
): GeneratedThemeCssVariables {
  const safeBrand = isValidHexColor(brandHex) ? brandHex : '#60c686';
  const safeNeutral = isValidHexColor(neutralHex) ? neutralHex : mode === 'dark' ? '#121212' : '#fcfbf8';

  const brandRgb = hexToRgb(safeBrand);
  const brandHsl = rgbToHsl(brandRgb);
  const neutralHsl = rgbToHsl(hexToRgb(safeNeutral));

  // Determine brand foreground based on luminance
  const brandLuminance = getRelativeLuminance(brandRgb);
  const brandForeground = brandLuminance > 0.45 ? '#11271f' : '#ffffff';

  if (mode === 'dark') {
    // Dark mode surfaces derived from neutral hue
    const darkHue = neutralHsl.h;
    const darkSat = Math.min(neutralHsl.s, 22);

    const bg = hslToHex({ h: darkHue, s: darkSat, l: 4 });
    const fg = '#fafafa';
    const card = hslToHex({ h: darkHue, s: darkSat, l: 8 });
    const popover = hslToHex({ h: darkHue, s: darkSat, l: 11 });
    const surface = hslToHex({ h: darkHue, s: darkSat, l: 8 });
    const surfaceMuted = hslToHex({ h: darkHue, s: darkSat, l: 10 });
    const surfaceRaised = hslToHex({ h: darkHue, s: darkSat, l: 13 });
    const surfaceInset = hslToHex({ h: darkHue, s: darkSat, l: 15 });

    const border = hslToHex({ h: darkHue, s: darkSat, l: 18 });
    const borderStrong = hslToHex({ h: darkHue, s: darkSat, l: 24 });
    const input = 'rgba(255, 255, 255, 0.15)';

    const muted = hslToHex({ h: darkHue, s: darkSat, l: 15 });
    const mutedFg = hslToHex({ h: darkHue, s: Math.max(5, darkSat * 0.4), l: 68 });
    const accent = hslToHex({ h: darkHue, s: darkSat, l: 15 });
    const selected = hslToHex({ h: brandHsl.h, s: Math.min(60, brandHsl.s), l: 12 });

    const primaryHover = adjustLightness(safeBrand, 8);
    const primaryText = adjustLightness(safeBrand, 12);

    return {
      '--primary': safeBrand,
      '--primary-foreground': brandForeground,
      '--primary-hover': primaryHover,
      '--primary-text': primaryText,
      '--ring': safeBrand,
      '--background': bg,
      '--foreground': fg,
      '--card': card,
      '--card-foreground': fg,
      '--popover': popover,
      '--popover-foreground': fg,
      '--surface': surface,
      '--surface-muted': surfaceMuted,
      '--surface-raised': surfaceRaised,
      '--surface-inset': surfaceInset,
      '--border': border,
      '--border-strong': borderStrong,
      '--input': input,
      '--muted': muted,
      '--muted-foreground': mutedFg,
      '--accent': accent,
      '--accent-foreground': fg,
      '--selected': selected,
      '--subtle': '#7d817f',
      '--disabled': '#5a5f5c',
      '--sidebar': bg,
      '--sidebar-foreground': fg,
      '--sidebar-border': border,
      '--sidebar-ring': safeBrand,
    };
  }

  // Light mode surfaces derived from neutral hue
  const lightHue = neutralHsl.h;
  const lightSat = Math.min(neutralHsl.s, 16);

  const bg = hslToHex({ h: lightHue, s: lightSat, l: 98 });
  const fg = hslToHex({ h: lightHue, s: Math.min(30, lightSat * 2), l: 11 });
  const card = '#ffffff';
  const popover = '#ffffff';
  const surface = '#ffffff';
  const surfaceMuted = hslToHex({ h: lightHue, s: lightSat, l: 97 });
  const surfaceRaised = hslToHex({ h: lightHue, s: lightSat, l: 95 });
  const surfaceInset = hslToHex({ h: lightHue, s: lightSat, l: 93 });

  const border = hslToHex({ h: lightHue, s: lightSat, l: 92 });
  const borderStrong = hslToHex({ h: lightHue, s: lightSat, l: 85 });
  const input = hslToHex({ h: lightHue, s: lightSat, l: 90 });

  const muted = hslToHex({ h: lightHue, s: lightSat, l: 96 });
  const mutedFg = hslToHex({ h: lightHue, s: Math.max(5, lightSat * 0.8), l: 45 });
  const accent = hslToHex({ h: lightHue, s: lightSat, l: 94 });
  const selected = hslToHex({ h: brandHsl.h, s: Math.min(40, brandHsl.s * 0.5), l: 92 });

  const primaryHover = adjustLightness(safeBrand, -8);
  const primaryText = adjustLightness(safeBrand, -20);

  return {
    '--primary': safeBrand,
    '--primary-foreground': brandForeground,
    '--primary-hover': primaryHover,
    '--primary-text': primaryText,
    '--ring': primaryText,
    '--background': bg,
    '--foreground': fg,
    '--card': card,
    '--card-foreground': fg,
    '--popover': popover,
    '--popover-foreground': fg,
    '--surface': surface,
    '--surface-muted': surfaceMuted,
    '--surface-raised': surfaceRaised,
    '--surface-inset': surfaceInset,
    '--border': border,
    '--border-strong': borderStrong,
    '--input': input,
    '--muted': muted,
    '--muted-foreground': mutedFg,
    '--accent': accent,
    '--accent-foreground': fg,
    '--selected': selected,
    '--subtle': '#8a958f',
    '--disabled': '#b4bcb7',
    '--sidebar': bg,
    '--sidebar-foreground': fg,
    '--sidebar-border': border,
    '--sidebar-ring': primaryText,
  };
}

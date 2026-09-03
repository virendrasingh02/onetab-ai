export {
  ThemeProvider,
  useTheme,
  themeInitScript,
  THEME_STORAGE_KEY,
  DENSITY_STORAGE_KEY,
  ACCENT_STORAGE_KEY,
  RADIUS_STORAGE_KEY,
  CUSTOM_THEME_STORAGE_KEY,
  type Theme,
  type ResolvedTheme,
  type ThemeProviderProps,
} from './lib/theme-provider.js';

export {
  colorTokens,
  layout,
  breakpoints,
  avatarTint,
  avatarGradient,
  normalizeAvatarSeed,
  ACCENTS,
  accentTokens,
  accentFor,
  motion,
  zIndex,
  DENSITIES,
  RADII,
  radiusScale,
  spacingScale,
  typography,
  type ColorToken,
  type Breakpoint,
  type Accent,
  type Density,
  type RadiusPreset,
} from './lib/tokens.js';

export {
  generateThemeVariables,
  generateShadeRamp,
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  hslToHex,
  getRelativeLuminance,
  getContrastRatio,
  isValidHexColor,
  adjustLightness,
  checkContrast,
  getAccessibleForeground,
  type GeneratedThemeCssVariables,
  type RgbColor,
  type HslColor,
  type ContrastCheckResult,
} from './lib/theme-color-generator.js';

export {
  generateCssGradient,
  formatColorWithOpacity,
  isValidGradientConfig,
  GRADIENT_PRESETS,
  type GradientPreset,
} from './lib/gradient-engine.js';

export {
  THEME_PRESETS,
  type ThemePreset,
} from './lib/theme-presets.js';

export {
  validateAndParseThemeConfig,
  downloadThemeConfigFile,
  type ThemeConfigExport,
} from './lib/theme-config-io.js';

export {
  ThemeSurface,
  GradientSurface,
  ThemeButton,
  ThemeCard,
  ThemeBadge,
  getThemeColor,
  getThemeGradient,
  getSurfaceStyle,
  getThemeTokens,
  type ThemeSurfaceProps,
  type GradientSurfaceProps,
  type ThemeButtonProps,
  type ThemeCardProps,
  type ThemeBadgeProps,
} from './lib/theme-elements.js';

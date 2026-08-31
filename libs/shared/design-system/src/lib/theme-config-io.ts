import type { ThemeConfig } from '@org/types';
import { isValidHexColor } from './theme-color-generator.js';
import { isValidGradientConfig } from './gradient-engine.js';

export interface ThemeConfigExport {
  $schema?: string;
  version: number;
  name?: string;
  mode: 'light' | 'dark' | 'system';
  type: 'default' | 'custom' | 'preset';
  brandColor?: string;
  neutralColor?: string;
  presetId?: string;
  colors?: ThemeConfig['colors'];
  gradients?: ThemeConfig['gradients'];
  backgrounds?: ThemeConfig['backgrounds'];
  typography?: ThemeConfig['typography'];
  shape?: ThemeConfig['shape'];
  shadows?: ThemeConfig['shadows'];
  exportedAt: string;
}

/** Validates and parses an imported JSON configuration. */
export function validateAndParseThemeConfig(jsonString: string): {
  success: boolean;
  config?: ThemeConfig;
  error?: string;
} {
  try {
    const parsed = JSON.parse(jsonString);

    if (typeof parsed !== 'object' || parsed === null) {
      return { success: false, error: 'Configuration must be a JSON object.' };
    }

    const mode = parsed.mode;
    if (mode !== 'light' && mode !== 'dark' && mode !== 'system') {
      return { success: false, error: 'Invalid mode: must be "light", "dark", or "system".' };
    }

    const type = parsed.type;
    if (type !== 'default' && type !== 'custom' && type !== 'preset') {
      return { success: false, error: 'Invalid type: must be "default", "custom", or "preset".' };
    }

    if (parsed.brandColor && !isValidHexColor(parsed.brandColor)) {
      return { success: false, error: 'Invalid brandColor: must be a valid hex color code (e.g., #ec15e7).' };
    }

    if (parsed.neutralColor && !isValidHexColor(parsed.neutralColor)) {
      return { success: false, error: 'Invalid neutralColor: must be a valid hex color code (e.g., #5a007a).' };
    }

    // Validate colors if provided
    if (parsed.colors && typeof parsed.colors === 'object') {
      for (const [key, val] of Object.entries(parsed.colors)) {
        if (typeof val === 'string' && val.startsWith('#') && !isValidHexColor(val)) {
          return { success: false, error: `Invalid color value for "${key}": "${val}" is not a valid hex color.` };
        }
      }
    }

    // Validate gradients if provided
    if (parsed.gradients && typeof parsed.gradients === 'object') {
      for (const [key, val] of Object.entries(parsed.gradients)) {
        if (typeof val === 'object' && val !== null && !isValidGradientConfig(val)) {
          return { success: false, error: `Invalid gradient definition for "${key}".` };
        }
      }
    }

    const config: ThemeConfig = {
      mode,
      type,
      name: typeof parsed.name === 'string' ? parsed.name : undefined,
      brandColor: parsed.brandColor || undefined,
      neutralColor: parsed.neutralColor || undefined,
      presetId: parsed.presetId || undefined,
      colors: parsed.colors || undefined,
      gradients: parsed.gradients || undefined,
      backgrounds: parsed.backgrounds || undefined,
      typography: parsed.typography || undefined,
      shape: parsed.shape || undefined,
      shadows: parsed.shadows || undefined,
    };

    return { success: true, config };
  } catch {
    return { success: false, error: 'Corrupted or malformed JSON file.' };
  }
}

/** Triggers download of theme configuration file. */
export function downloadThemeConfigFile(
  config: ThemeConfig,
  filename = 'platform-theme-config.json',
) {
  const exportPayload: ThemeConfigExport = {
    $schema: 'https://onetab.ai/schemas/theme-config.v1.json',
    version: 2,
    name: config.name || (config.type === 'preset' ? config.presetId : 'Custom Theme'),
    mode: config.mode,
    type: config.type,
    brandColor: config.brandColor,
    neutralColor: config.neutralColor,
    presetId: config.presetId,
    colors: config.colors,
    gradients: config.gradients,
    backgrounds: config.backgrounds,
    typography: config.typography,
    shape: config.shape,
    shadows: config.shadows,
    exportedAt: new Date().toISOString(),
  };

  const jsonString = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

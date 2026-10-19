import { useColorScheme } from 'react-native';
import { darkPalette, lightPalette, type Palette } from './tokens';

export interface Theme {
  dark: boolean;
  colors: Palette;
}

/** Follows the OS appearance, like the web app's default "system" theme. */
export function useTheme(): Theme {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return { dark, colors: dark ? darkPalette : lightPalette };
}

export function toneColors(
  colors: Palette,
  tone: 'success' | 'danger' | 'warning' | 'info' | 'neutral',
): { fg: string; bg: string } {
  switch (tone) {
    case 'success':
      return { fg: colors.successText, bg: withAlpha(colors.success, 0.14) };
    case 'danger':
      return {
        fg: colors.destructiveText,
        bg: withAlpha(colors.destructive, 0.12),
      };
    case 'warning':
      return { fg: colors.warningText, bg: withAlpha(colors.warning, 0.18) };
    case 'info':
      return { fg: colors.infoText, bg: withAlpha(colors.info, 0.14) };
    default:
      return { fg: colors.mutedForeground, bg: colors.muted };
  }
}

export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${full}${a}`;
}

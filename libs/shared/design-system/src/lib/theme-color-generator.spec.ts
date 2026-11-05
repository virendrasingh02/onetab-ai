import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkContrast,
  generateShadeRamp,
  generateThemeVariables,
  getContrastRatio,
  getRelativeLuminance,
  hexToRgb,
  hslToRgb,
  isValidHexColor,
  rgbToHex,
  rgbToHsl,
} from './theme-color-generator.js';
import { THEME_PRESETS } from './theme-presets.js';

describe('theme-color-generator', () => {
  describe('color conversions', () => {
    it('parses valid 6-digit and 3-digit hex strings to RGB', () => {
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
      expect(hexToRgb('60c686')).toEqual({ r: 96, g: 198, b: 134 });
    });

    it('converts RGB back to Hex correctly', () => {
      expect(rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
      expect(rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
      expect(rgbToHex({ r: 96, g: 198, b: 134 })).toBe('#60c686');
    });

    it('converts RGB to HSL and back with minimal rounding deviation', () => {
      const rgb = { r: 96, g: 198, b: 134 };
      const hsl = rgbToHsl(rgb);
      const convertedBack = hslToRgb(hsl);

      expect(Math.abs(convertedBack.r - rgb.r)).toBeLessThanOrEqual(2);
      expect(Math.abs(convertedBack.g - rgb.g)).toBeLessThanOrEqual(2);
      expect(Math.abs(convertedBack.b - rgb.b)).toBeLessThanOrEqual(2);
    });

    it('validates hex colors reliably', () => {
      expect(isValidHexColor('#ec15e7')).toBe(true);
      expect(isValidHexColor('#5a007a')).toBe(true);
      expect(isValidHexColor('#fff')).toBe(true);
      expect(isValidHexColor('invalid')).toBe(false);
      expect(isValidHexColor('#12345')).toBe(false);
    });
  });

  describe('WCAG luminance and contrast', () => {
    it('calculates expected relative luminance', () => {
      const whiteLum = getRelativeLuminance({ r: 255, g: 255, b: 255 });
      const blackLum = getRelativeLuminance({ r: 0, g: 0, b: 0 });

      expect(whiteLum).toBeCloseTo(1, 1);
      expect(blackLum).toBeCloseTo(0, 1);
    });

    it('calculates 21:1 contrast ratio between pure black and white', () => {
      const ratio = getContrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 });
      expect(ratio).toBeCloseTo(21, 0);
    });
  });

  describe('palette and variables generation', () => {
    it('generates 10 shade steps from 50 to 900', () => {
      const ramp = generateShadeRamp('#60c686');
      expect(Object.keys(ramp)).toEqual(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']);
      expect(ramp[50].startsWith('#')).toBe(true);
      expect(ramp[900].startsWith('#')).toBe(true);
    });

    it('evaluates checkContrast with AA and AAA criteria', () => {
      const whiteOnBlack = checkContrast('#ffffff', '#000000');
      expect(whiteOnBlack.ratio).toBeGreaterThan(15);
      expect(whiteOnBlack.passesAA).toBe(true);
      expect(whiteOnBlack.passesAAA).toBe(true);
      expect(whiteOnBlack.level).toBe('AAA');

      const lowContrast = checkContrast('#777777', '#666666');
      expect(lowContrast.passesAA).toBe(false);
      expect(lowContrast.level).toBe('Fail');
    });

    it('generates variables from full ThemeConfig object with gradients and typography', () => {
      const config = {
        mode: 'dark' as const,
        type: 'custom' as const,
        colors: {
          primary: '#6366f1',
          background: '#0f172a',
        },
        typography: {
          fontFamily: 'Inter',
        },
        shape: {
          radiusBase: '8px' as const,
        },
      };
      const vars = generateThemeVariables(config, undefined, 'dark');
      expect(vars['--primary']).toBe('#6366f1');
      expect(vars['--color-primary']).toBe('#6366f1');
      expect(vars['--background']).toBe('#0f172a');
      expect(vars['--font-sans-stack']).toContain('Inter');
      expect(vars['--radius']).toBe('8px');
      expect(vars['--gradient-primary']).toBeDefined();
    });
  });

  /*
   * These look the same in every workspace. A theme that sets one repaints the
   * unread dots, labels, inputs or composer, which is the bug this guards.
   */
  describe('tokens a workspace theme must not touch', () => {
    const PINNED = [
      '--brand',
      '--brand-foreground',
      '--brand-hover',
      '--brand-text',
      '--activity',
      '--activity-text',
      '--field',
      '--field-border',
      '--ring',
      '--sidebar-ring',
      '--input',
      '--destructive',
      '--destructive-foreground',
      '--destructive-text',
      '--success',
      '--success-foreground',
      '--success-text',
      '--warning',
      '--warning-foreground',
      '--warning-text',
      '--info',
      '--info-foreground',
      '--info-text',
    ];

    const expectNonePinned = (vars: Record<string, string>) => {
      for (const token of PINNED) {
        expect(vars[token]).toBeUndefined();
        expect(vars[token.replace('--', '--color-')]).toBeUndefined();
      }
    };

    it.each(['light', 'dark'] as const)(
      'ignores pinned values saved in an older %s theme',
      (mode) => {
        const rose = '#f43f5e';
        const vars = generateThemeVariables(
          {
            mode,
            type: 'custom',
            brandColor: rose,
            neutralColor: rose,
            colors: {
              primary: rose,
              ring: rose,
              input: rose,
              success: rose,
              warning: rose,
              destructive: rose,
              info: rose,
            },
          },
          undefined,
          mode,
        );

        expect(vars['--primary']).toBe(rose);
        expectNonePinned(vars);
      },
    );

    it.each(THEME_PRESETS.map((preset) => [preset.id, preset] as const))(
      'keeps the %s preset to its own surfaces',
      (_id, preset) => {
        expect(preset.config.colors?.ring).toBeUndefined();
        expectNonePinned(generateThemeVariables(preset.config, undefined, 'light'));
        expectNonePinned(generateThemeVariables(preset.config, undefined, 'dark'));
      },
    );

    it('keeps the theme-fixed scope in step with the default palette', () => {
      const css = readFileSync(resolve(__dirname, '../styles/theme.css'), 'utf8');
      const block = (selector: string) => {
        const start = css.indexOf(`\n${selector} {`);
        expect(start).toBeGreaterThan(-1);
        return css.slice(start, css.indexOf('\n}', start));
      };
      const declared = (text: string) =>
        Object.fromEntries(
          [...text.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)].map((m) => [m[1], m[2].trim()]),
        );

      const root = declared(block(':root'));
      const dark = declared(block('.dark'));
      const fixed = declared(block('.theme-fixed'));
      const fixedDark = declared(block('.dark .theme-fixed'));

      for (const [token, value] of Object.entries(fixedDark)) {
        expect(value).toBe(dark[token]);
        expect(fixed[token]).toBe(root[token]);
      }
    });

    it('keeps them out of the accent blocks in theme.css', () => {
      const css = readFileSync(resolve(__dirname, '../styles/theme.css'), 'utf8');
      const start = css.indexOf('Accent Themes');
      const end = css.indexOf('App content panel');
      expect(start).toBeGreaterThan(-1);
      expect(end).toBeGreaterThan(start);

      const accents = css.slice(start, end);
      for (const token of PINNED) {
        expect(accents).not.toMatch(new RegExp(String.raw`${token}\s*:`));
      }
    });
  });
});

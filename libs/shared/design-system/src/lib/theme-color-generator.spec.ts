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
});

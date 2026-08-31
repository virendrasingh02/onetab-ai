import { describe, expect, it } from 'vitest';
import {
  formatColorWithOpacity,
  generateCssGradient,
  GRADIENT_PRESETS,
  isValidGradientConfig,
} from './gradient-engine.js';

describe('gradient-engine', () => {
  it('formats color with opacity correctly', () => {
    expect(formatColorWithOpacity('#ffffff')).toBe('#ffffff');
    expect(formatColorWithOpacity('#ffffff', 1)).toBe('#ffffff');
    expect(formatColorWithOpacity('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
    expect(formatColorWithOpacity('#60c686', 0.8)).toBe('rgba(96, 198, 134, 0.8)');
  });

  it('generates linear gradient syntax with sorted stops', () => {
    const css = generateCssGradient({
      type: 'linear',
      angle: 90,
      stops: [
        { color: '#3b82f6', position: 100 },
        { color: '#06b6d4', position: 0 },
      ],
    });
    expect(css).toBe('linear-gradient(90deg, #06b6d4 0%, #3b82f6 100%)');
  });

  it('generates radial gradient syntax', () => {
    const css = generateCssGradient({
      type: 'radial',
      shape: 'circle',
      stops: [
        { color: '#ec4899', position: 0 },
        { color: '#8b5cf6', position: 100 },
      ],
    });
    expect(css).toBe('radial-gradient(circle at center, #ec4899 0%, #8b5cf6 100%)');
  });

  it('handles string input directly', () => {
    expect(generateCssGradient('linear-gradient(45deg, #111, #222)')).toBe(
      'linear-gradient(45deg, #111, #222)',
    );
    expect(generateCssGradient('#60c686')).toBe('linear-gradient(135deg, #60c686 0%, #60c686 100%)');
  });

  it('validates GradientConfig correctly', () => {
    expect(
      isValidGradientConfig({
        type: 'linear',
        stops: [
          { color: '#000000', position: 0 },
          { color: '#ffffff', position: 100 },
        ],
      }),
    ).toBe(true);

    expect(isValidGradientConfig(null)).toBe(false);
    expect(isValidGradientConfig({ type: 'unknown' })).toBe(false);
    expect(isValidGradientConfig({ type: 'linear', stops: [{ color: '#000', position: 0 }] })).toBe(
      false,
    );
  });

  it('contains valid gradient presets', () => {
    expect(GRADIENT_PRESETS.length).toBeGreaterThan(5);
    for (const preset of GRADIENT_PRESETS) {
      expect(isValidGradientConfig(preset.config)).toBe(true);
      const css = generateCssGradient(preset.config);
      expect(css).toContain('gradient(');
    }
  });
});

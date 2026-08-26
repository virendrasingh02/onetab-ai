import { describe, expect, it } from 'vitest';
import { validateAndParseThemeConfig } from './theme-config-io.js';

describe('theme-config-io', () => {
  it('validates and parses valid theme JSON config', () => {
    const json = JSON.stringify({
      mode: 'dark',
      type: 'custom',
      brandColor: '#ec15e7',
      neutralColor: '#5a007a',
    });

    const result = validateAndParseThemeConfig(json);
    expect(result.success).toBe(true);
    expect(result.config?.mode).toBe('dark');
    expect(result.config?.type).toBe('custom');
    expect(result.config?.brandColor).toBe('#ec15e7');
    expect(result.config?.neutralColor).toBe('#5a007a');
  });

  it('rejects malformed JSON', () => {
    const result = validateAndParseThemeConfig('{ broken json');
    expect(result.success).toBe(false);
    expect(result.error).toContain('malformed');
  });

  it('rejects invalid mode or type values', () => {
    const invalidMode = JSON.stringify({ mode: 'invalid_mode', type: 'custom' });
    expect(validateAndParseThemeConfig(invalidMode).success).toBe(false);

    const invalidType = JSON.stringify({ mode: 'dark', type: 'invalid_type' });
    expect(validateAndParseThemeConfig(invalidType).success).toBe(false);
  });

  it('rejects invalid hex colors', () => {
    const invalidHex = JSON.stringify({
      mode: 'dark',
      type: 'custom',
      brandColor: 'not-a-color',
    });
    expect(validateAndParseThemeConfig(invalidHex).success).toBe(false);
  });
});

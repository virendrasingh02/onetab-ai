import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LANGUAGE,
  getLanguageConfig,
  isRtlLanguage,
  isSupportedLanguage,
  normalizeLanguageCode,
  SUPPORTED_LANGUAGES,
} from './config.js';
import {
  createFormatters,
  formatCurrencyLocale,
  formatDateLocale,
  formatNumberLocale,
  formatPercentLocale,
} from './formatters.js';
import { LOCALES } from './locales/index.js';
import { createTranslator, interpolate, translate } from './translator.js';
import type { LanguageConfig } from './types.js';

describe('i18n config', () => {
  it('should support exactly 10 languages', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(10);
    const codes = SUPPORTED_LANGUAGES.map((l: LanguageConfig) => l.code);

    expect(codes).toEqual(['en', 'hi', 'es', 'fr', 'de', 'pt', 'ja', 'ko', 'zh', 'ar']);
  });

  it('should identify Arabic as RTL and English/Hindi as LTR', () => {
    expect(isRtlLanguage('ar')).toBe(true);
    expect(isRtlLanguage('en')).toBe(false);
    expect(isRtlLanguage('hi')).toBe(false);
  });

  it('should correctly normalize locale strings', () => {
    expect(normalizeLanguageCode('en-US')).toBe('en');
    expect(normalizeLanguageCode('hi-IN')).toBe('hi');
    expect(normalizeLanguageCode('es_ES')).toBe('es');
    expect(normalizeLanguageCode('fr-FR')).toBe('fr');
    expect(normalizeLanguageCode('ar-SA')).toBe('ar');
    expect(normalizeLanguageCode('unknown-locale')).toBeNull();
    expect(normalizeLanguageCode(null)).toBeNull();
  });

  it('should validate supported languages correctly', () => {
    expect(isSupportedLanguage('en')).toBe(true);
    expect(isSupportedLanguage('hi')).toBe(true);
    expect(isSupportedLanguage('ar')).toBe(true);
    expect(isSupportedLanguage('xyz')).toBe(false);
  });

  it('should fallback to English config for unknown language', () => {
    const config = getLanguageConfig('unknown');
    expect(config.code).toBe(DEFAULT_LANGUAGE);
    expect(config.name).toBe('English');
  });
});

describe('i18n translator', () => {
  it('should translate keys in English', () => {
    expect(translate('en', 'common.save')).toBe('Save');
    expect(translate('en', 'common.cancel')).toBe('Cancel');
    expect(translate('en', 'settings.language')).toBe('Language');
  });

  it('should translate keys in other languages', () => {
    expect(translate('hi', 'common.save')).toBe('सहेजें');
    expect(translate('es', 'common.save')).toBe('Guardar');
    expect(translate('fr', 'common.save')).toBe('Enregistrer');
    expect(translate('de', 'common.save')).toBe('Speichern');
    expect(translate('ja', 'common.save')).toBe('保存');
    expect(translate('ar', 'common.save')).toBe('حفظ');
  });

  it('should interpolate variables with {var} syntax', () => {
    expect(interpolate('Hello {name}!', { name: 'Virendra' })).toBe('Hello Virendra!');
    expect(
      translate('en', 'messages.unread_count', { count: 5 })
    ).toContain('5');
  });

  it('should handle pluralization count', () => {
    const zero = translate('en', 'messages.unread_count', { count: 0 });
    const one = translate('en', 'messages.unread_count', { count: 1 });
    const many = translate('en', 'messages.unread_count', { count: 10 });

    expect(zero).toBe('No unread messages');
    expect(one).toBe('1 unread message');
    expect(many).toBe('10 unread messages');
  });

  it('should fallback to English when key is missing in target locale', () => {
    const nonExistentKey = 'nonExistentNamespace.nonExistentKey';
    const fallbackFormatted = translate('ja', nonExistentKey);
    // Should return human-readable fallback instead of crashing or empty
    expect(fallbackFormatted).toBe('Non Existent Key');
  });

  it('should work with bound createTranslator', () => {
    const tEn = createTranslator('en');
    const tHi = createTranslator('hi');

    expect(tEn('common.confirm')).toBe('Confirm');
    expect(tHi('common.confirm')).toBe('पुष्टि करें');
  });

  it('should have all 10 locales defined in LOCALES', () => {
    expect(Object.keys(LOCALES)).toHaveLength(10);
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(LOCALES[lang.code]).toBeDefined();
      expect(LOCALES[lang.code].common.save).toBeTruthy();
    }
  });
});


describe('i18n formatters', () => {
  it('should format numbers with locale separators', () => {
    const num = 1234567.89;
    const formattedEn = formatNumberLocale(num, 'en');
    const formattedDe = formatNumberLocale(num, 'de');

    expect(formattedEn).toContain('1,234,567');
    expect(formattedDe).toContain('1.234.567');
  });

  it('should format currency according to locale', () => {
    const enUsd = formatCurrencyLocale(100, 'en', 'USD');
    expect(enUsd).toContain('100');
    expect(enUsd).toContain('$');
  });

  it('should format percentages according to locale', () => {
    const percent = formatPercentLocale(0.75, 'en');
    expect(percent).toBe('75%');
  });

  it('should format dates without error', () => {
    const testDate = new Date('2026-09-07T12:00:00Z');
    const formattedEn = formatDateLocale(testDate, 'en');
    const formattedJa = formatDateLocale(testDate, 'ja');

    expect(formattedEn).toBeTruthy();
    expect(formattedJa).toBeTruthy();
  });

  it('should create bound formatters with createFormatters', () => {
    const formatters = createFormatters('en');
    expect(formatters.formatNumber(42)).toBe('42');
    expect(formatters.formatPercent(0.5)).toBe('50%');
  });
});


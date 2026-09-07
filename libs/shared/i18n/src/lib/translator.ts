import { DEFAULT_LANGUAGE, type SupportedLanguageCode } from './config.js';
import { LOCALES } from './locales/index.js';
import type { NestedKeyOf, TranslationSchema } from './types.js';


/**
 * Resolves a nested key in a dictionary object.
 * e.g. getNestedValue(en, 'settings.languageAndRegion') => string
 */
function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;

  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Interpolates variables within translation string.
 * Supports {param} and {{param}} formats.
 */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params || Object.keys(params).length === 0) {
    return template;
  }

  return template.replace(/\{{1,2}(\w+)\}{1,2}/g, (match, paramKey) => {
    if (paramKey in params) {
      return String(params[paramKey]);
    }
    return match;
  });
}

/**
 * Formats a raw translation key into a human-readable fallback string
 * e.g. 'settings.languageAndRegion' -> 'Language And Region'
 */
function formatKeyFallback(key: string): string {
  const leaf = key.split('.').pop() ?? key;
  return leaf
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Translates a key for a given locale with optional interpolation parameters, count, or fallback text.
 */
export function translate(
  locale: SupportedLanguageCode,
  key: string,
  paramsOrFallback?: Record<string, string | number> | string,
  explicitFallback?: string
): string {
  const currentLocaleDict = LOCALES[locale] ?? LOCALES[DEFAULT_LANGUAGE];
  const defaultLocaleDict = LOCALES[DEFAULT_LANGUAGE];

  const params =
    typeof paramsOrFallback === 'object' && paramsOrFallback !== null
      ? paramsOrFallback
      : undefined;
  const defaultFallback =
    typeof paramsOrFallback === 'string'
      ? paramsOrFallback
      : explicitFallback;

  let rawValue: unknown;

  // Handle pluralization if `count` is provided
  if (params && typeof params['count'] === 'number') {
    const count = params['count'];
    let pluralKeySuffix = 'other';
    if (count === 0) {
      pluralKeySuffix = 'zero';
    } else if (count === 1) {
      pluralKeySuffix = 'one';
    }

    // Try key_zero / key_one / key_other first in current locale
    rawValue = getNestedValue(currentLocaleDict, `${key}_${pluralKeySuffix}`);

    // If not found, try in default locale
    if (typeof rawValue !== 'string') {
      rawValue = getNestedValue(defaultLocaleDict, `${key}_${pluralKeySuffix}`);
    }
  }

  // Regular key lookup if plural wasn't found or wasn't applicable
  if (typeof rawValue !== 'string') {
    rawValue = getNestedValue(currentLocaleDict, key);
  }

  // Fallback to default locale (English)
  if (typeof rawValue !== 'string') {
    rawValue = getNestedValue(defaultLocaleDict, key);
  }

  // If still not a string, use explicit defaultFallback or friendly formatted fallback
  if (typeof rawValue !== 'string') {
    return defaultFallback ?? formatKeyFallback(key);
  }

  return interpolate(rawValue, params);
}

/**
 * Create a bound translator function for a specific locale.
 */
export function createTranslator(locale: SupportedLanguageCode) {
  return function t<K extends string = NestedKeyOf<TranslationSchema>>(
    key: K,
    paramsOrFallback?: Record<string, string | number> | string,
    fallback?: string
  ): string {
    return translate(locale, key, paramsOrFallback, fallback);
  };
}


export type Translator = ReturnType<typeof createTranslator>;


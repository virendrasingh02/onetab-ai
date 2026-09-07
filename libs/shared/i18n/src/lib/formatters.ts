import type { SupportedLanguageCode } from './config.js';

function toDate(input: Date | string | number): Date {
  if (input instanceof Date) return input;
  return new Date(input);
}

/**
 * Formats a date according to the specified locale.
 */
export function formatDateLocale(
  date: Date | string | number,
  locale: SupportedLanguageCode,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = toDate(date);
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      ...options,
    }).format(d);
  } catch {
    return String(date);
  }
}

/**
 * Formats a time according to the specified locale.
 */
export function formatTimeLocale(
  date: Date | string | number,
  locale: SupportedLanguageCode,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = toDate(date);
    return new Intl.DateTimeFormat(locale, {
      timeStyle: 'short',
      ...options,
    }).format(d);
  } catch {
    return String(date);
  }
}

/**
 * Formats both date and time according to the specified locale.
 */
export function formatDateTimeLocale(
  date: Date | string | number,
  locale: SupportedLanguageCode,
  options?: Intl.DateTimeFormatOptions
): string {
  try {
    const d = toDate(date);
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      ...options,
    }).format(d);
  } catch {
    return String(date);
  }
}

/**
 * Formats a relative time description (e.g. '5 minutes ago', 'in 2 days').
 */
export function formatRelativeLocale(
  date: Date | string | number,
  locale: SupportedLanguageCode,
  baseDate: Date = new Date()
): string {
  try {
    const d = toDate(date);
    const diffSeconds = Math.round((d.getTime() - baseDate.getTime()) / 1000);

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

    const cutoffs = [
      { unit: 'year' as const, seconds: 31536000 },
      { unit: 'month' as const, seconds: 2592000 },
      { unit: 'week' as const, seconds: 604800 },
      { unit: 'day' as const, seconds: 86400 },
      { unit: 'hour' as const, seconds: 3600 },
      { unit: 'minute' as const, seconds: 60 },
      { unit: 'second' as const, seconds: 1 },
    ];

    for (const cutoff of cutoffs) {
      if (Math.abs(diffSeconds) >= cutoff.seconds || cutoff.unit === 'second') {
        const delta = Math.round(diffSeconds / cutoff.seconds);
        return rtf.format(delta, cutoff.unit);
      }
    }

    return rtf.format(0, 'second');
  } catch {
    return String(date);
  }
}

/**
 * Formats a number according to the specified locale.
 */
export function formatNumberLocale(
  value: number,
  locale: SupportedLanguageCode,
  options?: Intl.NumberFormatOptions
): string {
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Formats a currency value according to the specified locale and currency code.
 */
export function formatCurrencyLocale(
  value: number,
  locale: SupportedLanguageCode,
  currency = 'USD',
  options?: Intl.NumberFormatOptions
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      ...options,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

/**
 * Formats a percentage according to the specified locale.
 */
export function formatPercentLocale(
  value: number,
  locale: SupportedLanguageCode,
  options?: Intl.NumberFormatOptions
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      maximumFractionDigits: 1,
      ...options,
    }).format(value);
  } catch {
    return `${value}%`;
  }
}

/**
 * Creates all formatters bound to a given locale.
 */
export function createFormatters(locale: SupportedLanguageCode) {
  return {
    formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      formatDateLocale(date, locale, options),
    formatTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      formatTimeLocale(date, locale, options),
    formatDateTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      formatDateTimeLocale(date, locale, options),
    formatRelative: (date: Date | string | number, baseDate?: Date) =>
      formatRelativeLocale(date, locale, baseDate),
    formatNumber: (value: number, options?: Intl.NumberFormatOptions) =>
      formatNumberLocale(value, locale, options),
    formatCurrency: (value: number, currency?: string, options?: Intl.NumberFormatOptions) =>
      formatCurrencyLocale(value, locale, currency, options),
    formatPercent: (value: number, options?: Intl.NumberFormatOptions) =>
      formatPercentLocale(value, locale, options),
  };
}

export type Formatters = ReturnType<typeof createFormatters>;


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
 * The user's own clock and date display choice. `null` follows the locale's
 * convention, which is what everyone gets until they pick otherwise.
 */
export interface DisplayFormats {
  timeFormat: '12h' | '24h' | null;
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | null;
}

const NO_DISPLAY_FORMATS: DisplayFormats = { timeFormat: null, dateFormat: null };

/** A numeric date in the chosen field order, e.g. 21/10/2026. */
export function formatNumericDate(
  date: Date | string | number,
  dateFormat: NonNullable<DisplayFormats['dateFormat']>,
): string {
  const d = toDate(date);
  if (Number.isNaN(d.getTime())) return String(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  if (dateFormat === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`;
  return dateFormat === 'DD/MM/YYYY' ? `${dd}/${mm}/${yyyy}` : `${mm}/${dd}/${yyyy}`;
}

/**
 * Creates all formatters bound to a given locale. A 12h/24h choice overrides
 * the locale's hour cycle; a date-order choice applies when no explicit
 * `dateStyle`/field options are passed (the short numeric form).
 */
export function createFormatters(
  locale: SupportedLanguageCode,
  formats: DisplayFormats = NO_DISPLAY_FORMATS,
) {
  const hourCycle: Intl.DateTimeFormatOptions =
    formats.timeFormat === null ? {} : { hour12: formats.timeFormat === '12h' };
  const numericDate = (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
    formats.dateFormat && (!options || Object.keys(options).length === 0)
      ? formatNumericDate(date, formats.dateFormat)
      : null;

  return {
    formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      numericDate(date, options) ?? formatDateLocale(date, locale, options),
    formatTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) =>
      formatTimeLocale(date, locale, { ...hourCycle, ...options }),
    formatDateTime: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      const datePart = numericDate(date, options);
      return datePart
        ? `${datePart}, ${formatTimeLocale(date, locale, hourCycle)}`
        : formatDateTimeLocale(date, locale, { ...hourCycle, ...options });
    },
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


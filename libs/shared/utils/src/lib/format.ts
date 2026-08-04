import {
  format,
  formatDistanceToNowStrict,
  isThisYear,
  isToday,
  isYesterday,
} from 'date-fns';

/** Absolute timestamp, e.g. "14 Mar 2025, 09:41". */
export function formatDateTime(value: Date | string | number): string {
  return format(new Date(value), 'd MMM yyyy, HH:mm');
}

/** Date only, e.g. "14 Mar 2025". */
export function formatDate(value: Date | string | number): string {
  return format(new Date(value), 'd MMM yyyy');
}

/**
 * Conversational timestamp for list rows: time for today, "Yesterday",
 * weekday-and-date within the year, full date beyond it.
 */
export function formatListTimestamp(value: Date | string | number): string {
  const date = new Date(value);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  if (isThisYear(date)) return format(date, 'd MMM');
  return format(date, 'd MMM yyyy');
}

/** Compact relative age, e.g. "5m", "3h", "2d". */
export function formatRelative(value: Date | string | number): string {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Human-readable file size, e.g. "1.4 MB". */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    BYTE_UNITS.length - 1,
  );
  const value = bytes / Math.pow(1024, exponent);
  // Whole bytes never need a decimal point.
  const fractionDigits = exponent === 0 ? 0 : decimals;
  return `${value.toFixed(fractionDigits)} ${BYTE_UNITS[exponent]}`;
}

/** Abbreviate large counts for badges, e.g. 1250 → "1.2k". */
export function formatCount(count: number): string {
  if (count < 1000) return String(count);
  if (count < 1_000_000) return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}k`;
  return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}m`;
}

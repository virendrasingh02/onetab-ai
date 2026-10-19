/** Small presentation helpers shared by the screens. Platform-free. */

export function relativeTime(
  iso: string | null | undefined,
  now = Date.now(),
): string {
  if (!iso) return '—';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(then).toLocaleDateString();
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 10_000) return `${Math.round(value / 1000)}k`;
  return value.toLocaleString('en-US');
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${Math.round(seconds % 60)}s`;
}

/** A limit of -1 means unlimited, which is how the billing API spells it. */
export function formatLimit(
  used: number,
  limit: number,
  unit?: string,
): string {
  const suffix = unit ? ` ${unit}` : '';
  if (limit < 0) return `${formatNumber(used)}${suffix} / Unlimited`;
  return `${formatNumber(used)} / ${formatNumber(limit)}${suffix}`;
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase() || '?';
}

export type StatusTone = 'success' | 'danger' | 'warning' | 'info' | 'neutral';

/** Execution / run statuses across agents, workflows and AI executions. */
export function statusTone(status: string | null | undefined): StatusTone {
  const s = (status ?? '').toUpperCase();
  if (
    [
      'SUCCESS',
      'SUCCEEDED',
      'COMPLETED',
      'ACTIVE',
      'CONNECTED',
      'APPROVED',
      'OK',
    ].includes(s)
  ) {
    return 'success';
  }
  if (
    [
      'FAILED',
      'ERROR',
      'CANCELLED',
      'CANCELED',
      'REJECTED',
      'TIMED_OUT',
      'EXPIRED',
    ].includes(s)
  ) {
    return 'danger';
  }
  if (
    [
      'WAITING_APPROVAL',
      'PENDING',
      'PAUSED',
      'NEEDS_ATTENTION',
      'NEAR_LIMIT',
    ].includes(s)
  ) {
    return 'warning';
  }
  if (['RUNNING', 'QUEUED', 'IN_PROGRESS', 'STARTED'].includes(s))
    return 'info';
  return 'neutral';
}

export function humanize(value: string | null | undefined): string {
  if (!value) return '';
  const spaced = value.replace(/[_-]+/g, ' ').toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The last `days` days as the `{from, to}` ISO range the analytics API takes. */
export function lastDaysRange(
  days: number,
  now = new Date(),
): { from: string; to: string } {
  const to = new Date(now);
  const from = new Date(now);
  from.setDate(from.getDate() - days);
  return { from: from.toISOString(), to: to.toISOString() };
}

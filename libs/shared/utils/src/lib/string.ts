/**
 * Single letter initial from a display name or email.
 * "Ada Lovelace" → "A", "ada@example.com" → "A".
 */
export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed[0].toUpperCase();
}

/**
 * URL/mention-safe slug. Channel names use this, so it must be stable and
 * collapse anything that is not a word character.
 */
export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    // Strip the combining marks that NFKD just split off.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Truncate with an ellipsis, without splitting a word mid-character. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Escape a string for safe use inside a RegExp. */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Splits a pasted or comma/newline separated string of email addresses into clean tokens. */
export function parseEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}


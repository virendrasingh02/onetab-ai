import { v4 as uuidv4, v7 as uuidv7, validate, version } from 'uuid';

/**
 * Central, cryptographically secure ID generation (uuid package; v4 uses the
 * platform CSPRNG). IDs are opaque identifiers only — never use one as an
 * authorization credential.
 */

const CUID_RE = /^c[a-z0-9]{20,31}$/;

/** Random UUID v4. `prefix` yields `${prefix}_${uuid}` (e.g. `node_…`). */
export function generateId(prefix?: string): string {
  const id = uuidv4();
  return prefix ? `${prefix}_${id}` : id;
}

/** Time-sortable UUID v7 — only where insertion order matters (events, logs). */
export function generateSortableId(prefix?: string): string {
  const id = uuidv7();
  return prefix ? `${prefix}_${id}` : id;
}

/** Short random token (first 8 hex chars of a v4) for local-only labels/keys. */
export function generateShortId(prefix?: string): string {
  const id = uuidv4().slice(0, 8);
  return prefix ? `${prefix}_${id}` : id;
}

/** True for a canonical RFC 4122/9562 UUID (versions 1–8). */
export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && validate(value);
}

export function getUuidVersion(value: unknown): number | null {
  return isValidUuid(value) ? version(value) : null;
}

/**
 * Accepts any identifier format that exists in stored data: UUIDs, legacy
 * Prisma cuids, and prefixed ids (`prefix_<uuid|cuid|token>`). Use at API
 * boundaries to reject junk without breaking existing records.
 */
export function isValidId(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    return false;
  }
  if (isValidUuid(value) || CUID_RE.test(value)) return true;
  return /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}

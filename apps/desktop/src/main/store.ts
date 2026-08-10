import { app } from 'electron';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * A tiny JSON store in `userData`.
 *
 * `electron-store` would do the same job, but it is another runtime dependency
 * to ship and sign for a file that only ever holds a handful of scalars.
 */
export interface PersistedState {
  window?: {
    x?: number;
    y?: number;
    width: number;
    height: number;
    isMaximized: boolean;
  };
  /** Free-form renderer preferences, e.g. `launchAtLogin`, `minimizeToTray`. */
  preferences?: Record<string, unknown>;
}

const DEFAULTS: PersistedState = {
  window: { width: 1380, height: 900, isMaximized: false },
  preferences: {},
};

let cache: PersistedState | null = null;

function storePath(): string {
  return join(app.getPath('userData'), 'onetab-desktop.json');
}

export function readStore(): PersistedState {
  if (cache) return cache;

  try {
    const parsed = JSON.parse(readFileSync(storePath(), 'utf8')) as PersistedState;
    cache = { ...DEFAULTS, ...parsed };
  } catch {
    // Missing or corrupt file — starting from defaults is always recoverable.
    cache = { ...DEFAULTS };
  }

  return cache;
}

export function writeStore(patch: Partial<PersistedState>): void {
  const next = { ...readStore(), ...patch };
  cache = next;

  const target = storePath();
  try {
    mkdirSync(dirname(target), { recursive: true });
    // Write-then-rename so a crash mid-write cannot leave a half-written file
    // that throws on next launch.
    const temp = `${target}.tmp`;
    writeFileSync(temp, JSON.stringify(next, null, 2), 'utf8');
    renameSync(temp, target);
  } catch {
    // Persistence is a convenience; losing it must not take the app down.
  }
}

export function getPreference<T>(key: string, fallback: T): T {
  const value = readStore().preferences?.[key];
  return value === undefined ? fallback : (value as T);
}

export function setPreference(key: string, value: unknown): void {
  const preferences = { ...readStore().preferences, [key]: value };
  writeStore({ preferences });
}

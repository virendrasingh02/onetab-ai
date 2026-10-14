import { BadRequestException, UnauthorizedException } from '@nestjs/common';

/**
 * A manual-credential connection stores its whole form as one encrypted JSON
 * bundle (`IntegrationsService.initiateConnect`); `resolveCredential` hands
 * it back as `credential.accessToken`. This reads it, naming the app and the
 * missing field instead of failing deep inside a request.
 */
export function parseCredentialBundle<T extends Record<string, string>>(
  accessToken: string,
  app: string,
  required: ReadonlyArray<keyof T & string>,
): T {
  let parsed: Record<string, unknown> | null = null;
  try {
    const value = JSON.parse(accessToken);
    if (value && typeof value === 'object') parsed = value as Record<string, unknown>;
  } catch {
    // fall through
  }
  if (!parsed) throw new UnauthorizedException(`${app} credentials are missing or corrupted — please reconnect.`);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string') out[key] = value.trim();
  }
  for (const key of required) {
    if (!out[key]) throw new UnauthorizedException(`${app} credentials are incomplete (${key} is missing) — please reconnect.`);
  }
  return out as T;
}

/** A bounded integer from an action input, falling back to a default. */
export function boundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.trunc(n))) : fallback;
}

export function textOf(value: unknown): string {
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

/** The inputs an action cannot run without, named for the person fixing the step. */
export function requireText(input: Record<string, unknown>, ...keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  const missing: string[] = [];
  for (const key of keys) {
    const v = textOf(input[key]);
    if (!v) missing.push(key);
    else out[key] = v;
  }
  if (missing.length) {
    throw new BadRequestException(`Missing required input: ${missing.join(', ')}.`);
  }
  return out;
}

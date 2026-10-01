/**
 * Minimal 5-field cron matching (minute hour day-of-month month day-of-week),
 * shared by the agent schedule sweep and the workflow CRON trigger sweep.
 * The matcher itself lives in `@org/utils` so the Studio's "next run" labels
 * in the browser read a schedule exactly the way these sweeps fire it.
 */
import { cronMatches } from '@org/utils';

/** Whether `expression` has exactly five fields. */
export function isValidCronExpression(expression: string): boolean {
  return expression.trim().split(/\s+/).length === 5;
}

/**
 * Whether `expression` fires in the minute containing `at`, read in
 * `timeZone` (an IANA zone) — the server's own zone when none is given.
 */
export function isCronDue(expression: string, at: Date, timeZone?: string | null): boolean {
  return cronMatches(expression, at, timeZone);
}

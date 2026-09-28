/**
 * Minimal 5-field cron matching (minute hour day-of-month month day-of-week),
 * shared by the agent schedule sweep and the workflow CRON trigger sweep.
 * Supports wildcards, lists, ranges and steps — every expression the builders
 * produce — without a cron-parsing dependency.
 */

function matchesCronField(field: string, value: number): boolean {
  return field.split(',').some((part) => {
    const [range, stepRaw] = part.split('/');
    const step = stepRaw ? Number(stepRaw) : 1;
    if (!Number.isFinite(step) || step <= 0 || range === undefined) return false;

    if (range === '*') return value % step === 0;
    if (range.includes('-')) {
      const [startRaw, endRaw] = range.split('-');
      const start = Number(startRaw);
      const end = Number(endRaw);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
      return value >= start && value <= end && (value - start) % step === 0;
    }
    return Number(range) === value;
  });
}

/** Whether `expression` has exactly five fields. */
export function isValidCronExpression(expression: string): boolean {
  return expression.trim().split(/\s+/).length === 5;
}

/** Whether `expression` fires in the minute containing `at`. */
export function isCronDue(expression: string, at: Date): boolean {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts as [string, string, string, string, string];
  return (
    matchesCronField(minute, at.getMinutes()) &&
    matchesCronField(hour, at.getHours()) &&
    matchesCronField(dayOfMonth, at.getDate()) &&
    matchesCronField(month, at.getMonth() + 1) &&
    matchesCronField(dayOfWeek, at.getDay())
  );
}

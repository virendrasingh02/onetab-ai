/**
 * Checks (and gently coerces) an action's input against the JSON Schema its
 * adapter declared, before the adapter ever sees it. One place, so every
 * connector refuses bad input the same way — a clear message naming the field —
 * instead of sending a half-formed request to the app.
 *
 * Workflow steps build input from `{{variables}}`, which arrive as strings, so
 * numbers, booleans and arrays are accepted in their string form and converted.
 */
export type ActionInputCheck = { ok: true; input: Record<string, unknown> } | { ok: false; errors: string[] };

interface PropertySchema {
  type?: string;
  enum?: unknown[];
}

const isEmpty = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

export function validateActionInput(schema: Record<string, unknown> | undefined, raw: Record<string, unknown>): ActionInputCheck {
  const properties = (schema?.['properties'] ?? {}) as Record<string, PropertySchema>;
  const required = Array.isArray(schema?.['required']) ? (schema?.['required'] as string[]) : [];
  const errors: string[] = [];
  const input: Record<string, unknown> = { ...raw };

  for (const key of required) {
    if (isEmpty(input[key])) errors.push(`“${key}” is required.`);
  }

  for (const [key, prop] of Object.entries(properties)) {
    const value = input[key];
    if (isEmpty(value)) continue;
    switch (prop.type) {
      case 'number':
      case 'integer': {
        const n = typeof value === 'number' ? value : Number(value);
        if (!Number.isFinite(n)) errors.push(`“${key}” must be a number.`);
        else if (prop.type === 'integer' && !Number.isInteger(n)) errors.push(`“${key}” must be a whole number.`);
        else input[key] = n;
        break;
      }
      case 'boolean': {
        if (typeof value === 'boolean') break;
        const text = String(value).trim().toLowerCase();
        if (text === 'true') input[key] = true;
        else if (text === 'false') input[key] = false;
        else errors.push(`“${key}” must be true or false.`);
        break;
      }
      case 'array': {
        if (Array.isArray(value)) break;
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            if (Array.isArray(parsed)) {
              input[key] = parsed;
              break;
            }
          } catch {
            // fall through
          }
        }
        errors.push(`“${key}” must be a list.`);
        break;
      }
      case 'string':
        if (typeof value === 'number' || typeof value === 'boolean') input[key] = String(value);
        else if (typeof value !== 'string') errors.push(`“${key}” must be text.`);
        break;
      default:
        break;
    }
    if (Array.isArray(prop.enum) && prop.enum.length && !prop.enum.includes(input[key])) {
      errors.push(`“${key}” must be one of: ${prop.enum.join(', ')}.`);
    }
  }

  return errors.length ? { ok: false, errors } : { ok: true, input };
}

import type { CardRenderContext, CardVisibilityCondition } from '@org/types';

/**
 * Resolves a nested property path from an object safely.
 * e.g. getNestedValue({ a: { b: 123 } }, 'a.b') => 123
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  if (!path || path.trim() === '') return undefined;

  const parts = path.trim().split('.');
  let current: any = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    // Support array indexing like items[0]
    const arrayMatch = part.match(/^([a-zA-Z0-9_$]+)\[(\d+)\]$/);
    if (arrayMatch) {
      const fieldName = arrayMatch[1];
      const index = parseInt(arrayMatch[2], 10);
      current = current[fieldName]?.[index];
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Formats a value using a named transformation filter.
 */
export function applyFilter(value: unknown, filterExpression: string): string {
  const parts = filterExpression.split(':');
  const filterName = parts[0]?.trim().toLowerCase();
  const filterArg = parts.slice(1).join(':').trim();

  if (value === null || value === undefined) {
    if (filterName === 'default') {
      return filterArg.replace(/^['"]|['"]$/g, '');
    }
    return '';
  }

  switch (filterName) {
    case 'uppercase':
      return String(value).toUpperCase();

    case 'lowercase':
      return String(value).toLowerCase();

    case 'capitalize': {
      const str = String(value);
      return str.charAt(0).toUpperCase() + str.slice(1);
    }

    case 'currency': {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      const currencySymbol = filterArg || '$';
      return `${currencySymbol}${num.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    case 'number': {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      const decimals = filterArg ? parseInt(filterArg, 10) : 0;
      return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
    }

    case 'date': {
      try {
        const date = new Date(value as string | number);
        return isNaN(date.getTime())
          ? String(value)
          : date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });
      } catch {
        return String(value);
      }
    }

    case 'time': {
      try {
        const date = new Date(value as string | number);
        return isNaN(date.getTime())
          ? String(value)
          : date.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            });
      } catch {
        return String(value);
      }
    }

    case 'datetime': {
      try {
        const date = new Date(value as string | number);
        return isNaN(date.getTime())
          ? String(value)
          : `${date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })}, ${date.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}`;
      } catch {
        return String(value);
      }
    }

    case 'relative': {
      try {
        const date = new Date(value as string | number);
        if (isNaN(date.getTime())) return String(value);
        const diffMs = Date.now() - date.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        if (diffSec < 60) return 'just now';
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHours = Math.floor(diffMin / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d ago`;
      } catch {
        return String(value);
      }
    }

    case 'truncate': {
      const maxLen = parseInt(filterArg, 10) || 50;
      const str = String(value);
      return str.length > maxLen ? `${str.slice(0, maxLen)}…` : str;
    }

    case 'default':
      return value === '' ? filterArg.replace(/^['"]|['"]$/g, '') : String(value);

    default:
      return String(value);
  }
}

/**
 * Interpolates template strings with safe data bindings: `{{customer.name}}` or `{{price | currency}}`.
 */
export function evaluateTemplate(
  template: string | unknown,
  data: Record<string, unknown>,
  context?: CardRenderContext,
): string {
  if (typeof template !== 'string') {
    return template !== undefined && template !== null ? String(template) : '';
  }

  // Combined data scope: card data + context
  const scope: Record<string, unknown> = {
    ...data,
    context: context || {},
  };

  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, expression: string) => {
    const pipeParts = expression.split('|');
    const path = pipeParts[0].trim();
    const rawValue = getNestedValue(scope, path);

    if (pipeParts.length === 1) {
      if (rawValue === undefined || rawValue === null) return '';
      if (typeof rawValue === 'object') return JSON.stringify(rawValue);
      return String(rawValue);
    }

    // Apply filter chain: `path | filter1 | filter2`
    let result = rawValue;
    for (let i = 1; i < pipeParts.length; i++) {
      result = applyFilter(result, pipeParts[i]);
    }

    return String(result);
  });
}

/**
 * Safely evaluates conditional visibility without eval or arbitrary code execution.
 */
export function evaluateCondition(
  condition?: CardVisibilityCondition,
  data: Record<string, unknown> = {},
  context?: CardRenderContext,
): boolean {
  if (!condition) return true;

  // Handle AND group
  if (condition.and && condition.and.length > 0) {
    return condition.and.every((sub) => evaluateCondition(sub, data, context));
  }

  // Handle OR group
  if (condition.or && condition.or.length > 0) {
    return condition.or.some((sub) => evaluateCondition(sub, data, context));
  }

  if (!condition.field) return true;

  const scope = { ...data, context: context || {} };
  const actualValue = getNestedValue(scope, condition.field);
  const targetValue = condition.value;
  const op = condition.operator || 'equals';

  switch (op) {
    case 'equals':
      return String(actualValue ?? '') === String(targetValue ?? '');

    case 'not_equals':
      return String(actualValue ?? '') !== String(targetValue ?? '');

    case 'contains':
      if (Array.isArray(actualValue)) {
        return actualValue.includes(targetValue);
      }
      return String(actualValue ?? '').toLowerCase().includes(String(targetValue ?? '').toLowerCase());

    case 'not_contains':
      if (Array.isArray(actualValue)) {
        return !actualValue.includes(targetValue);
      }
      return !String(actualValue ?? '').toLowerCase().includes(String(targetValue ?? '').toLowerCase());

    case 'greater_than':
      return Number(actualValue) > Number(targetValue);

    case 'less_than':
      return Number(actualValue) < Number(targetValue);

    case 'greater_than_or_equals':
      return Number(actualValue) >= Number(targetValue);

    case 'less_than_or_equals':
      return Number(actualValue) <= Number(targetValue);

    case 'exists':
      return actualValue !== undefined && actualValue !== null;

    case 'empty':
      if (actualValue === undefined || actualValue === null || actualValue === '') return true;
      if (Array.isArray(actualValue)) return actualValue.length === 0;
      if (typeof actualValue === 'object') return Object.keys(actualValue).length === 0;
      return false;

    case 'not_empty':
      if (actualValue === undefined || actualValue === null || actualValue === '') return false;
      if (Array.isArray(actualValue)) return actualValue.length > 0;
      if (typeof actualValue === 'object') return Object.keys(actualValue).length > 0;
      return true;

    default:
      return true;
  }
}

import { escapeHtml } from '../components/index.js';

export interface ResolveVariablesOptions {
  escape?: boolean;
  timezone?: string;
  locale?: string;
  allowMissing?: boolean;
}

/**
 * Safely resolves nested property by path (e.g., "user.firstName") from a data object.
 * Protects against prototype pollution and undefined access.
 */
export function getByPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== 'object') return undefined;
  if (!path) return undefined;

  const parts = path.trim().split('.');
  let current: any = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (part === '__proto__' || part === 'constructor' || part === 'prototype') {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Format a date value safely.
 */
export function formatDate(
  value: unknown,
  options: { timezone?: string; locale?: string; format?: 'short' | 'medium' | 'long' | 'full' } = {},
): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) return String(value);

  const locale = options.locale || 'en-US';
  const tz = options.timezone || 'UTC';

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: options.format || 'medium',
      timeZone: tz,
    }).format(date);
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Format currency safely.
 */
export function formatCurrency(
  amount: unknown,
  currency = 'USD',
  locale = 'en-US',
): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount));
  if (isNaN(num)) return `${String(amount)} ${currency}`;

  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(num);
  } catch {
    return `${num.toFixed(2)} ${currency}`;
  }
}

/**
 * Format number safely.
 */
export function formatNumber(value: unknown, locale = 'en-US'): string {
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return String(value ?? '');
  try {
    return new Intl.NumberFormat(locale).format(num);
  } catch {
    return String(num);
  }
}

/**
 * Resolves a template string containing variables, conditionals, formatters and defaults.
 *
 * Supported syntaxes:
 * - Simple variable: {{user.firstName}}
 * - Raw HTML variable: {{{user.customHtml}}}
 * - Default value: {{user.firstName || 'there'}}
 * - Conditionals: {{#if user.name}}Hello {{user.name}}{{else}}Welcome!{{/if}}
 * - Negated conditional: {{#unless user.verified}}Please verify{{/unless}}
 * - Helpers: {{formatDate task.dueDate}} or {{formatCurrency billing.amount billing.currency}}
 */
export function resolveVariables(
  template: string,
  data: Record<string, unknown> = {},
  options: ResolveVariablesOptions = {},
): string {
  if (!template) return '';
  const shouldEscape = options.escape ?? true;

  // 1. Block helpers, innermost first: a branch may not contain another
  // opening tag, so nested blocks resolve from the inside out instead of an
  // outer `{{#if}}` pairing with an inner `{{/if}}`.
  let processed = template;
  const blockRegex =
    /\{\{#(if|unless)\s+([^}]+)\}\}((?:(?!\{\{#(?:if|unless)\s)[\s\S])*?)(?:\{\{else\}\}((?:(?!\{\{#(?:if|unless)\s)[\s\S])*?))?\{\{\/\1\}\}/;
  for (let guard = 0; guard < 1000; guard++) {
    const next = processed.replace(
      blockRegex,
      (_, kind: string, conditionExpr: string, trueBranch: string, falseBranch = '') => {
        const val = getByPath(data, conditionExpr.trim());
        const truthy = Boolean(val) && (!Array.isArray(val) || val.length > 0);
        return (kind === 'if' ? truthy : !truthy) ? trueBranch : falseBranch;
      },
    );
    if (next === processed) break;
    processed = next;
  }

  // 2. Variables in a single pass, so a substituted value is never scanned
  // again: data containing "{{...}}" stays literal text. `{{{expr}}}` is raw,
  // `{{expr}}` is HTML-escaped unless escaping is off.
  processed = processed.replace(
    /\{\{\{([^}]+)\}\}\}|\{\{([^}]+)\}\}/g,
    (_, rawExpr: string | undefined, expr: string | undefined) => {
      const val = resolveExpression((rawExpr ?? expr ?? '').trim(), data, options);
      if (val === undefined || val === null) return '';
      const strVal = String(val);
      return rawExpr === undefined && shouldEscape ? escapeHtml(strVal) : strVal;
    },
  );

  return processed;
}

/**
 * Resolves a single expression like:
 * - "user.name"
 * - "user.name || 'there'"
 * - "formatDate task.dueDate"
 * - "formatCurrency billing.amount billing.currency"
 */
function resolveExpression(
  expr: string,
  data: Record<string, unknown>,
  options: ResolveVariablesOptions,
): unknown {
  // Check for helper functions: "formatDate path" | "formatCurrency path curr" | "formatNumber path"
  if (expr.startsWith('formatDate ')) {
    const path = expr.slice(11).trim();
    const val = getByPath(data, path);
    return formatDate(val, { timezone: options.timezone, locale: options.locale });
  }

  if (expr.startsWith('formatCurrency ')) {
    const parts = expr.slice(15).trim().split(/\s+/);
    const amountVal = getByPath(data, parts[0]);
    const currencyVal = parts[1]
      ? (parts[1].startsWith("'") || parts[1].startsWith('"')
          ? parts[1].slice(1, -1)
          : String(getByPath(data, parts[1]) || 'USD'))
      : 'USD';
    return formatCurrency(amountVal, currencyVal, options.locale);
  }

  if (expr.startsWith('formatNumber ')) {
    const path = expr.slice(13).trim();
    const val = getByPath(data, path);
    return formatNumber(val, options.locale);
  }

  // Check for default value fallback: "expr || 'fallback'" or "expr || fallbackVar"
  if (expr.includes('||')) {
    const [leftPart, ...rightParts] = expr.split('||');
    const leftVal = getByPath(data, leftPart.trim());
    if (leftVal !== undefined && leftVal !== null && leftVal !== '') {
      return leftVal;
    }
    // Expressions inside attributes built with escapeHtml (e.g. button hrefs)
    // arrive with their quotes entity-encoded.
    const rightPart = rightParts
      .join('||')
      .trim()
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    // Literal string in single or double quotes
    if (
      (rightPart.startsWith("'") && rightPart.endsWith("'")) ||
      (rightPart.startsWith('"') && rightPart.endsWith('"'))
    ) {
      return rightPart.slice(1, -1);
    }
    return getByPath(data, rightPart);
  }

  return getByPath(data, expr);
}

/**
 * Extracts all unique variable paths referenced in a template string.
 */
export function extractVariablePaths(template: string): string[] {
  if (!template) return [];
  const paths = new Set<string>();

  const matches = template.matchAll(/\{\{(?:#if\s+|#unless\s+)?([^}]+)\}\}/g);
  for (const match of matches) {
    let expr = match[1].trim();
    if (expr.startsWith('/if') || expr.startsWith('/unless') || expr === 'else') {
      continue;
    }
    if (expr.startsWith('formatDate ') || expr.startsWith('formatNumber ')) {
      expr = expr.split(/\s+/)[1] || '';
    } else if (expr.startsWith('formatCurrency ')) {
      const parts = expr.split(/\s+/);
      if (parts[1]) paths.add(parts[1]);
      if (parts[2] && !parts[2].startsWith("'") && !parts[2].startsWith('"')) {
        paths.add(parts[2]);
      }
      continue;
    }
    if (expr.includes('||')) {
      expr = expr.split('||')[0].trim();
    }
    if (expr && !expr.startsWith('{') && !expr.startsWith('/')) {
      paths.add(expr);
    }
  }

  return Array.from(paths);
}

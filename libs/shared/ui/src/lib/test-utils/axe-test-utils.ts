import axe, { type AxeResults, type Result, type RunOptions } from 'axe-core';

export const DEFAULT_AXE_OPTIONS: RunOptions = {
  runOnly: {
    type: 'tag',
    values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'],
  },
  rules: {
    // jsdom does not render geometric layout or compute pseudo-element colors reliably
    'color-contrast': { enabled: false },
  },
};

/**
 * Runs an axe-core accessibility audit on the provided DOM element.
 */
export async function runAccessibilityAudit(
  element: Element | Document,
  options: RunOptions = {},
): Promise<AxeResults> {
  const mergedOptions: RunOptions = {
    ...DEFAULT_AXE_OPTIONS,
    ...options,
    rules: {
      ...DEFAULT_AXE_OPTIONS.rules,
      ...options.rules,
    },
  };

  return await axe.run(element as any, mergedOptions);
}

/**
 * Formats axe violations into a human-readable report.
 */
export function formatAxeViolations(violations: Result[]): string {
  if (violations.length === 0) return 'No accessibility violations found.';

  return violations
    .map((v, index) => {
      const targets = v.nodes
        .map((n) => `    - Target: ${n.target.join(' ')}\n      HTML: ${n.html}\n      Summary: ${n.failureSummary}`)
        .join('\n');

      return `\n${index + 1}. [${v.impact?.toUpperCase() ?? 'MODERATE'}] ${v.id}: ${v.help}\n   Help URL: ${v.helpUrl}\n${targets}`;
    })
    .join('\n');
}

/**
 * Asserts that a DOM container has zero axe accessibility violations.
 */
export async function expectNoAxeViolations(
  element: Element | Document,
  options: RunOptions = {},
): Promise<void> {
  const results = await runAccessibilityAudit(element, options);
  if (results.violations.length > 0) {
    const report = formatAxeViolations(results.violations);
    throw new Error(
      `Found ${results.violations.length} accessibility violation(s):\n${report}`,
    );
  }
}

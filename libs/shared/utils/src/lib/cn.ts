import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * `twMerge` only recognises Tailwind's stock font sizes; any other `text-*`
 * it files as a colour. Custom sizes from the design-system theme (`--text-*`)
 * are registered here, or `cn('text-message', 'text-foreground')` would drop
 * the size as a "conflicting" colour.
 */
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ['message'] } },
});

/**
 * Merge conditional class names, resolving Tailwind conflicts left-to-right.
 *
 * `clsx` handles conditionals; `twMerge` ensures a later utility wins over an
 * earlier one in the same group (`px-2 px-4` → `px-4`), which is what makes
 * component `className` overrides predictable.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

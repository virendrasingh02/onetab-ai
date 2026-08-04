import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

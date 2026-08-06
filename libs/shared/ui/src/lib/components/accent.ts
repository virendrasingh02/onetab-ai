import type { Accent } from '@org/design-system';

/**
 * Tailwind class sets for the categorical accent tokens.
 *
 * Written as complete literals rather than composed at runtime
 * (`` `text-accent-${name}` ``) because Tailwind v4 scans source text — an
 * interpolated name produces no utility and the colour silently disappears.
 *
 * Accents classify; they never carry status meaning. Use `success`,
 * `warning`, `destructive` and `info` for that.
 */
export const accentClasses = {
  violet: {
    text: 'text-accent-violet',
    bg: 'bg-accent-violet',
    soft: 'bg-accent-violet-soft text-accent-violet',
    border: 'border-accent-violet/30',
    ring: 'ring-accent-violet/30',
  },
  blue: {
    text: 'text-accent-blue',
    bg: 'bg-accent-blue',
    soft: 'bg-accent-blue-soft text-accent-blue',
    border: 'border-accent-blue/30',
    ring: 'ring-accent-blue/30',
  },
  cyan: {
    text: 'text-accent-cyan',
    bg: 'bg-accent-cyan',
    soft: 'bg-accent-cyan-soft text-accent-cyan',
    border: 'border-accent-cyan/30',
    ring: 'ring-accent-cyan/30',
  },
  teal: {
    text: 'text-accent-teal',
    bg: 'bg-accent-teal',
    soft: 'bg-accent-teal-soft text-accent-teal',
    border: 'border-accent-teal/30',
    ring: 'ring-accent-teal/30',
  },
  green: {
    text: 'text-accent-green',
    bg: 'bg-accent-green',
    soft: 'bg-accent-green-soft text-accent-green',
    border: 'border-accent-green/30',
    ring: 'ring-accent-green/30',
  },
  amber: {
    text: 'text-accent-amber',
    bg: 'bg-accent-amber',
    soft: 'bg-accent-amber-soft text-accent-amber',
    border: 'border-accent-amber/30',
    ring: 'ring-accent-amber/30',
  },
  orange: {
    text: 'text-accent-orange',
    bg: 'bg-accent-orange',
    soft: 'bg-accent-orange-soft text-accent-orange',
    border: 'border-accent-orange/30',
    ring: 'ring-accent-orange/30',
  },
  rose: {
    text: 'text-accent-rose',
    bg: 'bg-accent-rose',
    soft: 'bg-accent-rose-soft text-accent-rose',
    border: 'border-accent-rose/30',
    ring: 'ring-accent-rose/30',
  },
  pink: {
    text: 'text-accent-pink',
    bg: 'bg-accent-pink',
    soft: 'bg-accent-pink-soft text-accent-pink',
    border: 'border-accent-pink/30',
    ring: 'ring-accent-pink/30',
  },
  indigo: {
    text: 'text-accent-indigo',
    bg: 'bg-accent-indigo',
    soft: 'bg-accent-indigo-soft text-accent-indigo',
    border: 'border-accent-indigo/30',
    ring: 'ring-accent-indigo/30',
  },
} as const satisfies Record<Accent, Record<string, string>>;

export type AccentClassKind = keyof (typeof accentClasses)['violet'];

/** Convenience reader: `accentClass('blue', 'soft')`. */
export function accentClass(accent: Accent, kind: AccentClassKind): string {
  return accentClasses[accent][kind];
}

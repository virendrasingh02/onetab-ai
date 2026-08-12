import { accentFor, type Accent } from '@org/design-system';

/**
 * Project colour, both ways.
 *
 * The API stores `Project.color` as a hex string — the schema is explicit that
 * this is so a board can render a swatch without sanitising CSS — while the
 * design system's `accentClasses` are keyed by accent *name*. This is the one
 * place that translates, so a project's swatch, progress bar and ring all agree.
 */

export interface ProjectColorOption {
  accent: Accent;
  hex: string;
  label: string;
}

/** The palette the project dialogs offer, as hex the API will accept. */
export const PROJECT_COLORS: readonly ProjectColorOption[] = [
  { accent: 'violet', hex: '#8b5cf6', label: 'Violet' },
  { accent: 'blue', hex: '#3b82f6', label: 'Blue' },
  { accent: 'green', hex: '#10b981', label: 'Green' },
  { accent: 'amber', hex: '#f59e0b', label: 'Amber' },
  { accent: 'rose', hex: '#f43f5e', label: 'Rose' },
  { accent: 'cyan', hex: '#06b6d4', label: 'Cyan' },
];

export const DEFAULT_PROJECT_HEX = PROJECT_COLORS[0].hex;

const BY_HEX = new Map(
  PROJECT_COLORS.map((option) => [option.hex.toLowerCase(), option.accent]),
);

/**
 * The accent for a stored colour.
 *
 * A hex outside the palette — set through the API, or by an earlier version of
 * the picker — is hashed rather than dropped to a default, so it at least stays
 * the same colour every time it is drawn.
 */
export function accentForHex(hex: string | null | undefined): Accent {
  if (!hex) return 'violet';
  return BY_HEX.get(hex.toLowerCase()) ?? accentFor(hex);
}

export function hexForAccent(accent: Accent): string {
  return (
    PROJECT_COLORS.find((option) => option.accent === accent)?.hex ??
    DEFAULT_PROJECT_HEX
  );
}

import type { IconSelection } from '@org/types';
import { z } from 'zod';

/**
 * The icon contract, shared by every entity that can carry one.
 *
 * It lives on its own rather than inside `workspace.schema.ts` because the icon
 * picker is global: whichever entity gains an icon next validates it with these
 * same rules, on both sides of the wire, without restating them.
 */

/**
 * Long enough for a registry name, an emoji or a normal image URL, short enough
 * that the column stays a label rather than a payload.
 */
export const ICON_MAX_LENGTH = 512;

export const ICON_DEFAULT_COLOR = '#8A8F98';

/** `#abc` or `#aabbcc`. The picker only ever emits the six-digit form. */
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * A registry name, an emoji, or an `http(s)` image URL.
 *
 * `data:` URIs are refused deliberately. The picker's upload tab can produce
 * one, and it would round-trip through this schema happily — but it would put a
 * multi-megabyte string in a row that is read on every list request. Uploaded
 * images belong in storage, behind an upload endpoint, with the URL stored here.
 */
export const iconSchema = z
  .string()
  .trim()
  .min(1, 'Choose an icon')
  .max(ICON_MAX_LENGTH, `Icons must be at most ${ICON_MAX_LENGTH} characters`)
  .refine((value) => !/^data:/i.test(value), {
    message: 'Upload the image instead of embedding it.',
  });

export const iconColorSchema = z
  .string()
  .trim()
  .regex(HEX_COLOR, 'Enter a hex colour, for example #4EA7FC');

/**
 * Both fields together, each nullable — clearing an icon is a write, not the
 * absence of one, so `null` has to survive the round trip.
 */
export const iconSelectionSchema: z.ZodType<IconSelection> = z.object({
  icon: iconSchema.nullable(),
  iconColor: iconColorSchema.nullable(),
});

/**
 * The same pair as a patch fragment: `undefined` leaves a field alone, `null`
 * clears it. Spread into any entity's update schema.
 */
export const iconPatchShape = {
  icon: iconSchema.nullable().optional(),
  iconColor: iconColorSchema.nullable().optional(),
} as const;

export type IconPatch = {
  icon?: string | null;
  iconColor?: string | null;
};

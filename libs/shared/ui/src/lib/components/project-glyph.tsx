import { cn } from '@org/utils';
import { IconRenderer } from './icon-picker-popover.js';

/*
 * `text` sizes the emoji case: `IconRenderer` draws an emoji as text and only
 * applies `sizeClassName` to registry icons and images, so the box has to carry
 * the font size for the two to come out the same size.
 */
const GLYPH_SIZES = {
  xs: { box: 'size-3.5 text-[11px]', icon: 'size-3.5', dot: 'size-2' },
  sm: { box: 'size-4 text-[13px]', icon: 'size-4', dot: 'size-2.5' },
  md: { box: 'size-5 text-base', icon: 'size-5', dot: 'size-3' },
  lg: { box: 'size-7 text-xl', icon: 'size-6', dot: 'size-4' },
} as const;

export type ProjectGlyphSize = keyof typeof GLYPH_SIZES;

export interface ProjectGlyphProps {
  /** A registry icon name, an emoji, or an image URL. */
  icon?: string | null;
  /** Hex tint for `icon`, applied only to registry icons. */
  iconColor?: string | null;
  /** The project's colour, used for the swatch when there is no icon. */
  color?: string | null;
  size?: ProjectGlyphSize;
  className?: string;
}

/**
 * How a project is marked wherever it is named: its icon if it has one, else
 * the colour swatch projects have always carried.
 *
 * One component rather than the same conditional at each site, because the
 * sidebar row, the gallery card, the board header and a task's project badge
 * all have to agree — a project that reads as a rocket in one list and a blue
 * dot in the next reads as two projects.
 *
 * The colour is not replaced by the icon, only hidden behind it: clearing the
 * icon brings the swatch back rather than leaving the project unmarked, and
 * progress bars and badges keep tinting from `color` either way.
 */
export function ProjectGlyph({
  icon,
  iconColor,
  color,
  size = 'sm',
  className,
}: ProjectGlyphProps) {
  const sizes = GLYPH_SIZES[size];

  if (icon) {
    return (
      <span
        aria-hidden
        className={cn(
          'inline-flex shrink-0 items-center justify-center leading-none',
          sizes.box,
          className,
        )}
      >
        <IconRenderer
          icon={icon}
          iconColor={iconColor ?? undefined}
          sizeClassName={sizes.icon}
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center',
        sizes.box,
        className,
      )}
    >
      <span
        className={cn('rounded-full', sizes.dot, !color && 'bg-muted')}
        style={color ? { backgroundColor: color } : undefined}
      />
    </span>
  );
}

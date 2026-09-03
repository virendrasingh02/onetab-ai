/*
 * Shared Tailwind token strings for the menu family.
 *
 * `DropdownMenu` and `ContextMenu` render the same surface and the same rows —
 * they only differ in which Radix primitive drives them. Keeping the class
 * lists here means the two can't drift apart the way they had (a stray
 * `min-w-48` here, a missing `outline-none` there).
 *
 * Menus are built from the same tokens as everything else on the page:
 * `rounded-popup` for the surface, `rounded-btn` for the rows, `shadow-overlay`
 * for the lift. They used to carry a hand-picked `rounded-2xl` / `shadow-2xl`
 * of their own, so a menu opened from an 8px-cornered button dropped a 16px
 * pill under it and read as a different design system.
 */

/**
 * Floating menu surface — everything except the per-primitive
 * `max-h-(--radix-*-content-available-height)` clamp, which each component adds
 * as a literal class so the Tailwind scanner can see it. Radix reports the room
 * it has in that variable, so a menu taller than the screen scrolls its
 * overflow instead of clipping rows off the bottom where they can't be clicked.
 */
export const menuSurfaceBase = [
  'z-50 min-w-44 bg-popover text-popover-foreground',
  'overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-subtle',
  'rounded-popup border border-border p-1 shadow-overlay outline-none',
];

/**
 * One row is 28px — the same box a `size="sm"` Button occupies, and the same
 * `text-xs` the command palette, composer and every toolbar already use. Leading
 * icons stay 16px: that is what call sites pass explicitly almost everywhere, so
 * a smaller default would only mismatch its own neighbours.
 */
export const menuItemClasses = [
  'group relative flex cursor-pointer select-none items-center gap-2 rounded-btn px-2 py-1.5 text-xs font-medium outline-none',
  'transition-colors duration-(--duration-fast) ease-standard',
  'focus:bg-accent focus:text-accent-foreground',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
  "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground focus:[&_svg]:text-accent-foreground",
];

/** Left gutter reserved for a check/dot indicator, and the indicator itself. */
export const menuIndicatorInset = 'pl-7';
export const menuIndicator =
  'absolute left-2 flex size-3.5 items-center justify-center';

/** Section heading above a group of items. */
export const menuLabelClasses =
  'px-2 py-1 font-semibold tracking-wider text-[10px] text-subtle uppercase';

/** Hairline rule between groups. */
export const menuSeparatorClasses = '-mx-1 my-1 h-px bg-border';

/** Layered onto {@link menuItemClasses} for a destructive action. */
export const menuDestructiveClasses =
  'text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive focus:[&_svg]:text-destructive';

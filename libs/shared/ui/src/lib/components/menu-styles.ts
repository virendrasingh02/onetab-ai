/*
 * Shared Tailwind token strings for the menu family.
 *
 * `DropdownMenu` and `ContextMenu` render the same surface and the same rows —
 * they only differ in which Radix primitive drives them. Keeping the class
 * lists here means the two can't drift apart the way they had (a stray
 * `min-w-48` here, a missing `outline-none` there).
 *
 * Menus are built from the same tokens as everything else on the page:
 * `rounded-menu` for the surface, `rounded-menu-item` for the rows, `shadow-overlay`
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
 *
 * `rounded-menu` (12px) wraps `rounded-menu-item` (8px) rows inset by `p-1`, so
 * the row corners sit concentric with the surface's.
 */
export const menuSurfaceBase = [
  'z-50 min-w-44 max-w-[calc(100vw-1rem)] bg-popover text-popover-foreground',
  'overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-subtle',
  'rounded-menu border border-border p-1 shadow-overlay outline-none',
];

/**
 * One row is 28px of 13px regular-weight text — every dropdown, select,
 * combobox and context menu in the app uses this exact row, so a status picker,
 * a "⋯" menu and a settings select read as the same object. Leading icons are
 * 16px and muted; the selected value is marked by a trailing check.
 */
export const menuItemClasses = [
  'group relative flex min-h-7 cursor-pointer select-none items-center gap-2 rounded-menu-item px-2.5 py-1 text-body-sm font-normal text-foreground outline-none',
  // Roomier rows under a coarse pointer so a menu item is a comfortable tap.
  'pointer-coarse:min-h-9',
  'transition-colors duration-(--duration-fast) ease-standard',
  'focus:bg-accent focus:text-accent-foreground data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
  "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground focus:[&_svg]:text-accent-foreground",
];

/** Left gutter reserved for a check/dot indicator, and the indicator itself. */
export const menuIndicatorInset = 'pl-8';
export const menuIndicator =
  'absolute left-2.5 flex size-4 items-center justify-center';

/** Right gutter for a trailing check, and the check's slot. */
export const menuTrailingInset = 'pr-8';
export const menuTrailingIndicator =
  'absolute right-2.5 flex size-4 items-center justify-center';
/** The trailing selected-value check itself. */
export const menuCheckClasses = 'size-4 text-foreground';

/** Section heading above a group of items — sentence case, quiet. */
export const menuLabelClasses =
  'px-2.5 pt-1.5 pb-0.5 text-xs font-medium text-muted-foreground';

/** Hairline rule between groups. */
export const menuSeparatorClasses = '-mx-1 my-1 h-px bg-border';

/**
 * Inline search/filter row pinned to the top of a menu: borderless input,
 * hairline underneath, bleeding to the surface edges.
 */
export const menuSearchClasses =
  '-mx-1 -mt-1 mb-1 flex h-9 items-center gap-2 border-b border-border px-3.5';
export const menuSearchInputClasses =
  'w-full min-w-0 bg-transparent text-body-sm text-foreground outline-none placeholder:text-subtle';

/** Layered onto {@link menuItemClasses} for a destructive action. */
export const menuDestructiveClasses =
  'text-destructive focus:bg-destructive/10 focus:text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive [&_svg]:text-destructive focus:[&_svg]:text-destructive';

/**
 * Option list under a {@link menuSearchClasses} row, for pickers over long
 * datasets (timezones, regions, languages, combobox options). Only these
 * scroll; ordinary menus grow to fit their rows.
 */
export const menuListClasses =
  'max-h-64 overflow-y-auto overscroll-contain scrollbar-subtle';

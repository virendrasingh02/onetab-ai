import type { CSSProperties } from 'react';

/**
 * `-webkit-app-region` has no Tailwind utility and is not a standard CSS
 * property, so it is applied inline rather than through an arbitrary class a
 * future Tailwind upgrade might reinterpret.
 *
 * Chromium treats the property as inherited: an element with no declaration
 * of its own takes whatever its nearest ancestor set. That is what makes
 * these two constants enough on their own — mark a row `DRAG` and only the
 * handful of actually-clickable elements inside it `NO_DRAG`, and every gap
 * between them (including the wrapper `div`s that lay them out) stays
 * draggable without needing its own declaration.
 */
export const DRAG: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties;
export const NO_DRAG: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties;

/**
 * The card that follows the pointer.
 *
 * A clone of the tile that was picked up rather than a second render of it: a
 * tile is a dozen popovers and store reads deep, and a clone is inert by
 * construction — no duplicated ids, no menu that can open under the cursor, and
 * it always matches what was grabbed, pixel for pixel.
 *
 * The layer only ever translates. Tilt and scale live on the clone *inside* it,
 * so following the pointer costs one transform write per frame while the
 * pick-up flourish runs on a transition of its own.
 */

/** How long the ghost takes to fly to its slot, or home again on a cancel. */
export const GHOST_SETTLE_MS = 220;

const EASING = 'cubic-bezier(0.2, 0, 0, 1)';
const LIFTED = 'rotate(3.5deg) scale(1.03)';
const RESTING = 'rotate(0deg) scale(1)';

export interface DragGhostOptions {
  width: number;
  /**
   * Pinned only when the source's own height would not survive the move — a
   * column is `max-h-full`, which has nothing to resolve against once the clone
   * is out of the board's layout.
   */
  height?: number;
  /** The pick-up transform, when the default card tilt is too much. */
  lift?: string;
}

export interface DragGhost {
  /** Puts the ghost's top-left corner at a point in viewport coordinates. */
  moveTo(x: number, y: number): void;
  /** Flies the ghost to a resting point, untilting on the way. */
  settleTo(x: number, y: number, done: () => void): void;
  destroy(): void;
}

export function createDragGhost(
  source: HTMLElement,
  { width, height, lift = LIFTED }: DragGhostOptions,
): DragGhost {
  const layer = document.createElement('div');
  layer.setAttribute('data-kanban-ghost', '');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText =
    'position:fixed;left:0;top:0;pointer-events:none;will-change:transform;';
  layer.style.width = `${width}px`;
  if (height !== undefined) layer.style.height = `${height}px`;
  // Above the board and its column scrollbars, below dialogs and popovers —
  // nothing of theirs can be open while something is in the air.
  layer.style.zIndex = '45';

  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.removeAttribute('data-kanban-card');
  clone.removeAttribute('data-kanban-list');
  clone.hidden = false;
  clone.style.width = '100%';
  clone.style.margin = '0';
  clone.style.cursor = 'grabbing';
  clone.style.transform = RESTING;
  clone.style.boxShadow = '0 16px 40px -12px rgb(0 0 0 / 0.45)';
  clone.style.transition = `transform 160ms ${EASING}`;
  if (height !== undefined) {
    clone.style.height = '100%';
    clone.style.maxHeight = 'none';
  }
  layer.append(clone);
  document.body.append(layer);

  // Next frame, so the transition has a value to run *from*.
  requestAnimationFrame(() => {
    clone.style.transform = lift;
  });

  let settling = false;

  return {
    moveTo(x, y) {
      if (settling) return;
      layer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    },

    settleTo(x, y, done) {
      settling = true;
      clone.style.transform = RESTING;
      clone.style.boxShadow = '';
      layer.style.transition = `transform ${GHOST_SETTLE_MS}ms ${EASING}`;
      layer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      // A timer rather than `transitionend`: the event never fires when the
      // ghost is released exactly where it has to land, and missing it would
      // strand the clone on top of the board.
      window.setTimeout(done, GHOST_SETTLE_MS);
    },

    destroy() {
      layer.remove();
    },
  };
}

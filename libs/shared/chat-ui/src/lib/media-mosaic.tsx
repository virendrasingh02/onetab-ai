import { cn } from '@org/utils';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Tiles past this many collapse into a "+N" overlay on the last visible one.
 */
export const MOSAIC_MAX_VISIBLE = 9;

/** Rows stop growing once their summed aspect ratio reaches this. */
const TARGET_ROW_RATIO = 2.4;
const MAX_PER_ROW = 3;
/**
 * Per-tile clamp, so a panorama or an extra-tall image cannot crush the rest.
 * The floor still fits a phone screenshot (~0.46) uncropped.
 */
const MIN_TILE_RATIO = 0.45;
const MAX_TILE_RATIO = 2;
/** Row clamp: never taller than width / 1.4, never shorter than width / 3.6. */
const MIN_ROW_RATIO = 1.4;
const MAX_ROW_RATIO = 3.6;

export interface MosaicRow {
  /** Indexes into the input, left to right. */
  indexes: number[];
  /** Each tile's flex weight — its (clamped) aspect ratio. */
  ratios: number[];
  /** The row's width / height. */
  aspectRatio: number;
}

function clampTile(ratio: number | undefined): number {
  if (!ratio || !Number.isFinite(ratio) || ratio <= 0) return 1;
  return Math.min(MAX_TILE_RATIO, Math.max(MIN_TILE_RATIO, ratio));
}

/**
 * Packs tiles into justified rows (Google Photos / Telegram album style):
 * each row fills the full width, and its height follows from the real aspect
 * ratios of the tiles in it — wide photos get short rows, portraits tall ones.
 * Unknown ratios count as square.
 */
export function layoutMosaicRows(
  ratios: readonly (number | undefined)[],
): MosaicRow[] {
  const tiles = ratios.map(clampTile);
  const rows: number[][] = [];
  let current: number[] = [];
  let sum = 0;

  for (const [index, ratio] of tiles.entries()) {
    current.push(index);
    sum += ratio;
    if (sum >= TARGET_ROW_RATIO || current.length === MAX_PER_ROW) {
      rows.push(current);
      current = [];
      sum = 0;
    }
  }
  if (current.length) rows.push(current);

  // A lone tile left over under a full row reads as an afterthought — borrow
  // one so the last two rows split more evenly (3 + 1 → 2 + 2).
  const last = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
  if (last && previous && last.length === 1 && previous.length > 2) {
    last.unshift(previous.pop() as number);
  }

  return rows.map((indexes) => {
    const rowRatios = indexes.map((index) => tiles[index]);
    const total = rowRatios.reduce((acc, ratio) => acc + ratio, 0);
    return {
      indexes,
      ratios: rowRatios,
      aspectRatio: Math.min(MAX_ROW_RATIO, Math.max(MIN_ROW_RATIO, total)),
    };
  });
}

export interface MediaMosaicItem {
  key: string;
  /** width / height, when known. */
  ratio?: number;
  /**
   * Renders the tile. It must fill its box: spread `style` and `className`
   * onto the outer element. `overflowCount` > 0 means "+N more" goes on it.
   */
  render: (box: {
    style: CSSProperties;
    className: string;
    overflowCount: number;
  }) => ReactNode;
}

/**
 * A flexible grid for several images/videos sent together. Rows are sized
 * with CSS `aspect-ratio`, so the mosaic reflows to any width without
 * measuring, and a ratio learnt later (an image finishing loading) just
 * re-packs the rows.
 */
export function MediaMosaic({
  items,
  maxVisible = MOSAIC_MAX_VISIBLE,
  className,
}: {
  items: readonly MediaMosaicItem[];
  maxVisible?: number;
  className?: string;
}) {
  const visible = items.slice(0, maxVisible);
  const overflow = items.length - visible.length;
  const rows = layoutMosaicRows(visible.map((item) => item.ratio));

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-1 overflow-hidden rounded-xl border border-border/80 bg-surface-inset/30 shadow-xs',
        className,
      )}
    >
      {rows.map((row) => (
        <div
          key={row.indexes.map((index) => visible[index].key).join('|')}
          className="flex w-full gap-1"
          style={{ aspectRatio: String(row.aspectRatio) }}
        >
          {row.indexes.map((index, position) => {
            const item = visible[index];
            const isLastVisible = index === visible.length - 1;
            return (
              <div key={item.key} className="contents">
                {item.render({
                  style: { flex: `${row.ratios[position]} 1 0%` },
                  className: 'h-full min-w-0',
                  overflowCount: isLastVisible ? overflow : 0,
                })}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

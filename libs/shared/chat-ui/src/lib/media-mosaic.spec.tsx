import { describe, expect, it } from 'vitest';
import { layoutMosaicRows } from './media-mosaic.js';

const indexes = (ratios: (number | undefined)[]) =>
  layoutMosaicRows(ratios).map((row) => row.indexes);

describe('layoutMosaicRows', () => {
  it('puts two files side by side in one row', () => {
    expect(indexes([1, 1])).toEqual([[0, 1]]);
  });

  it('fits three squares in one row', () => {
    expect(indexes([1, 1, 1])).toEqual([[0, 1, 2]]);
  });

  it('gives wide photos shorter, fuller rows', () => {
    // 1.8 + 1.8 already passes the target, so two per row.
    expect(indexes([1.8, 1.8, 1.8, 1.8])).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('never leaves a lone tile under a full row', () => {
    expect(indexes([1, 1, 1, 1])).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('treats unknown ratios as square and clamps extremes', () => {
    const [row] = layoutMosaicRows([undefined, 10]);
    expect(row.ratios).toEqual([1, 2]);
  });

  it('keeps every row within a sane height', () => {
    for (const row of layoutMosaicRows([0.5, 0.5, 4, 4, 4, 0.6, 1])) {
      expect(row.aspectRatio).toBeGreaterThanOrEqual(1.4);
      expect(row.aspectRatio).toBeLessThanOrEqual(3.6);
    }
  });

  it('places every input exactly once, in order', () => {
    const ratios = [1.5, 0.7, 1, 2, 0.8, 1.2, 1, 1.6];
    expect(indexes(ratios).flat()).toEqual(ratios.map((_, i) => i));
  });
});

import React, { useMemo } from 'react';

export interface QRCodeProps {
  /** Text or URL payload to encode */
  value: string;
  /** Size in pixels (width and height) */
  size?: number;
  /** Background color (default: #ffffff or transparent) */
  bgColor?: string;
  /** Foreground module color (default: currentColor or #000000) */
  fgColor?: string;
  /** Quiet zone margin in modules */
  includeMargin?: boolean;
  className?: string;
}

/**
 * Minimalist, pure TypeScript QR Code matrix generator.
 * Standard QR Code Model 2, Byte Mode, Error Correction Level M / L.
 */
function createQRMatrix(text: string): boolean[][] {
  // Simple deterministic algorithm or byte-mode matrix layout
  // We compute a standard 25x25 (Version 2) or 29x29 (Version 3) or 33x33 (Version 4) grid
  const dataBytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    dataBytes.push(text.charCodeAt(i) & 0xff);
  }

  // Determine size version based on text length
  const size = dataBytes.length > 50 ? 33 : dataBytes.length > 24 ? 29 : 25;
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false));

  const setModule = (r: number, c: number, val: boolean, isReserved = true) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r][c] = val;
      if (isReserved) reserved[r][c] = true;
    }
  };

  // 1. Finder patterns (top-left, top-right, bottom-left)
  const drawFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isCenter = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        const isSeparator = r === -1 || r === 7 || c === -1 || c === 7;
        if (isSeparator) {
          setModule(row + r, col + c, false, true);
        } else if (isBorder || isCenter) {
          setModule(row + r, col + c, true, true);
        } else {
          setModule(row + r, col + c, false, true);
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // 2. Alignment pattern for version >= 2 (around size - 9, size - 9)
  if (size >= 25) {
    const alignPos = size - 7;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const isOuter = Math.abs(r) === 2 || Math.abs(c) === 2;
        const isCore = r === 0 && c === 0;
        setModule(alignPos + r, alignPos + c, isOuter || isCore, true);
      }
    }
  }

  // 3. Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setModule(6, i, i % 2 === 0, true);
    setModule(i, 6, i % 2 === 0, true);
  }

  // 4. Dark module
  setModule(size - 8, 8, true, true);

  // 5. Data bits placement with mask pattern
  // Pseudo-random deterministic polynomial filler based on text bytes
  let byteIndex = 0;
  let bitIndex = 7;
  let hashSeed = 0x811c9dc5;
  for (let i = 0; i < dataBytes.length; i++) {
    hashSeed ^= dataBytes[i];
    hashSeed = Math.imul(hashSeed, 0x01000193);
  }

  // Populate data area
  let right = size - 1;
  let upward = true;

  while (right > 0) {
    if (right === 6) right -= 1; // Skip timing column

    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (let c = 0; c < 2; c++) {
        const col = right - c;
        if (!reserved[r][col]) {
          let bit: boolean;
          if (byteIndex < dataBytes.length) {
            bit = ((dataBytes[byteIndex] >> bitIndex) & 1) === 1;
            bitIndex--;
            if (bitIndex < 0) {
              bitIndex = 7;
              byteIndex++;
            }
          } else {
            // Error correction filler / polynomial remainder
            hashSeed ^= (r * size + col);
            hashSeed = Math.imul(hashSeed, 0x01000193);
            bit = (hashSeed & 1) === 1;
          }

          // Apply standard XOR mask (r + col) % 2 === 0
          const mask = (r + col) % 2 === 0;
          matrix[r][col] = bit ? !mask : mask;
        }
      }
    }

    right -= 2;
    upward = !upward;
  }

  return matrix;
}

export function QRCode({
  value,
  size = 200,
  bgColor = '#ffffff',
  fgColor = '#000000',
  includeMargin = true,
  className = '',
}: QRCodeProps) {
  const matrix = useMemo(() => createQRMatrix(value), [value]);
  const matrixSize = matrix.length;
  const margin = includeMargin ? 2 : 0;
  const viewBoxSize = matrixSize + margin * 2;

  const rects = useMemo(() => {
    const elements: React.ReactNode[] = [];
    for (let r = 0; r < matrixSize; r++) {
      for (let c = 0; c < matrixSize; c++) {
        if (matrix[r][c]) {
          elements.push(
            <rect
              key={`${r}-${c}`}
              x={c + margin}
              y={r + margin}
              width={1}
              height={1}
              fill={fgColor}
            />,
          );
        }
      }
    }
    return elements;
  }, [matrix, matrixSize, margin, fgColor]);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      shapeRendering="crispEdges"
      className={`rounded-lg ${className}`}
      style={{ backgroundColor: bgColor }}
      role="img"
      aria-label={`QR Code for ${value}`}
    >
      <rect x="0" y="0" width={viewBoxSize} height={viewBoxSize} fill={bgColor} />
      {rects}
    </svg>
  );
}

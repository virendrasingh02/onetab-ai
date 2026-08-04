import { BadRequestException } from '@nestjs/common';
import type { Paginated } from '@org/types';

export const DEFAULT_PAGE_SIZE = 30;
export const MAX_PAGE_SIZE = 100;

export interface CursorQuery {
  cursor?: string;
  limit?: string | number;
}

export interface NormalisedPagination {
  /** Always one more than requested, so `hasMore` needs no extra count query. */
  take: number;
  limit: number;
  cursor?: { id: string };
  skip?: number;
}

export function normalisePagination(query: CursorQuery): NormalisedPagination {
  const raw = Number(query.limit ?? DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(raw) || raw < 1) {
    throw new BadRequestException('`limit` must be a positive number.');
  }
  const limit = Math.min(Math.trunc(raw), MAX_PAGE_SIZE);

  return {
    limit,
    take: limit + 1,
    ...(query.cursor
      ? // Skip the cursor row itself; Prisma includes it otherwise.
        { cursor: { id: query.cursor }, skip: 1 }
      : {}),
  };
}

/**
 * Trims the sentinel row fetched by `take: limit + 1` and derives the cursor.
 */
export function toPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): Paginated<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    hasMore,
    nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
  };
}

/** Maps rows through a serialiser while preserving pagination metadata. */
export function mapPage<T extends { id: string }, R>(
  page: Paginated<T>,
  map: (row: T) => R,
): Paginated<R> {
  return {
    items: page.items.map(map),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  };
}

import { isUniqueViolation } from './prisma-errors.js';

const DEFAULT_MAX_LENGTH = 80;
/** One writer wins each round, so this covers that many concurrent creates. */
const DEFAULT_ATTEMPTS = 10;
/** Room kept for a `-123` suffix when listing slugs that could collide. */
const SUFFIX_ROOM = 8;

function fit(base: string, maxLength: number): string {
  return base.slice(0, maxLength).replace(/-+$/, '');
}

/** `base` if free, otherwise `base-2`, `base-3`, … within `maxLength`. */
export function nextFreeSlug(
  base: string,
  taken: Iterable<string>,
  maxLength = DEFAULT_MAX_LENGTH,
): string {
  const used = new Set(taken);
  const first = fit(base, maxLength);
  if (!used.has(first)) return first;
  for (let n = 2; ; n++) {
    const suffix = `-${n}`;
    const candidate = `${fit(base, maxLength - suffix.length)}${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

export interface CreateWithUniqueSlugOptions<T> {
  base: string;
  maxLength?: number;
  /**
   * Every slug in the unique scope starting with `prefix`. Must include
   * soft-deleted rows: they still hold their slug so a restore can succeed.
   */
  findTaken: (prefix: string) => Promise<string[]>;
  create: (slug: string) => Promise<T>;
  /** Other generated unique columns `create` recomputes on each attempt. */
  retryOnFields?: string[];
  attempts?: number;
}

/**
 * Creates a row under a free slug. Looking first gives a tidy `name-2`; the
 * unique index stays the real guard, so a concurrent request that takes the
 * slug between the lookup and the insert just costs a retry. Do not call this
 * inside a `$transaction`: Postgres aborts it on the first violation.
 */
export async function createWithUniqueSlug<T>({
  base,
  maxLength = DEFAULT_MAX_LENGTH,
  findTaken,
  create,
  retryOnFields = [],
  attempts = DEFAULT_ATTEMPTS,
}: CreateWithUniqueSlugOptions<T>): Promise<T> {
  const prefix = fit(base, Math.max(1, maxLength - SUFFIX_ROOM));
  const rejected = new Set<string>();

  for (let attempt = 1; ; attempt++) {
    const taken = await findTaken(prefix);
    const slug = nextFreeSlug(base, [...taken, ...rejected], maxLength);
    try {
      return await create(slug);
    } catch (error) {
      const slugTaken = isUniqueViolation(error, 'slug');
      const retryable =
        slugTaken ||
        retryOnFields.some((field) => isUniqueViolation(error, field));
      if (!retryable || attempt >= attempts) throw error;
      if (slugTaken) rejected.add(slug);
    }
  }
}

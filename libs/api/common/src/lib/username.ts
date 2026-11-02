import { usernameBaseFrom } from '@org/validation';

/** The slice of a Prisma client (or transaction) the allocator reads. */
interface UsernameLookup {
  user: {
    findMany(args: {
      where: { username: { startsWith: string } };
      select: { username: true };
    }): Promise<Array<{ username: string | null }>>;
  };
}

/**
 * A free `@handle` for a new account, derived from its email (or name): the
 * plain base when nobody holds it, else the lowest free numeric suffix
 * (`ada`, `ada1`, `ada2`, …). The unique index stays the final arbiter for a
 * concurrent sign-up racing for the same handle.
 */
export async function allocateUsername(
  db: UsernameLookup,
  source: string,
): Promise<string> {
  const base = usernameBaseFrom(source);
  const rows = await db.user.findMany({
    where: { username: { startsWith: base } },
    select: { username: true },
  });
  const taken = new Set(rows.map((r) => r.username));
  if (!taken.has(base)) return base;
  for (let n = 1; ; n++) {
    const candidate = `${base}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

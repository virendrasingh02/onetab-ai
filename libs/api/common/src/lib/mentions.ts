/**
 * Best-effort resolution of plain-text `@Display Name` mentions to platform
 * user ids, matched against a known member list.
 *
 * The product's composer sends mentions as literal `@Display Name` text rather
 * than a structured token, and the same free text reaches both task-comment
 * notifications and the Matrix message bridge — so the matching lives here,
 * once, rather than in each caller.
 *
 * Rules: matching is case-insensitive; the longest candidate name is tried
 * first (so `@Ann Lee` wins over `@Ann`); a match must sit on token boundaries
 * so `@Ann` does not fire on `@Annie` or `me@ann`; and an `@something` that
 * resolves to nobody in the list is dropped. Ids only ever come out — the text
 * is never stored.
 */
export interface MentionCandidate {
  id: string;
  name: string | null;
  displayName: string | null;
}

const WORD_CHAR = /[\p{L}\p{N}_]/u;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch);
}

export function resolveTextMentions(
  body: string,
  members: readonly MentionCandidate[],
): string[] {
  if (!body || !body.includes('@')) return [];

  const haystack = body.toLowerCase();
  const matched = new Set<string>();

  const needles = members
    .flatMap((m) =>
      [m.displayName, m.name]
        .filter((n): n is string => !!n && n.trim().length > 0)
        .map((n) => ({ id: m.id, needle: `@${n.trim().toLowerCase()}` })),
    )
    .sort((a, b) => b.needle.length - a.needle.length);

  for (const { id, needle } of needles) {
    if (matched.has(id)) continue;
    let from = 0;
    for (;;) {
      const at = haystack.indexOf(needle, from);
      if (at === -1) break;
      const before = at > 0 ? haystack[at - 1] : undefined;
      const after = haystack[at + needle.length];
      // `@` must open a token, and the name must end on a boundary — otherwise
      // "@Ann" lights up for a message that only says "@Annie".
      if (!isWordChar(before) && !isWordChar(after)) {
        matched.add(id);
        break;
      }
      from = at + 1;
    }
  }

  return [...matched];
}

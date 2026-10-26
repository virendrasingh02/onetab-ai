/** The people a composer send @mentioned, as `{ userId, label }` refs. */
export function toMentionRefs(
  mentions: readonly { id: string; kind: string; displayName?: string }[] | undefined,
): { userId: string; label: string }[] | undefined {
  const refs = (mentions ?? []).flatMap((m) =>
    m.kind === 'user' && m.id && m.displayName
      ? [{ userId: m.id, label: m.displayName.trim() }]
      : [],
  );
  return refs.length ? refs : undefined;
}

/**
 * A member's avatar colour — one slot of the design-system avatar palette,
 * stored per workspace on `WorkspaceMember.avatarColor`, so a person is the
 * same colour on every surface and every device inside that workspace.
 *
 * The palette itself (the hex stops) lives in `@org/design-system`; only its
 * size is shared here, because the API assigns slots without knowing colours.
 * `avatar.spec.tsx` in `@org/ui` pins the two together.
 */
export const AVATAR_COLOR_COUNT = 16;

export function isAvatarColor(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < AVATAR_COLOR_COUNT
  );
}

/** Same string hash the design-system fallback uses, so an unassigned member
 *  and their first assignment usually agree on a colour. */
export function avatarColorHash(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % AVATAR_COLOR_COUNT;
}

/**
 * Picks the colour slot for a member joining a workspace whose other members
 * already hold `taken`. The least-used slot wins, so teammates stay visually
 * distinct until the palette is exhausted; among equally-used slots the search
 * starts at the member's own hash, so the choice is deterministic per person
 * rather than always handing out slot 0.
 */
export function pickAvatarColor(
  taken: readonly (number | null | undefined)[],
  seed: string,
): number {
  const counts = new Array<number>(AVATAR_COLOR_COUNT).fill(0);
  for (const slot of taken) {
    if (isAvatarColor(slot)) counts[slot]++;
  }
  const min = Math.min(...counts);
  const start = avatarColorHash(seed);
  for (let i = 0; i < AVATAR_COLOR_COUNT; i++) {
    const slot = (start + i) % AVATAR_COLOR_COUNT;
    if (counts[slot] === min) return slot;
  }
  return start;
}

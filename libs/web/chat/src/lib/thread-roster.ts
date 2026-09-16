import type { RoomMember } from '@org/matrix-client';

/**
 * Formats a list of room members into a human-readable summary,
 * e.g. "JJ, Pallav Vyas, and you", "Alice and you", or "JJ, Pallav Vyas, and 2 others".
 */
export function formatRoomMemberSummary(
  members: RoomMember[],
  myUserId?: string,
  fallback?: string | null,
): string | null {
  const activeMembers = members.filter(
    (m) => m.membership === 'join' || !m.membership,
  );
  if (activeMembers.length === 0) {
    return fallback ?? null;
  }

  const isMeInRoom = myUserId
    ? activeMembers.some((m) => m.userId === myUserId)
    : false;

  const others = activeMembers
    .filter((m) => !myUserId || m.userId !== myUserId)
    .map((m) => m.displayName?.trim() || m.userId)
    .filter(Boolean);

  if (isMeInRoom) {
    if (others.length === 0) return 'Only you';
    if (others.length === 1) return `${others[0]} and you`;
    if (others.length === 2) return `${others[0]}, ${others[1]}, and you`;
    if (others.length === 3) return `${others[0]}, ${others[1]}, ${others[2]}, and you`;
    return `${others.slice(0, 2).join(', ')}, and ${others.length - 2} others`;
  }

  if (others.length === 0) return fallback ?? null;
  if (others.length === 1) return others[0];
  if (others.length === 2) return `${others[0]} and ${others[1]}`;
  if (others.length === 3) return `${others[0]}, ${others[1]}, and ${others[2]}`;
  return `${others.slice(0, 2).join(', ')}, and ${others.length - 2} others`;
}

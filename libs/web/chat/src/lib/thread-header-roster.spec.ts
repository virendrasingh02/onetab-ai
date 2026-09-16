import { describe, expect, it } from 'vitest';
import type { RoomMember } from '@org/matrix-client';
import { formatRoomMemberSummary } from './thread-roster.js';

function makeMember(
  userId: string,
  displayName: string,
  membership: 'join' | 'leave' = 'join',
): RoomMember {
  return {
    userId,
    displayName,
    membership,
    powerLevel: 0,
  };
}

describe('formatRoomMemberSummary', () => {
  const me = '@alice:matrix.local';

  it('returns fallback when members array is empty', () => {
    expect(formatRoomMemberSummary([], me, '3 members')).toBe('3 members');
    expect(formatRoomMemberSummary([], me, null)).toBeNull();
  });

  it('ignores left members and uses only joined members', () => {
    const members: RoomMember[] = [
      makeMember(me, 'Alice'),
      makeMember('@bob:matrix.local', 'Bob', 'leave'),
    ];
    expect(formatRoomMemberSummary(members, me)).toBe('Only you');
  });

  it('formats current user and 1 other member as "[Other] and you"', () => {
    const members: RoomMember[] = [
      makeMember(me, 'Alice'),
      makeMember('@bob:matrix.local', 'Bob'),
    ];
    expect(formatRoomMemberSummary(members, me)).toBe('Bob and you');
  });

  it('formats current user and 2 other members as "[Other 1], [Other 2], and you" (matches design)', () => {
    const members: RoomMember[] = [
      makeMember(me, 'Alice'),
      makeMember('@jj:matrix.local', 'JJ'),
      makeMember('@pallav:matrix.local', 'Pallav Vyas'),
    ];
    expect(formatRoomMemberSummary(members, me)).toBe('JJ, Pallav Vyas, and you');
  });

  it('formats current user and 3 other members', () => {
    const members: RoomMember[] = [
      makeMember(me, 'Alice'),
      makeMember('@jj:matrix.local', 'JJ'),
      makeMember('@pallav:matrix.local', 'Pallav Vyas'),
      makeMember('@charlie:matrix.local', 'Charlie'),
    ];
    expect(formatRoomMemberSummary(members, me)).toBe(
      'JJ, Pallav Vyas, Charlie, and you',
    );
  });

  it('formats current user and more than 3 others with count', () => {
    const members: RoomMember[] = [
      makeMember(me, 'Alice'),
      makeMember('@jj:matrix.local', 'JJ'),
      makeMember('@pallav:matrix.local', 'Pallav Vyas'),
      makeMember('@charlie:matrix.local', 'Charlie'),
      makeMember('@david:matrix.local', 'David'),
    ];
    expect(formatRoomMemberSummary(members, me)).toBe('JJ, Pallav Vyas, and 2 others');
  });

  it('formats third-party viewer (when current user is not in the room)', () => {
    const members: RoomMember[] = [
      makeMember('@jj:matrix.local', 'JJ'),
      makeMember('@pallav:matrix.local', 'Pallav Vyas'),
    ];
    expect(formatRoomMemberSummary(members, me)).toBe('JJ and Pallav Vyas');

    const members3: RoomMember[] = [
      makeMember('@jj:matrix.local', 'JJ'),
      makeMember('@pallav:matrix.local', 'Pallav Vyas'),
      makeMember('@bob:matrix.local', 'Bob'),
    ];
    expect(formatRoomMemberSummary(members3, me)).toBe('JJ, Pallav Vyas, and Bob');
  });
});

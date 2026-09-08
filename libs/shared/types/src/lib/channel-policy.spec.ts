import { describe, it, expect } from 'vitest';
import { ChannelMode, ChannelRole, WorkspaceRole } from './enums.js';
import {
  announcementPosterUserIds,
  canPostInChannel,
  canReplyInChannel,
  clampTempMembershipHours,
  extendedTemporaryExpiry,
  isAuthorizedAnnouncementPoster,
  isTemporaryMembershipActive,
  MAX_TEMP_MEMBERSHIP_HOURS,
  temporaryExpiryFrom,
  type ChannelPostingContext,
  type ChannelViewer,
} from './channel-policy.js';

const standard: ChannelPostingContext = {
  mode: ChannelMode.STANDARD,
  createdById: 'creator',
  announcementPosterIds: [],
};
const announcement: ChannelPostingContext = {
  mode: ChannelMode.ANNOUNCEMENT,
  createdById: 'creator',
  announcementPosterIds: ['named-poster'],
};

const member = (over: Partial<ChannelViewer> = {}): ChannelViewer => ({
  userId: 'u1',
  channelRole: ChannelRole.MEMBER,
  workspaceRole: WorkspaceRole.MEMBER,
  ...over,
});

describe('canPostInChannel — STANDARD', () => {
  it('any channel member may post', () => {
    expect(canPostInChannel(standard, member())).toBe(true);
  });
  it('a non-member may not', () => {
    expect(canPostInChannel(standard, member({ channelRole: null }))).toBe(
      false,
    );
  });
  it('a workspace admin who has not joined still may not', () => {
    expect(
      canPostInChannel(
        standard,
        member({ channelRole: null, workspaceRole: WorkspaceRole.ADMIN }),
      ),
    ).toBe(false);
  });
});

describe('canPostInChannel — ANNOUNCEMENT', () => {
  it('a plain member may NOT post', () => {
    expect(canPostInChannel(announcement, member())).toBe(false);
  });
  it('a channel admin may post', () => {
    expect(
      canPostInChannel(announcement, member({ channelRole: ChannelRole.ADMIN })),
    ).toBe(true);
  });
  it('the creator may post even as a plain member', () => {
    expect(canPostInChannel(announcement, member({ userId: 'creator' }))).toBe(
      true,
    );
  });
  it('a workspace admin/owner may post', () => {
    expect(
      canPostInChannel(
        announcement,
        member({ workspaceRole: WorkspaceRole.ADMIN }),
      ),
    ).toBe(true);
    expect(
      canPostInChannel(
        announcement,
        member({ workspaceRole: WorkspaceRole.OWNER }),
      ),
    ).toBe(true);
  });
  it('a named poster may post', () => {
    expect(
      canPostInChannel(announcement, member({ userId: 'named-poster' })),
    ).toBe(true);
  });
  it('a guest is never a poster', () => {
    expect(
      isAuthorizedAnnouncementPoster(
        announcement,
        member({ channelRole: ChannelRole.MEMBER, workspaceRole: WorkspaceRole.GUEST }),
      ),
    ).toBe(false);
  });
});

describe('canReplyInChannel', () => {
  it('standard: any member', () => {
    expect(canReplyInChannel({ ...standard, allowReplies: false }, member())).toBe(
      true,
    );
  });
  it('announcement: authorized poster only when replies are enabled', () => {
    const admin = member({ channelRole: ChannelRole.ADMIN });
    expect(
      canReplyInChannel({ ...announcement, allowReplies: false }, admin),
    ).toBe(false);
    expect(
      canReplyInChannel({ ...announcement, allowReplies: true }, admin),
    ).toBe(true);
    expect(
      canReplyInChannel({ ...announcement, allowReplies: true }, member()),
    ).toBe(false);
  });
});

describe('announcementPosterUserIds', () => {
  it('unions creator, named posters, channel admins and workspace admins with no dupes', () => {
    expect(
      announcementPosterUserIds({
        createdById: 'creator',
        announcementPosterIds: ['a', 'b'],
        channelAdminIds: ['b', 'c'],
        workspaceAdminIds: ['c', 'd', 'creator'],
      }).sort(),
    ).toEqual(['a', 'b', 'c', 'creator', 'd'].sort());
  });
});

describe('temporary membership (§8)', () => {
  const now = new Date('2026-09-08T12:00:00.000Z');

  it('clampTempMembershipHours bounds and rounds', () => {
    expect(clampTempMembershipHours(24)).toBe(24);
    expect(clampTempMembershipHours(0)).toBeNull();
    expect(clampTempMembershipHours(-5)).toBeNull();
    expect(clampTempMembershipHours(Number.NaN)).toBeNull();
    expect(clampTempMembershipHours(0.4)).toBe(1); // rounds up to the floor
    expect(clampTempMembershipHours(999_999)).toBe(MAX_TEMP_MEMBERSHIP_HOURS);
  });

  it('temporaryExpiryFrom adds the window to now', () => {
    expect(temporaryExpiryFrom(48, now).toISOString()).toBe(
      '2026-09-10T12:00:00.000Z',
    );
  });

  it('extendedTemporaryExpiry adds onto a live window, restarts a lapsed one', () => {
    // live: current is in the future → extend from current
    expect(
      extendedTemporaryExpiry('2026-09-09T12:00:00.000Z', 24, now).toISOString(),
    ).toBe('2026-09-10T12:00:00.000Z');
    // lapsed: current is in the past → extend from now
    expect(
      extendedTemporaryExpiry('2026-09-01T00:00:00.000Z', 24, now).toISOString(),
    ).toBe('2026-09-09T12:00:00.000Z');
    // never had one
    expect(extendedTemporaryExpiry(null, 24, now).toISOString()).toBe(
      '2026-09-09T12:00:00.000Z',
    );
  });

  it('isTemporaryMembershipActive', () => {
    expect(
      isTemporaryMembershipActive(
        { membershipType: 'TEMPORARY', expiresAt: '2026-09-09T12:00:00.000Z' },
        now,
      ),
    ).toBe(true);
    expect(
      isTemporaryMembershipActive(
        { membershipType: 'TEMPORARY', expiresAt: '2026-09-07T12:00:00.000Z' },
        now,
      ),
    ).toBe(false);
    expect(
      isTemporaryMembershipActive(
        { membershipType: 'PERMANENT', expiresAt: null },
        now,
      ),
    ).toBe(false);
    expect(isTemporaryMembershipActive(null, now)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  channelNotificationLevel,
  channelNotificationLevelInput,
} from './channel-notifications.js';

describe('channelNotificationLevel', () => {
  it('defaults to all new posts', () => {
    expect(channelNotificationLevel(null)).toBe('all');
    expect(channelNotificationLevel({ isMuted: false })).toBe('all');
  });

  it('reads mentions-only while unmuted', () => {
    expect(
      channelNotificationLevel({ isMuted: false, mentionsOnly: true }),
    ).toBe('mentions');
  });

  it('lets mute win over mentions-only', () => {
    expect(channelNotificationLevel({ isMuted: true, mentionsOnly: true })).toBe(
      'nothing',
    );
  });
});

describe('channelNotificationLevelInput', () => {
  it('round-trips every level', () => {
    for (const level of ['all', 'mentions', 'nothing'] as const) {
      const flags = { isMuted: false, mentionsOnly: false };
      expect(
        channelNotificationLevel({
          ...flags,
          ...channelNotificationLevelInput(level),
        }),
      ).toBe(level);
    }
  });

  it('keeps the underlying level when muting', () => {
    const muted = {
      isMuted: false,
      mentionsOnly: true,
      ...channelNotificationLevelInput('nothing'),
    };
    expect(muted.mentionsOnly).toBe(true);
    expect(channelNotificationLevel({ ...muted, isMuted: false })).toBe(
      'mentions',
    );
  });
});

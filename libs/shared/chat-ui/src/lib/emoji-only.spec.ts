import { describe, expect, it } from 'vitest';
import { countEmojiOnly } from './emoji-only.js';

describe('countEmojiOnly', () => {
  it('counts a single emoji, including ZWJ, skin-tone and flag sequences', () => {
    expect(countEmojiOnly('😁')).toBe(1);
    expect(countEmojiOnly('  👍🏽 ')).toBe(1);
    expect(countEmojiOnly('👨‍👩‍👧')).toBe(1);
    expect(countEmojiOnly('🇮🇳')).toBe(1);
    expect(countEmojiOnly('❤️')).toBe(1);
  });

  it('counts multiple emoji', () => {
    expect(countEmojiOnly('😁😁')).toBe(2);
    expect(countEmojiOnly('🎉 🚀 🔥')).toBe(3);
  });

  it('returns 0 when any non-emoji text is present', () => {
    expect(countEmojiOnly('hi 😁')).toBe(0);
    expect(countEmojiOnly('1')).toBe(0);
    expect(countEmojiOnly('')).toBe(0);
    expect(countEmojiOnly(':smile:')).toBe(0);
  });
});

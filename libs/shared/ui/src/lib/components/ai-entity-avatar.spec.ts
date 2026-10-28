import { describe, expect, it } from 'vitest';
import {
  aiEntityAvatarFromLegacy,
  formatAiEntityIconAvatar,
  getAiEntityPresetIcon,
  parseAiEntityAvatar,
} from './ai-entity-avatar.js';

describe('AI entity identity', () => {
  it('round-trips an icon with a colour', () => {
    const value = formatAiEntityIconAvatar('Code2', 'rose');
    expect(value).toBe('icon:code:rose');
    expect(parseAiEntityAvatar(value)).toEqual({ type: 'icon', icon: 'code', color: 'rose' });
  });

  it('keeps old `icon:<preset>` values working, without a colour', () => {
    expect(parseAiEntityAvatar('icon:spark')).toEqual({ type: 'icon', icon: 'sparkles', color: undefined });
    expect(getAiEntityPresetIcon('icon:spark')).toBeDefined();
  });

  it('treats anything else as a photo and unknown parts as defaults', () => {
    expect(parseAiEntityAvatar('https://x.test/a.png')).toEqual({ type: 'photo', src: 'https://x.test/a.png' });
    expect(parseAiEntityAvatar('icon:nope:plaid')).toEqual({ type: 'icon', icon: 'bot', color: undefined });
    expect(parseAiEntityAvatar('')).toEqual({ type: 'none' });
  });

  it('folds an older agent’s configuration icon/theme into one value', () => {
    expect(aiEntityAvatarFromLegacy(null, { icon: 'MessageSquare', theme: 'amber' })).toBe('icon:chat:amber');
    expect(aiEntityAvatarFromLegacy('https://x.test/a.png', { icon: 'Bot' })).toBe('https://x.test/a.png');
    expect(aiEntityAvatarFromLegacy(null, {})).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { aiEntityAvatarImageUrl, formatAiEntityIconAvatar, parseAiEntityAvatar } from './ai-entity-identity.js';

const decode = (dataUrl: string) => Buffer.from(dataUrl.split(',')[1], 'base64').toString('utf8');

describe('aiEntityAvatarImageUrl', () => {
  it('turns an icon identity into a valid SVG image on its colour', () => {
    const url = aiEntityAvatarImageUrl('icon:code:rose');
    expect(url).toMatch(/^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/);
    const svg = decode(url as string);
    expect(svg).toContain('fill="#f43f5e"');
    expect(svg).toContain('<path');
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('uses the fallback colour for an icon saved without one', () => {
    expect(decode(aiEntityAvatarImageUrl('icon:bot', '#123456') as string)).toContain('fill="#123456"');
  });

  it('passes photos through and gives null for nothing', () => {
    expect(aiEntityAvatarImageUrl('https://x.test/a.png')).toBe('https://x.test/a.png');
    expect(aiEntityAvatarImageUrl('')).toBeNull();
    expect(aiEntityAvatarImageUrl(null)).toBeNull();
  });

  it('round-trips through format/parse', () => {
    expect(parseAiEntityAvatar(formatAiEntityIconAvatar('Headphones', 'sky'))).toEqual({ type: 'icon', icon: 'support', color: 'sky' });
  });
});

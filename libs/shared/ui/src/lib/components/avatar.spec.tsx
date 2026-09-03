import { avatarGradient, avatarTint, normalizeAvatarSeed } from '@org/design-system';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PresenceDot, UserAvatar } from './avatar.js';

/**
 * The whole point of the avatar work: one person, one fallback colour, on every
 * surface. Chat seeds with the Matrix id the bridge minted; everywhere else
 * seeds with the bare database id. These must resolve to the same gradient.
 */
describe('avatar seed consistency', () => {
  const userId = 'ckz9q1abc000d3b6l7xk2m9pq';
  const matrixId = `@onetab_${userId}:matrix.example.com`;

  it('maps a bridge Matrix id back to the bare user id', () => {
    expect(normalizeAvatarSeed(matrixId)).toBe(userId);
  });

  it('tolerates a server name that carries a port', () => {
    expect(normalizeAvatarSeed(`@onetab_${userId}:localhost:8448`)).toBe(userId);
  });

  it('leaves a raw id (or any non-bridge string) untouched', () => {
    expect(normalizeAvatarSeed(userId)).toBe(userId);
    expect(normalizeAvatarSeed('Ada Lovelace')).toBe('Ada Lovelace');
  });

  it('produces an identical gradient and tint for both spellings', () => {
    expect(avatarGradient(matrixId)).toBe(avatarGradient(userId));
    expect(avatarTint(matrixId)).toBe(avatarTint(userId));
  });
});

/** The rendered fallback's `background-image` (jsdom normalises the colours). */
function renderedGradient(node: HTMLElement): string {
  const fallback = node.querySelector(
    '[data-slot="avatar-fallback"]',
  ) as HTMLElement | null;
  return fallback?.style.backgroundImage ?? '';
}

describe('UserAvatar', () => {
  it('falls back to an initial on a gradient when there is no src', () => {
    const { container } = render(<UserAvatar name="Ada Lovelace" seed="user-1" />);
    expect(container.textContent).toContain('A');
    expect(renderedGradient(container)).toMatch(/^linear-gradient/);
  });

  it('draws the same fallback for a Matrix id and the bare user id', () => {
    const userId = 'ckz9q1abc000d3b6l7xk2m9pq';
    const fromRaw = render(<UserAvatar name="Ada" seed={userId} />);
    const fromMatrix = render(
      <UserAvatar name="Ada" seed={`@onetab_${userId}:matrix.example.com`} />,
    );
    expect(renderedGradient(fromMatrix.container)).toBe(
      renderedGradient(fromRaw.container),
    );
  });

  it('treats an empty-string seed as no seed, hashing the name instead', () => {
    const seeded = render(<UserAvatar name="Ada Lovelace" seed="" />);
    const named = render(<UserAvatar name="Ada Lovelace" seed="Ada Lovelace" />);
    expect(renderedGradient(seeded.container)).toBe(
      renderedGradient(named.container),
    );
  });
});

describe('UserAvatar status indicator', () => {
  it('normalizes the API enum so BUSY is not shown as offline', () => {
    const upper = render(<UserAvatar name="Ada" presence="BUSY" />);
    const lower = render(<UserAvatar name="Ada" presence="busy" />);
    const upperDot = upper.container.querySelector('[role="status"]');
    const lowerDot = lower.container.querySelector('[role="status"]');
    expect(upperDot?.getAttribute('title')).toBe('Do not disturb');
    expect(upperDot?.className).toBe(lowerDot?.className);
  });

  it('lets a status emoji replace the dot regardless of presence', () => {
    const withEmoji = render(
      <UserAvatar name="Ada" presence="online" statusEmoji="🌴" statusText="On leave" />,
    );
    const noEmoji = render(<UserAvatar name="Ada" presence="online" />);

    expect(withEmoji.container.textContent).toContain('🌴');
    // The presence dot (its own title is a presence label) is gone.
    expect(
      withEmoji.container.querySelector('[title="Online"]'),
    ).toBeNull();
    expect(noEmoji.container.querySelector('[title="Online"]')).not.toBeNull();
  });

  it('maps the realtime "unavailable" state to away', () => {
    const unavailable = render(<UserAvatar name="Ada" presence="unavailable" />);
    const away = render(<UserAvatar name="Ada" presence="away" />);
    expect(
      unavailable.container.querySelector('[role="status"]')?.getAttribute('title'),
    ).toBe('Away');
    expect(
      unavailable.container.querySelector('[role="status"]')?.className,
    ).toBe(away.container.querySelector('[role="status"]')?.className);
  });

  it('draws nothing when indicator is off', () => {
    const { container } = render(
      <UserAvatar name="Ada" presence="online" statusEmoji="🌴" indicator={false} />,
    );
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.textContent).not.toContain('🌴');
  });

  it('the avatar dot and a standalone PresenceDot render identical colour', () => {
    const inAvatar = render(<UserAvatar name="Ada" presence="BUSY" />);
    const standalone = render(<PresenceDot presence="busy" hint={false} />);
    const cls = (n: HTMLElement) =>
      n
        .querySelector('[role="status"]')!
        .className.split(/\s+/)
        .filter((c) => c.startsWith('bg-'))
        .sort()
        .join(' ');
    expect(cls(inAvatar.container)).toBe(cls(standalone.container));
    expect(cls(standalone.container)).toBe('bg-destructive');
  });
});

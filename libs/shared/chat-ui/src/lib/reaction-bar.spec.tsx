import type { Reaction } from '@org/types';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ReactionBar,
  ReactorDirectoryProvider,
  describeReactors,
} from './reaction-bar.js';

const names: Record<string, string> = {
  '@alice:x': 'Alice',
  '@bob:x': 'Bob',
  '@carol:x': 'Carol',
};
const resolve = (id: string) => (names[id] ? { name: names[id] } : undefined);

const reaction = (overrides: Partial<Reaction>): Reaction => ({
  key: '👍',
  count: 1,
  reactedByMe: false,
  userIds: ['@alice:x'] as any,
  ...overrides,
});

describe('describeReactors', () => {
  it('names one, two and three people naturally', () => {
    expect(describeReactors(['@alice:x'], resolve)).toBe('Alice');
    expect(describeReactors(['@alice:x', '@bob:x'], resolve)).toBe('Alice and Bob');
    expect(describeReactors(['@alice:x', '@bob:x', '@carol:x'], resolve)).toBe(
      'Alice, Bob and Carol',
    );
  });

  it('puts the reader first as "You"', () => {
    expect(describeReactors(['@alice:x', '@me:x'], resolve, '@me:x')).toBe('You and Alice');
  });

  it('falls back to the id localpart and folds long lists', () => {
    const ids = Array.from({ length: 11 }, (_, i) => `@user${i}:x`);
    expect(describeReactors(ids, resolve)).toBe(
      'user0, user1, user2, user3, user4, user5, user6, user7 and 3 others',
    );
  });
});

describe('ReactionBar', () => {
  it('removes the reader’s reaction in one click, optimistically', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn(() => new Promise<void>(() => undefined));
    render(
      <ReactorDirectoryProvider resolve={resolve} myUserId="@me:x">
        <ReactionBar
          reactions={[reaction({ count: 2, reactedByMe: true, userIds: ['@me:x', '@alice:x'] as any })]}
          onToggle={onToggle}
        />
      </ReactorDirectoryProvider>,
    );

    const pill = screen.getByRole('button', { pressed: true });
    await user.click(pill);

    expect(onToggle).toHaveBeenCalledWith('👍', true);
    expect(screen.getByRole('button', { pressed: false })).toHaveTextContent('1');
  });

  it('ignores a second click while the first toggle is in flight', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn(() => new Promise<void>(() => undefined));
    render(<ReactionBar reactions={[reaction({})]} onToggle={onToggle} />);

    await user.dblClick(screen.getByRole('button'));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('drops a pill whose only reaction was taken back', async () => {
    const user = userEvent.setup();
    render(
      <ReactorDirectoryProvider resolve={resolve} myUserId="@me:x">
        <ReactionBar
          reactions={[reaction({ reactedByMe: true, userIds: ['@me:x'] as any })]}
          onToggle={() => new Promise<void>(() => undefined)}
        />
      </ReactorDirectoryProvider>,
    );

    await user.click(screen.getByRole('button'));
    expect(screen.queryByRole('button')).toBeNull();
  });
});

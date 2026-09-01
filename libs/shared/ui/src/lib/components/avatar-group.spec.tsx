import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UserAvatarGroup } from './avatar-group.js';

describe('UserAvatarGroup', () => {
  it('renders nothing when user list is empty', () => {
    const { container } = render(<UserAvatarGroup users={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders single user avatar without overflow badge', () => {
    const users = [
      { id: 'user-1', name: 'Alice Cooper', displayName: 'Alice Cooper' },
    ];
    const { container } = render(<UserAvatarGroup users={users} size="sm" />);

    expect(container.textContent).toContain('A');
    expect(screen.queryByText(/\+/)).toBeNull();
  });

  it('renders up to max avatars and shows +N overflow badge for remaining users', () => {
    const users = [
      { id: 'user-1', name: 'Alice Cooper', displayName: 'Alice Cooper' },
      { id: 'user-2', name: 'Bob Dylan', displayName: 'Bob Dylan' },
      { id: 'user-3', name: 'Charlie Brown', displayName: 'Charlie Brown' },
      { id: 'user-4', name: 'David Bowie', displayName: 'David Bowie' },
      { id: 'user-5', name: 'Eva Green', displayName: 'Eva Green' },
    ];

    const { container } = render(
      <UserAvatarGroup users={users} max={3} size="xs" />,
    );

    // Should have +2 badge
    expect(container.textContent).toContain('+2');
    const group = screen.getByRole('group');
    expect(group).toHaveAttribute(
      'aria-label',
      'Assigned to: Alice Cooper, Bob Dylan, Charlie Brown, David Bowie, Eva Green',
    );
  });
});

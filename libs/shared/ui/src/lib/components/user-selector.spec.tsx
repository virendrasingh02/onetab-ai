import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserSelector } from './user-selector.js';

const mockMembers = [
  { id: 'user-1', name: 'Alice Cooper', email: 'alice@example.com' },
  { id: 'user-2', name: 'Bob Dylan', email: 'bob@example.com' },
  { id: 'user-3', name: 'Charlie Brown', email: 'charlie@example.com' },
];

describe('UserSelector', () => {
  it('renders trigger with unassigned icon when no users selected', () => {
    const { container } = render(
      <UserSelector members={mockMembers} selectedIds={[]} />,
    );

    const trigger = container.querySelector('button');
    expect(trigger).not.toBeNull();
  });

  it('renders trigger with UserAvatarGroup when multiple users are selected', () => {
    const { container } = render(
      <UserSelector
        members={mockMembers}
        selectedIds={['user-1', 'user-2']}
      />,
    );

    expect(container.querySelector('[role="group"]')).not.toBeNull();
  });

  it('opens dropdown, filters by search query, and toggles selection', async () => {
    const onChange = vi.fn();
    render(
      <UserSelector
        members={mockMembers}
        selectedIds={['user-1']}
        onChange={onChange}
      />,
    );

    // Open dropdown
    const trigger = screen.getByRole('button', { name: /change assignees/i });
    await userEvent.click(trigger);

    expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument();
    expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
    expect(screen.getByText('Bob Dylan')).toBeInTheDocument();

    // Type into search input
    const input = screen.getByPlaceholderText('Search users...');
    await userEvent.type(input, 'bob');

    expect(screen.queryByText('Alice Cooper')).toBeNull();
    expect(screen.getByText('Bob Dylan')).toBeInTheDocument();

    // Toggle Bob
    await userEvent.click(screen.getByText('Bob Dylan'));
    expect(onChange).toHaveBeenCalledWith(['user-1', 'user-2']);
  });
});

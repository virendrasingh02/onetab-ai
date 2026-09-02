import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UserSelector } from './user-selector.js';

const mockMembers = [
  { id: 'user-1', name: 'Alice Cooper', role: 'AI product operator', email: 'alice@example.com' },
  { id: 'user-2', name: 'Bob Dylan', role: 'Platform engineer', email: 'bob@example.com' },
  { id: 'user-3', name: 'Charlie Brown', role: 'Safety reviewer', email: 'charlie@example.com' },
];

describe('UserSelector', () => {
  it('renders avatar trigger with unassigned icon when variant="avatar" and no users selected', () => {
    const { container } = render(
      <UserSelector members={mockMembers} selectedIds={[]} variant="avatar" />,
    );

    const trigger = container.querySelector('button');
    expect(trigger).not.toBeNull();
  });

  it('renders trigger with selected chips when multiple users are selected', () => {
    const { container } = render(
      <UserSelector
        members={mockMembers}
        selectedIds={['user-1', 'user-2']}
      />,
    );

    expect(container.querySelector('[role="group"]')).not.toBeNull();
    expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
    expect(screen.getByText('Bob Dylan')).toBeInTheDocument();
  });

  it('opens dropdown, shows roles/subtitles, filters by query, and toggles selection', async () => {
    const onChange = vi.fn();
    render(
      <UserSelector
        members={mockMembers}
        selectedIds={['user-1']}
        onChange={onChange}
      />,
    );

    // Open dropdown by clicking trigger
    const trigger = screen.getByRole('button', { name: /change assignees/i });
    await userEvent.click(trigger);

    expect(screen.getAllByText('Alice Cooper').length).toBeGreaterThan(0);
    expect(screen.getByText('Bob Dylan')).toBeInTheDocument();
    expect(screen.getByText('AI product operator')).toBeInTheDocument();
    expect(screen.getByText('Platform engineer')).toBeInTheDocument();

    // Type into search input
    const input = screen.getByPlaceholderText('Search users...');
    await userEvent.type(input, 'bob');

    expect(screen.queryByText('Platform engineer')).toBeInTheDocument();
    expect(screen.queryByText('Safety reviewer')).toBeNull();

    // Toggle Bob
    await userEvent.click(screen.getByText('Bob Dylan'));
    expect(onChange).toHaveBeenCalledWith(['user-1', 'user-2']);
  });
});

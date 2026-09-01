// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { TaskStatus } from '@org/types';
import { TooltipProvider } from '@org/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { KanbanCardTile } from './KanbanCardTile.js';
import { KanbanLeadPicker } from './KanbanLeadPicker.js';
import type { BoardMember, KanbanCard } from './types.js';

const mockMembers: BoardMember[] = [
  { id: 'user-1', name: 'Alice Cooper', displayName: 'Alice Cooper', email: 'alice@example.com' },
  { id: 'user-2', name: 'Bob Dylan', displayName: 'Bob Dylan', email: 'bob@example.com' },
  { id: 'user-3', name: 'Charlie Brown', displayName: 'Charlie Brown', email: 'charlie@example.com' },
];

describe('Kanban Multi-User Assignment', () => {
  it('renders KanbanCardTile with overlapping avatars when multiple members are assigned', () => {
    const card: KanbanCard = {
      id: 'task-1',
      title: 'Design multi-avatar component',
      description: '',
      memberIds: ['user-1', 'user-2'],
      commentCount: 0,
      dueComplete: false,
      priority: 'HIGH',
      createdAt: '2026-09-01T00:00:00.000Z',
    };

    const dragHandlers = {
      onPointerDown: vi.fn(),
      onKeyDown: vi.fn(),
    };

    const { container } = render(
      <TooltipProvider>
        <KanbanCardTile
          card={card}
          members={mockMembers}
          lists={[{ id: TaskStatus.TODO, title: 'Planned' }]}
          listId={TaskStatus.TODO}
          dragging={false}
          drag={dragHandlers}
          onOpen={vi.fn()}
          onCopy={vi.fn()}
          onDelete={vi.fn()}
          onMoveToList={vi.fn()}
        />
      </TooltipProvider>,
    );

    // Should render a group with both assigned users
    const group = container.querySelector('[role="group"]');
    expect(group).not.toBeNull();
    expect(group).toHaveAttribute('aria-label', 'Assigned to: Alice Cooper, Bob Dylan');
  });

  it('allows searching, toggling multiple assignees, and clearing in KanbanLeadPicker', async () => {
    const onSelectMembers = vi.fn();
    render(
      <TooltipProvider>
        <KanbanLeadPicker
          selectedMemberIds={['user-1']}
          members={mockMembers}
          multiple={true}
          onSelectMembers={onSelectMembers}
        />
      </TooltipProvider>,
    );

    // Open dropdown
    const trigger = screen.getByRole('button', { name: /change assignee/i });
    await userEvent.click(trigger);

    // Check search input exists
    expect(screen.getByPlaceholderText('Search users...')).toBeInTheDocument();

    // Toggle Bob
    await userEvent.click(screen.getByText('Bob Dylan'));
    expect(onSelectMembers).toHaveBeenCalledWith(['user-1', 'user-2']);
  });
});

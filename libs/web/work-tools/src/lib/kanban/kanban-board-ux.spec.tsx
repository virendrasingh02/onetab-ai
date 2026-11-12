// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { TaskStatus } from '@org/types';
import { TooltipProvider } from '@org/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { KanbanCardTile } from './KanbanCardTile.js';
import { KanbanListColumn } from './KanbanListColumn.js';
import type { BoardMember, KanbanCard, KanbanList } from './types.js';

const mockMembers: BoardMember[] = [
  {
    id: 'user-1',
    name: 'Linus Torvalds',
    displayName: 'Linus Torvalds',
    email: 'linus@example.com',
  },
];

const mockLists: KanbanList[] = [
  {
    id: TaskStatus.TODO,
    category: TaskStatus.TODO,
    title: 'Planned',
    cards: [],
  },
  {
    id: TaskStatus.IN_PROGRESS,
    category: TaskStatus.IN_PROGRESS,
    title: 'In Progress',
    cards: [],
  },
];

describe('Kanban Board & Card UX', () => {
  it('renders modern Linear-inspired card tile with complete pill metadata', () => {
    const card: KanbanCard = {
      id: 'MOB-217',
      ticketId: 'MOB-217',
      title: 'Address autocomplete drops the flat number',
      description: 'Fix the address parsing bug.',
      memberIds: ['user-1'],
      commentCount: 3,
      dueComplete: false,
      priority: 'URGENT',
      createdAt: '2026-10-01T00:00:00.000Z',
      startDate: '2026-10-15',
      dueDate: '2026-10-21',
      milestone: 'Delivery',
      cycle: 'Checkout sprint 2',
      estimate: 2,
      relationCount: 1,
      labels: ['Mobile', 'Bug'],
      checklist: [{ id: 'chk-1', text: 'Verify zip', done: true }],
      subtasks: { done: 1, total: 2 },
    };

    const dragHandlers = {
      onPointerDown: vi.fn(),
      onKeyDown: vi.fn(),
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <KanbanCardTile
              card={card}
              members={mockMembers}
              lists={mockLists}
              listId={TaskStatus.TODO}
              dragging={false}
              drag={dragHandlers}
              onOpen={vi.fn()}
              onCopy={vi.fn()}
              onDelete={vi.fn()}
              onMoveToList={vi.fn()}
            />
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Ticket ID
    expect(screen.getByText('MOB-217')).toBeInTheDocument();

    // Title
    expect(
      screen.getByText('Address autocomplete drops the flat number'),
    ).toBeInTheDocument();

    // Priority pill with "Urgent"
    expect(screen.getByText('Urgent')).toBeInTheDocument();

    // Milestone pill
    expect(screen.getByText('Delivery')).toBeInTheDocument();

    // Cycle / Sprint pill
    expect(screen.getByText('Checkout sprint 2')).toBeInTheDocument();

    // Estimate pill with Δ 2
    expect(screen.getByText('Δ')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    // Labels
    expect(screen.getByText('Mobile')).toBeInTheDocument();
    expect(screen.getByText('Bug')).toBeInTheDocument();

    // Assignee avatar is rendered
    expect(screen.getByLabelText('Change assignee')).toBeInTheDocument();
  });

  it('renders modern column empty state and allows opening composer', async () => {
    const list: KanbanList = {
      id: 'planned-list',
      category: TaskStatus.TODO,
      title: 'Planned',
      cards: [],
    };

    const mockDrag: any = {
      registerColumn: vi.fn(),
      getColumnHandlers: vi.fn().mockReturnValue({
        onPointerDown: vi.fn(),
        onKeyDown: vi.fn(),
      }),
      getCardHandlers: vi.fn().mockReturnValue({
        onPointerDown: vi.fn(),
        onKeyDown: vi.fn(),
      }),
      activeListId: null,
      activeCardId: null,
      announcement: '',
    };

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <TooltipProvider>
            <KanbanListColumn
              list={list}
              lists={[list]}
              members={mockMembers}
              visibleCards={[]}
              hiddenCount={0}
              dispatch={vi.fn()}
              drag={mockDrag}
              index={0}
              onOpenCard={vi.fn()}
            />
          </TooltipProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Empty state text
    expect(screen.getByText('No tasks')).toBeInTheDocument();

    // Bottom add task button
    const addButtons = screen.getAllByRole('button', { name: /add task/i });
    expect(addButtons.length).toBeGreaterThan(0);

    // Clicking add button opens the inline composer
    await userEvent.click(addButtons[addButtons.length - 1]);
    expect(
      screen.getByPlaceholderText('Task title'),
    ).toBeInTheDocument();
  });
});

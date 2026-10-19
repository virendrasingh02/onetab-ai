import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NotificationView } from '@org/types';
import { NotificationCenterList } from './notification-center-list.js';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();
const mockDismiss = vi.fn();

vi.mock('./use-notification-center.js', () => ({
  useNotificationUnreadCount: vi.fn((_workspaceId: string) => ({
    data: 3,
  })),
  useNotificationList: vi.fn((workspaceId: string, options: { unreadOnly?: boolean; enabled?: boolean }) => {
    const items: NotificationView[] = [
      {
        id: 'n-1',
        workspaceId,
        kind: 'MENTION',
        title: 'Alice mentioned you in #general',
        body: 'Hey take a look at this document',
        deepLink: 'c/general',
        resourceType: 'channel',
        resourceId: 'c1',
        read: false,
        createdAt: '2026-10-19T10:00:00.000Z',
        actor: {
          id: 'u1',
          name: 'alice',
          displayName: 'Alice Cooper',
          avatarUrl: null,
        },
        workspace: {
          id: workspaceId,
          name: 'Workspace Alpha',
          slug: 'alpha',
          avatarUrl: null,
          icon: null,
          iconColor: null,
        },
      },
      {
        id: 'n-2',
        workspaceId,
        kind: 'TASK_ASSIGNED',
        title: 'You were assigned task PROJ-42',
        body: 'Implement notifications center',
        deepLink: 'tasks?taskId=t42',
        resourceType: 'task',
        resourceId: 't42',
        read: true,
        createdAt: '2026-10-19T09:00:00.000Z',
        actor: {
          id: 'u2',
          name: 'bob',
          displayName: 'Bob Dylan',
          avatarUrl: null,
        },
        workspace: {
          id: workspaceId,
          name: 'Workspace Alpha',
          slug: 'alpha',
          avatarUrl: null,
          icon: null,
          iconColor: null,
        },
      },
      {
        id: 'n-3',
        workspaceId,
        kind: 'AI_RUN_COMPLETED',
        title: '“Research Agent” finished',
        body: 'Completed codebase audit',
        deepLink: 'ai/runs?run=r1',
        resourceType: 'ai_run',
        resourceId: 'r1',
        read: false,
        createdAt: '2026-10-19T08:00:00.000Z',
        actor: null,
        workspace: {
          id: workspaceId,
          name: 'Workspace Alpha',
          slug: 'alpha',
          avatarUrl: null,
          icon: null,
          iconColor: null,
        },
      },
    ];

    if (options.unreadOnly) {
      return {
        items: items.filter((i) => !i.read),
        isLoading: false,
        isError: false,
        hasNextPage: false,
        fetchNextPage: vi.fn(),
        isFetchingNextPage: false,
        refetch: vi.fn(),
      };
    }

    return {
      items,
      isLoading: false,
      isError: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      isFetchingNextPage: false,
      refetch: vi.fn(),
    };
  }),
  useNotificationMutations: vi.fn((_workspaceId: string) => ({
    markRead: { mutate: mockMarkRead, isPending: false },
    markAllRead: { mutate: mockMarkAllRead, isPending: false },
    dismiss: { mutate: mockDismiss, isPending: false },
  })),
}));

describe('NotificationCenterList (Inbox "For you")', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the unread count on the Unread filter', () => {
    render(<NotificationCenterList workspaceId="ws-1" workspaceSlug="alpha" />);

    expect(screen.getByRole('button', { name: /^Unread\s*3$/i })).toBeDefined();
  });

  it('renders All, Unread, Mentions, and Updates filters', () => {
    render(<NotificationCenterList workspaceId="ws-1" workspaceSlug="alpha" />);

    expect(screen.getByRole('button', { name: /^All$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Unread/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Mentions$/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /^Updates$/i })).toBeDefined();
  });

  it('filters notifications when switching tabs', () => {
    render(<NotificationCenterList workspaceId="ws-1" workspaceSlug="alpha" />);

    // "All" tab shows all items
    expect(screen.getByText('Alice mentioned you in #general')).toBeDefined();
    expect(screen.getByText('You were assigned task PROJ-42')).toBeDefined();
    expect(screen.getByText('“Research Agent” finished')).toBeDefined();

    // Switch to "Mentions" tab
    fireEvent.click(screen.getByRole('button', { name: /^Mentions$/i }));
    expect(screen.getByText('Alice mentioned you in #general')).toBeDefined();
    expect(screen.queryByText('You were assigned task PROJ-42')).toBeNull();
    expect(screen.queryByText('“Research Agent” finished')).toBeNull();

    // Switch to "Updates" tab
    fireEvent.click(screen.getByRole('button', { name: /^Updates$/i }));
    expect(screen.queryByText('Alice mentioned you in #general')).toBeNull();
    expect(screen.getByText('You were assigned task PROJ-42')).toBeDefined();
    expect(screen.getByText('“Research Agent” finished')).toBeDefined();
  });

  it('calls markAllRead when clicking "Mark all as read"', () => {
    render(<NotificationCenterList workspaceId="ws-1" workspaceSlug="alpha" />);

    fireEvent.click(screen.getByRole('button', { name: /Mark all as read/i }));

    expect(mockMarkAllRead).toHaveBeenCalled();
  });

  it('calls markRead and navigates when clicking a notification row', () => {
    render(<NotificationCenterList workspaceId="ws-1" workspaceSlug="alpha" />);

    const unreadItem = screen.getByText('Alice mentioned you in #general');
    fireEvent.click(unreadItem);

    expect(mockMarkRead).toHaveBeenCalledWith('n-1');
    expect(mockNavigate).toHaveBeenCalledWith('/w/alpha/c/general');
  });

  it('calls markRead independently when clicking "Mark as read" button on an unread row', () => {
    render(<NotificationCenterList workspaceId="ws-1" workspaceSlug="alpha" />);

    const markReadButtons = screen.getAllByRole('button', { name: 'Mark notification read' });
    fireEvent.click(markReadButtons[0]);

    expect(mockMarkRead).toHaveBeenCalledWith('n-1');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('calls dismiss when clicking "Dismiss" button', () => {
    render(<NotificationCenterList workspaceId="ws-1" workspaceSlug="alpha" />);

    const dismissButtons = screen.getAllByRole('button', { name: 'Dismiss notification' });
    fireEvent.click(dismissButtons[0]);

    expect(mockDismiss).toHaveBeenCalledWith('n-1');
  });
});

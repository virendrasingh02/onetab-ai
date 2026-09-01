import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { NotificationView } from '@org/types';
import { NotificationAvatar } from './notification-avatar.js';

describe('NotificationAvatar', () => {
  it('renders workspace avatar for a notification belonging to Workspace A', () => {
    const notificationA: NotificationView = {
      id: 'notif-1',
      workspaceId: 'ws-a',
      kind: 'TASK_ASSIGNED',
      title: 'Task in Workspace A',
      body: 'New task',
      deepLink: 'tasks/123',
      resourceType: 'task',
      resourceId: '123',
      read: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      actor: {
        id: 'user-1',
        name: 'alice',
        displayName: 'Alice Cooper',
        avatarUrl: null,
      },
      workspace: {
        id: 'ws-a',
        name: 'Workspace Alpha',
        slug: 'alpha',
        avatarUrl: null,
        icon: null,
        iconColor: null,
      },
    };

    const { container } = render(
      <NotificationAvatar notification={notificationA} />,
    );

    // Should render workspace initial "W" for "Workspace Alpha"
    expect(container.textContent).toContain('W');
    expect(container.querySelector('[data-slot="avatar"]')).not.toBeNull();
  });

  it('renders workspace avatar for a notification belonging to Workspace B with custom emoji icon', () => {
    const notificationB: NotificationView = {
      id: 'notif-2',
      workspaceId: 'ws-b',
      kind: 'TASK_ASSIGNED',
      title: 'Task in Workspace B',
      body: 'New task',
      deepLink: 'tasks/456',
      resourceType: 'task',
      resourceId: '456',
      read: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      actor: {
        id: 'user-2',
        name: 'bob',
        displayName: 'Bob Dylan',
        avatarUrl: null,
      },
      workspace: {
        id: 'ws-b',
        name: 'Workspace Beta',
        slug: 'beta',
        avatarUrl: null,
        icon: '🚀',
        iconColor: null,
      },
    };

    const { container } = render(
      <NotificationAvatar notification={notificationB} />,
    );

    expect(container.textContent).toContain('🚀');
  });

  it('renders workspace avatar for a notification with custom Lucide icon and color', () => {
    const notificationWithIcon: NotificationView = {
      id: 'notif-lucide',
      workspaceId: 'ws-lucide',
      kind: 'PROJECT_CREATED',
      title: 'Project created',
      body: 'New project',
      deepLink: null,
      resourceType: null,
      resourceId: null,
      read: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      actor: null,
      workspace: {
        id: 'ws-lucide',
        name: 'Design Studio',
        slug: 'design',
        avatarUrl: null,
        icon: 'Folder',
        iconColor: '#3b82f6',
      },
    };

    const { container } = render(
      <NotificationAvatar notification={notificationWithIcon} />,
    );

    expect(container.querySelector('[data-slot="avatar"]')).not.toBeNull();
    // SVG icon is rendered inside the avatar
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders workspace avatar container for workspace with avatarUrl', () => {
    const notificationWithImage: NotificationView = {
      id: 'notif-3',
      workspaceId: 'ws-c',
      kind: 'CHANNEL_INVITE',
      title: 'Invite to Channel',
      body: 'Welcome',
      deepLink: null,
      resourceType: null,
      resourceId: null,
      read: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      actor: null,
      workspace: {
        id: 'ws-c',
        name: 'Workspace Gamma',
        slug: 'gamma',
        avatarUrl: 'https://example.com/logo.png',
        icon: null,
        iconColor: null,
      },
    };

    const { container } = render(
      <NotificationAvatar notification={notificationWithImage} />,
    );

    const avatar = container.querySelector('[data-slot="avatar"]');
    expect(avatar).not.toBeNull();
  });

  it('gracefully falls back to actor avatar when notification has no workspace context', () => {
    const nonWorkspaceNotif: Partial<NotificationView> = {
      id: 'notif-4',
      kind: 'SYSTEM',
      title: 'System maintenance',
      body: 'Scheduled update',
      read: false,
      actor: {
        id: 'user-admin',
        name: 'admin',
        displayName: 'Admin User',
        avatarUrl: null,
      },
    };

    const { container } = render(
      <NotificationAvatar notification={nonWorkspaceNotif} />,
    );

    // Falls back to actor initial "A"
    expect(container.textContent).toContain('A');
    expect(container.querySelector('[data-slot="avatar"]')).not.toBeNull();
  });

  it('gracefully falls back to system avatar when neither workspace nor actor is present', () => {
    const systemNotif: Partial<NotificationView> = {
      id: 'notif-5',
      kind: 'SYSTEM',
      title: 'System alert',
    };

    const { container } = render(
      <NotificationAvatar notification={systemNotif} />,
    );

    // Falls back to "S" for System
    expect(container.textContent).toContain('S');
    expect(container.querySelector('[data-slot="avatar"]')).not.toBeNull();
  });

  it('preserves respective workspace icons when multiple notifications from different workspaces are rendered together', () => {
    const notifA: NotificationView = {
      id: 'notif-a',
      workspaceId: 'ws-a',
      kind: 'MENTION',
      title: 'Mention in A',
      body: 'Hello in A',
      deepLink: null,
      resourceType: null,
      resourceId: null,
      read: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      actor: null,
      workspace: {
        id: 'ws-a',
        name: 'Acme Corp',
        slug: 'acme',
        avatarUrl: null,
        icon: '⚡',
        iconColor: null,
      },
    };

    const notifB: NotificationView = {
      id: 'notif-b',
      workspaceId: 'ws-b',
      kind: 'MENTION',
      title: 'Mention in B',
      body: 'Hello in B',
      deepLink: null,
      resourceType: null,
      resourceId: null,
      read: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      actor: null,
      workspace: {
        id: 'ws-b',
        name: 'Beta Labs',
        slug: 'beta-labs',
        avatarUrl: null,
        icon: '🔬',
        iconColor: null,
      },
    };

    const { container } = render(
      <div>
        <div data-testid="item-a">
          <NotificationAvatar notification={notifA} />
        </div>
        <div data-testid="item-b">
          <NotificationAvatar notification={notifB} />
        </div>
      </div>,
    );

    const itemA = container.querySelector('[data-testid="item-a"]');
    const itemB = container.querySelector('[data-testid="item-b"]');

    expect(itemA?.textContent).toContain('⚡');
    expect(itemB?.textContent).toContain('🔬');
  });
});

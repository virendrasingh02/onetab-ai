import type { Message, SystemActivityEventContent } from '@org/types';
import { TooltipProvider } from '@org/ui';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SystemEventCard, getSystemEventActions } from './system-event-card.js';

function renderWithProviders(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: '$evt-1',
    roomId: '!room:example.org',
    senderId: '@onetab_system-events:example.org',
    senderName: 'OneTab AI',
    kind: 'text',
    body: 'fallback text',
    timestamp: 1_700_000_000_000,
    reactions: [],
    isEdited: false,
    isRedacted: false,
    isEncrypted: false,
    ...overrides,
  };
}

function createEvent(
  overrides: Partial<SystemActivityEventContent> = {},
): SystemActivityEventContent {
  return {
    type: 'mie.system_event',
    eventType: 'member_added',
    conversationType: 'channel',
    conversationId: 'chan-1',
    conversationName: 'engineering',
    actor: { kind: 'user', id: 'admin-1', name: 'VR' },
    target: { kind: 'user', id: 'user-1', name: 'John Smith' },
    occurredAt: 1_700_000_000_000,
    idempotencyKey: 'k1',
    capabilities: { reactions: true, threading: true, sharing: true, reply: false },
    ...overrides,
  };
}

describe('SystemEventCard', () => {
  it('renders "was added to #channel by" for a member_added event', () => {
    renderWithProviders(<SystemEventCard message={createMessage()} event={createEvent()} />);

    expect(screen.getByText('John Smith')).toBeInTheDocument();
    expect(screen.getByText(/was added to #engineering by/)).toBeInTheDocument();
    expect(screen.getByText('VR')).toBeInTheDocument();
  });

  it('renders a self-driven member_joined event with no actor attribution', () => {
    renderWithProviders(
      <SystemEventCard
        message={createMessage()}
        event={createEvent({ eventType: 'member_joined', actor: null })}
      />,
    );

    expect(screen.getByText(/joined #engineering/)).toBeInTheDocument();
    expect(screen.queryByText(/ by /)).not.toBeInTheDocument();
  });

  it('shows the APP / AI AGENT / AI COWORKER badge for those entity kinds', () => {
    const { rerender } = renderWithProviders(
      <SystemEventCard
        message={createMessage()}
        event={createEvent({
          eventType: 'app_added',
          target: { kind: 'app', id: 'int-1', name: 'Outlook Calendar' },
        })}
      />,
    );
    expect(screen.getByText('APP')).toBeInTheDocument();

    rerender(
      <TooltipProvider>
        <SystemEventCard
          message={createMessage()}
          event={createEvent({
            eventType: 'agent_added',
            target: { kind: 'agent', id: 'agent-1', name: 'Research Agent' },
          })}
        />
      </TooltipProvider>,
    );
    expect(screen.getByText('AI AGENT')).toBeInTheDocument();
  });

  it('never shows a type badge for a plain member', () => {
    renderWithProviders(<SystemEventCard message={createMessage()} event={createEvent()} />);
    expect(screen.queryByText('APP')).not.toBeInTheDocument();
    expect(screen.queryByText('AI AGENT')).not.toBeInTheDocument();
    expect(screen.queryByText('AI COWORKER')).not.toBeInTheDocument();
  });

  it('renders a deleted entity gracefully instead of crashing or dead-linking (brief §20)', async () => {
    const onViewEntity = vi.fn();
    renderWithProviders(
      <SystemEventCard
        message={createMessage()}
        event={createEvent({
          target: { kind: 'app', id: 'gone', name: 'Deleted app', isDeleted: true },
        })}
        onViewEntity={onViewEntity}
      />,
    );

    const label = screen.getByText('Deleted app');
    expect(label.tagName).toBe('SPAN'); // not a clickable button
    await userEvent.click(label);
    expect(onViewEntity).not.toHaveBeenCalled();
  });

  it('calls onViewEntity when a live entity name is clicked', async () => {
    const onViewEntity = vi.fn();
    renderWithProviders(
      <SystemEventCard message={createMessage()} event={createEvent()} onViewEntity={onViewEntity} />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'John Smith' }));
    expect(onViewEntity).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1', name: 'John Smith' }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'VR' }));
    expect(onViewEntity).toHaveBeenCalledWith(expect.objectContaining({ id: 'admin-1', name: 'VR' }));
  });

  it('has an accessible label describing the whole event as one sentence (brief §28)', () => {
    renderWithProviders(
      <SystemEventCard
        message={createMessage({ body: 'Outlook Calendar app was added to #agent45 by VR' })}
        event={createEvent()}
      />,
    );

    expect(
      screen.getByRole('article', { name: 'Outlook Calendar app was added to #agent45 by VR' }),
    ).toBeInTheDocument();
  });

  it('renders existing reactions using the shared reaction pill, not a second implementation', () => {
    renderWithProviders(
      <SystemEventCard
        message={createMessage({
          reactions: [{ key: '👍', count: 3, reactedByMe: false, userIds: ['@a:hs', '@b:hs', '@c:hs'] }],
        })}
        event={createEvent()}
      />,
    );

    expect(screen.getByText('👍')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('getSystemEventActions', () => {
  const event = createEvent({
    target: { kind: 'app', id: 'int-1', name: 'Outlook Calendar' },
  });

  it('always offers Copy event', () => {
    const actions = getSystemEventActions(event, {});
    expect(actions.some((a) => a.id === 'copy_event')).toBe(true);
  });

  it('offers "View app" only when a view handler is supplied and the target is live', () => {
    expect(getSystemEventActions(event, {}).some((a) => a.id === 'view_target')).toBe(false);

    const withHandler = getSystemEventActions(event, { onViewEntity: vi.fn() });
    expect(withHandler.some((a) => a.id === 'view_target' && a.label === 'View app')).toBe(true);
  });

  it('never offers "View app" for a deleted entity', () => {
    const deletedEvent = createEvent({
      target: { kind: 'app', id: 'gone', name: 'Deleted app', isDeleted: true },
    });
    const actions = getSystemEventActions(deletedEvent, { onViewEntity: vi.fn() });
    expect(actions.some((a) => a.id === 'view_target')).toBe(false);
  });

  it('offers "Delete event" only to someone who can manage the conversation', () => {
    const onDelete = vi.fn();
    expect(getSystemEventActions(event, { onDelete }).some((a) => a.id === 'delete_event')).toBe(false);
    expect(
      getSystemEventActions(event, { canManage: true, onDelete }).some((a) => a.id === 'delete_event'),
    ).toBe(true);
    // Even an admin gets nothing to click without a delete handler wired up.
    expect(
      getSystemEventActions(event, { canManage: true }).some((a) => a.id === 'delete_event'),
    ).toBe(false);
  });
});

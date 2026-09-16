import { describe, it, expect, beforeEach } from 'vitest';
import { useScheduledMessagesStore } from './scheduled-messages-store.js';

describe('useScheduledMessagesStore', () => {
  beforeEach(() => {
    useScheduledMessagesStore.getState().clearAll();
  });

  it('initially has no messages', () => {
    const { messages } = useScheduledMessagesStore.getState();
    expect(messages).toEqual([]);
  });

  it('schedules a message with pending status', () => {
    const store = useScheduledMessagesStore.getState();
    const scheduled = store.scheduleMessage({
      conversationId: 'room-1',
      channelName: 'general',
      body: 'Hello tomorrow!',
      scheduledFor: '2026-09-17T09:00:00.000Z',
    });

    expect(scheduled.id).toBeDefined();
    expect(scheduled.status).toBe('pending');
    expect(scheduled.body).toBe('Hello tomorrow!');

    const current = useScheduledMessagesStore.getState().messages;
    expect(current).toHaveLength(1);
    expect(current[0].channelName).toBe('general');
  });

  it('reschedules a message', () => {
    const store = useScheduledMessagesStore.getState();
    const msg = store.scheduleMessage({
      conversationId: 'room-1',
      body: 'Meeting soon',
      scheduledFor: '2026-09-17T09:00:00.000Z',
    });

    store.rescheduleMessage(msg.id, '2026-09-17T14:00:00.000Z');
    const updated = useScheduledMessagesStore
      .getState()
      .messages.find((m) => m.id === msg.id);
    expect(updated?.scheduledFor).toBe('2026-09-17T14:00:00.000Z');
    expect(updated?.status).toBe('pending');
  });

  it('marks a message as sent', () => {
    const store = useScheduledMessagesStore.getState();
    const msg = store.scheduleMessage({
      conversationId: 'room-1',
      body: 'Now sending',
      scheduledFor: '2026-09-17T09:00:00.000Z',
    });

    store.markAsSent(msg.id);
    const updated = useScheduledMessagesStore
      .getState()
      .messages.find((m) => m.id === msg.id);
    expect(updated?.status).toBe('sent');
    expect(updated?.sentAt).toBeDefined();
  });

  it('cancels and deletes a scheduled message', () => {
    const store = useScheduledMessagesStore.getState();
    const msg = store.scheduleMessage({
      conversationId: 'room-1',
      body: 'Nevermind',
      scheduledFor: '2026-09-17T09:00:00.000Z',
    });

    store.cancelScheduledMessage(msg.id);
    let updated = useScheduledMessagesStore
      .getState()
      .messages.find((m) => m.id === msg.id);
    expect(updated?.status).toBe('cancelled');

    store.deleteScheduledMessage(msg.id);
    updated = useScheduledMessagesStore
      .getState()
      .messages.find((m) => m.id === msg.id);
    expect(updated).toBeUndefined();
  });
});

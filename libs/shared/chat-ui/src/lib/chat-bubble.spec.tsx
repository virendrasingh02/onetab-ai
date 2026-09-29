import { act, render, screen } from '@testing-library/react';
import type { Message } from '@org/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatBubble } from './chat-bubble.js';

function baseMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: '~local-1' as any,
    roomId: '!room:example.com' as any,
    senderId: '@me:example.com' as any,
    senderName: 'Virendra Singh',
    kind: 'text',
    body: 'GHi',
    timestamp: Date.now(),
    reactions: [],
    isEdited: false,
    isRedacted: false,
    isEncrypted: false,
    ...overrides,
  };
}

describe('ChatBubble send state', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows nothing for a send that is confirmed quickly', () => {
    const { rerender } = render(
      <ChatBubble message={baseMessage({ sendState: 'sending' })} isOwn />,
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender(<ChatBubble message={baseMessage({ sendState: 'sent' })} isOwn />);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });

    expect(screen.queryByText('Sending')).toBeNull();
    expect(screen.getByRole('article').className).not.toContain('opacity-70');
  });

  it('puts a lingering send in the header, beside the timestamp', () => {
    render(<ChatBubble message={baseMessage({ sendState: 'sending' })} isOwn />);
    expect(screen.queryByText('Sending')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText('Sending').closest('header')).not.toBeNull();
    expect(screen.getByRole('article').className).toContain('opacity-70');
  });

  it('puts a grouped message’s lingering send in the time gutter', () => {
    render(
      <ChatBubble
        message={baseMessage({ sendState: 'sending' })}
        isOwn
        isGrouped
      />,
    );
    act(() => {
      vi.advanceTimersByTime(600);
    });

    const gutter = screen.getByRole('article').firstElementChild;
    expect(gutter?.contains(screen.getByText('Sending'))).toBe(true);
  });

  it('keeps a deleted thread root as a slim marker that still opens the thread', () => {
    const onOpenThread = vi.fn();
    render(
      <ChatBubble
        message={baseMessage({ isRedacted: true, body: '' })}
        isOwn
        threadReplyCount={2}
        onOpenThread={onOpenThread}
      />,
    );

    expect(screen.queryByRole('article')).toBeNull();
    act(() => {
      screen.getByRole('button', { name: /2 replies/ }).click();
    });
    expect(onOpenThread).toHaveBeenCalledTimes(1);
  });

  it('shows a single failure notice with retry', () => {
    render(
      <ChatBubble
        message={baseMessage({ sendState: 'failed' })}
        isOwn
        onRetry={() => undefined}
      />,
    );

    expect(screen.getAllByText(/Failed to send/)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Message } from '@org/types';
import { describe, expect, it, vi } from 'vitest';
import { PinnedPanel } from './channel-extras.js';

function baseMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: '$msg-1' as any,
    roomId: '!room:example.com' as any,
    senderId: '@user:example.com' as any,
    senderName: 'Zeeshan Khan',
    senderAvatarUrl: 'https://cdn.example.com/avatar.png',
    kind: 'text',
    body: 'Fine jewelry\nRings\nTennis',
    timestamp: new Date(2026, 5, 5, 17, 38).getTime(), // Jun 5, 2026 5:38 PM
    reactions: [],
    isEdited: false,
    isRedacted: false,
    isEncrypted: false,
    ...overrides,
  };
}

describe('PinnedPanel', () => {
  it('renders empty state when no messages are pinned', () => {
    render(<PinnedPanel messages={[]} />);
    expect(screen.getByText('Nothing pinned')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Pin a message to keep it at the top of this channel for everyone.',
      ),
    ).toBeInTheDocument();
  });

  it('renders pinned messages in cards with sender, timestamp, and body', () => {
    const msg = baseMessage();
    render(<PinnedPanel messages={[msg]} />);

    expect(screen.getByText('Zeeshan Khan')).toBeInTheDocument();
    expect(screen.getByText(/Jun 5th at 5:38 PM/i)).toBeInTheDocument();
    expect(screen.getByText(/Fine jewelry/i)).toBeInTheDocument();
  });

  it('jumps to message when card content is clicked', async () => {
    const user = userEvent.setup();
    const onJump = vi.fn();
    const msg = baseMessage({ id: '$pinned-123' as any });

    render(<PinnedPanel messages={[msg]} onJump={onJump} />);

    await user.click(screen.getByText(/Fine jewelry/i));
    expect(onJump).toHaveBeenCalledWith('$pinned-123');
  });

  it('renders reactions and triggers onReact when clicked', async () => {
    const user = userEvent.setup();
    const onReact = vi.fn();
    const msg = baseMessage({
      reactions: [
        { key: '👍', count: 2, reactedByMe: false, senders: [] },
      ],
    });

    render(<PinnedPanel messages={[msg]} onReact={onReact} />);

    expect(screen.getByText('👍')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();

    await user.click(screen.getByText('👍'));
    expect(onReact).toHaveBeenCalledWith(msg.id, '👍', false);
  });

  it('triggers thread opening, save, and unpin from action bar', async () => {
    const user = userEvent.setup();
    const onOpenThread = vi.fn();
    const onToggleSave = vi.fn();
    const onUnpin = vi.fn();
    const msg = baseMessage({ id: '$pinned-action' as any });

    render(
      <PinnedPanel
        messages={[msg]}
        onOpenThread={onOpenThread}
        onToggleSave={onToggleSave}
        onUnpin={onUnpin}
      />,
    );

    // Click reply in thread
    const replyBtn = screen.getByRole('button', { name: 'Reply in thread' });
    await user.click(replyBtn);
    expect(onOpenThread).toHaveBeenCalledWith('$pinned-action');

    // Click save message
    const saveBtn = screen.getByRole('button', { name: 'Save message' });
    await user.click(saveBtn);
    expect(onToggleSave).toHaveBeenCalledWith('$pinned-action');

    // Click more options and unpin
    const moreBtn = screen.getByRole('button', { name: 'More options' });
    await user.click(moreBtn);

    const unpinItem = await screen.findByRole('menuitem', {
      name: /Unpin from channel/i,
    });
    expect(unpinItem).toBeInTheDocument();
    await user.click(unpinItem);
    expect(onUnpin).toHaveBeenCalledWith('$pinned-action');
  });
});

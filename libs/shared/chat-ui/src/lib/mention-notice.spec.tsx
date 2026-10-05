import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  MentionNotice,
  describeConversation,
  getMentionNoticeCopy,
  getMentionNoticeSuccess,
} from './mention-notice.js';
import type { MentionNoticeTarget } from './mention-notice-store.js';

const github: MentionNoticeTarget = {
  id: 'int-1',
  name: 'GitHub',
  kind: 'app',
  addAction: 'channel-app',
};
const alice: MentionNoticeTarget = {
  id: 'u-alice',
  name: 'Alice',
  kind: 'user',
  addAction: 'channel-member',
};
const bob: MentionNoticeTarget = {
  id: 'u-bob',
  name: 'Bob',
  kind: 'user',
  addAction: 'none',
};

describe('describeConversation', () => {
  it('names a public channel and hides a private one behind a phrase', () => {
    expect(describeConversation('channel', 'design')).toBe('#design');
    expect(describeConversation('channel', 'design', true)).toBe(
      'this private channel',
    );
    expect(describeConversation('thread', undefined)).toBe('this channel');
    expect(describeConversation('dm', 'Alice')).toBe('this conversation');
  });
});

describe('getMentionNoticeCopy', () => {
  it('says "it" for a single app in a private channel, like the reference', () => {
    const copy = getMentionNoticeCopy({
      targets: [github],
      surfaceKind: 'channel',
      conversationName: 'secret',
      isPrivate: true,
    });
    expect(copy.clause).toBe("but it isn't in this private channel.");
    expect(copy.detail).toBe("It won't see or act on your message until it's added.");
    expect(copy.actionLabel).toBe('Add to channel');
  });

  it('says "they" for a person', () => {
    const copy = getMentionNoticeCopy({
      targets: [alice],
      surfaceKind: 'channel',
      conversationName: 'general',
    });
    expect(copy.clause).toBe("but they aren't in #general.");
    expect(copy.detail).toBe("They won't be notified unless you add them.");
  });

  it('points a viewer without permission at a channel admin, with no button', () => {
    const copy = getMentionNoticeCopy({
      targets: [bob],
      surfaceKind: 'channel',
      conversationName: 'general',
    });
    expect(copy.actionLabel).toBeNull();
    expect(copy.detail).toMatch(/Only channel admins can add them/);
  });

  it('explains a partial add when only some targets can be added', () => {
    const copy = getMentionNoticeCopy({
      targets: [alice, bob],
      surfaceKind: 'channel',
      conversationName: 'general',
    });
    expect(copy.actionLabel).toBe('Add to channel');
    expect(copy.detail).toMatch(/rest need a channel admin/);
  });

  it('offers a group in a 1:1 DM', () => {
    const copy = getMentionNoticeCopy({
      targets: [{ ...alice, addAction: 'start-group' }],
      surfaceKind: 'dm',
    });
    expect(copy.actionLabel).toBe('Start a group');
  });

  it('has no action in a conversation with an agent', () => {
    const copy = getMentionNoticeCopy({
      targets: [{ ...alice, addAction: 'none' }],
      surfaceKind: 'agent',
      peerName: 'Helper',
    });
    expect(copy.clause).toBe(
      'but this conversation is just between you and @Helper.',
    );
    expect(copy.actionLabel).toBeNull();
  });
});

describe('getMentionNoticeSuccess', () => {
  it('confirms what was added and where', () => {
    expect(
      getMentionNoticeSuccess({
        targets: [github],
        surfaceKind: 'channel',
        conversationName: 'dev',
      }),
    ).toBe('Added @GitHub to #dev.');
    expect(
      getMentionNoticeSuccess({
        targets: [alice, github],
        surfaceKind: 'channel',
        conversationName: 'dev',
        isPrivate: true,
      }),
    ).toBe('Added @Alice and @GitHub to this channel.');
  });
});

describe('<MentionNotice>', () => {
  const baseProps = {
    targets: [github],
    surfaceKind: 'channel' as const,
    conversationName: 'secret',
    isPrivate: true,
    timestamp: Date.now(),
  };

  it('renders the ephemeral label, sentence and all three actions', () => {
    const onAdd = vi.fn();
    const onDismiss = vi.fn();
    const onDontShowAgain = vi.fn();
    render(
      <MentionNotice
        {...baseProps}
        onAdd={onAdd}
        onDismiss={onDismiss}
        onDontShowAgain={onDontShowAgain}
      />,
    );

    expect(screen.getByText('Only visible to you')).toBeTruthy();
    expect(screen.getByText('@GitHub')).toBeTruthy();
    expect(
      screen.getByText(/but it isn't in this private channel\./),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Add to channel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    fireEvent.click(screen.getByRole('button', { name: "Don't show again" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onDontShowAgain).toHaveBeenCalledTimes(1);
  });

  it('dismisses on Escape', () => {
    const onDismiss = vi.fn();
    render(<MentionNotice {...baseProps} onDismiss={onDismiss} />);
    fireEvent.keyDown(screen.getByRole('status'), { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('swaps the actions for a confirmation once added', () => {
    render(
      <MentionNotice
        {...baseProps}
        status="added"
        addedIds={[github.id]}
        onAdd={vi.fn()}
        onDismiss={vi.fn()}
        onDontShowAgain={vi.fn()}
      />,
    );
    expect(screen.getByText('Added @GitHub to this channel.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add to channel' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });

  it('offers a retry and shows the error after a failed add', () => {
    render(
      <MentionNotice
        {...baseProps}
        status="failed"
        error="Forbidden"
        onAdd={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Forbidden');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('renders nothing without targets', () => {
    const { container } = render(
      <MentionNotice {...baseProps} targets={[]} onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatrixClientEvent } from '@org/matrix-client';

const listeners: Array<(event: MatrixClientEvent) => void> = [];
const rooms = new Map<
  string,
  { id?: string; kind: string; name: string; directUserId?: string }
>();

const client = {
  getSession: vi.fn(() => ({ userId: '@me:hs' })),
  getRoom: vi.fn((roomId: string) => rooms.get(roomId) ?? null),
  isThreadMuted: vi.fn(() => false),
  on: vi.fn((listener: (event: MatrixClientEvent) => void) => {
    listeners.push(listener);
    return () => {
      const i = listeners.indexOf(listener);
      if (i >= 0) listeners.splice(i, 1);
    };
  }),
};

vi.mock('./matrix-provider.js', () => ({
  useMatrix: () => ({
    client,
    status: { state: 'connected' },
    enabled: true,
    error: null,
  }),
}));

const play = vi.fn();
const notify = vi.fn();
let claimed = true;
vi.mock('@org/notifications', () => ({
  claimNotification: () => claimed,
  notificationService: {
    notify: (...args: unknown[]) => notify(...args),
  },
  notificationSound: {
    play: (...args: unknown[]) => play(...args),
  },
}));

let activeRoomId: string | null = null;
vi.mock('./active-conversation.js', () => ({
  getActiveConversation: () => activeRoomId,
}));

import { ChatNotificationBridge } from './chat-notification-bridge.js';

const FUTURE = () => Date.now() + 60_000;

function setWindow({
  visible,
  focused,
}: {
  visible: boolean;
  focused: boolean;
}) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(
    visible ? 'visible' : 'hidden',
  );
  vi.spyOn(document, 'hasFocus').mockReturnValue(focused);
}

function emitMessage(message: Record<string, unknown>) {
  for (const listener of [...listeners]) {
    listener({ type: 'message.received', message } as MatrixClientEvent);
  }
}

function baseMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: `$evt-${Math.random()}`,
    roomId: '!chan:hs',
    senderId: '@alice:hs',
    senderName: 'Alice Smith',
    kind: 'text',
    body: 'hello',
    timestamp: FUTURE(),
    isMention: false,
    isRedacted: false,
    isEdited: false,
    ...overrides,
  };
}

beforeEach(() => {
  listeners.length = 0;
  rooms.clear();
  rooms.set('!chan:hs', { kind: 'channel', name: 'general' });
  rooms.set('!dm:hs', {
    id: '!dm:hs',
    kind: 'direct',
    name: 'Alice Smith',
    directUserId: '@alice:hs',
  });
  rooms.set('!group:hs', {
    id: '!group:hs',
    kind: 'group',
    name: 'Design crew',
  });
  activeRoomId = null;
  claimed = true;
  setWindow({ visible: true, focused: true });
  play.mockReset();
  notify.mockReset();
  client.getSession.mockReturnValue({ userId: '@me:hs' });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('ChatNotificationBridge', () => {
  it('shows a banner with sound for a channel message from someone else', () => {
    render(<ChatNotificationBridge />);
    emitMessage(baseMessage());
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0]).toMatchObject({
      title: 'Alice Smith in #general',
      body: 'hello',
      type: 'message',
      soundEvent: 'message',
      tag: 'chat:!chan:hs',
      silent: true,
    });
  });

  it('titles a DM with the sender and uses the dm cue', () => {
    render(<ChatNotificationBridge />);
    emitMessage(baseMessage({ roomId: '!dm:hs' }));
    expect(notify.mock.calls[0][0]).toMatchObject({
      title: 'Alice Smith',
      soundEvent: 'dm',
    });
  });

  it('raises the OS notification when the window is not focused', () => {
    setWindow({ visible: true, focused: false });
    render(<ChatNotificationBridge />);
    emitMessage(baseMessage());
    expect(notify.mock.calls[0][0]).toMatchObject({ silent: false });
  });

  it('lets a visible tab win: a hidden tab waits before claiming', () => {
    vi.useFakeTimers();
    setWindow({ visible: false, focused: false });
    render(<ChatNotificationBridge />);
    emitMessage(baseMessage());
    expect(notify).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(notify.mock.calls[0][0]).toMatchObject({ silent: false });
  });

  it('does nothing in a tab that lost the claim', () => {
    claimed = false;
    render(<ChatNotificationBridge />);
    emitMessage(baseMessage());
    expect(notify).not.toHaveBeenCalled();
  });

  it('opens the right conversation from the notification', () => {
    const onNavigate = vi.fn();
    render(
      <ChatNotificationBridge
        workspaceSlug="acme"
        channelRoutes={new Map([['!chan:hs', '/w/acme/channels/general']])}
        onNavigate={onNavigate}
      />,
    );
    emitMessage(baseMessage());
    emitMessage(baseMessage({ roomId: '!dm:hs' }));
    emitMessage(baseMessage({ roomId: '!group:hs', threadRootId: '$root' }));

    const [channel, dm, group] = notify.mock.calls.map((call) => call[0]);
    expect(channel.route).toBe('/w/acme/channels/general');
    expect(dm.route).toContain('/w/acme/dms/');
    expect(group.route).toBe('/w/acme/dms?room=!group%3Ahs&thread=%24root');
    expect(group.title).toBe('Alice Smith replied in Design crew');

    channel.onActivate();
    expect(onNavigate).toHaveBeenCalledWith('/w/acme/channels/general');
  });

  it('still notifies for a channel it has no route for', () => {
    render(
      <ChatNotificationBridge workspaceSlug="acme" onNavigate={vi.fn()} />,
    );
    emitMessage(baseMessage());
    expect(notify.mock.calls[0][0]).toMatchObject({
      route: undefined,
      onActivate: undefined,
    });
  });

  it.each([
    ['image', 'Sent a photo'],
    ['voice', 'Sent a voice message'],
  ])('describes a %s instead of showing its filename', (kind, body) => {
    render(<ChatNotificationBridge />);
    emitMessage(baseMessage({ kind, body: 'IMG_0042.png' }));
    expect(notify.mock.calls[0][0]).toMatchObject({ body });
  });

  it('never exposes an undecryptable message', () => {
    render(<ChatNotificationBridge />);
    emitMessage(baseMessage({ decryptionError: 'no key', body: '' }));
    expect(notify.mock.calls[0][0]).toMatchObject({
      body: 'Sent an encrypted message',
    });
  });

  it('stays quiet for the user\u2019s own message', () => {
    render(<ChatNotificationBridge />);
    emitMessage(baseMessage({ senderId: '@me:hs' }));
    expect(notify).not.toHaveBeenCalled();
  });

  it('stays quiet for a local echo / unsent message', () => {
    render(<ChatNotificationBridge />);
    emitMessage(baseMessage({ sendState: 'sending' }));
    emitMessage(baseMessage({ transactionId: 'txn1' }));
    expect(notify).not.toHaveBeenCalled();
  });

  it('stays quiet for backfilled history', () => {
    render(<ChatNotificationBridge />);
    emitMessage(baseMessage({ timestamp: Date.now() - 60_000 }));
    expect(notify).not.toHaveBeenCalled();
  });

  it('stays quiet for edits, redactions and system rows', () => {
    render(<ChatNotificationBridge />);
    emitMessage(baseMessage({ isEdited: true }));
    emitMessage(baseMessage({ isRedacted: true }));
    emitMessage(baseMessage({ structuredEvent: { type: 'mie.system_event' } }));
    expect(notify).not.toHaveBeenCalled();
  });

  it('stays quiet for a muted channel', () => {
    render(<ChatNotificationBridge mutedChannelNames={new Set(['general'])} />);
    emitMessage(baseMessage());
    expect(notify).not.toHaveBeenCalled();
  });

  it('stays quiet for a muted DM peer', () => {
    render(
      <ChatNotificationBridge mutedPeerNames={new Set(['alice smith'])} />,
    );
    emitMessage(baseMessage({ roomId: '!dm:hs' }));
    expect(notify).not.toHaveBeenCalled();
  });

  it('stays quiet during quiet hours', () => {
    render(<ChatNotificationBridge suppressed />);
    emitMessage(baseMessage());
    expect(notify).not.toHaveBeenCalled();
  });

  it('keeps the banner but drops the sound when workspace sounds are muted', () => {
    render(<ChatNotificationBridge soundMuted />);
    emitMessage(baseMessage());
    expect(notify.mock.calls[0][0]).toMatchObject({ soundEvent: 'none' });
  });

  it('under "mentions only", channel chatter is quiet but DMs and groups get through', () => {
    render(<ChatNotificationBridge mentionsOnly />);
    emitMessage(baseMessage());
    expect(notify).not.toHaveBeenCalled();
    emitMessage(baseMessage({ roomId: '!dm:hs' }));
    emitMessage(baseMessage({ roomId: '!group:hs' }));
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('honours a channel set to "Just mentions"', () => {
    render(
      <ChatNotificationBridge
        mentionsOnlyChannelNames={new Set(['general'])}
      />,
    );
    emitMessage(baseMessage());
    expect(notify).not.toHaveBeenCalled();
  });

  it('owns a channel mention, with who said it and the mention cue', () => {
    render(<ChatNotificationBridge />);
    emitMessage(baseMessage({ isMention: true }));
    expect(notify.mock.calls[0][0]).toMatchObject({
      title: 'Alice Smith mentioned you in #general',
      body: 'hello',
      priority: 'high',
      soundEvent: 'mention',
    });
  });

  it('lets a mention through "mentions only", workspace-wide or per channel', () => {
    render(
      <ChatNotificationBridge
        mentionsOnly
        mentionsOnlyChannelNames={new Set(['general'])}
      />,
    );
    emitMessage(baseMessage({ isMention: true }));
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('shows no banner for the conversation on screen, only the sound rule', () => {
    activeRoomId = '!chan:hs';
    render(<ChatNotificationBridge />);
    emitMessage(baseMessage());
    expect(notify).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalledWith(
      'message',
      expect.objectContaining({ isViewingConversation: true }),
    );
  });
});

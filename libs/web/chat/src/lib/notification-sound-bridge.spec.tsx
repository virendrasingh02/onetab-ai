import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatrixClientEvent } from '@org/matrix-client';

const listeners: Array<(event: MatrixClientEvent) => void> = [];
const rooms = new Map<string, { kind: string; name: string }>();

const client = {
  getSession: vi.fn(() => ({ userId: '@me:hs' })),
  getRoom: vi.fn((roomId: string) => rooms.get(roomId) ?? null),
  on: vi.fn((listener: (event: MatrixClientEvent) => void) => {
    listeners.push(listener);
    return () => {
      const i = listeners.indexOf(listener);
      if (i >= 0) listeners.splice(i, 1);
    };
  }),
};

vi.mock('./matrix-provider.js', () => ({
  useMatrix: () => ({ client, status: { state: 'connected' }, enabled: true, error: null }),
}));

const play = vi.fn();
vi.mock('@org/notifications', () => ({
  notificationSound: {
    play: (...args: unknown[]) => play(...args),
  },
}));

let activeRoomId: string | null = null;
vi.mock('./active-conversation.js', () => ({
  getActiveConversation: () => activeRoomId,
}));

import { NotificationSoundBridge } from './notification-sound-bridge.js';

const FUTURE = () => Date.now() + 60_000;

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
  rooms.set('!dm:hs', { kind: 'direct', name: 'Alice Smith' });
  activeRoomId = null;
  play.mockReset();
  client.getSession.mockReturnValue({ userId: '@me:hs' });
});

afterEach(() => vi.clearAllMocks());

describe('NotificationSoundBridge', () => {
  it('plays a message cue for a new channel message from someone else', () => {
    render(<NotificationSoundBridge />);
    emitMessage(baseMessage());
    expect(play).toHaveBeenCalledWith(
      'message',
      expect.objectContaining({ isViewingConversation: false }),
    );
  });

  it('plays a dm cue for a direct message', () => {
    render(<NotificationSoundBridge />);
    emitMessage(baseMessage({ roomId: '!dm:hs' }));
    expect(play).toHaveBeenCalledWith('dm', expect.any(Object));
  });

  it('stays silent for the user’s own message', () => {
    render(<NotificationSoundBridge />);
    emitMessage(baseMessage({ senderId: '@me:hs' }));
    expect(play).not.toHaveBeenCalled();
  });

  it('stays silent for a local echo / unsent message', () => {
    render(<NotificationSoundBridge />);
    emitMessage(baseMessage({ sendState: 'sending' }));
    emitMessage(baseMessage({ transactionId: 'txn-1' }));
    expect(play).not.toHaveBeenCalled();
  });

  it('stays silent for backfilled history', () => {
    render(<NotificationSoundBridge />);
    emitMessage(baseMessage({ timestamp: Date.now() - 60_000 }));
    expect(play).not.toHaveBeenCalled();
  });

  it('stays silent for edits and redactions', () => {
    render(<NotificationSoundBridge />);
    emitMessage(baseMessage({ isEdited: true }));
    emitMessage(baseMessage({ isRedacted: true }));
    expect(play).not.toHaveBeenCalled();
  });

  it('stays silent for a muted channel', () => {
    render(
      <NotificationSoundBridge mutedChannelNames={new Set(['general'])} />,
    );
    emitMessage(baseMessage());
    expect(play).not.toHaveBeenCalled();
  });

  it('stays silent for a muted DM peer', () => {
    render(
      <NotificationSoundBridge mutedPeerNames={new Set(['alice smith'])} />,
    );
    emitMessage(baseMessage({ roomId: '!dm:hs' }));
    expect(play).not.toHaveBeenCalled();
  });

  it('stays silent when suppressed (quiet hours / focus / workspace mute)', () => {
    render(<NotificationSoundBridge suppressed />);
    emitMessage(baseMessage());
    expect(play).not.toHaveBeenCalled();
  });

  it('under "mentions only", a plain message is silent', () => {
    render(<NotificationSoundBridge mentionsOnly />);
    emitMessage(baseMessage());
    expect(play).not.toHaveBeenCalled();
  });

  it('never plays for a channel mention (the server notification owns it)', () => {
    render(<NotificationSoundBridge />);
    emitMessage(baseMessage({ isMention: true }));
    expect(play).not.toHaveBeenCalled();
  });

  it('flags isViewingConversation when that room is on screen', () => {
    activeRoomId = '!chan:hs';
    vi.spyOn(document, 'hasFocus').mockReturnValue(true);
    render(<NotificationSoundBridge />);
    emitMessage(baseMessage());
    expect(play).toHaveBeenCalledWith(
      'message',
      expect.objectContaining({ isViewingConversation: true }),
    );
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { CallManager, classifyCallQuality, isCallLive } from './calls.js';
import type { OneTabMatrixClient } from './matrix-client.js';
import type { Room } from './types.js';

describe('CallManager', () => {
  let mockClient: Partial<OneTabMatrixClient>;
  let mockRoom: Room;
  let manager: CallManager;

  beforeEach(() => {
    mockRoom = {
      id: '!room123:homeserver',
      name: 'Direct Message',
      kind: 'direct',
      topic: null,
      avatarUrl: null,
      unreadCount: 0,
      highlightCount: 0,
      memberCount: 2,
    };

    mockClient = {
      getRoom: vi.fn((id: string) => (id === mockRoom.id ? mockRoom : null)),
      getSdk: vi.fn(),
    };

    manager = new CallManager(mockClient as OneTabMatrixClient);
  });

  it('rejects startCall early when the room does not exist', async () => {
    vi.spyOn(CallManager, 'isSupported').mockReturnValue(true);

    await expect(
      manager.startCall('!nonexistent:hs', 'voice'),
    ).rejects.toThrow('That room is not available.');
  });

  it('rejects startCall if WebRTC is unsupported', async () => {
    vi.spyOn(CallManager, 'isSupported').mockReturnValue(false);

    await expect(
      manager.startCall('!room123:homeserver', 'voice'),
    ).rejects.toThrow('This browser cannot make calls');
  });

  it('handles incoming call and updates active call state to ringing', () => {
    const listener = vi.fn();
    manager.on(listener);

    const mockMatrixCall: any = {
      callId: 'call_123',
      roomId: '!room123:homeserver',
      type: 'video',
      on: vi.fn(),
      getOpponentMember: vi.fn(() => ({ userId: '@bob:homeserver' })),
    };

    manager.handleIncomingCall(mockMatrixCall);

    const active = manager.getActiveCall();
    expect(active).not.toBeNull();
    expect(active?.id).toBe('call_123');
    expect(active?.roomId).toBe('!room123:homeserver');
    expect(active?.kind).toBe('video');
    expect(active?.state).toBe('ringing');
    expect(active?.isIncoming).toBe(true);
    expect(active?.remoteUserId).toBe('@bob:homeserver');
    expect(listener).toHaveBeenCalledWith(active);
  });

  it('allows answering an incoming call', async () => {
    const mockMatrixCall: any = {
      callId: 'call_123',
      roomId: '!room123:homeserver',
      type: 'voice',
      on: vi.fn(),
      answer: vi.fn().mockResolvedValue(undefined),
      getOpponentMember: vi.fn(() => ({ userId: '@bob:homeserver' })),
    };

    manager.handleIncomingCall(mockMatrixCall);
    await manager.answerCall();

    expect(mockMatrixCall.answer).toHaveBeenCalledWith(true, false);
    expect(manager.getActiveCall()?.state).toBe('connecting');
  });

  it('allows rejecting an incoming call', () => {
    const mockMatrixCall: any = {
      callId: 'call_123',
      roomId: '!room123:homeserver',
      type: 'voice',
      on: vi.fn(),
      reject: vi.fn(),
      getOpponentMember: vi.fn(() => ({ userId: '@bob:homeserver' })),
    };

    manager.handleIncomingCall(mockMatrixCall);
    manager.rejectCall();

    expect(mockMatrixCall.reject).toHaveBeenCalled();
    expect(manager.getActiveCall()?.state).toBe('rejected');
  });

  it('allows hanging up an active call and cleaning up tracks', () => {
    const stopTrack = vi.fn();
    const mockStream: any = {
      getTracks: () => [{ stop: stopTrack }],
    };

    const mockMatrixCall: any = {
      callId: 'call_123',
      roomId: '!room123:homeserver',
      type: 'voice',
      on: vi.fn(),
      hangup: vi.fn(),
      localUsermediaStream: mockStream,
      getOpponentMember: vi.fn(() => ({ userId: '@bob:homeserver' })),
    };

    manager.handleIncomingCall(mockMatrixCall);
    manager.hangUp();

    expect(mockMatrixCall.hangup).toHaveBeenCalled();
    expect(stopTrack).toHaveBeenCalled();
    expect(manager.getActiveCall()?.state).toBe('ended');
    expect(manager.getLocalStream()).toBeNull();
    expect(manager.getRemoteStream()).toBeNull();
  });

  it('toggles mute, video and screensharing on active call', async () => {
    const mockMatrixCall: any = {
      callId: 'call_123',
      roomId: '!room123:homeserver',
      type: 'video',
      on: vi.fn(),
      setMicrophoneMuted: vi.fn().mockResolvedValue(undefined),
      setLocalVideoMuted: vi.fn().mockResolvedValue(undefined),
      setScreensharingEnabled: vi.fn().mockResolvedValue(true),
      getOpponentMember: vi.fn(() => ({ userId: '@bob:homeserver' })),
    };

    manager.handleIncomingCall(mockMatrixCall);

    await manager.setMuted(true);
    expect(manager.isMuted()).toBe(true);
    expect(mockMatrixCall.setMicrophoneMuted).toHaveBeenCalledWith(true);

    await manager.setVideoEnabled(false);
    expect(manager.isVideoEnabled()).toBe(false);
    expect(mockMatrixCall.setLocalVideoMuted).toHaveBeenCalledWith(true);

    const screenOk = await manager.setScreensharingEnabled(true);
    expect(screenOk).toBe(true);
    expect(manager.isScreensharing()).toBe(true);
  });

  it('answers a second incoming call with user_busy while one is in progress', () => {
    const call1: any = {
      callId: 'call_1',
      roomId: '!room123:homeserver',
      type: 'voice',
      on: vi.fn(),
      getOpponentMember: vi.fn(() => ({ userId: '@alice:homeserver' })),
    };
    manager.handleIncomingCall(call1);

    const call2: any = {
      callId: 'call_2',
      roomId: '!room123:homeserver',
      type: 'video',
      on: vi.fn(),
      hangup: vi.fn(),
      getOpponentMember: vi.fn(() => ({ userId: '@bob:homeserver' })),
    };

    manager.handleIncomingCall(call2);
    expect(call2.hangup).toHaveBeenCalledWith('user_busy', false);
    expect(manager.getActiveCall()?.id).toBe('call_1');
  });

  it('accepts a new call once the previous one timed out', () => {
    vi.useFakeTimers();
    try {
      const first: any = {
        callId: 'call_first',
        roomId: '!room123:homeserver',
        type: 'voice',
        on: vi.fn(),
        reject: vi.fn(),
        getOpponentMember: vi.fn(() => ({ userId: '@alice:homeserver' })),
      };
      manager.handleIncomingCall(first);
      vi.advanceTimersByTime(60_000);
      expect(manager.getActiveCall()?.state).toBe('timeout');

      const next: any = {
        callId: 'call_next',
        roomId: '!room123:homeserver',
        type: 'voice',
        on: vi.fn(),
        hangup: vi.fn(),
        getOpponentMember: vi.fn(() => ({ userId: '@bob:homeserver' })),
      };
      manager.handleIncomingCall(next);
      expect(next.hangup).not.toHaveBeenCalled();
      expect(manager.getActiveCall()?.id).toBe('call_next');
      expect(manager.getActiveCall()?.state).toBe('ringing');
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores late events from a call that has been replaced', () => {
    const handlers = new Map<string, (arg: unknown) => void>();
    const old: any = {
      callId: 'call_old',
      roomId: '!room123:homeserver',
      type: 'voice',
      on: vi.fn((event: string, cb: (arg: unknown) => void) => handlers.set(event, cb)),
      hangup: vi.fn(),
      getOpponentMember: vi.fn(() => ({ userId: '@alice:homeserver' })),
    };
    manager.handleIncomingCall(old);
    manager.hangUp();

    const fresh: any = {
      callId: 'call_fresh',
      roomId: '!room123:homeserver',
      type: 'voice',
      on: vi.fn(),
      getOpponentMember: vi.fn(() => ({ userId: '@bob:homeserver' })),
    };
    manager.handleIncomingCall(fresh);

    // The old call's SDK object reports its own end after the fact.
    handlers.get('state')?.('ended');
    expect(manager.getActiveCall()?.id).toBe('call_fresh');
    expect(manager.getActiveCall()?.state).toBe('ringing');
  });

  it('tells live calls from finished ones', () => {
    expect(isCallLive('ringing')).toBe(true);
    expect(isCallLive('connected')).toBe(true);
    for (const state of ['ended', 'rejected', 'failed', 'timeout', 'busy'] as const) {
      expect(isCallLive(state)).toBe(false);
    }
    expect(isCallLive(null)).toBe(false);
  });

  it('grades connection quality from round-trip time and packet loss', () => {
    expect(classifyCallQuality(40, 0)).toBe('excellent');
    expect(classifyCallQuality(250, 0.01)).toBe('good');
    expect(classifyCallQuality(80, 0.05)).toBe('good');
    expect(classifyCallQuality(600, 0)).toBe('poor');
    expect(classifyCallQuality(50, 0.2)).toBe('poor');
  });

  it('returns empty list or enumerated devices', async () => {
    const devices = await manager.getDevices();
    expect(Array.isArray(devices)).toBe(true);
  });
});
